import { PointConservingPaymentService } from './point-conserving-payment.service';

const completedAt = new Date('2026-08-10T12:00:00.000Z');
const beforeCompletion = new Date('2026-08-10T11:00:00.000Z');
const afterCompletion = new Date('2026-08-10T13:00:00.000Z');

describe('PointConservingPaymentService refund timeline', () => {
  it('restores deducted points for all refunds but claws completion rewards only for post-completion refunds', async () => {
    const createdPointRecords: any[] = [];
    const userUpdates: any[] = [];
    const taskCreates: any[] = [];

    const tx: any = {
      $queryRaw: jest.fn(async () => [{ id: 1n }]),
      order: {
        findUnique: jest.fn(async () => ({
          id: 88n,
          orderNo: 'XY-POINT-TIMELINE',
          userId: 7n,
          payAmount: 10000,
          pointsDeducted: 1000,
          completedAt,
        })),
      },
      orderRefund: {
        findMany: jest.fn(async () => [
          { id: 1n, refundAmount: 5000, updatedAt: beforeCompletion },
          { id: 2n, refundAmount: 2500, updatedAt: afterCompletion },
        ]),
      },
      user: {
        findFirst: jest.fn(async () => ({ availablePoints: 1000 })),
        update: jest.fn(async ({ data }: any) => {
          userUpdates.push(data);
          return {};
        }),
      },
      aftersaleOrder: {
        findMany: jest.fn(async () => []),
      },
      pointsRecord: {
        aggregate: jest.fn(async ({ where }: any) => {
          if (where.source?.in?.includes?.('order_complete')) {
            return { _sum: { points: 75 } };
          }
          return { _sum: { points: 0 } };
        }),
        create: jest.fn(async ({ data }: any) => {
          createdPointRecords.push(data);
          return {};
        }),
      },
      paymentCompensationTask: {
        findFirst: jest.fn(async () => null),
        create: jest.fn(async ({ data }: any) => {
          taskCreates.push(data);
          return { id: 99n, ...data };
        }),
        update: jest.fn(async () => ({})),
      },
    };
    const prisma: any = {
      $transaction: jest.fn(async (callback: any) => callback(tx)),
    };
    const service = Object.create(PointConservingPaymentService.prototype) as any;
    service.conservationPrisma = prisma;

    const result = await service.reconcileOrderRefundPoints(88n);

    expect(result).toEqual({
      restoredDelta: 750,
      clawedDelta: 37,
      outstandingRewardClawback: 0,
    });
    expect(userUpdates).toContainEqual({ availablePoints: { increment: 750 } });
    expect(userUpdates).toContainEqual({ availablePoints: { decrement: 37 } });
    expect(createdPointRecords).toEqual(expect.arrayContaining([
      expect.objectContaining({
        type: 1,
        points: 750,
        source: 'refund_restore_reconcile',
        sourceId: 2n,
      }),
      expect.objectContaining({
        type: 2,
        points: 37,
        source: 'refund_reward_reconcile',
        sourceId: 2n,
      }),
    ]));
    expect(taskCreates.at(-1)?.callbackPayload).toMatchObject({
      cumulativeRefundAmount: 7500,
      preCompletionRefundAmount: 5000,
      rewardPayAmount: 5000,
      rewardRefundAmount: 2500,
      restoreDeductedTarget: 750,
      clawbackRewardTarget: 37,
      outstandingRewardClawback: 0,
    });
  });
});
