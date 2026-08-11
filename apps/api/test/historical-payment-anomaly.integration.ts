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
    assert.equal(task.status, 'pending');

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
        status: REFUND_STATUS.PROCESSING,
        reason: 'integration processing refund',
      },
    });

    await (detector as any).reconcileExistingCancelledPaidTasks();
    task = await prisma.paymentCompensationTask.findFirstOrThrow({
      where: { id: task.id },
    });
    assert.equal(task.status, 'pending', 'PROCESSING 退款不能自动关闭资金任务');
    assert.equal(task.amount, 1000, 'PROCESSING 退款不能减少尚未证明退回的资金敞口');
    assert.equal((task.callbackPayload as any)?.reconciliation?.activeRefundAmount, 400);
    assert.equal((task.callbackPayload as any)?.reconciliation?.successfulRefundAmount, 0);

    await prisma.orderRefund.update({
      where: { id: refund1.id },
      data: { status: REFUND_STATUS.CLOSED },
    });
    await (detector as any).reconcileExistingCancelledPaidTasks();
    task = await prisma.paymentCompensationTask.findFirstOrThrow({ where: { id: task.id } });
    assert.equal(task.status, 'pending', 'CLOSED 退款后任务必须继续待处理');
    assert.equal(task.amount, 1000, 'CLOSED 退款不能被当成用户已收到退款');
    assert.equal((task.callbackPayload as any)?.reconciliation?.activeRefundAmount, 0);

    await prisma.orderRefund.update({
      where: { id: refund1.id },
      data: { status: REFUND_STATUS.SUCCESS },
    });
    await (detector as any).reconcileExistingCancelledPaidTasks();
    task = await prisma.paymentCompensationTask.findFirstOrThrow({ where: { id: task.id } });
    assert.equal(task.status, 'pending', '部分成功退款后仍有敞口，任务不能关闭');
    assert.equal(task.amount, 600, '400分 SUCCESS 后剩余资金敞口应为600分');
    assert.equal((task.callbackPayload as any)?.reconciliation?.successfulRefundAmount, 400);

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

    await (detector as any).reconcileExistingCancelledPaidTasks();
    task = await prisma.paymentCompensationTask.findFirstOrThrow({ where: { id: task.id } });
    assert.equal(task.status, 'pending', '剩余600分仅 PROCESSING 时仍不能关闭任务');
    assert.equal(task.amount, 600, '处理中退款不能进一步减少现金敞口');
    assert.equal((task.callbackPayload as any)?.reconciliation?.activeRefundAmount, 600);

    await prisma.orderRefund.update({
      where: { id: refund2.id },
      data: { status: REFUND_STATUS.SUCCESS },
    });
    await (detector as any).reconcileExistingCancelledPaidTasks();
    task = await prisma.paymentCompensationTask.findFirstOrThrow({ where: { id: task.id } });
    assert.equal(task.status, 'resolved', 'SUCCESS 退款覆盖全部实付后任务应自动闭环');
    assert.equal(task.amount, 0);
    assert.equal(task.handledBy, 'system:historical-cancelled-paid-reconcile');
    assert.ok(task.handledAt, '系统自动闭环应记录 handledAt');

    await prisma.paymentCompensationTask.delete({ where: { id: task.id } });
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
