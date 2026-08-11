import { MemberGrowthConservingPaymentService } from './member-growth-conserving-payment.service';

const completedAt = new Date('2026-08-10T12:00:00.000Z');
const beforeCompletion = new Date('2026-08-10T11:00:00.000Z');
const afterCompletion = new Date('2026-08-10T13:00:00.000Z');

describe('MemberGrowthConservingPaymentService', () => {
  it('50%到100%累计退款只回退成长值增量，并按成长值同步降级', async () => {
    let refunds = [{ refundAmount: 5000, updatedAt: afterCompletion }];
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
          completedAt,
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
        findMany: jest.fn(async () => refunds),
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
      preCompletionRefundAmount: 0,
      growthGrantedAtCompletion: 100,
      growthThatShouldRemain: 50,
      growthClawbackTarget: 50,
      clawedGrowthValue: 50,
      outstandingGrowthClawback: 0,
    });
    expect(levelRecords).toHaveLength(1);

    refunds = [
      { refundAmount: 5000, updatedAt: afterCompletion },
      { refundAmount: 5000, updatedAt: new Date('2026-08-10T14:00:00.000Z') },
    ];
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

  it('完成前已成功退款的金额不二次回退成长值，完成后新增退款才回退差额', async () => {
    let refunds = [{ refundAmount: 5000, updatedAt: beforeCompletion }];
    let growthValue = 70;
    const taskState: any = {
      id: 100n,
      callbackPayload: { orderId: '89', clawedGrowthValue: 0 },
      status: 'pending',
    };
    const growthDecrements: number[] = [];

    const tx: any = {
      $queryRaw: jest.fn(async () => [{ id: 1n }]),
      order: {
        findUnique: jest.fn(async () => ({
          id: 89n,
          orderNo: 'XY-EARLY-REFUND-GROWTH',
          userId: 8n,
          payAmount: 10000,
          completedAt,
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
        findMany: jest.fn(async () => refunds),
      },
      user: {
        findFirst: jest.fn(async () => ({ growthValue, memberLevelId: 1n })),
        update: jest.fn(async ({ data }: any) => {
          if (data.growthValue?.decrement) {
            growthDecrements.push(data.growthValue.decrement);
            growthValue -= data.growthValue.decrement;
          }
          return {};
        }),
      },
      memberLevel: {
        findMany: jest.fn(async () => [
          { id: 1n, name: '普通会员', minGrowthValue: 0, maxGrowthValue: null, discountRate: 100, pointsRate: 10, sortOrder: 1, status: 1 },
        ]),
      },
      userMemberRecord: { create: jest.fn(async () => ({})) },
    };
    const prisma: any = {
      $transaction: jest.fn(async (callback: any) => callback(tx)),
    };
    const service = Object.create(MemberGrowthConservingPaymentService.prototype) as any;
    service.memberGrowthPrisma = prisma;

    const earlyOnly = await service.reconcileOrderRefundGrowth(89n);
    expect(earlyOnly).toEqual({ clawedDelta: 0, outstandingGrowthClawback: 0 });
    expect(growthValue).toBe(70);
    expect(taskState.callbackPayload).toMatchObject({
      cumulativeRefundAmount: 5000,
      preCompletionRefundAmount: 5000,
      growthGrantedAtCompletion: 50,
      growthThatShouldRemain: 50,
      growthClawbackTarget: 0,
    });

    refunds = [
      { refundAmount: 5000, updatedAt: beforeCompletion },
      { refundAmount: 2500, updatedAt: afterCompletion },
    ];
    taskState.status = 'pending';
    const laterRefund = await service.reconcileOrderRefundGrowth(89n);
    expect(laterRefund).toEqual({ clawedDelta: 25, outstandingGrowthClawback: 0 });
    expect(growthValue).toBe(45);
    expect(taskState.callbackPayload).toMatchObject({
      cumulativeRefundAmount: 7500,
      preCompletionRefundAmount: 5000,
      growthGrantedAtCompletion: 50,
      growthThatShouldRemain: 25,
      growthClawbackTarget: 25,
      clawedGrowthValue: 25,
    });
    expect(growthDecrements).toEqual([25]);
  });
});
