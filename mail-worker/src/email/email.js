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

	let autoCreateAdminEmail;
	let autoCreateAdminUserId = null;

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

		autoCreateAdminEmail = env && env.admin;
		let account = await accountService.selectByEmailIncludeDel({ env: env }, message.to);

		if (!account) {
			if (noRecipient === settingConst.noRecipient.CLOSE) {
				message.setReject('Recipient not found');
				return;
			}
			// 自动创建邮箱
			if (autoCreate === settingConst.autoCreate.OPEN) {
				const result = await tryAutoCreateAccount({
					env,
					toEmail: message.to,
					adminEmail: autoCreateAdminEmail
				});
				account = result.account;
				autoCreateAdminUserId = result.adminUserId;
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
			if (attachments.length > 0) {
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

		if (isUniqueConstraintError(e)) {
			console.error('Unique constraint violation during receive', {
				to: message?.to,
				admin: autoCreateAdminEmail,
				userId: autoCreateAdminUserId,
				error: e?.message,
				stack: e?.stack
			});
		}
		console.error('邮件接收异常: ', e);
		throw e
	}
}

function isUniqueConstraintError(error) {
	if (!error) return false;
	const code = error.code || '';
	const message = error.message || '';
	return code === 'SQLITE_CONSTRAINT'
		|| code === 'SQLITE_CONSTRAINT_UNIQUE'
		|| message.includes('SQLITE_CONSTRAINT')
		|| message.includes('UNIQUE constraint failed');
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

/**
 * 尝试自动创建账户
 * @param {Object} params - 参数对象
 * @param {Object} params.env - 环境对象
 * @param {string} params.toEmail - 收件人邮箱地址
 * @param {string} params.adminEmail - 管理员邮箱地址
 * @returns {Promise<{account: Object|null, adminUserId: number|null}>} 返回创建的账户和管理员用户ID
 */
async function tryAutoCreateAccount({ env, toEmail, adminEmail }) {
	console.info('Auto-create account attempt', { to: toEmail, adminEmail });

	// 验证管理员邮箱是否有效
	if (!adminEmail || !verifyUtils.isEmail(adminEmail)) {
		console.error('Auto-create enabled but env.admin is missing or invalid', {
			to: toEmail,
			admin: adminEmail
		});
		return { account: null, adminUserId: null };
	}

	// 查询管理员用户
	const adminUser = await userService.selectByEmail({ env }, adminEmail);
	if (!adminUser) {
		console.error('Auto-create enabled but admin user not found', {
			to: toEmail,
			admin: adminEmail
		});
		return { account: null, adminUserId: null };
	}

	// 尝试创建账户
	try {
		let account = await orm({ env }).insert(accountTable).values({
			email: toEmail,
			userId: adminUser.userId,
			name: emailUtils.getName(toEmail)
		}).onConflictDoNothing().returning().get();

		// 如果因为冲突未创建,则重新加载账户
		if (!account) {
			console.info('Auto-create ignored due to conflict, reloading account', {
				to: toEmail,
				admin: adminEmail,
				userId: adminUser.userId
			});
			account = await accountService.selectByEmailIncludeDel({ env }, toEmail);
		}

		return { account, adminUserId: adminUser.userId };
	} catch (e) {
		console.error('Auto-create account insert failed', {
			to: toEmail,
			admin: adminEmail,
			userId: adminUser.userId,
			error: e?.message,
			stack: e?.stack
		});
		return { account: null, adminUserId: adminUser.userId };
	}
}
