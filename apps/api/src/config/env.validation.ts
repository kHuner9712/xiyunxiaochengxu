import { Logger } from '@nestjs/common';
import { plainToClass } from 'class-transformer';
import { IsString, IsOptional, ValidateIf, validateSync } from 'class-validator';
import * as fs from 'fs';

const logger = new Logger('EnvValidator');

const WEAK_JWT_SECRETS = [
  'your_jwt_secret_key_change_this',
  'change_this_jwt_secret',
  'your-secret-key',
  'jwt-secret',
  'secret',
  'changeme',
  'password',
  '123456',
  'admin',
  'test',
  'development',
];

class EnvValidation {
  @IsString()
  @IsOptional()
  NODE_ENV?: string;

  @IsString()
  @IsOptional()
  PORT?: string;

  @IsString()
  @IsOptional()
  DATABASE_URL?: string;

  @IsString()
  @IsOptional()
  REDIS_HOST?: string;

  @IsString()
  @IsOptional()
  REDIS_PORT?: string;

  @IsString()
  @IsOptional()
  JWT_SECRET?: string;

  @IsString()
  @IsOptional()
  JWT_EXPIRES_IN?: string;

  @IsString()
  @IsOptional()
  WECHAT_APP_ID?: string;

  @IsString()
  @IsOptional()
  WECHAT_APP_SECRET?: string;

  @IsString()
  @IsOptional()
  WECHAT_MCH_ID?: string;

  @IsString()
  @IsOptional()
  WECHAT_API_V3_KEY?: string;

  @IsString()
  @IsOptional()
  WECHAT_NOTIFY_URL?: string;

  @IsString()
  @IsOptional()
  WECHAT_REFUND_NOTIFY_URL?: string;

  @IsString()
  @IsOptional()
  WECHAT_MCH_SERIAL_NO?: string;

  @IsString()
  @IsOptional()
  WECHAT_PRIVATE_KEY_PATH?: string;

  @IsString()
  @IsOptional()
  WECHAT_PLATFORM_CERT_PATH?: string;

  @IsString()
  @IsOptional()
  WECHAT_SKIP_VERIFY?: string;

  @IsString()
  @IsOptional()
  REFRESH_TOKEN_SECRET?: string;

  @IsString()
  @IsOptional()
  REFRESH_TOKEN_EXPIRES_IN?: string;

  @IsString()
  @IsOptional()
  UPLOAD_PUBLIC_URL?: string;

  @IsString()
  @IsOptional()
  CORS_ORIGINS?: string;

  @IsString()
  @IsOptional()
  SMOKE_TEST_BYPASS_CAPTCHA?: string;

  @IsString()
  @IsOptional()
  ADMIN_DEFAULT_PASSWORD?: string;
}

