import assert from 'node:assert/strict';
import { OrderStatus, PrismaClient } from '@prisma/client';
import { PAYMENT_STATUS, REFUND_STATUS } from '../src/common/constants';
import { HistoricalAnomalyPaymentReconcileService } from '../src/payment/historical-anomaly-payment-reconcile.service';

function assertSafeIntegrationDatabase() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error('DATABASE_URL is required');
  const databaseName = decodeURIComponent(
    new URL(databaseUrl).pathname.replace(/^\//, ''),
  );
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
const CALLBACK_REASON = 'cancelled_order_paid_callback';

async function main() {
  await prisma.$connect();
  const suffix = `${Date.now()}${Math.floor(Math.random() * 100000)}`;
  const orderNo = `HPA${suffix}`.slice(0, 32);
  const transactionId = `WX-HPA-${suffix}`.slice(0, 64);
  let userId: bigint | null = null;
  let orderId: bigint | null = null;
  let paymentId: bigint | null = null;

  try {
    const user = await prisma.user.create({
      data: { openid: `historical-payment-${suffix}`.slice(0, 64) },
    });
    userId = user.id;

    const order = await prisma.order.create({
      data: {
        orderNo,
        userId: user.id,
        status: OrderStatus.cancelled,
        totalAmount: 1000,
        payAmount: 1000,
        receiverName: '集成测试用户',
        receiverPhone: '13800000000',
        cancelledAt: new Date(),
        cancelReason: 'integration historical race fixture',
      },
    });
    orderId = order.id;

    const payment = await prisma.orderPayment.create({
      data: {
        orderId: order.id,
        paymentNo: `P${suffix}`.slice(0, 64),
        transactionId,
        amount: 1000,
        paymentMethod: 'wechat',
        status: PAYMENT_STATUS.SUCCESS,
        paidAt: new Date(),
      },
    });
    paymentId = payment.id;

    const detector = new HistoricalAnomalyPaymentReconcileService(
      prisma as any,
      {} as any,
      {} as any,
    );

    const first = await (detector as any).seedCancelledPaidAnomalies();
    assert.equal(first.cancelledPaidDetected, 1, '未退款 cancelled+paid 应被检测');
    assert.equal(first.cancelledPaidSeeded, 1, '未退款 cancelled+paid 应创建人工补偿任务');

    let task = await prisma.paymentCompensationTask.findFirstOrThrow({
      where: { orderNo, reason: HISTORICAL_REASON, transactionId },
    });
    assert.equal(task.amount, 1000, '首次资金敞口应为完整实付金额');

    await prisma.paymentCompensationTask.delete({ where: { id: task.id } });
    const refund1 = await prisma.orderRefund.create({
      data: {
        refundNo: `R1${suffix}`.slice(0, 64),
        orderId: order.id,
        paymentId: payment.id,
        outTradeNo: orderNo,
        transactionId,
        outRefundNo: `OR1${suffix}`.slice(0, 64),
        refundAmount: 400,
        totalAmount: 1000,
        status: REFUND_STATUS.SUCCESS,
        reason: 'integration partial refund',
      },
    });

    const partial = await (detector as any).seedCancelledPaidAnomalies();
    assert.equal(partial.cancelledPaidDetected, 1, '部分退款后仍应保留资金敞口');
    task = await prisma.paymentCompensationTask.findFirstOrThrow({
      where: { orderNo, reason: HISTORICAL_REASON, transactionId },
    });
    assert.equal(task.amount, 600, '部分退款后只记录剩余未覆盖金额');

    await prisma.paymentCompensationTask.delete({ where: { id: task.id } });
    const refund2 = await prisma.orderRefund.create({
      data: {
        refundNo: `R2${suffix}`.slice(0, 64),
        orderId: order.id,
        paymentId: payment.id,
        outTradeNo: orderNo,
        transactionId,
        outRefundNo: `OR2${suffix}`.slice(0, 64),
        refundAmount: 600,
        totalAmount: 1000,
        status: REFUND_STATUS.PROCESSING,
        reason: 'integration remaining refund',
      },
    });

    const fullyCovered = await (detector as any).seedCancelledPaidAnomalies();
    assert.equal(fullyCovered.cancelledPaidDetected, 0, '有效退款已覆盖全部实付时不应再告警');
    assert.equal(
      await prisma.paymentCompensationTask.count({ where: { orderNo, reason: HISTORICAL_REASON } }),
      0,
      '全额退款覆盖后不得创建历史异常任务',
    );

    await prisma.orderRefund.deleteMany({ where: { id: { in: [refund1.id, refund2.id] } } });
    await prisma.paymentCompensationTask.create({
      data: {
        orderNo,
        transactionId,
        amount: 1000,
        reason: CALLBACK_REASON,
        status: 'pending',
        callbackPayload: { source: 'integration existing callback task' },
      },
    });

    const callbackCovered = await (detector as any).seedCancelledPaidAnomalies();
    assert.equal(callbackCovered.cancelledPaidDetected, 0, '已有旧 callback 补偿任务时不能重复告警');
    assert.equal(
      await prisma.paymentCompensationTask.count({ where: { orderNo, reason: HISTORICAL_REASON } }),
      0,
      '已有 callback 任务时不得再创建历史任务',
    );

    console.log('[historical-payment-anomaly.integration] PASS');
  } finally {
    await prisma.paymentCompensationTask.deleteMany({ where: { orderNo } }).catch(() => undefined);
    if (orderId) {
      await prisma.orderRefund.deleteMany({ where: { orderId } }).catch(() => undefined);
    }
    if (paymentId) {
      await prisma.orderPayment.deleteMany({ where: { id: paymentId } }).catch(() => undefined);
    }
    if (orderId) {
      await prisma.order.deleteMany({ where: { id: orderId } }).catch(() => undefined);
    }
    if (userId) {
      await prisma.user.deleteMany({ where: { id: userId } }).catch(() => undefined);
    }
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error('[historical-payment-anomaly.integration] FAIL', error);
  process.exitCode = 1;
});
