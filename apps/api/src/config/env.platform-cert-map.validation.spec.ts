import { afterEach, describe, expect, it, jest } from '@jest/globals';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { validateEnv } from './env.validation';

function createProductionEnv(overrides: Record<string, unknown> = {}) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'baby-mall-cert-map-'));
  const privateKeyPath = path.join(tmpDir, 'apiclient_key.pem');
  const platformCertPath = path.join(tmpDir, 'wechatpay_platform.pem');
  fs.writeFileSync(privateKeyPath, 'test-private-key');
  fs.writeFileSync(platformCertPath, 'test-platform-cert');

  const env: Record<string, any> = {
    NODE_ENV: 'production',
    DATABASE_URL: 'mysql://root:strong_password@localhost:3306/baby_mall',
    REDIS_HOST: 'localhost',
    REDIS_PASSWORD: 'Redis_Strong_Password_2026!',
    JWT_SECRET: 'JwTk_qwertyuiopasdfghjklzxcvbnm9081726354',
    REFRESH_TOKEN_SECRET: 'RfTk_mnbvcxzlkjhgfdsapoiuytrewq9081726354',
    WECHAT_APP_ID: 'wx1234567890abcdef',
    WECHAT_APP_SECRET: 'test_app_secret',
    WECHAT_MCH_ID: '1234567890',
    WECHAT_MCH_SERIAL_NO: 'merchant-serial-123',
    WECHAT_API_V3_KEY: '0123456789abcdef0123456789abcdef',
    WECHAT_PRIVATE_KEY_PATH: privateKeyPath,
    WECHAT_PLATFORM_CERT_PATH: platformCertPath,
    WECHAT_PLATFORM_CERT_SERIAL_NO: 'platform-serial-123',
    WECHAT_NOTIFY_URL: 'https://api.example.com/api/weapp/pay/callback',
    WECHAT_REFUND_NOTIFY_URL: 'https://api.example.com/api/weapp/pay/refund-callback',
    UPLOAD_PUBLIC_URL: 'https://api.example.com',
    CORS_ORIGINS: 'https://admin.example.com',
    ADMIN_DEFAULT_PASSWORD: 'R9$KlmnoPQrsTuv1!',
    ...overrides,
  };

  return { tmpDir, env };
}

describe('validateEnv platform certificate rotation map', () => {
  const createdDirs: string[] = [];

  afterEach(() => {
    for (const dir of createdDirs.splice(0)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
    jest.restoreAllMocks();
  });

  it('rejects malformed WECHAT_PLATFORM_CERT_MAP JSON in production', () => {
    const { tmpDir, env } = createProductionEnv({ WECHAT_PLATFORM_CERT_MAP: '{broken' });
    createdDirs.push(tmpDir);
    const exitSpy = jest.spyOn(process, 'exit').mockImplementation(((code?: number) => {
      throw new Error(`process.exit:${code}`);
    }) as never);

    expect(() => validateEnv(env)).toThrow('process.exit:1');
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it('rejects unreadable certificate paths in WECHAT_PLATFORM_CERT_MAP', () => {
    const { tmpDir, env } = createProductionEnv();
    createdDirs.push(tmpDir);
    env.WECHAT_PLATFORM_CERT_MAP = JSON.stringify({
      'ROTATED-SERIAL': path.join(tmpDir, 'missing-platform-cert.pem'),
    });
    const exitSpy = jest.spyOn(process, 'exit').mockImplementation(((code?: number) => {
      throw new Error(`process.exit:${code}`);
    }) as never);

    expect(() => validateEnv(env)).toThrow('process.exit:1');
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it('accepts a readable certificate rotation map', () => {
    const { tmpDir, env } = createProductionEnv();
    createdDirs.push(tmpDir);
    const rotatedCertPath = path.join(tmpDir, 'wechatpay_platform_rotated.pem');
    fs.writeFileSync(rotatedCertPath, 'test-rotated-platform-cert');
    env.WECHAT_PLATFORM_CERT_MAP = JSON.stringify({
      'ROTATED-SERIAL': rotatedCertPath,
    });
    const exitSpy = jest.spyOn(process, 'exit').mockImplementation((() => undefined as never) as never);

    const result = validateEnv(env);

    expect(result.NODE_ENV).toBe('production');
    expect(exitSpy).not.toHaveBeenCalled();
  });
});
