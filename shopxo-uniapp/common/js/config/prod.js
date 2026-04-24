// [MUYING-二开] 生产环境配置 — 强校验版
// 当 NODE_ENV=production 时，缺少必填配置直接 throw Error 阻止构建
import { build_runtime_config, get_default_dev_request_url, ENV_PRODUCTION } from './runtime-config.js';

var config = build_runtime_config({
    default_request_url: process.env.NODE_ENV === 'production' ? '' : get_default_dev_request_url(),
});

if (process.env.NODE_ENV === 'production') {
    if (!config.request_url) {
        throw new Error(
            '[CONFIG][PROD] UNI_APP_REQUEST_URL 未配置，生产构建终止。\n' +
            '配置方式：\n' +
            '1) HBuilderX 发行对话框 → 环境变量：UNI_APP_REQUEST_URL=https://api.example.com/\n' +
            '2) CLI 构建 → 设置 .env.production 或 export 环境变量\n' +
            '3) 确保该域名已加入微信小程序 request 合法域名'
        );
    }

    if (config.request_url.indexOf('https://') !== 0) {
        throw new Error(
            '[CONFIG][PROD] 生产环境 request_url 必须以 https:// 开头，当前值: ' + config.request_url
        );
    }

    if (!config.wx_appid) {
        throw new Error(
            '[CONFIG][PROD] UNI_APP_WX_APPID 未配置，生产构建终止。' +
            '必须在 .env.production 中设置正式 AppID'
        );
    }
}

export default config;
