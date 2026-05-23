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

const adminUser = {
  id: BigInt(1),
  username: 'admin',
  password: 'hashed_password',
  realName: 'Admin',
  avatar: null,
  status: 1,
  deletedAt: null,
  mustChangePassword: false,
  adminUserRoles: [
    {
      role: {
        code: 'super_admin',
        adminRolePermissions: [{ permission: { code: 'all' } }],
      },
    },
  ],
};

describe('Admin Auth (e2e)', () => {
  let app: INestApplication;
  let mockPrisma: ReturnType<typeof createMockPrismaService>;
  let mockRedis: ReturnType<typeof createMockRedisService>;
  let jwtService: JwtService;
  let accessToken: string;
  let refreshToken: string;

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
        transformOptions: {
          enableImplicitConversion: true,
        },
      }),
    );

    app.useGlobalInterceptors(
      new TransformInterceptor(app.get(Reflector)),
    );

    app.useGlobalFilters(new HttpExceptionFilter());

    await app.init();

    jwtService = moduleFixture.get<JwtService>(JwtService);
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /api/admin/auth/captcha returns captchaId and captchaSvg', () => {
    return request(app.getHttpServer())
      .get('/api/admin/auth/captcha')
      .expect(200)
      .expect((res) => {
        expect(res.body.code).toBe(0);
        expect(res.body.message).toBe('success');
        expect(res.body.data).toHaveProperty('captchaId');
        expect(res.body.data).toHaveProperty('captchaSvg');
        expect(typeof res.body.data.captchaId).toBe('string');
        expect(res.body.data.captchaSvg).toContain('<svg');
      });
  });

  it('POST /api/admin/auth/login with bypass captcha returns tokens and adminUser', async () => {
    mockPrisma.adminUser.findFirst.mockResolvedValue(adminUser);
    mockPrisma.adminUser.update.mockResolvedValue(adminUser);

    const res = await request(app.getHttpServer())
      .post('/api/admin/auth/login')
      .send({
        username: 'admin',
        password: 'admin123',
        captchaId: 'smoke-test',
        captchaCode: 'bypass',
      });

    expect(res.status).toBe(201);
    expect(res.body.data.accessToken).toBeDefined();
    expect(typeof res.body.data.accessToken).toBe('string');
    expect(res.body.data.refreshToken).toBeDefined();
    expect(typeof res.body.data.refreshToken).toBe('string');
    expect(res.body.data.adminUser.username).toBe('admin');

    accessToken = res.body.data.accessToken;
    refreshToken = res.body.data.refreshToken;
  });

  it('accessToken payload contains tokenType=access', async () => {
    const decoded = await jwtService.verifyAsync(accessToken);
    expect(decoded.tokenType).toBe('access');
    expect(decoded.roleType).toBe('admin');
  });

  it('refreshToken payload contains tokenType=refresh', async () => {
    const decoded = await jwtService.verifyAsync(refreshToken);
    expect(decoded.tokenType).toBe('refresh');
    expect(decoded.roleType).toBe('admin');
  });

  it('POST /api/admin/auth/refresh returns new tokens', async () => {
    mockPrisma.adminUser.findFirst.mockResolvedValue(adminUser);

    const res = await request(app.getHttpServer())
      .post('/api/admin/auth/refresh')
      .send({ refreshToken });

    expect(res.status).toBe(201);
    expect(res.body.data.accessToken).toBeDefined();
    expect(typeof res.body.data.accessToken).toBe('string');
    expect(res.body.data.refreshToken).toBeDefined();
    expect(typeof res.body.data.refreshToken).toBe('string');
  });

  it('refreshToken cannot access /api/admin/auth/info', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/admin/auth/info')
      .set('Authorization', `Bearer ${refreshToken}`);

    expect([40101, 40102, 40103]).toContain(res.body.code);
  });
});
