import { Logger } from '@nestjs/common';
import { plainToClass } from 'class-transformer';
import { IsString, IsOptional, ValidateIf, validateSync } from 'class-validator';

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
      'CORS_ORIGINS',
    ];

    const missing = requiredVars.filter((key) => !env[key]);
    if (missing.length > 0) {
      logger.error(`生产环境缺少必需的环境变量: ${missing.join(', ')}`);
      process.exit(1);
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
