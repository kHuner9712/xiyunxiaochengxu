import { jest } from '@jest/globals';

jest.setTimeout(10000);

jest.mock('@nestjs/config', () => ({
  ConfigService: jest.fn().mockImplementation(() => ({
    get: jest.fn((key: string, defaultValue?: any) => {
      const env: Record<string, string> = {
        NODE_ENV: 'test',
        JWT_SECRET: 'test_jwt_secret_key_that_is_long_enough_32chars',
        DATABASE_URL: 'mysql://test:test@localhost:3306/test',
        REDIS_HOST: 'localhost',
        REDIS_PORT: '6379',
        WECHAT_APP_ID: 'test_app_id',
        WECHAT_APP_SECRET: 'test_app_secret',
        WECHAT_MCH_ID: 'test_mch_id',
        WECHAT_API_V3_KEY: 'test_api_v3_key_32_chars_long',
        WECHAT_MCH_SERIAL_NO: 'test_serial_no',
        CORS_ORIGINS: 'http://localhost:3000',
        WECHAT_NOTIFY_URL: 'http://localhost:3000/api/weapp/pay/callback',
        WECHAT_REFUND_NOTIFY_URL: 'http://localhost:3000/api/weapp/pay/refund-callback',
        WECHAT_SKIP_VERIFY: 'true',
      };
      return env[key] ?? defaultValue;
    }),
  })),
  ConfigModule: {
    forRoot: jest.fn().mockReturnValue({}),
  },
}));

beforeAll(() => {
  process.env.NODE_ENV = 'test';
});

afterAll(() => {
  jest.clearAllMocks();
});
