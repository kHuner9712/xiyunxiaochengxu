import { ConflictException, InternalServerErrorException } from '@nestjs/common';
import { jest } from '@jest/globals';
import { GrowthAwareCouponService } from './growth-aware-coupon.service';
import { IdempotentGrowthAwareCouponService } from './idempotent-growth-aware-coupon.service';

const REQUEST_ID = '1786449600000-abcdefghijklmnopqrstuvwx';

function createRedisMock() {
  const values = new Map<string, string>();
  return {
    values,
    get: jest.fn(async (key: string) => values.get(key) ?? null),
    set: jest.fn(async (key: string, value: string) => { values.set(key, value); }),
    setNX: jest.fn(async (key: string, value: string) => {
      if (values.has(key)) return false;
      values.set(key, value);
      return true;
    }),
    del: jest.fn(async (key: string) => { values.delete(key); }),
    releaseLockWithLua: jest.fn(async (key: string, value: string) => {
      if (values.get(key) !== value) return false;
      values.delete(key);
      return true;
    }),
  };
}

describe('IdempotentGrowthAwareCouponService', () => {
  afterEach(() => jest.restoreAllMocks());

  it('returns the same cached claim after the original response is lost', async () => {
    const redis = createRedisMock();
    const claimed = {
      id: '9001',
      userId: '7',
      couponId: '11',
      status: 1,
      name: '测试券',
    };
    const receiveSpy = jest
      .spyOn(GrowthAwareCouponService.prototype, 'receive')
      .mockResolvedValue(claimed as any);
    const service = new IdempotentGrowthAwareCouponService({} as any, redis as any);

    await expect(service.receiveIdempotent('7', '11', REQUEST_ID)).resolves.toEqual(claimed);
    await expect(service.receiveIdempotent('7', '11', REQUEST_ID)).resolves.toEqual(claimed);

    expect(receiveSpy).toHaveBeenCalledTimes(1);
    const requestEntries = [...redis.values.entries()].filter(([key]) => key.startsWith('coupon:claim:request:'));
    expect(requestEntries).toHaveLength(1);
    expect(JSON.parse(requestEntries[0][1])).toMatchObject({ state: 'success', result: claimed });
  });

  it('never re-executes an unresolved processing request', async () => {
    const redis = createRedisMock();
    redis.values.set(
      `coupon:claim:request:7:11:${REQUEST_ID}`,
      JSON.stringify({ state: 'processing', startedAt: Date.now() }),
    );
    const receiveSpy = jest.spyOn(GrowthAwareCouponService.prototype, 'receive');
    const service = new IdempotentGrowthAwareCouponService({} as any, redis as any);

    await expect(service.receiveIdempotent('7', '11', REQUEST_ID))
      .rejects.toBeInstanceOf(ConflictException);
    expect(receiveSpy).not.toHaveBeenCalled();
  });

  it('keeps the processing marker when MySQL succeeded but result persistence fails', async () => {
    const redis = createRedisMock();
    redis.set.mockRejectedValueOnce(new Error('redis unavailable'));
    const receiveSpy = jest
      .spyOn(GrowthAwareCouponService.prototype, 'receive')
      .mockResolvedValue({ id: '9001', couponId: '11' } as any);
    const service = new IdempotentGrowthAwareCouponService({} as any, redis as any);

    await expect(service.receiveIdempotent('7', '11', REQUEST_ID))
      .rejects.toBeInstanceOf(InternalServerErrorException);
    expect(receiveSpy).toHaveBeenCalledTimes(1);

    const requestKey = `coupon:claim:request:7:11:${REQUEST_ID}`;
    expect(JSON.parse(redis.values.get(requestKey)!)).toMatchObject({ state: 'processing' });

    await expect(service.receiveIdempotent('7', '11', REQUEST_ID))
      .rejects.toBeInstanceOf(ConflictException);
    expect(receiveSpy).toHaveBeenCalledTimes(1);
  });

  it('releases the request marker after a known business failure so the same action can retry', async () => {
    const redis = createRedisMock();
    const receiveSpy = jest
      .spyOn(GrowthAwareCouponService.prototype, 'receive')
      .mockRejectedValueOnce(new Error('temporary db failure'))
      .mockResolvedValueOnce({ id: '9002', couponId: '11' } as any);
    const service = new IdempotentGrowthAwareCouponService({} as any, redis as any);

    await expect(service.receiveIdempotent('7', '11', REQUEST_ID)).rejects.toThrow('temporary db failure');
    await expect(service.receiveIdempotent('7', '11', REQUEST_ID)).resolves.toMatchObject({ id: '9002' });
    expect(receiveSpy).toHaveBeenCalledTimes(2);
  });
});
