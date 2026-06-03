import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import request from 'supertest';
import { AuthModule } from '../src/auth/auth.module';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { PrismaService } from '../src/common/prisma/prisma.service';
import { RedisService } from '../src/common/redis/redis.service';
import { JwtAuthGuard } from '../src/common/guards/jwt-auth.guard';
import { PermissionGuard } from '../src/common/guards/permission.guard';
import { APP_GUARD } from '@nestjs/core';
import {
  createMockPrismaService,
  createMockRedisService,
  createTestEnvConfig,
} from './helpers/mock-providers';
import { TransformInterceptor } from '../src/common/interceptors/transform.interceptor';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';

describe('Throttler Guard (e2e)', () => {
  let app: INestApplication;
  let mockPrisma: ReturnType<typeof createMockPrismaService>;
  let mockRedis: ReturnType<typeof createMockRedisService>;

  beforeAll(async () => {
    mockPrisma = createMockPrismaService();
    mockRedis = createMockRedisService();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          load: [() => createTestEnvConfig()],
        }),
        ThrottlerModule.forRoot({
          throttlers: [{ ttl: 60000, limit: 100 }],
          getTracker: (req: Record<string, any>) => req.ip || req.socket?.remoteAddress || 'unknown',
        }),
        AuthModule,
      ],
      providers: [
        { provide: APP_GUARD, useClass: ThrottlerGuard },
        { provide: APP_GUARD, useClass: JwtAuthGuard },
        { provide: APP_GUARD, useClass: PermissionGuard },
      ],
    })
      .overrideProvider(PrismaService)
      .useValue(mockPrisma)
      .overrideProvider(RedisService)
      .useValue(mockRedis)
      .overrideProvider('REDIS_CLIENT')
      .useValue({
        get: jest.fn(),
        set: jest.fn(),
        del: jest.fn(),
        incr: jest.fn(),
        expire: jest.fn(),
        hset: jest.fn(),
        hget: jest.fn(),
        hgetall: jest.fn(),
        exists: jest.fn(),
        keys: jest.fn(),
        ping: jest.fn(),
        eval: jest.fn(),
      })
      .compile();

    app = moduleFixture.createNestApplication({ rawBody: true });
    app.getHttpAdapter().getInstance().set('trust proxy', 1);
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: false,
        transformOptions: { enableImplicitConversion: true },
      }),
    );
    app.useGlobalInterceptors(new TransformInterceptor(app.get(Reflector)));
    app.useGlobalFilters(new HttpExceptionFilter());
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /api/admin/auth/captcha 触发限流后返回 code=40501', async () => {
    const responses = [];
    for (let i = 0; i < 21; i++) {
      const res = await request(app.getHttpServer()).get('/api/admin/auth/captcha');
      responses.push(res);
    }
    const throttled = responses.find((res) => res.body.code === 40501);
    expect(throttled).toBeDefined();
    expect(throttled!.body.code).toBe(40501);
    expect(throttled!.body.message).toBe('请求频率超限，请稍后再试');
    expect(throttled!.body.data).toBeNull();
    expect(throttled!.body).toHaveProperty('requestId');
  });

  it('GET /api/admin/auth/captcha 按 X-Forwarded-For 解析后的真实客户端 IP 限流', async () => {
    const limitedIp = '203.0.113.10';
    for (let i = 0; i < 20; i++) {
      await request(app.getHttpServer())
        .get('/api/admin/auth/captcha')
        .set('X-Forwarded-For', limitedIp);
    }

    const throttled = await request(app.getHttpServer())
      .get('/api/admin/auth/captcha')
      .set('X-Forwarded-For', limitedIp);
    expect(throttled.body.code).toBe(40501);

    const otherIpResponse = await request(app.getHttpServer())
      .get('/api/admin/auth/captcha')
      .set('X-Forwarded-For', '203.0.113.11');
    expect(otherIpResponse.body.code).not.toBe(40501);
  });

  it('POST /api/admin/auth/login 触发限流后返回 code=40501', async () => {
    const responses = [];
    for (let i = 0; i < 6; i++) {
      const res = await request(app.getHttpServer())
        .post('/api/admin/auth/login')
        .send({ username: 'test', password: 'test', captchaId: 'x', captchaCode: 'x' });
      responses.push(res);
    }
    const throttled = responses.find((res) => res.body.code === 40501);
    expect(throttled).toBeDefined();
    expect(throttled!.body.code).toBe(40501);
    expect(throttled!.body.message).toBe('请求频率超限，请稍后再试');
    expect(throttled!.body.data).toBeNull();
    expect(throttled!.body).toHaveProperty('requestId');
  });

  it('POST /api/admin/auth/login 按 X-Forwarded-For 解析后的真实客户端 IP 限流', async () => {
    const limitedIp = '203.0.113.20';
    for (let i = 0; i < 5; i++) {
      await request(app.getHttpServer())
        .post('/api/admin/auth/login')
        .set('X-Forwarded-For', limitedIp)
        .send({ username: 'test', password: 'test', captchaId: 'x', captchaCode: 'x' });
    }

    const throttled = await request(app.getHttpServer())
      .post('/api/admin/auth/login')
      .set('X-Forwarded-For', limitedIp)
      .send({ username: 'test', password: 'test', captchaId: 'x', captchaCode: 'x' });
    expect(throttled.body.code).toBe(40501);

    const otherIpResponse = await request(app.getHttpServer())
      .post('/api/admin/auth/login')
      .set('X-Forwarded-For', '203.0.113.21')
      .send({ username: 'test', password: 'test', captchaId: 'x', captchaCode: 'x' });
    expect(otherIpResponse.body.code).not.toBe(40501);
  });

  it('限流响应结构包含 code, message, data, requestId', async () => {
    const responses = [];
    for (let i = 0; i < 6; i++) {
      const res = await request(app.getHttpServer())
        .post('/api/admin/auth/login')
        .send({ username: 'test', password: 'test', captchaId: 'x', captchaCode: 'x' });
      responses.push(res);
    }
    const throttled = responses.find((res) => res.body.code === 40501);
    expect(throttled).toBeDefined();
    const body = throttled!.body;
    expect(body).toHaveProperty('code');
    expect(body).toHaveProperty('message');
    expect(body).toHaveProperty('data');
    expect(body).toHaveProperty('requestId');
  });
});
