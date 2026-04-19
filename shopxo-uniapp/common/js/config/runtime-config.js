const DEFAULT_DEV_REQUEST_URL = 'http://localhost:8080/';

const normalize_base_url = (value) => {
    const raw = (value || '').trim();
    if (!raw) {
        return '';
    }
    return raw.endsWith('/') ? raw : `${raw}/`;
};

const read_env = (name) => (process.env[name] || '').trim();

const build_runtime_config = ({ default_request_url = '' } = {}) => {
    const request_url = normalize_base_url(read_env('UNI_APP_REQUEST_URL') || default_request_url);
    const static_url = normalize_base_url(read_env('UNI_APP_STATIC_URL'));

    return {
        request_url,
        static_url,
    };
};

export {
    DEFAULT_DEV_REQUEST_URL,
    normalize_base_url,
    build_runtime_config,
};
