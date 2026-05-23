import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import request from 'supertest';
import { HealthModule } from '../src/health/health.module';
import { PrismaService } from '../src/common/prisma/prisma.service';
import { RedisService } from '../src/common/redis/redis.service';
import { TransformInterceptor } from '../src/common/interceptors/transform.interceptor';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import {
  createMockPrismaService,
  createMockRedisService,
  createTestEnvConfig,
  setupTestApp,
} from './helpers/mock-providers';

describe('HealthController (e2e)', () => {
  let app: any;
  let httpServer: any;
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
        HealthModule,
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
        ping: jest.fn().mockResolvedValue('PONG'),
        incr: jest.fn(),
        expire: jest.fn(),
        hset: jest.fn(),
        hget: jest.fn(),
        hgetall: jest.fn(),
        exists: jest.fn(),
        keys: jest.fn(),
        eval: jest.fn(),
      })
      .compile();

    app = moduleFixture.createNestApplication({ rawBody: true });
    app.setGlobalPrefix('api');
    app.useGlobalInterceptors(new TransformInterceptor(app.get(Reflector)));
    app.useGlobalFilters(new HttpExceptionFilter());
    await app.init();

    httpServer = app.getHttpServer();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /api/health returns raw JSON not wrapped by TransformInterceptor', async () => {
    mockPrisma.$queryRaw.mockResolvedValue([{ '1': 1 }]);
    mockRedis.ping.mockResolvedValue('PONG');

    const res = await request(httpServer).get('/api/health');

    expect(res.status).toBe(200);
    expect(res.body).not.toEqual({
      code: 0,
      message: 'success',
      data: expect.anything(),
    });
    expect(res.body).toHaveProperty('status', 'ok');
  });

  it('GET /api/health returns ok when database and redis are healthy', async () => {
    mockPrisma.$queryRaw.mockResolvedValue([{ '1': 1 }]);
    mockRedis.ping.mockResolvedValue('PONG');

    const res = await request(httpServer).get('/api/health');

    expect(res.body.status).toBe('ok');
    expect(res.body.services.database).toBe('ok');
    expect(res.body.services.redis).toBe('ok');
  });

  it('GET /api/health returns degraded when database fails', async () => {
    mockPrisma.$queryRaw.mockRejectedValue(new Error('DB down'));
    mockRedis.ping.mockResolvedValue('PONG');

    const res = await request(httpServer).get('/api/health');

    expect(res.body.status).toBe('degraded');
    expect(res.body.services.database).toBe('error');
  });

  it('GET /api/health returns degraded when redis fails', async () => {
    mockPrisma.$queryRaw.mockResolvedValue([{ '1': 1 }]);
    mockRedis.ping.mockResolvedValue('ERROR');

    const res = await request(httpServer).get('/api/health');

    expect(res.body.status).toBe('degraded');
    expect(res.body.services.redis).toBe('error');
  });
});
