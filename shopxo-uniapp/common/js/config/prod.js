import { build_runtime_config, get_default_dev_request_url } from './runtime-config.js';

const config = build_runtime_config({
    default_request_url: process.env.NODE_ENV === 'production' ? '' : get_default_dev_request_url(),
});

if (process.env.NODE_ENV === 'production' && !config.request_url) {
    console.error(
        [
            '[CONFIG][PROD] Missing UNI_APP_REQUEST_URL.',
            'Release build requires backend API base URL.',
            'How to configure:',
            '1) HBuilderX publish dialog -> env vars: UNI_APP_REQUEST_URL=https://api.example.com/',
            '2) CLI build -> set .env.production/.env.staging or export env var before build',
            '3) Ensure this domain is in WeChat mini-program legal request domains',
        ].join('\n')
    );
}

export default config;
