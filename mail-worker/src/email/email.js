import PostalMime from 'postal-mime';
import emailService from '../service/email-service';
import accountService from '../service/account-service';
import settingService from '../service/setting-service';
import attService from '../service/att-service';
import constant from '../const/constant';
import fileUtils from '../utils/file-utils';
import { emailConst, isDel, roleConst, settingConst } from '../const/entity-const';
import emailUtils from '../utils/email-utils';
import roleService from '../service/role-service';
import verifyUtils from '../utils/verify-utils';
import r2Service from '../service/r2-service';
import userService from '../service/user-service';
import telegramService from '../service/telegram-service';
import orm from '../entity/orm';
import { account as accountTable } from '../entity/account';

export async function email(message, env, ctx) {

	try {

		const {
			receive,
			tgChatId,
			tgBotStatus,
			forwardStatus,
			forwardEmail,
			ruleEmail,
			ruleType,
			r2Domain,
			noRecipient,
			autoCreate
		} = await settingService.query({ env });

		if (receive === settingConst.receive.CLOSE) {
			message.setReject('Service suspended');
			return;
		}


		const reader = message.raw.getReader();
		let content = '';

		while (true) {
			const { done, value } = await reader.read();
			if (done) break;
			content += new TextDecoder().decode(value);
		}

		const email = await PostalMime.parse(content);

		let account = await accountService.selectByEmailIncludeDel({ env: env }, message.to);

		if (!account) {
			if (noRecipient === settingConst.noRecipient.CLOSE) {
				message.setReject('Recipient not found');
				return;
			}
			// 自动创建邮箱
			if (autoCreate === settingConst.autoCreate.OPEN) {
				const adminUser = await userService.selectByEmail({ env: env }, env.admin);
				if (adminUser) {
					account = await orm({ env }).insert(accountTable).values({
						email: message.to,
						userId: adminUser.userId,
						name: emailUtils.getName(message.to)
					}).returning().get();
				}
			}
		}

		let userRow = {}

		if (account) {
			 userRow = await userService.selectById({ env: env }, account.userId);
		}

		if (account && userRow.email !== env.admin) {

			let { banEmail, banEmailType, availDomain } = await roleService.selectByUserId({ env: env }, account.userId);

			if (!roleService.hasAvailDomainPerm(availDomain, message.to)) {
				message.setReject('Mailbox disabled');
				return;
			}

			banEmail = banEmail.split(',').filter(item => item !== '');


			if (banEmail.includes('*')) {

				if (!banEmailHandler(banEmailType, message, email)) return;

			}

			for (const item of banEmail) {

				if (verifyUtils.isDomain(item)) {

					const banDomain = item.toLowerCase();
					const receiveDomain = emailUtils.getDomain(email.from.address.toLowerCase());

					if (banDomain === receiveDomain) {

						if (!banEmailHandler(banEmailType, message, email)) return;

					}

				} else {

					if (item.toLowerCase() === email.from.address.toLowerCase()) {

						if (!banEmailHandler(banEmailType, message, email)) return;

					}

				}

			}

		}


		if (!email.to) {
			email.to = [{ address: message.to, name: emailUtils.getName(message.to)}]
		}

		const toName = email.to.find(item => item.address === message.to)?.name || '';

		const params = {
			toEmail: message.to,
			toName: toName,
			sendEmail: email.from.address,
			name: email.from.name || emailUtils.getName(email.from.address),
			subject: email.subject,
			content: email.html,
			text: email.text,
			cc: email.cc ? JSON.stringify(email.cc) : '[]',
			bcc: email.bcc ? JSON.stringify(email.bcc) : '[]',
			recipient: JSON.stringify(email.to),
			inReplyTo: email.inReplyTo,
			relation: email.references,
			messageId: email.messageId,
			userId: account ? account.userId : 0,
			accountId: account ? account.accountId : 0,
			isDel: isDel.DELETE,
			status: emailConst.status.SAVING
		};

		const attachments = [];
		const cidAttachments = [];

		for (let item of email.attachments) {
			let attachment = { ...item };
			attachment.key = constant.ATTACHMENT_PREFIX + await fileUtils.getBuffHash(attachment.content) + fileUtils.getExtFileName(item.filename);
			attachment.size = item.content.length ?? item.content.byteLength;
			attachments.push(attachment);
			if (attachment.contentId) {
				cidAttachments.push(attachment);
			}
		}

		let emailRow = await emailService.receive({ env }, params, cidAttachments, r2Domain);

		attachments.forEach(attachment => {
			attachment.emailId = emailRow.emailId;
			attachment.userId = emailRow.userId;
			attachment.accountId = emailRow.accountId;
		});

		try {
			if (attachments.length > 0 && await r2Service.hasOSS({ env })) {
				await attService.addAtt({ env }, attachments);
			}
		} catch (e) {
			console.error(e);
		}

		emailRow = await emailService.completeReceive({ env }, account ? emailConst.status.RECEIVE : emailConst.status.NOONE, emailRow.emailId);


		if (ruleType === settingConst.ruleType.RULE) {

			const emails = ruleEmail.split(',');

			if (!emails.includes(message.to)) {
				return;
			}

		}

		//转发到TG
		if (tgBotStatus === settingConst.tgBotStatus.OPEN && tgChatId) {
			await telegramService.sendEmailToBot({ env }, emailRow)
		}

		//转发到其他邮箱
		if (forwardStatus === settingConst.forwardStatus.OPEN && forwardEmail) {

			const emails = forwardEmail.split(',');

			await Promise.all(emails.map(async email => {

				try {
					await message.forward(email);
				} catch (e) {
					console.error(`转发邮箱 ${email} 失败：`, e);
				}

			}));

		}

	} catch (e) {

		console.error('邮件接收异常: ', e);
	}
}

function banEmailHandler(banEmailType, message, email) {

	if (banEmailType === roleConst.banEmailType.ALL) {
		message.setReject('Mailbox disabled');
		return false;
	}

	if (banEmailType === roleConst.banEmailType.CONTENT) {
		email.html = 'The content has been deleted';
		email.text = 'The content has been deleted';
		email.attachments = [];
	}

	return true;

}
