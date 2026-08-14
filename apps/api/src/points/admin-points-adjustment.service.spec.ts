import { BadRequestException } from '@nestjs/common';
import { jest } from '@jest/globals';
import { AdminPointsAdjustmentService } from './admin-points-adjustment.service';

describe('AdminPointsAdjustmentService', () => {
  it('durably replays the same positive request even if the visible balance later returns to its old value', async () => {
    let availablePoints = 100;
    let totalPoints = 500;
    let existingRecord: any = null;
    const pointsRecordCreate = jest.fn(async ({ data }: any) => {
      existingRecord = {
        userId: data.userId,
        type: data.type,
        points: data.points,
        balance: data.balance,
        description: data.description,
        source: data.source,
        sourceId: data.sourceId,
      };
      return { id: 1n };
    });
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
      pointsRecord: {
        findFirst: jest.fn(async ({ where }: any) =>
          existingRecord?.source === where.source && existingRecord?.sourceId === where.sourceId
            ? existingRecord
            : null,
        ),
        create: pointsRecordCreate,
      },
    };
    const service = new AdminPointsAdjustmentService({
      $transaction: jest.fn(async (callback: any) => callback(tx)),
    } as any);

    await expect(service.adjust('7', 20, '人工补偿', 100, '9001')).resolves.toMatchObject({
      replayed: false,
      beforeAvailablePoints: 100,
      afterAvailablePoints: 120,
    });
    expect(availablePoints).toBe(120);
    expect(totalPoints).toBe(520);
    expect(pointsRecordCreate).toHaveBeenCalledTimes(1);
    const positiveCreateArgs = pointsRecordCreate.mock.calls[0]?.[0] as any;
    expect(positiveCreateArgs).toMatchObject({
      data: {
        userId: 7n,
        type: 1,
        points: 20,
        balance: 120,
        source: 'admin_adjust',
        sourceId: 9001n,
        description: '人工补偿',
      },
    });
    expect(positiveCreateArgs.data.expireAt).toBeInstanceOf(Date);

    // Simulate an ABA balance: unrelated activity later returns the visible balance to 100.
    // A balance-only retry guard would now accept the old request again; durable request identity must not.
    availablePoints = 100;
    await expect(service.adjust('7', 20, '人工补偿', 100, '9001')).resolves.toMatchObject({
      replayed: true,
      beforeAvailablePoints: 100,
      afterAvailablePoints: 120,
    });
    expect(tx.user.update).toHaveBeenCalledTimes(1);
    expect(pointsRecordCreate).toHaveBeenCalledTimes(1);
    expect(totalPoints).toBe(520);
  });

  it('deducts available points without reducing historical total earned points and persists the request id', async () => {
    let availablePoints = 100;
    let totalPoints = 500;
    const pointsRecordCreate = jest.fn(async (_args: any) => ({ id: 2n }));
    const tx = {
      $queryRaw: jest.fn(async () => [{ id: 7n }]),
      user: {
        findFirst: jest.fn(async () => ({ id: 7n, availablePoints, totalPoints })),
        update: jest.fn(async ({ data }: any) => {
          if (data.availablePoints?.decrement) availablePoints -= data.availablePoints.decrement;
          return { id: 7n };
        }),
      },
      pointsRecord: {
        findFirst: jest.fn(async () => null),
        create: pointsRecordCreate,
      },
    };
    const service = new AdminPointsAdjustmentService({
      $transaction: jest.fn(async (callback: any) => callback(tx)),
    } as any);

    await expect(service.adjust('7', -30, '纠正误发', 100, '9002')).resolves.toMatchObject({
      replayed: false,
      beforeAvailablePoints: 100,
      afterAvailablePoints: 70,
    });
    expect(availablePoints).toBe(70);
    expect(totalPoints).toBe(500);
    const negativeCreateArgs = pointsRecordCreate.mock.calls[0]?.[0] as any;
    expect(negativeCreateArgs).toMatchObject({
      data: {
        type: 2,
        points: 30,
        balance: 70,
        source: 'admin_adjust',
        sourceId: 9002n,
      },
    });
    expect(negativeCreateArgs.data.expireAt).toBeUndefined();
  });

  it('fails before writing when a genuinely new request uses a stale rendered balance', async () => {
    const tx = {
      $queryRaw: jest.fn(async () => [{ id: 7n }]),
      user: {
        findFirst: jest.fn(async () => ({ id: 7n, availablePoints: 110, totalPoints: 500 })),
        update: jest.fn(),
      },
      pointsRecord: {
        findFirst: jest.fn(async () => null),
        create: jest.fn(),
      },
    };
    const service = new AdminPointsAdjustmentService({
      $transaction: jest.fn(async (callback: any) => callback(tx)),
    } as any);

    await expect(service.adjust('7', 10, '测试', 100, '9003')).rejects.toBeInstanceOf(BadRequestException);
    expect(tx.user.update).not.toHaveBeenCalled();
    expect(tx.pointsRecord.create).not.toHaveBeenCalled();
  });

  it('rejects reuse of a durable request id with a different operation payload', async () => {
    const tx = {
      $queryRaw: jest.fn(async () => [{ id: 7n }]),
      user: {
        findFirst: jest.fn(async () => ({ id: 7n, availablePoints: 120, totalPoints: 520 })),
        update: jest.fn(),
      },
      pointsRecord: {
        findFirst: jest.fn(async () => ({
          userId: 7n,
          type: 1,
          points: 20,
          balance: 120,
          description: '第一次操作',
        })),
        create: jest.fn(),
      },
    };
    const service = new AdminPointsAdjustmentService({
      $transaction: jest.fn(async (callback: any) => callback(tx)),
    } as any);

    await expect(service.adjust('7', 30, '第二次操作', 120, '9004')).rejects.toThrow(
      '积分调整请求ID已被其他操作使用',
    );
    expect(tx.user.update).not.toHaveBeenCalled();
    expect(tx.pointsRecord.create).not.toHaveBeenCalled();
  });
});
