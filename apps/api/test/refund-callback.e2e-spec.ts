import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import request from 'supertest';
import { ConfigModule } from '@nestjs/config';
import { PaymentModule } from '../src/payment/payment.module';
import { BusinessEventModule } from '../src/common/business-event.module';
import { PaymentController } from '../src/payment/payment.controller';
import { PaymentService } from '../src/payment/payment.service';
import { PrismaService } from '../src/common/prisma/prisma.service';
import { RedisService } from '../src/common/redis/redis.service';
import {
  createMockPrismaService,
  createMockRedisService,
  createTestEnvConfig,
} from './helpers/mock-providers';
import { TransformInterceptor } from '../src/common/interceptors/transform.interceptor';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';

describe('PaymentController refund-callback (e2e)', () => {
  let app: INestApplication;
  let mockPrisma: ReturnType<typeof createMockPrismaService>;
  let mockRedis: ReturnType<typeof createMockRedisService>;
  let paymentService: {
    handleCallback: jest.Mock;
    handleRefundCallback: jest.Mock;
  };

  beforeAll(async () => {
    mockPrisma = createMockPrismaService();
    mockRedis = createMockRedisService();

    const mockPaymentService = {
      handleCallback: jest.fn(),
      handleRefundCallback: jest.fn(),
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          load: [() => createTestEnvConfig()],
        }),
        PaymentModule,
        BusinessEventModule,
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
        ping: jest.fn(),
        incr: jest.fn(),
        expire: jest.fn(),
        hset: jest.fn(),
        hget: jest.fn(),
        hgetall: jest.fn(),
        exists: jest.fn(),
        keys: jest.fn(),
        eval: jest.fn(),
      })
      .overrideProvider(PaymentService)
      .useValue(mockPaymentService)
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

    paymentService = moduleFixture.get<PaymentService>(PaymentService) as any;
  });

  afterAll(async () => {
    await app.close();
  });

  it('POST /api/weapp/pay/refund-callback returns raw response not wrapped by TransformInterceptor', async () => {
    paymentService.handleRefundCallback.mockResolvedValue({ code: 'SUCCESS', message: '' });

    const res = await request(app.getHttpServer())
      .post('/api/weapp/pay/refund-callback')
      .send({})
      .set('Content-Type', 'application/json');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ code: 'SUCCESS', message: '' });
    expect(res.body).not.toEqual({
      code: 0,
      message: 'success',
      data: expect.anything(),
    });
  });

  it('POST /api/weapp/pay/refund-callback with amount mismatch returns FAIL', async () => {
    paymentService.handleRefundCallback.mockResolvedValue({ code: 'FAIL', message: '退款金额不匹配' });

    const res = await request(app.getHttpServer())
      .post('/api/weapp/pay/refund-callback')
      .send({})
      .set('Content-Type', 'application/json');

    expect(res.status).toBe(200);
    expect(res.body.code).toBe('FAIL');
    expect(res.body.message).toBe('退款金额不匹配');
  });

  it('duplicate SUCCESS callback is idempotent - service called twice returns same result', async () => {
    paymentService.handleRefundCallback.mockClear();
    paymentService.handleRefundCallback.mockResolvedValue({ code: 'SUCCESS', message: '' });

    const res1 = await request(app.getHttpServer())
      .post('/api/weapp/pay/refund-callback')
      .send({})
      .set('Content-Type', 'application/json');

    const res2 = await request(app.getHttpServer())
      .post('/api/weapp/pay/refund-callback')
      .send({})
      .set('Content-Type', 'application/json');

    expect(res1.body).toEqual({ code: 'SUCCESS', message: '' });
    expect(res2.body).toEqual({ code: 'SUCCESS', message: '' });
    expect(paymentService.handleRefundCallback).toHaveBeenCalledTimes(2);
  });
});
