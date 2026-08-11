import assert from 'node:assert/strict';
import { OrderStatus, PrismaClient } from '@prisma/client';
import { PAYMENT_STATUS } from '../src/common/constants';
import { HistoricalAnomalyPaymentReconcileService } from '../src/payment/historical-anomaly-payment-reconcile.service';

function assertSafeIntegrationDatabase() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error('DATABASE_URL is required');
  const databaseName = decodeURIComponent(new URL(databaseUrl).pathname.replace(/^\//, ''));
  if (
    !/(^|[_-])test($|[_-])/i.test(databaseName) &&
    process.env.ALLOW_DESTRUCTIVE_INTEGRATION_TESTS !== 'true'
  ) {
    throw new Error(`Refusing destructive integration test against database "${databaseName}"`);
  }
}

assertSafeIntegrationDatabase();
const prisma = new PrismaClient();

const HISTORICAL_REASON = 'cancelled_order_paid_historical_anomaly';
const MISMATCH_REASON = 'cancelled_order_paid_amount_mismatch';

type ScenarioName = 'success' | 'notpay' | 'userpaying' | 'race-success' | 'mismatch';

async function main() {
  await prisma.$connect();
  const suffix = `${Date.now()}${Math.floor(Math.random() * 100000)}`;
  let userId: bigint | null = null;
  const orderIds: bigint[] = [];
  const paymentIds: bigint[] = [];
  const orderNos: string[] = [];

  try {
    const user = await prisma.user.create({
      data: { openid: `historical-created-${suffix}`.slice(0, 64) },
    });
    userId = user.id;

    const scenarios: Array<{ name: ScenarioName; payAmount: number }> = [
      { name: 'success', payAmount: 1000 },
      { name: 'notpay', payAmount: 1100 },
      { name: 'userpaying', payAmount: 1200 },
      { name: 'race-success', payAmount: 1300 },
      { name: 'mismatch', payAmount: 1400 },
    ];

    const fixtures = new Map<ScenarioName, { orderId: bigint; orderNo: string; paymentId: bigint; payAmount: number }>();

    for (const [index, scenario] of scenarios.entries()) {
      const orderNo = `HCP${index}${suffix}`.slice(0, 32);
      const order = await prisma.order.create({
        data: {
          orderNo,
          userId: user.id,
          status: OrderStatus.cancelled,
          totalAmount: scenario.payAmount,
          payAmount: scenario.payAmount,
          receiverName: '历史支付集成测试',
          receiverPhone: '13800000000',
          cancelledAt: new Date(),
          cancelReason: `integration ${scenario.name}`,
        },
      });
      const payment = await prisma.orderPayment.create({
        data: {
          orderId: order.id,
          paymentNo: `P${index}${suffix}`.slice(0, 64),
          amount: scenario.payAmount,
          paymentMethod: 'wechat',
          status: PAYMENT_STATUS.CREATED,
        },
      });
      orderIds.push(order.id);
      paymentIds.push(payment.id);
      orderNos.push(orderNo);
      fixtures.set(scenario.name, {
        orderId: order.id,
        orderNo,
        paymentId: payment.id,
        payAmount: scenario.payAmount,
      });
    }

    const queryCounts = new Map<string, number>();
    const closedOrderNos: string[] = [];
    const paymentService: any = {
      isPaymentStatusSyncAvailable: () => true,
      queryWechatOrder: async (orderNo: string) => {
        const call = (queryCounts.get(orderNo) || 0) + 1;
        queryCounts.set(orderNo, call);
        if (orderNo === fixtures.get('success')!.orderNo) {
          return {
            trade_state: 'SUCCESS',
            transaction_id: `WX-SUCCESS-${suffix}`,
            amount: { total: 1000 },
            success_time: '2026-08-01T12:00:00+08:00',
          };
        }
        if (orderNo === fixtures.get('notpay')!.orderNo) {
          return { trade_state: 'NOTPAY' };
        }
        if (orderNo === fixtures.get('userpaying')!.orderNo) {
          return { trade_state: 'USERPAYING' };
        }
        if (orderNo === fixtures.get('race-success')!.orderNo) {
          if (call === 1) return { trade_state: 'NOTPAY' };
          return {
            trade_state: 'SUCCESS',
            transaction_id: `WX-RACE-${suffix}`,
            amount: { total: 1300 },
          };
        }
        if (orderNo === fixtures.get('mismatch')!.orderNo) {
          return {
            trade_state: 'SUCCESS',
            transaction_id: `WX-MISMATCH-${suffix}`,
            amount: { total: 1500 },
          };
        }
        throw new Error(`unexpected order ${orderNo}`);
      },
      closeWechatOrderForCancellation: async (orderNo: string) => {
        closedOrderNos.push(orderNo);
        if (orderNo === fixtures.get('race-success')!.orderNo) {
          throw new Error('simulated close/payment race');
        }
      },
    };

    const detector = new HistoricalAnomalyPaymentReconcileService(
      prisma as any,
      paymentService,
      {} as any,
    );

    const result = await (detector as any).reconcileCancelledCreatedPayments(50);
    assert.equal(result.cancelledCreatedChecked, 5);
    assert.equal(result.cancelledCreatedSuccess, 2, '普通SUCCESS与关单竞态SUCCESS都应同步成功');
    assert.equal(result.cancelledCreatedClosed, 1, 'NOTPAY关单成功应形成安全终态');
    assert.equal(result.cancelledCreatedPending, 1, 'USERPAYING必须保持待确认');
    assert.equal(result.cancelledCreatedMismatch, 1, '金额不一致必须单独进入人工核账');
    assert.equal(result.cancelledCreatedFailed, 0);

    const successPayment = await prisma.orderPayment.findUniqueOrThrow({
      where: { id: fixtures.get('success')!.paymentId },
    });
    assert.equal(successPayment.status, PAYMENT_STATUS.SUCCESS);
    assert.equal(successPayment.transactionId, `WX-SUCCESS-${suffix}`);
    assert.ok(successPayment.paidAt);

    const notPayPayment = await prisma.orderPayment.findUniqueOrThrow({
      where: { id: fixtures.get('notpay')!.paymentId },
    });
    assert.equal(notPayPayment.status, PAYMENT_STATUS.FAILED);
    assert.ok(closedOrderNos.includes(fixtures.get('notpay')!.orderNo));

    const userPayingPayment = await prisma.orderPayment.findUniqueOrThrow({
      where: { id: fixtures.get('userpaying')!.paymentId },
    });
    assert.equal(userPayingPayment.status, PAYMENT_STATUS.CREATED);
    assert.equal((userPayingPayment.rawResponse as any)?.state, 'USERPAYING');

    const racedPayment = await prisma.orderPayment.findUniqueOrThrow({
      where: { id: fixtures.get('race-success')!.paymentId },
    });
    assert.equal(racedPayment.status, PAYMENT_STATUS.SUCCESS, '关单失败后复查SUCCESS绝不能标FAILED');
    assert.equal(racedPayment.transactionId, `WX-RACE-${suffix}`);
    assert.equal(queryCounts.get(fixtures.get('race-success')!.orderNo), 2);

    const mismatchPayment = await prisma.orderPayment.findUniqueOrThrow({
      where: { id: fixtures.get('mismatch')!.paymentId },
    });
    assert.equal(mismatchPayment.status, PAYMENT_STATUS.SUCCESS, '金额不一致仍应同步客观支付事实');
    assert.equal(mismatchPayment.transactionId, `WX-MISMATCH-${suffix}`);
    const mismatchTask = await prisma.paymentCompensationTask.findFirstOrThrow({
      where: {
        orderNo: fixtures.get('mismatch')!.orderNo,
        reason: MISMATCH_REASON,
        transactionId: `WX-MISMATCH-${suffix}`,
      },
    });
    assert.equal(mismatchTask.status, 'pending');
    assert.equal(mismatchTask.amount, 1500);
    assert.equal((mismatchTask.callbackPayload as any)?.expectedAmount, 1400);
    assert.equal((mismatchTask.callbackPayload as any)?.wechatAmount, 1500);

    // After CREATED->SUCCESS synchronization, the existing SUCCESS detector must surface normal
    // cancelled-paid cash exposure without creating a second task for amount mismatch cases.
    const seeded = await (detector as any).seedCancelledPaidAnomalies(50);
    assert.equal(seeded.cancelledPaidDetected, 2, '匹配金额的两笔SUCCESS应进入人工资金任务');
    assert.equal(seeded.cancelledPaidSeeded, 2);

    for (const scenario of ['success', 'race-success'] as const) {
      const fixture = fixtures.get(scenario)!;
      const task = await prisma.paymentCompensationTask.findFirstOrThrow({
        where: { orderNo: fixture.orderNo, reason: HISTORICAL_REASON },
      });
      assert.equal(task.status, 'pending');
      assert.equal(task.amount, fixture.payAmount);
    }
    assert.equal(
      await prisma.paymentCompensationTask.count({
        where: { orderNo: fixtures.get('mismatch')!.orderNo, reason: HISTORICAL_REASON },
      }),
      0,
      '金额不一致已有专属人工任务时不得再建普通历史资金任务',
    );

    console.log('[historical-cancelled-created-payment.integration] PASS');
  } finally {
    await prisma.paymentCompensationTask.deleteMany({ where: { orderNo: { in: orderNos } } }).catch(() => undefined);
    if (orderIds.length) {
      await prisma.orderRefund.deleteMany({ where: { orderId: { in: orderIds } } }).catch(() => undefined);
    }
    if (paymentIds.length) {
      await prisma.orderPayment.deleteMany({ where: { id: { in: paymentIds } } }).catch(() => undefined);
    }
    if (orderIds.length) {
      await prisma.order.deleteMany({ where: { id: { in: orderIds } } }).catch(() => undefined);
    }
    if (userId) {
      await prisma.user.deleteMany({ where: { id: userId } }).catch(() => undefined);
    }
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error('[historical-cancelled-created-payment.integration] FAIL', error);
  process.exitCode = 1;
});
