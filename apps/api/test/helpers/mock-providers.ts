import { Test, TestingModuleBuilder } from '@nestjs/testing';
import { ValidationPipe, INestApplication } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../../src/common/prisma/prisma.service';
import { RedisService } from '../../src/common/redis/redis.service';
import { TransformInterceptor } from '../../src/common/interceptors/transform.interceptor';
import { HttpExceptionFilter } from '../../src/common/filters/http-exception.filter';

function createPrismaMock() {
  const txMock = {
    adminUser: {
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    adminUserRole: {
      findMany: jest.fn(),
    },
    user: {
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    order: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    orderPayment: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    orderRefund: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
    },
    aftersaleOrder: {
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    orderLog: {
      create: jest.fn(),
    },
    productSku: {
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    productStockLog: {
      create: jest.fn(),
    },
    pointsRecord: {
      create: jest.fn(),
    },
  };

  const prismaMock = {
    $queryRaw: jest.fn(),
    $connect: jest.fn(),
    $disconnect: jest.fn(),
    $transaction: jest.fn((callback: any) => callback(txMock)),
    ...txMock,
  };

  return prismaMock;
}

function createRedisMock() {
  const store = new Map<string, string>();

  return {
    get: jest.fn((key: string) => Promise.resolve(store.get(key) ?? null)),
    set: jest.fn((key: string, value: string, _ttlSeconds?: number) => {
      store.set(key, value);
      return Promise.resolve('OK');
    }),
    del: jest.fn((key: string) => {
      const existed = store.has(key);
      store.delete(key);
      return Promise.resolve(existed ? 1 : 0);
    }),
    ping: jest.fn(() => Promise.resolve('PONG')),
    setNX: jest.fn((key: string, value: string) => {
      if (store.has(key)) return Promise.resolve(0);
      store.set(key, value);
      return Promise.resolve(1);
    }),
    incr: jest.fn((key: string) => {
      const current = parseInt(store.get(key) ?? '0', 10);
      const next = current + 1;
      store.set(key, String(next));
      return Promise.resolve(next);
    }),
    expire: jest.fn(() => Promise.resolve(1)),
    hset: jest.fn(() => Promise.resolve(1)),
    hget: jest.fn(() => Promise.resolve(null)),
    hgetall: jest.fn(() => Promise.resolve({})),
    exists: jest.fn((key: string) => Promise.resolve(store.has(key) ? 1 : 0)),
    keys: jest.fn((_pattern: string) => Promise.resolve([])),
    releaseLockWithLua: jest.fn(() => Promise.resolve(1)),
  };
}

const prismaMock = createPrismaMock();
const redisMock = createRedisMock();

export { prismaMock, redisMock, createPrismaMock as createMockPrismaService, createRedisMock as createMockRedisService };

export function createTestEnvConfig(): Record<string, string> {
  return {
    NODE_ENV: 'test',
    JWT_SECRET: 'test_jwt_secret_key_that_is_long_enough_32chars',
    DATABASE_URL: 'mysql://test:test@localhost:3306/test',
    REDIS_HOST: 'localhost',
    REDIS_PORT: '6379',
    WECHAT_APP_ID: 'test_app_id',
    WECHAT_APP_SECRET: 'test_app_secret',
    WECHAT_MCH_ID: 'test_mch_id',
    WECHAT_API_V3_KEY: 'test_api_v3_key_32_characters!!',
    WECHAT_MCH_SERIAL_NO: 'test_serial_no',
    WECHAT_SKIP_VERIFY: 'true',
    SMOKE_TEST_BYPASS_CAPTCHA: 'true',
    CORS_ORIGINS: 'http://localhost:3000',
    WECHAT_NOTIFY_URL: 'http://localhost:3000/api/weapp/pay/callback',
    WECHAT_REFUND_NOTIFY_URL: 'http://localhost:3000/api/weapp/pay/refund-callback',
  };
}

export async function setupTestApp(
  moduleBuilder: TestingModuleBuilder,
): Promise<INestApplication> {
  const moduleFixture = await moduleBuilder
    .overrideProvider(PrismaService)
    .useValue(prismaMock)
    .overrideProvider(RedisService)
    .useValue(redisMock)
    .overrideProvider('REDIS_CLIENT')
    .useValue({})
    .compile();

  const app = moduleFixture.createNestApplication({ rawBody: true });
  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: false,
      transformOptions: { enableImplicitConversion: true },
    }),
  );
  app.useGlobalInterceptors(new TransformInterceptor(new Reflector()));
  app.useGlobalFilters(new HttpExceptionFilter());
  await app.init();
  return app;
}
