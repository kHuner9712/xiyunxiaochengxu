import { build_runtime_config, get_default_dev_request_url, ENV_PRODUCTION } from './runtime-config.js';

var config = build_runtime_config({
    default_request_url: process.env.NODE_ENV === 'production' ? '' : get_default_dev_request_url(),
});

if (process.env.NODE_ENV === 'production' && !config.request_url) {
    console.error(
        [
            '[CONFIG][PROD] UNI_APP_REQUEST_URL 未配置，生产构建无法运行。',
            '配置方式：',
            '1) HBuilderX 发行对话框 → 环境变量：UNI_APP_REQUEST_URL=https://api.example.com/',
            '2) CLI 构建 → 设置 .env.production 或 export 环境变量',
            '3) 确保该域名已加入微信小程序 request 合法域名',
        ].join('\n')
    );
}

if (process.env.NODE_ENV === 'production' && !config.wx_appid) {
    console.error(
        '[CONFIG][PROD] UNI_APP_WX_APPID 未配置，正式发布前必须在 .env.production 中设置正式 AppID'
    );
}

export default config;
