import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { AuthModule } from '../src/auth/auth.module';
import { ConfigModule } from '@nestjs/config';
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

jest.mock('axios', () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
    post: jest.fn(),
    create: jest.fn(() => ({ get: jest.fn(), post: jest.fn() })),
  },
}));

describe('Weapp Auth (e2e)', () => {
  let app: INestApplication;
  let mockPrisma: ReturnType<typeof createMockPrismaService>;
  let mockRedis: ReturnType<typeof createMockRedisService>;
  let jwtService: JwtService;
  let token: string;

  beforeAll(async () => {
    mockPrisma = createMockPrismaService();
    mockRedis = createMockRedisService();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          load: [() => createTestEnvConfig()],
        }),
        AuthModule,
      ],
      providers: [
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

    jwtService = moduleFixture.get<JwtService>(JwtService);
  });

  afterAll(async () => {
    await app.close();
  });

  it('POST /api/weapp/auth/login with valid code returns token', async () => {
    const axios = require('axios');
    axios.default.get.mockResolvedValue({
      data: { openid: 'test_openid', session_key: 'test_session_key' },
    });

    mockPrisma.user.findFirst.mockResolvedValue(null);
    mockPrisma.user.create.mockResolvedValue({
      id: BigInt(1),
      openid: 'test_openid',
      unionId: null,
      status: 1,
      deletedAt: null,
    });

    const res = await request(app.getHttpServer())
      .post('/api/weapp/auth/login')
      .send({ code: 'test_code' });

    expect(res.status).toBe(201);
    expect(res.body.data.token).toBeDefined();
    expect(typeof res.body.data.token).toBe('string');
    expect(res.body.data.isNewUser).toBe(true);

    token = res.body.data.token;
  });

  it('token payload contains roleType=user and tokenType=access', async () => {
    const decoded = await jwtService.verifyAsync(token);
    expect(decoded.roleType).toBe('user');
    expect(decoded.tokenType).toBe('access');
  });

  it('token can access weapp authenticated endpoints', async () => {
    const axios = require('axios');
    axios.default.get.mockResolvedValue({
      data: { session_key: 'new_session_key' },
    });

    const res = await request(app.getHttpServer())
      .post('/api/weapp/auth/phone')
      .set('Authorization', `Bearer ${token}`)
      .send({ code: 'x', encryptedData: 'x', iv: 'x' });

    expect([40101, 40102, 40103]).not.toContain(res.body.code);
  });

  it('POST /api/weapp/auth/login with WeChat error throws unauthorized', async () => {
    const axios = require('axios');
    axios.default.get.mockResolvedValue({
      data: { errcode: 40029, errmsg: 'invalid code' },
    });

    const res = await request(app.getHttpServer())
      .post('/api/weapp/auth/login')
      .send({ code: 'bad_code' });

    expect(res.body.code).toBe(40101);
  });
});
