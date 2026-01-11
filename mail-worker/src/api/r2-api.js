import app from '../hono/hono';
import storageService from "../service/storage-service";

app.get('/oss/*', async (c) => {
	const key = c.req.path.split('/oss/')[1];
	return await storageService.toObjResp(c, key);
});
