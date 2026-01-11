import s3Service from './s3-service';
import settingService from './setting-service';
import kvObjService from './kv-obj-service';

const storageService = {

    async storageType(c) {
        const setting = await settingService.query(c);
        const { bucket, endpoint, s3AccessKey, s3SecretKey } = setting;

        if (!!(bucket && endpoint && s3AccessKey && s3SecretKey)) {
            return 'S3';
        }

        if (c.env.r2) {
            return 'R2';
        }

        return 'KV';
    },

    async toObjResp(c, key) {
        const storageType = await this.storageType(c);

        if (storageType === 'KV') {
            return await kvObjService.toObjResp(c, key);
        }

        if (storageType === 'R2') {
            const object = await c.env.r2.get(key);
            
            if (object === null) {
                return new Response('Object Not Found', { status: 404 });
            }

            const headers = new Headers();
            object.writeHttpMetadata(headers);
            headers.set('etag', object.httpEtag);

            return new Response(object.body, {
                headers,
            });
        }

        if (storageType === 'S3') {
            try {
                const { Body, ContentType, ContentLength, ETag, CacheControl, ContentDisposition } = await s3Service.getObj(c, key);
                
                const headers = new Headers();
                if (ContentType) headers.set('Content-Type', ContentType);
                if (ContentLength) headers.set('Content-Length', ContentLength.toString());
                if (ETag) headers.set('ETag', ETag);
                if (CacheControl) headers.set('Cache-Control', CacheControl);
                if (ContentDisposition) headers.set('Content-Disposition', ContentDisposition);

                return new Response(Body, {
                    headers
                });
            } catch (e) {
                console.error('S3 getObj error', e);
                // 检查是否是 404
                if (e.name === 'NoSuchKey' || e.$metadata?.httpStatusCode === 404) {
                     return new Response('Object Not Found', { status: 404 });
                }
                return new Response('Internal Server Error', { status: 500 });
            }
        }
        
        return new Response('Storage Not Configured', { status: 500 });
    }
};

export default storageService;
