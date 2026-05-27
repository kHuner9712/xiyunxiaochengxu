import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { validateEnv } from './env.validation';

function createProductionEnv(overrides: Record<string, any> = {}) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'baby-mall-env-'));
  const privateKeyPath = path.join(tmpDir, 'apiclient_key.pem');
  const platformCertPath = path.join(tmpDir, 'wechatpay_platform.pem');
  fs.writeFileSync(privateKeyPath, 'test-private-key');
  fs.writeFileSync(platformCertPath, 'test-platform-cert');

  return {
    tmpDir,
    env: {
      NODE_ENV: 'production',
      DATABASE_URL: 'mysql://root:strong_password@localhost:3306/baby_mall',
      REDIS_HOST: 'localhost',
      JWT_SECRET: 'JwTk_qwertyuiopasdfghjklzxcvbnm9081726354',
      REFRESH_TOKEN_SECRET: 'RfTk_mnbvcxzlkjhgfdsapoiuytrewq9081726354',
      WECHAT_APP_ID: 'wx1234567890abcdef',
      WECHAT_APP_SECRET: 'test_app_secret',
      WECHAT_MCH_ID: '1234567890',
      WECHAT_MCH_SERIAL_NO: 'serial-123',
      WECHAT_API_V3_KEY: '0123456789abcdef0123456789abcdef',
      WECHAT_PRIVATE_KEY_PATH: privateKeyPath,
      WECHAT_PLATFORM_CERT_PATH: platformCertPath,
      WECHAT_PLATFORM_CERT_SERIAL_NO: 'platform-serial-123',
      WECHAT_NOTIFY_URL: 'https://api.example.com/api/weapp/pay/callback',
      WECHAT_REFUND_NOTIFY_URL: 'https://api.example.com/api/weapp/pay/refund-callback',
      CORS_ORIGINS: 'https://admin.example.com',
      ADMIN_DEFAULT_PASSWORD: 'R9$KlmnoPQrsTuv1!',
      ...overrides,
    },
  };
}

describe('validateEnv 生产环境强校验', () => {
  let createdDirs: string[] = [];

  afterEach(() => {
    createdDirs.forEach((dir) => {
      fs.rmSync(dir, { recursive: true, force: true });
    });
    createdDirs = [];
    jest.restoreAllMocks();
  });

  it('缺少 REFRESH_TOKEN_SECRET 时应启动失败', () => {
    const { tmpDir, env } = createProductionEnv({ REFRESH_TOKEN_SECRET: '' });
    createdDirs.push(tmpDir);
    const exitSpy = jest.spyOn(process, 'exit').mockImplementation(((code?: number) => {
      throw new Error(`process.exit:${code}`);
    }) as never);

    expect(() => validateEnv(env)).toThrow('process.exit:1');
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it('缺少 WECHAT_PLATFORM_CERT_SERIAL_NO 时应启动失败', () => {
    const { tmpDir, env } = createProductionEnv({ WECHAT_PLATFORM_CERT_SERIAL_NO: '' });
    createdDirs.push(tmpDir);
    const exitSpy = jest.spyOn(process, 'exit').mockImplementation(((code?: number) => {
      throw new Error(`process.exit:${code}`);
    }) as never);

    expect(() => validateEnv(env)).toThrow('process.exit:1');
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it('弱 REFRESH_TOKEN_SECRET 时应启动失败', () => {
    const { tmpDir, env } = createProductionEnv({ REFRESH_TOKEN_SECRET: '123456' });
    createdDirs.push(tmpDir);
    const exitSpy = jest.spyOn(process, 'exit').mockImplementation(((code?: number) => {
      throw new Error(`process.exit:${code}`);
    }) as never);

    expect(() => validateEnv(env)).toThrow('process.exit:1');
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it('弱 ADMIN_DEFAULT_PASSWORD 时应启动失败', () => {
    const { tmpDir, env } = createProductionEnv({ ADMIN_DEFAULT_PASSWORD: 'admin123' });
    createdDirs.push(tmpDir);
    const exitSpy = jest.spyOn(process, 'exit').mockImplementation(((code?: number) => {
      throw new Error(`process.exit:${code}`);
    }) as never);

    expect(() => validateEnv(env)).toThrow('process.exit:1');
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it('生产必要配置齐全时不应退出', () => {
    const { tmpDir, env } = createProductionEnv();
    createdDirs.push(tmpDir);
    const exitSpy = jest.spyOn(process, 'exit').mockImplementation((() => undefined as never) as never);

    const result = validateEnv(env);
    expect(result.NODE_ENV).toBe('production');
    expect(exitSpy).not.toHaveBeenCalled();
  });
});
