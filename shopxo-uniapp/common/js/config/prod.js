import { build_runtime_config } from './runtime-config.js';

const config = build_runtime_config();

if (!config.request_url) {
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