export function validateEnv(env: Record<string, any>) {
  const nodeEnv = env.NODE_ENV || 'development';

  if (nodeEnv === 'production') {
    const requiredVars = [
      'DATABASE_URL',
      'REDIS_HOST',
      'JWT_SECRET',
      'WECHAT_APP_ID',
      'WECHAT_APP_SECRET',
      'WECHAT_MCH_ID',
      'WECHAT_API_V3_KEY',
      'WECHAT_NOTIFY_URL',
      'WECHAT_MCH_SERIAL_NO',
      'WECHAT_PRIVATE_KEY_PATH',
      'WECHAT_PLATFORM_CERT_PATH',
      'WECHAT_REFUND_NOTIFY_URL',
      'CORS_ORIGINS',
    ];

    const missing = requiredVars.filter((key) => !env[key]);
    if (missing.length > 0) {
      logger.error(`生产环境缺少必需的环境变量: ${missing.join(', ')}`);
      process.exit(1);
    }

    const apiV3Key = env.WECHAT_API_V3_KEY;
    if (apiV3Key && Buffer.byteLength(apiV3Key, 'utf8') !== 32) {
      logger.error('WECHAT_API_V3_KEY 必须为32字节');
      process.exit(1);
    }

    const refundNotifyUrl = env.WECHAT_REFUND_NOTIFY_URL;
    if (refundNotifyUrl && !refundNotifyUrl.startsWith('https://')) {
      logger.error('WECHAT_REFUND_NOTIFY_URL 必须以 https:// 开头');
      process.exit(1);
    }

    const notifyUrl = env.WECHAT_NOTIFY_URL;
    if (notifyUrl && !notifyUrl.startsWith('https://')) {
      logger.error('WECHAT_NOTIFY_URL 必须以 https:// 开头');
      process.exit(1);
    }

    const privateKeyPath = env.WECHAT_PRIVATE_KEY_PATH;
    if (privateKeyPath) {
      try {
        fs.accessSync(privateKeyPath, fs.constants.R_OK);
      } catch {
        logger.error(`WECHAT_PRIVATE_KEY_PATH 指向的文件不可读: ${privateKeyPath}`);
        process.exit(1);
      }
    }

    const platformCertPath = env.WECHAT_PLATFORM_CERT_PATH;
    if (platformCertPath) {
      try {
        fs.accessSync(platformCertPath, fs.constants.R_OK);
      } catch {
        logger.error(`WECHAT_PLATFORM_CERT_PATH 指向的文件不可读: ${platformCertPath}`);
        process.exit(1);
      }
    }

    const jwtSecret = env.JWT_SECRET;
    if (jwtSecret) {
      const lowerSecret = jwtSecret.toLowerCase();
      for (const weak of WEAK_JWT_SECRETS) {
        if (lowerSecret.includes(weak.toLowerCase())) {
          logger.error(
            `生产环境不允许使用默认或弱 JWT_SECRET，请使用随机生成的强密钥（至少32字符）`
          );
          process.exit(1);
        }
      }

      if (jwtSecret.length < 32) {
        logger.error(`生产环境 JWT_SECRET 长度必须至少为 32 字符`);
        process.exit(1);
      }
    }

    const adminDefaultPassword = env.ADMIN_DEFAULT_PASSWORD;
    if (adminDefaultPassword) {
      const lowerPassword = adminDefaultPassword.toLowerCase();
      for (const weak of WEAK_JWT_SECRETS) {
        if (lowerPassword.includes(weak.toLowerCase())) {
          logger.warn(
            `警告: 生产环境 ADMIN_DEFAULT_PASSWORD 包含默认或弱值，建议使用随机生成的强密码`
          );
        }
      }
    }

    if (env.SMOKE_TEST_BYPASS_CAPTCHA === 'true') {
      logger.error('生产环境禁止启用 SMOKE_TEST_BYPASS_CAPTCHA，请设置为 false 或删除该变量');
      process.exit(1);
    }

    if (env.WECHAT_SKIP_VERIFY === 'true') {
      logger.error('生产环境禁止启用 WECHAT_SKIP_VERIFY，请设置为 false 或删除该变量');
      process.exit(1);
    }
  }

  if (nodeEnv !== 'production') {
    const paymentVars = ['WECHAT_APP_ID', 'WECHAT_MCH_ID', 'WECHAT_API_V3_KEY'];
    const missingPayment = paymentVars.filter(key => !env[key]);
    if (missingPayment.length > 0) {
      logger.warn(`非生产环境缺少支付配置: ${missingPayment.join(', ')}，支付功能不可用`);
    }
  }

  const validatedEnv = plainToClass(EnvValidation, env, {
    enableImplicitConversion: true,
  });

  const errors = validateSync(validatedEnv, {
    skipMissingProperties: false,
    whitelist: false,
    forbidNonWhitelisted: false,
  });

  if (errors.length > 0) {
    logger.warn(`环境变量验证警告: ${JSON.stringify(errors)}`);
  }

  return validatedEnv;
}
