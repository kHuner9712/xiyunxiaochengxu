import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { PrismaService } from './common/prisma/prisma.service';
import * as path from 'path';
import { configurePublicUploadStaticAssets } from './common/utils/upload-static-assets';

const DEFAULT_OUTBOUND_HTTP_TIMEOUT_MS = 10_000;
const MIN_OUTBOUND_HTTP_TIMEOUT_MS = 1_000;
const MAX_OUTBOUND_HTTP_TIMEOUT_MS = 60_000;

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    rawBody: true,
  });

  // Docker/systemd/Kubernetes terminate services with SIGTERM/SIGINT. Enable Nest lifecycle
  // hooks so Prisma, Redis and any future resource-owning providers can drain cleanly instead
  // of waiting for the process manager to force-kill the API.
  app.enableShutdownHooks(['SIGTERM', 'SIGINT']);

  const configService = app.get(ConfigService);
  const nodeEnv = configService.get<string>('NODE_ENV', 'development');
  const outboundHttpTimeoutRaw = configService.get<string>(
    'OUTBOUND_HTTP_TIMEOUT_MS',
    String(DEFAULT_OUTBOUND_HTTP_TIMEOUT_MS),
  );
  const outboundHttpTimeoutMs = Number(outboundHttpTimeoutRaw);
  if (
    !Number.isInteger(outboundHttpTimeoutMs) ||
    outboundHttpTimeoutMs < MIN_OUTBOUND_HTTP_TIMEOUT_MS ||
    outboundHttpTimeoutMs > MAX_OUTBOUND_HTTP_TIMEOUT_MS
  ) {
    logger.error(
      `OUTBOUND_HTTP_TIMEOUT_MS 必须是 ${MIN_OUTBOUND_HTTP_TIMEOUT_MS}-${MAX_OUTBOUND_HTTP_TIMEOUT_MS} 之间的整数毫秒值`,
    );
    process.exit(1);
  }

  // Axios defaults to timeout=0 (no timeout). Every current backend axios call is an outbound
  // platform dependency (WeChat login/pay/refund/close and alert delivery). Bound them globally
  // before the HTTP server starts so a stalled upstream cannot pin application requests forever.
  axios.defaults.timeout = outboundHttpTimeoutMs;

  if (nodeEnv === 'production') {
    app.set('trust proxy', 1);
  }

  const uploadDir = configService.get<string>('UPLOAD_DIR') || path.join(process.cwd(), 'uploads');
  configurePublicUploadStaticAssets(app, uploadDir);

  // API 前缀固定为 /api，Nginx 代理和前端 baseURL 均依赖此路径，不可更改
  app.setGlobalPrefix('api');

  const corsOrigins = configService.get<string>('CORS_ORIGINS', '');
  if (nodeEnv === 'production' && !corsOrigins) {
    logger.error('生产环境必须配置 CORS_ORIGINS 环境变量');
    process.exit(1);
  }

  const allowedOrigins = corsOrigins
    ? corsOrigins.split(',').map((o) => o.trim()).filter(Boolean)
    : [];

  app.enableCors({
    origin: allowedOrigins.length > 0 ? allowedOrigins : false,
    credentials: true,
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'Origin', 'X-Requested-With', 'X-Request-Id', 'X-Correlation-Id'],
    exposedHeaders: ['X-Request-Id'],
  });

  if (nodeEnv !== 'production') {
    app.useGlobalPipes(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: false,
        transformOptions: {
          enableImplicitConversion: true,
        },
      }),
    );
  } else {
    app.useGlobalPipes(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
        transformOptions: {
          enableImplicitConversion: true,
        },
      }),
    );
  }

  app.useGlobalInterceptors(new TransformInterceptor(app.get(Reflector)));
  app.useGlobalFilters(new HttpExceptionFilter());

  const prismaService = app.get(PrismaService);
  await (prismaService as any).enableShutdownHooks?.(app);

  const port = configService.get<number>('PORT', 3000);
  await app.listen(port, '0.0.0.0');
  logger.log(`Application is running on: http://0.0.0.0:${port}`);
  logger.log(`Environment: ${nodeEnv}`);
}

bootstrap();
