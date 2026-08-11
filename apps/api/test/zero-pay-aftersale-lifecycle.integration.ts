import assert from 'node:assert/strict';
import { ConfigService } from '@nestjs/config';
import { PrismaClient } from '@prisma/client';
import { PAYMENT_STATUS, REFUND_STATUS } from '../src/common/constants/payment';
import { DurableZeroPayAftersalePaymentService } from '../src/payment/durable-zero-pay-aftersale-payment.service';

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

async function cleanup() {
  await prisma.paymentCompensationTask.deleteMany();
  await prisma.orderRefund.deleteMany();
  await prisma.aftersaleLog.deleteMany();
  await prisma.aftersaleOrder.deleteMany();
  await prisma.orderPayment.deleteMany();
  await prisma.orderLog.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.pointsRecord.deleteMany();
  await prisma.productStockLog.deleteMany();
  await prisma.productSku.deleteMany();
  await prisma.product.deleteMany();
  await prisma.productCategory.deleteMany();
  await prisma.user.deleteMany();
}

async function main() {
  await prisma.$connect();
  await cleanup();

  let revokeAttempts = 0;
  const benefitPackage = {
    assertRefundable: async () => ({ ok: true }),
    freezeForRefund: async () => ({ frozen: true }),
    restoreAfterRefundClosed: async () => ({ restored: true }),
    revokeAfterRefundSuccess: async () => {
      revokeAttempts += 1;
      if (revokeAttempts === 1) throw new Error('simulated transient benefit storage failure');
      return { packages: 1, entitlements: 1 };
    },
  };
  let groupRefundEffects = 0;
  const groupBuy = {
    handleRefundSuccess: async () => {
      groupRefundEffects += 1;
      return { affected: 0 };
    },
  };
  const configService = new ConfigService({});
  const businessEvent = new Proxy({}, { get: () => async () => undefined });
  const noopService = new Proxy({}, { get: () => async () => undefined });
  const redis = {
    setNX: async () => true,
    releaseLockWithLua: async () => true,
  };

  const service = new DurableZeroPayAftersalePaymentService(
    prisma as any,
    configService,
    businessEvent as any,
    noopService as any,
    noopService as any,
    benefitPackage as any,
    noopService as any,
    groupBuy as any,
    noopService as any,
    redis as any,
  );

  try {
    const user = await prisma.user.create({
      data: { openid: 'zero-pay-aftersale-integration-user', availablePoints: 0 },
    });
    const category = await prisma.productCategory.create({
      data: { name: '0元售后集成测试分类' },
    });
    const product = await prisma.product.create({
      data: {
        name: '0元售后集成测试商品',
        categoryId: category.id,
        status: 1,
        minPrice: 1000,
        maxPrice: 1000,
      },
    });
    const sku = await prisma.productSku.create({
      data: {
        productId: product.id,
        skuCode: 'ZERO-AFTERSALE-INTEGRATION-SKU',
        price: 1000,
        stock: 8,
        sales: 2,
        status: 1,
      },
    });
    const order = await prisma.order.create({
      data: {
        orderNo: `ZA${Date.now()}`,
        userId: user.id,
        status: 'aftersale',
        totalAmount: 2000,
        discountAmount: 2000,
        payAmount: 0,
        receiverName: '集成测试用户',
        receiverPhone: '13800138000',
        province: '上海市',
        city: '上海市',
        district: '浦东新区',
        detailAddress: '真实库测试路1号',
      },
    });
    const orderItem = await prisma.orderItem.create({
      data: {
        orderId: order.id,
        productId: product.id,
        skuId: sku.id,
        productName: product.name,
        price: 1000,
        originalPrice: 1000,
        quantity: 2,
        subtotal: 2000,
      },
    });
    const payment = await prisma.orderPayment.create({
      data: {
        orderId: order.id,
        paymentNo: `ZP${Date.now()}`,
        transactionId: `ZERO-TX-${Date.now()}`,
        amount: 0,
        status: PAYMENT_STATUS.SUCCESS,
        paidAt: new Date(),
      },
    });
    const aftersale = await prisma.aftersaleOrder.create({
      data: {
        aftersaleNo: `ZAS${Date.now()}`,
        orderId: order.id,
        orderItemId: orderItem.id,
        activeOrderItemId: orderItem.id,
        userId: user.id,
        type: 2,
        reason: '真实库0元退货退款测试',
        description: '验证本地退款、库存、审计和补偿任务一致性',
        status: 'pending_refund',
        refundAmount: 0,
      },
    });

    const result = await service.createRefund({
      orderId: order.id.toString(),
      aftersaleId: aftersale.id.toString(),
      refundAmount: 0,
      reason: 'real-mysql-zero-pay-aftersale',
    });

    assert.equal(result.zeroPay, true);
    assert.equal(result.status, REFUND_STATUS.SUCCESS);

    const settledAftersale = await prisma.aftersaleOrder.findUniqueOrThrow({
      where: { id: aftersale.id },
    });
    assert.equal(settledAftersale.status, 'refunded');
    assert.equal(settledAftersale.activeOrderItemId, null);
    assert.ok(settledAftersale.refundedAt, '0元售后必须记录真实退款完成时间');

    const settledOrder = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    assert.equal(settledOrder.status, 'delivered', '无其他活跃售后时订单应恢复到履约状态');

    const settledSku = await prisma.productSku.findUniqueOrThrow({ where: { id: sku.id } });
    assert.equal(settledSku.stock, 10, '退货退款必须把2件真实库存归还');
    assert.equal(settledSku.sales, 0, '退货退款必须同步回退SKU销量');

    const stockLog = await prisma.productStockLog.findFirstOrThrow({
      where: { skuId: sku.id, reason: '0元售后退款归还库存' },
    });
    assert.equal(stockLog.quantity, 2);
    assert.equal(stockLog.beforeStock, 8);
    assert.equal(stockLog.afterStock, 10);

    const refund = await prisma.orderRefund.findFirstOrThrow({
      where: { aftersaleId: aftersale.id },
    });
    assert.equal(refund.status, REFUND_STATUS.SUCCESS);
    assert.equal(refund.refundAmount, 0);
    assert.equal(refund.totalAmount, 0);
    assert.equal(refund.refundId, `ZERO-${aftersale.id}`);
    assert.equal(refund.outTradeNo, order.orderNo);
    assert.equal(refund.transactionId, payment.transactionId);

    const aftersaleLog = await prisma.aftersaleLog.findFirstOrThrow({
      where: { aftersaleId: aftersale.id, action: 'refund' },
    });
    assert.match(aftersaleLog.content, /无需调用微信退款/);

    const pointsTask = await prisma.paymentCompensationTask.findFirstOrThrow({
      where: {
        orderNo: order.orderNo,
        reason: 'zero_refund_points_conservation',
        transactionId: `zero-refund-points:${order.id}`,
      },
    });
    assert.equal(pointsTask.status, 'resolved', '无积分债务的0元售后应自动完成积分守恒任务');

    assert.equal(revokeAttempts, 1, '首次权益撤销故意失败，用于验证持久补偿');
    const sideEffectResult = await (service as any).reconcileZeroPayRefundSideEffects(10);
    assert.deepEqual(sideEffectResult, { total: 1, resolved: 1, failed: 0 });
    assert.equal(revokeAttempts, 2, '持久补偿必须重新执行失败的权益撤销');

    const sideEffectTask = await prisma.paymentCompensationTask.findFirstOrThrow({
      where: {
        orderNo: order.orderNo,
        reason: 'zero_refund_side_effects',
        transactionId: `zero-refund-effects:${refund.id}`,
      },
    });
    assert.equal(sideEffectTask.status, 'resolved');
    assert.equal(sideEffectTask.handledBy, 'system:zero-refund-side-effects');
    assert.ok(sideEffectTask.handledAt);
    assert.ok(groupRefundEffects >= 2, '即时处理与持久补偿都必须执行拼团退款副作用入口');

    const repeated = await service.createRefund({
      orderId: order.id.toString(),
      aftersaleId: aftersale.id.toString(),
      refundAmount: 0,
      reason: 'idempotent-retry',
    });
    assert.equal(repeated.refundId, refund.id.toString(), '重复0元退款必须返回同一退款记录');
    assert.equal(
      await prisma.orderRefund.count({ where: { aftersaleId: aftersale.id } }),
      1,
      '重复调用不能生成第二笔退款审计记录',
    );

    console.log('[zero-pay-aftersale-lifecycle-integration] PASS');
  } finally {
    await cleanup();
    await prisma.$disconnect();
  }
}

main().catch(async (error) => {
  console.error('[zero-pay-aftersale-lifecycle-integration] FAIL', error);
  await prisma.$disconnect().catch(() => undefined);
  process.exitCode = 1;
});
