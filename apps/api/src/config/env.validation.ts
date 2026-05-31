import { Logger } from '@nestjs/common';
import { plainToClass } from 'class-transformer';
import { IsString, IsOptional, validateSync } from 'class-validator';
import * as fs from 'fs';

const logger = new Logger('EnvValidator');

const WEAK_JWT_SECRETS = [
  'your_jwt_secret_key_change_this',
  'your_refresh_token_secret_change_this',
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
  DB_HOST?: string;

  @IsString()
  @IsOptional()
  DB_PORT?: string;

  @IsString()
  @IsOptional()
  DB_NAME?: string;

  @IsString()
  @IsOptional()
  DB_USER?: string;

  @IsString()
  @IsOptional()
  DB_PASSWORD?: string;

  @IsString()
  @IsOptional()
  DB_CHARSET?: string;

  @IsString()
  @IsOptional()
  REDIS_HOST?: string;

  @IsString()
  @IsOptional()
  REDIS_PORT?: string;

  @IsString()
  @IsOptional()
  REDIS_PASSWORD?: string;

  @IsString()
  @IsOptional()
  REDIS_DB?: string;

  @IsString()
  @IsOptional()
  JWT_SECRET?: string;

  @IsString()
  @IsOptional()
  JWT_EXPIRES_IN?: string;

  @IsString()
  @IsOptional()
  JWT_ADMIN_EXPIRES_IN?: string;

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
  WECHAT_PLATFORM_CERT_SERIAL_NO?: string;

  /**
   * Optional JSON map of platform certificate serial numbers to PEM file paths.
   * Used for WeChat callback signature verification during certificate rotation.
   */
  @IsString()
  @IsOptional()
  WECHAT_PLATFORM_CERT_MAP?: string;

  @IsString()
  @IsOptional()
  WECHAT_SKIP_VERIFY?: string;

  @IsString()
  @IsOptional()
  WECHAT_REFUND_MOCK?: string;

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
  UPLOAD_DRIVER?: string;

  @IsString()
  @IsOptional()
  UPLOAD_DIR?: string;

  @IsString()
  @IsOptional()
  UPLOAD_MAX_SIZE?: string;

  @IsString()
  @IsOptional()
  UPLOAD_ALLOWED_TYPES?: string;

  @IsString()
  @IsOptional()
  PUBLIC_ASSET_BASE_URL?: string;

  @IsString()
  @IsOptional()
  COS_SECRET_ID?: string;

  @IsString()
  @IsOptional()
  COS_SECRET_KEY?: string;

  @IsString()
  @IsOptional()
  COS_BUCKET?: string;

  @IsString()
  @IsOptional()
  COS_REGION?: string;

  @IsString()
  @IsOptional()
  OSS_ACCESS_KEY_ID?: string;

  @IsString()
  @IsOptional()
  OSS_ACCESS_KEY_SECRET?: string;

  @IsString()
  @IsOptional()
  OSS_BUCKET?: string;

  @IsString()
  @IsOptional()
  OSS_REGION?: string;

  @IsString()
  @IsOptional()
  OSS_ENDPOINT?: string;

  @IsString()
  @IsOptional()
  ORDER_AUTO_CLOSE_MINUTES?: string;

  @IsString()
  @IsOptional()
  ORDER_AUTO_COMPLETE_DAYS?: string;

  @IsString()
  @IsOptional()
  ORDER_AUTO_COMPLETE_REMIND_DAYS?: string;

  @IsString()
  @IsOptional()
  POINTS_RATE_PER_YUAN?: string;

  @IsString()
  @IsOptional()
  POINTS_SIGN_IN_BASE?: string;

  @IsString()
  @IsOptional()
  POINTS_SIGN_IN_MAX?: string;

  @IsString()
  @IsOptional()
  POINTS_SHARE_AWARD?: string;

  @IsString()
  @IsOptional()
  POINTS_SHARE_DAILY_LIMIT?: string;

  @IsString()
  @IsOptional()
  POINTS_PROFILE_AWARD?: string;

  @IsString()
  @IsOptional()
  POINTS_REVIEW_AWARD?: string;

  @IsString()
  @IsOptional()
  POINTS_REVIEW_DAILY_LIMIT?: string;

  @IsString()
  @IsOptional()
  POINTS_REGISTER_AWARD?: string;

  @IsString()
  @IsOptional()
  POINTS_DEDUCT_RATE?: string;

  @IsString()
  @IsOptional()
  POINTS_DEDUCT_MAX_PERCENT?: string;

  @IsString()
  @IsOptional()
  POINTS_EXPIRE_MONTHS?: string;

  @IsString()
  @IsOptional()
  FREIGHT_FREE_AMOUNT?: string;

  @IsString()
  @IsOptional()
  FREIGHT_DEFAULT_FEE?: string;

  @IsString()
  @IsOptional()
  FREIGHT_REMOTE_AREAS?: string;

  @IsString()
  @IsOptional()
  FREIGHT_REMOTE_FEE?: string;

  @IsString()
  @IsOptional()
  MEMBER_LEVEL_NORMAL_MAX?: string;

  @IsString()
  @IsOptional()
  MEMBER_LEVEL_SILVER_MIN?: string;

  @IsString()
  @IsOptional()
  MEMBER_LEVEL_SILVER_MAX?: string;

  @IsString()
  @IsOptional()
  MEMBER_LEVEL_GOLD_MIN?: string;

  @IsString()
  @IsOptional()
  MEMBER_LEVEL_GOLD_MAX?: string;

  @IsString()
  @IsOptional()
  MEMBER_LEVEL_BLACK_GOLD_MIN?: string;

  @IsString()
  @IsOptional()
  LOG_LEVEL?: string;

  @IsString()
  @IsOptional()
  LOG_DIR?: string;

  @IsString()
  @IsOptional()
  CORS_ORIGINS?: string;

  @IsString()
  @IsOptional()
  ALERT_WEBHOOK_URL?: string;

  @IsString()
  @IsOptional()
  SMOKE_TEST_BYPASS_CAPTCHA?: string;

  @IsString()
  @IsOptional()
  ADMIN_DEFAULT_USERNAME?: string;

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
      'REDIS_PASSWORD',
      'JWT_SECRET',
      'REFRESH_TOKEN_SECRET',
      'WECHAT_APP_ID',
      'WECHAT_APP_SECRET',
      'WECHAT_MCH_ID',
      'WECHAT_API_V3_KEY',
      'WECHAT_NOTIFY_URL',
      'WECHAT_MCH_SERIAL_NO',
      'WECHAT_PRIVATE_KEY_PATH',
      'WECHAT_PLATFORM_CERT_PATH',
      'WECHAT_PLATFORM_CERT_SERIAL_NO',
      'WECHAT_REFUND_NOTIFY_URL',
      'UPLOAD_PUBLIC_URL',
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

    const uploadPublicUrl = env.UPLOAD_PUBLIC_URL;
    if (uploadPublicUrl && !uploadPublicUrl.startsWith('https://')) {
      logger.error('UPLOAD_PUBLIC_URL 必须以 https:// 开头');
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

    const refreshTokenSecret = env.REFRESH_TOKEN_SECRET;
    if (refreshTokenSecret) {
      const lowerRefreshSecret = refreshTokenSecret.toLowerCase();
      for (const weak of WEAK_JWT_SECRETS) {
        if (lowerRefreshSecret.includes(weak.toLowerCase())) {
          logger.error(
            `生产环境不允许使用默认或弱 REFRESH_TOKEN_SECRET，请使用随机生成的强密钥（至少32字符）`
          );
          process.exit(1);
        }
      }

      if (refreshTokenSecret.length < 32) {
        logger.error(`生产环境 REFRESH_TOKEN_SECRET 长度必须至少为 32 字符`);
        process.exit(1);
      }
    }

    const adminDefaultPassword = env.ADMIN_DEFAULT_PASSWORD;
    if (adminDefaultPassword) {
      const lowerPassword = adminDefaultPassword.toLowerCase();
      for (const weak of WEAK_JWT_SECRETS) {
        if (lowerPassword.includes(weak.toLowerCase())) {
          logger.error(
            `生产环境不允许使用默认或弱 ADMIN_DEFAULT_PASSWORD，请改为强密码并启用首次登录改密`
          );
          process.exit(1);
        }
      }

      if (adminDefaultPassword.length < 12) {
        logger.error(`生产环境 ADMIN_DEFAULT_PASSWORD 长度必须至少为 12 字符`);
        process.exit(1);
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
