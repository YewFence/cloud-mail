import app from '../hono/hono';
import result from "../model/result";
import oauthService from "../service/oauth-service";
import BizError from "../error/biz-error";

// LinuxDo OAuth 登录
app.post('/oauth/linuxDo/login', async (c) => {
	// 检查LinuxDo功能是否启用
	if (!c.env.linuxdo_client_id || !c.env.linuxdo_client_secret || !c.env.linuxdo_callback_url) {
		throw new BizError('LinuxDo OAuth is not enabled');
	}
	const loginInfo = await oauthService.linuxDoLogin(c, await c.req.json());
	return c.json(result.ok(loginInfo))
});

// 绑定用户
app.put('/oauth/bindUser', async (c) => {
	const loginInfo = await oauthService.bindUser(c, await c.req.json());
	return c.json(result.ok(loginInfo))
})
