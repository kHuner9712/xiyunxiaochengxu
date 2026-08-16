import { HttpStatus } from '@nestjs/common';
import { jest } from '@jest/globals';
import { HealthController } from './health.controller';

function responseMock() {
  const res: any = {
    status: jest.fn(),
    json: jest.fn(),
  };
  res.status.mockReturnValue(res);
  res.json.mockImplementation((body: any) => body);
  return res;
}

describe('HealthController production Redis safety', () => {
  const originalNodeEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
    jest.restoreAllMocks();
  });

  it('reports healthy only when production Redis is persistent and non-evicting', async () => {
    process.env.NODE_ENV = 'production';
    const prisma = { $queryRaw: jest.fn(async () => [{ ok: 1 }]) } as any;
    const redis = {
      ping: jest.fn(async () => 'PONG'),
      getRuntimeSafetyConfig: jest.fn(async () => ({
        maxmemoryPolicy: 'noeviction',
        appendonly: 'yes',
        appendfsync: 'everysec',
      })),
      isSchedulerPausedForCurrentBuild: jest.fn(() => false),
    } as any;
    const res = responseMock();

    await new HealthController(prisma, redis).check(res);

    expect(res.status).toHaveBeenCalledWith(HttpStatus.OK);
    expect(res.json.mock.calls[0][0]).toMatchObject({
      status: 'ok',
      maintenance: false,
      services: { database: 'ok', redis: 'ok', redisSafety: 'ok', scheduler: 'ok' },
    });
  });

  it('fails production health when Redis is configured to evict correctness-critical keys', async () => {
    process.env.NODE_ENV = 'production';
    const prisma = { $queryRaw: jest.fn(async () => [{ ok: 1 }]) } as any;
    const redis = {
      ping: jest.fn(async () => 'PONG'),
      getRuntimeSafetyConfig: jest.fn(async () => ({
        maxmemoryPolicy: 'allkeys-lru',
        appendonly: 'yes',
        appendfsync: 'everysec',
      })),
      isSchedulerPausedForCurrentBuild: jest.fn(() => false),
    } as any;
    const res = responseMock();

    await new HealthController(prisma, redis).check(res);

    expect(res.status).toHaveBeenCalledWith(HttpStatus.SERVICE_UNAVAILABLE);
    expect(res.json.mock.calls[0][0]).toMatchObject({
      status: 'degraded',
      services: { database: 'ok', redis: 'error', redisSafety: 'error', scheduler: 'ok' },
    });
  });

  it('fails readiness while a global migration/scheduler maintenance marker is active', async () => {
    process.env.NODE_ENV = 'production';
    const prisma = { $queryRaw: jest.fn(async () => [{ ok: 1 }]) } as any;
    const redis = {
      ping: jest.fn(async () => 'PONG'),
      getRuntimeSafetyConfig: jest.fn(async () => ({
        maxmemoryPolicy: 'noeviction',
        appendonly: 'yes',
        appendfsync: 'everysec',
      })),
      isSchedulerPausedForCurrentBuild: jest.fn(() => true),
    } as any;
    const res = responseMock();

    await new HealthController(prisma, redis).check(res);

    expect(res.status).toHaveBeenCalledWith(HttpStatus.SERVICE_UNAVAILABLE);
    expect(res.json.mock.calls[0][0]).toMatchObject({
      status: 'degraded',
      maintenance: true,
      services: { database: 'ok', redis: 'ok', redisSafety: 'ok', scheduler: 'paused' },
    });
  });

  it('does not impose production persistence settings on isolated test Redis', async () => {
    process.env.NODE_ENV = 'test';
    const prisma = { $queryRaw: jest.fn(async () => [{ ok: 1 }]) } as any;
    const redis = {
      ping: jest.fn(async () => 'PONG'),
      getRuntimeSafetyConfig: jest.fn(),
      isSchedulerPausedForCurrentBuild: jest.fn(() => false),
    } as any;
    const res = responseMock();

    await new HealthController(prisma, redis).check(res);

    expect(redis.getRuntimeSafetyConfig).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(HttpStatus.OK);
  });
});