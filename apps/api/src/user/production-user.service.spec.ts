import {
  BadRequestException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
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
      order: {
        findFirst: jest.fn().mockResolvedValue(null),
      },
      aftersaleOrder: {
        findFirst: jest.fn().mockResolvedValue(null),
      },
      orderRefund: {
        findFirst: jest.fn().mockResolvedValue(null),
      },
      cart: {
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      userAddress: {
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      babyProfile: {
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      userProfile: {
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
    };
    const prisma = {
      systemConfig: {
        findFirst: jest.fn().mockResolvedValue(null),
      },
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

  it('cancels an eligible account, erases direct PII and revokes sessions twice', async () => {
    const { service, redis, tx } = createHarness(1);

    const result = await service.cancelAccount('7');

    expect(result.cancelled).toBe(true);
    expect(tx.cart.deleteMany).toHaveBeenCalledWith({ where: { userId: 7n } });
    expect(tx.userAddress.deleteMany).toHaveBeenCalledWith({ where: { userId: 7n } });
    expect(tx.babyProfile.deleteMany).toHaveBeenCalledWith({ where: { userId: 7n } });
    expect(tx.userProfile.deleteMany).toHaveBeenCalledWith({ where: { userId: 7n } });
    expect(tx.user.update).toHaveBeenCalledWith({
      where: { id: 7n },
      data: expect.objectContaining({
        openid: expect.stringMatching(/^deleted_7_/),
        unionId: null,
        phone: null,
        nickname: null,
        avatarUrl: null,
        status: 0,
        deletedAt: expect.any(Date),
      }),
    });
    expect(redis.delByPattern).toHaveBeenCalledTimes(2);
    expect(redis.del).toHaveBeenCalledTimes(2);
  });

  it('blocks cancellation while an order is unfinished or inside the aftersale window', async () => {
    const { service, redis, tx } = createHarness(1);
    tx.order.findFirst.mockResolvedValue({
      id: 11n,
      orderNo: 'ORDER-ACTIVE',
      status: 'pending_delivery',
    });

    await expect(service.cancelAccount('7')).rejects.toBeInstanceOf(BadRequestException);
    expect(redis.delByPattern).not.toHaveBeenCalled();
    expect(tx.userAddress.deleteMany).not.toHaveBeenCalled();
    expect(tx.user.update).not.toHaveBeenCalled();
  });

  it('blocks cancellation while a refund remains unresolved', async () => {
    const { service, redis, tx } = createHarness(1);
    tx.orderRefund.findFirst.mockResolvedValue({
      id: 21n,
      outRefundNo: 'RF-ACTIVE',
      status: 'processing',
    });

    await expect(service.cancelAccount('7')).rejects.toBeInstanceOf(BadRequestException);
    expect(redis.delByPattern).not.toHaveBeenCalled();
    expect(tx.user.update).not.toHaveBeenCalled();
  });

  it('fails closed before erasing PII when the pre-cancellation Redis revoke fails', async () => {
    const { service, redis, tx } = createHarness(1);
    redis.delByPattern.mockRejectedValueOnce(new Error('redis unavailable'));

    await expect(service.cancelAccount('7')).rejects.toBeInstanceOf(
      InternalServerErrorException,
    );
    expect(tx.userAddress.deleteMany).not.toHaveBeenCalled();
    expect(tx.user.update).not.toHaveBeenCalled();
  });
});
