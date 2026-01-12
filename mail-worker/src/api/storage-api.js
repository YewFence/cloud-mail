import app from '../hono/hono';
import storageService from "../service/storage-service";

app.get('/attachments/*', async (c) => {
	// 移除开头的 / 得到 key, 例如 /attachments/xxx -> attachments/xxx
	const key = c.req.path.substring(1);
	return await storageService.toObjResp(c, key);
});

app.get('/static/*', async (c) => {
	const key = c.req.path.substring(1);
	return await storageService.toObjResp(c, key);
});

