import { BadRequestException } from '@nestjs/common';
import { jest } from '@jest/globals';
import { AdminPointsAdjustmentService } from './admin-points-adjustment.service';

describe('AdminPointsAdjustmentService', () => {
  it('applies one positive adjustment and rejects a retry with the stale balance version', async () => {
    let availablePoints = 100;
    let totalPoints = 500;
    const pointsRecordCreate = jest.fn(async () => ({ id: 1n }));
    const tx = {
      $queryRaw: jest.fn(async () => [{ id: 7n }]),
      user: {
        findFirst: jest.fn(async () => ({ id: 7n, availablePoints, totalPoints })),
        update: jest.fn(async ({ data }: any) => {
          if (data.availablePoints?.increment) availablePoints += data.availablePoints.increment;
          if (data.totalPoints?.increment) totalPoints += data.totalPoints.increment;
          return { id: 7n };
        }),
      },
      pointsRecord: { create: pointsRecordCreate },
    };
    const transaction = jest.fn(async (callback: any) => callback(tx));
    const service = new AdminPointsAdjustmentService({ $transaction: transaction } as any);

    await expect(service.adjust('7', 20, '人工补偿', 100)).resolves.toMatchObject({
      beforeAvailablePoints: 100,
      afterAvailablePoints: 120,
    });
    expect(availablePoints).toBe(120);
    expect(totalPoints).toBe(520);
    expect(pointsRecordCreate).toHaveBeenCalledTimes(1);
    expect(pointsRecordCreate.mock.calls[0][0]).toMatchObject({
      data: {
        userId: 7n,
        type: 1,
        points: 20,
        balance: 120,
        source: 'admin_adjust',
        description: '人工补偿',
      },
    });
    expect((pointsRecordCreate.mock.calls[0][0] as any).data.expireAt).toBeInstanceOf(Date);

    await expect(service.adjust('7', 20, '人工补偿', 100)).rejects.toThrow('用户积分已变更');
    expect(availablePoints).toBe(120);
    expect(totalPoints).toBe(520);
    expect(pointsRecordCreate).toHaveBeenCalledTimes(1);
  });

  it('deducts available points without reducing historical total earned points', async () => {
    let availablePoints = 100;
    let totalPoints = 500;
    const pointsRecordCreate = jest.fn(async () => ({ id: 2n }));
    const tx = {
      $queryRaw: jest.fn(async () => [{ id: 7n }]),
      user: {
        findFirst: jest.fn(async () => ({ id: 7n, availablePoints, totalPoints })),
        update: jest.fn(async ({ data }: any) => {
          if (data.availablePoints?.decrement) availablePoints -= data.availablePoints.decrement;
          return { id: 7n };
        }),
      },
      pointsRecord: { create: pointsRecordCreate },
    };
    const service = new AdminPointsAdjustmentService({
      $transaction: jest.fn(async (callback: any) => callback(tx)),
    } as any);

    await expect(service.adjust('7', -30, '纠正误发', 100)).resolves.toMatchObject({
      beforeAvailablePoints: 100,
      afterAvailablePoints: 70,
    });
    expect(availablePoints).toBe(70);
    expect(totalPoints).toBe(500);
    expect(pointsRecordCreate.mock.calls[0][0]).toMatchObject({
      data: {
        type: 2,
        points: 30,
        balance: 70,
        source: 'admin_adjust',
      },
    });
    expect((pointsRecordCreate.mock.calls[0][0] as any).data.expireAt).toBeUndefined();
  });

  it('fails before writing when the rendered balance no longer matches', async () => {
    const tx = {
      $queryRaw: jest.fn(async () => [{ id: 7n }]),
      user: {
        findFirst: jest.fn(async () => ({ id: 7n, availablePoints: 110, totalPoints: 500 })),
        update: jest.fn(),
      },
      pointsRecord: { create: jest.fn() },
    };
    const service = new AdminPointsAdjustmentService({
      $transaction: jest.fn(async (callback: any) => callback(tx)),
    } as any);

    await expect(service.adjust('7', 10, '测试', 100)).rejects.toBeInstanceOf(BadRequestException);
    expect(tx.user.update).not.toHaveBeenCalled();
    expect(tx.pointsRecord.create).not.toHaveBeenCalled();
  });
});
