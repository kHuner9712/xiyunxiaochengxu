import { InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { ProductionUserService } from './production-user.service';

describe('ProductionUserService', () => {
  function createHarness(status: number | null = 1) {
    const tx = {
      $queryRaw: jest.fn().mockResolvedValue(
        status === null ? [] : [{ id: 7n, status }],
      ),
      user: {
        update: jest.fn().mockResolvedValue({ id: 7n }),
      },
    };
    const prisma = {
      $transaction: jest.fn(async (callback: any) => callback(tx)),
    } as any;
    const redis = {
      delByPattern: jest.fn().mockResolvedValue(2),
      del: jest.fn().mockResolvedValue(undefined),
    } as any;
    return {
      service: new ProductionUserService(prisma, redis),
      prisma,
      redis,
      tx,
    };
  }

  it('revokes all WeApp sessions before disabling a user', async () => {
    const { service, redis, tx } = createHarness(1);

    await expect(service.toggleStatus('7')).resolves.toEqual({ id: '7', status: 0 });

    expect(redis.delByPattern).toHaveBeenCalledWith('weapp_access_token:7:*');
    expect(redis.del).toHaveBeenCalledWith('wechat_session:7');
    expect(tx.user.update).toHaveBeenCalledWith({
      where: { id: 7n },
      data: { status: 0 },
    });
    expect(redis.del.mock.invocationCallOrder[0]).toBeLessThan(
      tx.user.update.mock.invocationCallOrder[0],
    );
  });

  it('revokes stale sessions again before re-enabling a user', async () => {
    const { service, redis, tx } = createHarness(0);

    await expect(service.toggleStatus('7')).resolves.toEqual({ id: '7', status: 1 });

    expect(redis.delByPattern).toHaveBeenCalledWith('weapp_access_token:7:*');
    expect(redis.del).toHaveBeenCalledWith('wechat_session:7');
    expect(tx.user.update).toHaveBeenCalledWith({
      where: { id: 7n },
      data: { status: 1 },
    });
  });

  it('fails closed without changing status when session revocation fails', async () => {
    const { service, redis, tx } = createHarness(1);
    redis.delByPattern.mockRejectedValueOnce(new Error('redis unavailable'));

    await expect(service.toggleStatus('7')).rejects.toBeInstanceOf(
      InternalServerErrorException,
    );
    expect(tx.user.update).not.toHaveBeenCalled();
  });

  it('does not mutate anything when the user no longer exists', async () => {
    const { service, redis, tx } = createHarness(null);

    await expect(service.toggleStatus('7')).rejects.toBeInstanceOf(NotFoundException);
    expect(redis.delByPattern).not.toHaveBeenCalled();
    expect(redis.del).not.toHaveBeenCalled();
    expect(tx.user.update).not.toHaveBeenCalled();
  });
});
