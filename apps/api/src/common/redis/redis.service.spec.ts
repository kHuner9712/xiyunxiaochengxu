import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { RedisService } from './redis.service';

describe('RedisService.delByPattern', () => {
  it('uses incremental SCAN pages and deletes only matched keys', async () => {
    const client: any = {
      scan: jest
        .fn()
        .mockResolvedValueOnce(['17', ['admin_refresh_token:7:a', 'admin_refresh_token:7:b']])
        .mockResolvedValueOnce(['0', ['admin_refresh_token:7:c']]),
      del: jest
        .fn()
        .mockResolvedValueOnce(2)
        .mockResolvedValueOnce(1),
    };
    const service = new RedisService(client);

    const deleted = await service.delByPattern('admin_refresh_token:7:*', 100);

    expect(deleted).toBe(3);
    expect(client.scan).toHaveBeenNthCalledWith(
      1,
      '0',
      'MATCH',
      'admin_refresh_token:7:*',
      'COUNT',
      100,
    );
    expect(client.scan).toHaveBeenNthCalledWith(
      2,
      '17',
      'MATCH',
      'admin_refresh_token:7:*',
      'COUNT',
      100,
    );
    expect(client.del).toHaveBeenNthCalledWith(
      1,
      'admin_refresh_token:7:a',
      'admin_refresh_token:7:b',
    );
    expect(client.del).toHaveBeenNthCalledWith(
      2,
      'admin_refresh_token:7:c',
    );
  });
});

describe('RedisService scheduler maintenance marker', () => {
  let tempDir: string;
  let markerPath: string;
  let previousBuildSha: string | undefined;
  let previousPauseFile: string | undefined;
  let client: { set: jest.Mock };
  let service: RedisService;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'baby-mall-scheduler-pause-'));
    markerPath = path.join(tempDir, '.scheduler-paused');
    previousBuildSha = process.env.BUILD_SHA;
    previousPauseFile = process.env.SCHEDULER_PAUSE_FILE;
    process.env.BUILD_SHA = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
    process.env.SCHEDULER_PAUSE_FILE = markerPath;
    client = { set: jest.fn().mockResolvedValue('OK') };
    service = new RedisService(client as any);
  });

  afterEach(async () => {
    await service.onApplicationShutdown();
    if (previousBuildSha === undefined) delete process.env.BUILD_SHA;
    else process.env.BUILD_SHA = previousBuildSha;
    if (previousPauseFile === undefined) delete process.env.SCHEDULER_PAUSE_FILE;
    else process.env.SCHEDULER_PAUSE_FILE = previousPauseFile;
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('blocks schedule locks for the candidate build without touching Redis', async () => {
    fs.writeFileSync(markerPath, `${process.env.BUILD_SHA}\n`);

    await expect(service.setNX('schedule:payment_reconcile', 'lock', 60)).resolves.toBe(false);
    expect(client.set).not.toHaveBeenCalled();
  });

  it('does not block non-scheduler locks even when the candidate marker matches', async () => {
    fs.writeFileSync(markerPath, `${process.env.BUILD_SHA}\n`);

    await expect(service.setNX('payment:callback:123', 'lock', 60)).resolves.toBe(true);
    expect(client.set).toHaveBeenCalledWith('payment:callback:123', 'lock', 'EX', 60, 'NX');
  });

  it('does not pause a previous build when the marker belongs to another candidate', async () => {
    fs.writeFileSync(markerPath, 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb\n');

    await expect(service.setNX('schedule:refund_reconcile', 'lock', 60)).resolves.toBe(true);
    expect(client.set).toHaveBeenCalledWith('schedule:refund_reconcile', 'lock', 'EX', 60, 'NX');
  });

  it('resumes schedule locks after the matching marker is removed', async () => {
    fs.writeFileSync(markerPath, `${process.env.BUILD_SHA}\n`);
    await expect(service.setNX('schedule:close_timeout_orders', 'first', 60)).resolves.toBe(false);

    fs.rmSync(markerPath);
    await expect(service.setNX('schedule:close_timeout_orders', 'second', 60)).resolves.toBe(true);
    expect(client.set).toHaveBeenCalledWith('schedule:close_timeout_orders', 'second', 'EX', 60, 'NX');
  });
});

describe('RedisService scheduler lock heartbeat', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('renews a scheduler lock with the same token and stops after release', async () => {
    const client: any = {
      set: jest.fn().mockResolvedValue('OK'),
      eval: jest.fn().mockResolvedValue(1),
      quit: jest.fn().mockResolvedValue(undefined),
    };
    const service = new RedisService(client);

    await expect(service.setNX('schedule:test', 'owner-a', 3)).resolves.toBe(true);
    await jest.advanceTimersByTimeAsync(1000);

    expect(client.eval).toHaveBeenCalledTimes(1);
    expect(client.eval.mock.calls[0][0]).toContain('expire');
    expect(client.eval.mock.calls[0].slice(1)).toEqual([1, 'schedule:test', 'owner-a', '3']);

    await expect(service.releaseLockWithLua('schedule:test', 'owner-a')).resolves.toBe(true);
    expect(client.eval).toHaveBeenCalledTimes(2);

    await jest.advanceTimersByTimeAsync(5000);
    expect(client.eval).toHaveBeenCalledTimes(2);
    await service.onApplicationShutdown();
  });

  it('stops renewing when Redis reports that ownership was lost', async () => {
    const client: any = {
      set: jest.fn().mockResolvedValue('OK'),
      eval: jest.fn().mockResolvedValueOnce(0),
      quit: jest.fn().mockResolvedValue(undefined),
    };
    const service = new RedisService(client);

    await expect(service.setNX('schedule:test', 'owner-a', 3)).resolves.toBe(true);
    await jest.advanceTimersByTimeAsync(1000);
    expect(client.eval).toHaveBeenCalledTimes(1);

    await jest.advanceTimersByTimeAsync(5000);
    expect(client.eval).toHaveBeenCalledTimes(1);
    await service.onApplicationShutdown();
  });

  it('does not create heartbeats for non-scheduler locks', async () => {
    const client: any = {
      set: jest.fn().mockResolvedValue('OK'),
      eval: jest.fn(),
      quit: jest.fn().mockResolvedValue(undefined),
    };
    const service = new RedisService(client);

    await expect(service.setNX('payment:callback:123', 'owner-a', 3)).resolves.toBe(true);
    await jest.advanceTimersByTimeAsync(5000);

    expect(client.eval).not.toHaveBeenCalled();
    await service.onApplicationShutdown();
  });

  it('clears scheduler heartbeat timers before Redis shutdown', async () => {
    const client: any = {
      set: jest.fn().mockResolvedValue('OK'),
      eval: jest.fn(),
      quit: jest.fn().mockResolvedValue(undefined),
    };
    const service = new RedisService(client);

    await expect(service.setNX('schedule:test', 'owner-a', 3)).resolves.toBe(true);
    await service.onApplicationShutdown();
    await jest.advanceTimersByTimeAsync(5000);

    expect(client.eval).not.toHaveBeenCalled();
    expect(client.quit).toHaveBeenCalledTimes(1);
  });
});