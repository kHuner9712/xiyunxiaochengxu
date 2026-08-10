import { MemberGrowthConservingPaymentService } from './member-growth-conserving-payment.service';

describe('MemberGrowthConservingPaymentService', () => {
  it('50%到100%累计退款只回退成长值增量，并按成长值同步降级', async () => {
    let refundAmounts = [5000];
    let growthValue = 120;
    let memberLevelId: bigint | null = 2n;
    const taskState: any = {
      id: 99n,
      callbackPayload: { orderId: '88', clawedGrowthValue: 0 },
      status: 'pending',
    };
    const levelRecords: any[] = [];
    const userUpdates: any[] = [];

    const tx: any = {
      $queryRaw: jest.fn(async () => [{ id: 1n }]),
      order: {
        findUnique: jest.fn(async () => ({
          id: 88n,
          orderNo: 'XY-REFUND-GROWTH',
          userId: 7n,
          payAmount: 10000,
        })),
      },
      paymentCompensationTask: {
        findFirst: jest.fn(async () => taskState),
        create: jest.fn(async () => taskState),
        update: jest.fn(async ({ data }: any) => {
          Object.assign(taskState, data);
          return taskState;
        }),
      },
      orderRefund: {
        findMany: jest.fn(async () => refundAmounts.map((refundAmount) => ({ refundAmount }))),
      },
      pointsRecord: {
        aggregate: jest.fn(async () => ({ _sum: { points: 100 } })),
      },
      user: {
        findFirst: jest.fn(async () => ({ growthValue, memberLevelId })),
        update: jest.fn(async ({ data }: any) => {
          userUpdates.push(data);
          if (data.growthValue?.decrement) growthValue -= data.growthValue.decrement;
          if (data.memberLevelId !== undefined) memberLevelId = data.memberLevelId;
          return {};
        }),
      },
      memberLevel: {
        findMany: jest.fn(async () => [
          { id: 1n, name: '普通会员', minGrowthValue: 0, maxGrowthValue: 99, discountRate: 100, pointsRate: 10, sortOrder: 1, status: 1 },
          { id: 2n, name: '银卡会员', minGrowthValue: 100, maxGrowthValue: null, discountRate: 90, pointsRate: 15, sortOrder: 2, status: 1 },
        ]),
      },
      userMemberRecord: {
        create: jest.fn(async ({ data }: any) => {
          levelRecords.push(data);
          return {};
        }),
      },
    };
    const prisma: any = {
      $transaction: jest.fn(async (callback: any) => callback(tx)),
    };
    const service = Object.create(MemberGrowthConservingPaymentService.prototype) as any;
    service.memberGrowthPrisma = prisma;

    const half = await service.reconcileOrderRefundGrowth(88n);
    expect(half).toEqual({ clawedDelta: 50, outstandingGrowthClawback: 0 });
    expect(growthValue).toBe(70);
    expect(memberLevelId).toBe(1n);
    expect(taskState.callbackPayload).toMatchObject({
      growthClawbackTarget: 50,
      clawedGrowthValue: 50,
      outstandingGrowthClawback: 0,
    });
    expect(levelRecords).toHaveLength(1);

    refundAmounts = [5000, 5000];
    taskState.status = 'pending';
    const full = await service.reconcileOrderRefundGrowth(88n);
    expect(full).toEqual({ clawedDelta: 50, outstandingGrowthClawback: 0 });
    expect(growthValue).toBe(20);
    expect(taskState.callbackPayload).toMatchObject({
      growthClawbackTarget: 100,
      clawedGrowthValue: 100,
      outstandingGrowthClawback: 0,
    });

    taskState.status = 'pending';
    const retry = await service.reconcileOrderRefundGrowth(88n);
    expect(retry).toEqual({ clawedDelta: 0, outstandingGrowthClawback: 0 });
    expect(growthValue).toBe(20);

    const growthDecrements = userUpdates.filter((data) => data.growthValue?.decrement);
    expect(growthDecrements.map((data) => data.growthValue.decrement)).toEqual([50, 50]);
  });
});
