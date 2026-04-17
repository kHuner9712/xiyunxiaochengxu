var request_url = process.env.UNI_APP_REQUEST_URL || '';

if (!request_url) {
    console.error('[PROD] UNI_APP_REQUEST_URL 未设置，生产构建必须配置后端地址');
}

export default {
    request_url: request_url,
    static_url: process.env.UNI_APP_STATIC_URL || '',
};
