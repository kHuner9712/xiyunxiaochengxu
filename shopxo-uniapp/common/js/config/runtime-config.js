const DEFAULT_DEV_REQUEST_URL_H5 = 'http://localhost:8080/';
const DEFAULT_DEV_REQUEST_URL_NON_H5 = 'http://127.0.0.1:8080/';

const get_default_dev_request_url = () => {
    // #ifdef H5
    return DEFAULT_DEV_REQUEST_URL_H5;
    // #endif
    // #ifndef H5
    // For local mini-program debugging in WeChat DevTools on desktop,
    // fallback to loopback backend when env injection is unavailable.
    return DEFAULT_DEV_REQUEST_URL_NON_H5;
    // #endif
};

const normalize_base_url = (value) => {
    const raw = (value || '').trim();
    if (!raw) {
        return '';
    }
    return raw.endsWith('/') ? raw : `${raw}/`;
};

const read_env = (name) => {
    const direct = (process.env[name] || '').trim();
    if (direct) {
        return direct;
    }
    // HBuilderX / vue-cli only inject custom env keys with VUE_APP_ prefix.
    return (process.env[`VUE_APP_${name}`] || '').trim();
};

const build_runtime_config = ({ default_request_url = '' } = {}) => {
    const env_url = read_env('UNI_APP_REQUEST_URL');
    const request_url = normalize_base_url(env_url || default_request_url);
    const static_url = normalize_base_url(read_env('UNI_APP_STATIC_URL'));

    if (!env_url && !default_request_url) {
        console.warn(
            '[CONFIG] UNI_APP_REQUEST_URL 未配置，接口请求将失败。\n' +
            '请在 .env.development 或 HBuilderX 运行配置中设置 UNI_APP_REQUEST_URL 为后端地址，\n' +
            '例如：UNI_APP_REQUEST_URL=http://192.168.1.100:8080/'
        );
    }

    return {
        request_url,
        static_url,
    };
};

export {
    DEFAULT_DEV_REQUEST_URL_H5,
    DEFAULT_DEV_REQUEST_URL_NON_H5,
    get_default_dev_request_url,
    normalize_base_url,
    build_runtime_config,
};
