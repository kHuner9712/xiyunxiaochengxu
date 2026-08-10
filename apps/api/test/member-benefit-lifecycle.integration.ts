import assert from 'node:assert/strict';
import { PrismaClient } from '@prisma/client';
import { calculateOrderGrowthValue } from '../src/member/member-level-runtime';
import { MemberBenefitProductionOrderService } from '../src/order/member-benefit-production-order.service';
import { MemberGrowthConservingPaymentService } from '../src/payment/member-growth-conserving-payment.service';

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
    throw new Error(
      `Refusing destructive integration test against database "${databaseName}"`,
    );
  }
}

assertSafeIntegrationDatabase();
const prisma = new PrismaClient();

const businessEvent = new Proxy({}, { get: () => () => undefined });
const benefitPackage = { grantBenefitsForOrder: async () => undefined };
const promotionHooks = { handleOrderCancel: async () => undefined };
const redis = {
  setNX: async () => true,
  releaseLockWithLua: async () => true,
};

async function cleanup() {
  await prisma.paymentCompensationTask.deleteMany();
  await prisma.orderRefund.deleteMany();
  await prisma.userMemberRecord.deleteMany();
  await prisma.pointsRecord.deleteMany();
  await prisma.orderLog.deleteMany();
  await prisma.orderDelivery.deleteMany();
  await prisma.orderPayment.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.productStockLog.deleteMany();
  await prisma.cart.deleteMany();
  await prisma.productSku.deleteMany();
  await prisma.product.deleteMany();
  await prisma.productCategory.deleteMany();
  await prisma.userAddress.deleteMany();
  await prisma.user.deleteMany();
  await prisma.memberLevel.deleteMany();
}

async function main() {
  await prisma.$connect();
  await cleanup();

  const orderService = new MemberBenefitProductionOrderService(
    prisma as any,
    businessEvent as any,
    benefitPackage as any,
    promotionHooks as any,
    promotionHooks as any,
    redis as any,
    undefined,
  );

  try {
    const baseLevel = await prisma.memberLevel.create({
      data: {
        name: '真实库普通会员',
        minGrowthValue: 0,
        maxGrowthValue: 99,
        discountRate: 90,
        pointsRate: 15,
        sortOrder: 0,
        status: 1,
      },
    });
    const upgradedLevel = await prisma.memberLevel.create({
      data: {
        name: '真实库银卡会员',
        minGrowthValue: 100,
        maxGrowthValue: null,
        discountRate: 85,
        pointsRate: 20,
        sortOrder: 100,
        status: 1,
      },
    });

    const initialGrowth = 95;
    const user = await prisma.user.create({
      data: {
        openid: 'member-benefit-integration-user',
        growthValue: initialGrowth,
        memberLevelId: baseLevel.id,
        availablePoints: 0,
        totalPoints: 0,
      },
    });
    const address = await prisma.userAddress.create({
      data: {
        userId: user.id,
        receiverName: '会员权益真实库用户',
        receiverPhone: '13800138000',
        province: '上海市',
        city: '上海市',
        district: '浦东新区',
        detailAddress: '会员权益真实库测试路1号',
        isDefault: 1,
      },
    });
    const category = await prisma.productCategory.create({
      data: { name: '会员权益真实库分类' },
    });
    const product = await prisma.product.create({
      data: {
        name: '会员权益真实库商品',
        categoryId: category.id,
        status: 1,
        fulfillmentType: 'delivery',
      },
    });
    const sku = await prisma.productSku.create({
      data: {
        productId: product.id,
        skuCode: 'MEMBER-BENEFIT-INTEGRATION-SKU',
        price: 10000,
        originalPrice: 10000,
        stock: 20,
        status: 1,
      },
    });

    const input = {
      fulfillmentType: 'delivery',
      addressId: address.id.toString(),
      pointsDeduct: 0,
      items: [{ skuId: sku.id.toString(), quantity: 1 }],
    };

    const preview = await orderService.confirm(user.id.toString(), input);
    assert.equal(preview.totalAmount, 10000);
    assert.equal(preview.discountAmount, 1000, '真实普通订单预览必须应用当前会员9折价');
    assert.equal(preview.activityDiscountAmount, 0, '会员价不能伪装成活动优惠');
    assert.equal(
      preview.payAmount,
      preview.totalAmount - preview.discountAmount + preview.freightAmount,
      '会员价必须进入服务端真实实付计算',
    );

    const created = await orderService.create(user.id.toString(), input);
    const order = await prisma.order.findUniqueOrThrow({
      where: { id: BigInt(created.orderId) },
      include: { payment: true },
    });
    assert.equal(order.discountAmount, 1000, '会员优惠必须真实持久化到订单');
    assert.equal(order.payAmount, preview.payAmount, '会员价预览和真实订单实付必须一致');
    assert.equal(order.activityDiscountAmount, 0);
    assert.equal(order.payment?.amount, order.payAmount, '支付单金额必须包含会员价后的实付');

    await prisma.order.update({
      where: { id: order.id },
      data: {
        status: 'delivered',
        deliveredAt: new Date(Date.now() - 60_000),
        autoCompleteAt: new Date(Date.now() - 1_000),
      },
    });

    const completed = await orderService.autoCompleteOrders();
    assert.equal(completed.completedCount, 1, '真实订单必须可进入自动完成奖励链');

    const expectedReward = Math.floor(Math.floor(order.payAmount / 100) * 15 / 10);
    const expectedGrowth = calculateOrderGrowthValue(order.payAmount);
    const rewardedUser = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    assert.equal(rewardedUser.availablePoints, expectedReward, '会员积分倍率必须真实发放');
    assert.equal(rewardedUser.totalPoints, expectedReward);
    assert.equal(rewardedUser.growthValue, initialGrowth + expectedGrowth, '积分倍率不能放大订单成长值');
    assert.equal(rewardedUser.memberLevelId, upgradedLevel.id, '成长值跨门槛必须同步持久化会员等级');

    const rewardRecord = await prisma.pointsRecord.findFirstOrThrow({
      where: { userId: user.id, source: 'order_auto_complete', sourceId: order.id },
    });
    assert.equal(rewardRecord.points, expectedReward);
    const upgradeRecord = await prisma.userMemberRecord.findFirstOrThrow({
      where: { userId: user.id, oldLevelId: baseLevel.id, newLevelId: upgradedLevel.id },
    });
    assert.match(upgradeRecord.changeReason || '', /成长值更新/);

    const halfRefundAmount = Math.floor(order.payAmount / 2);
    await prisma.orderRefund.create({
      data: {
        refundNo: `MEMBER-HALF-${Date.now()}`,
        orderId: order.id,
        paymentId: order.payment?.id,
        outTradeNo: order.orderNo,
        transactionId: order.payment?.transactionId,
        outRefundNo: `MEMBER-HALF-OUT-${Date.now()}`,
        refundId: `MEMBER-HALF-WX-${Date.now()}`,
        refundAmount: halfRefundAmount,
        totalAmount: order.payAmount,
        status: 'success',
        reason: '会员成长值50%退款真实库测试',
      },
    });

    const growthService = Object.create(MemberGrowthConservingPaymentService.prototype) as any;
    growthService.memberGrowthPrisma = prisma;
    const halfTarget = expectedGrowth - calculateOrderGrowthValue(order.payAmount - halfRefundAmount);
    const halfResult = await growthService.reconcileOrderRefundGrowth(order.id);
    assert.equal(halfResult.clawedDelta, halfTarget);

    const afterHalfRefund = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    assert.equal(afterHalfRefund.growthValue, initialGrowth + expectedGrowth - halfTarget);

    const remainingRefundAmount = order.payAmount - halfRefundAmount;
    await prisma.orderRefund.create({
      data: {
        refundNo: `MEMBER-FULL-${Date.now()}`,
        orderId: order.id,
        paymentId: order.payment?.id,
        outTradeNo: order.orderNo,
        transactionId: order.payment?.transactionId,
        outRefundNo: `MEMBER-FULL-OUT-${Date.now()}`,
        refundId: `MEMBER-FULL-WX-${Date.now()}`,
        refundAmount: remainingRefundAmount,
        totalAmount: order.payAmount,
        status: 'success',
        reason: '会员成长值100%累计退款真实库测试',
      },
    });

    const fullResult = await growthService.reconcileOrderRefundGrowth(order.id);
    assert.equal(fullResult.clawedDelta, expectedGrowth - halfTarget);
    assert.equal(fullResult.outstandingGrowthClawback, 0);

    const fullyRefundedUser = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    assert.equal(fullyRefundedUser.growthValue, initialGrowth, '全额累计退款必须完整回退订单成长值');
    assert.equal(fullyRefundedUser.memberLevelId, baseLevel.id, '成长值回退后会员等级必须同步降级');

    const growthTask = await prisma.paymentCompensationTask.findFirstOrThrow({
      where: {
        orderNo: order.orderNo,
        reason: 'refund_growth_conservation',
        transactionId: `refund-growth:${order.id}`,
      },
    });
    assert.equal(growthTask.status, 'resolved');
    assert.equal((growthTask.callbackPayload as any)?.clawedGrowthValue, expectedGrowth);

    const retry = await growthService.reconcileOrderRefundGrowth(order.id);
    assert.equal(retry.clawedDelta, 0, '重复对账不能再次扣成长值');
    const afterRetryUser = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    assert.equal(afterRetryUser.growthValue, initialGrowth);

    console.log('[member-benefit-lifecycle-integration] PASS');
  } finally {
    await cleanup();
    await prisma.$disconnect();
  }
}

main().catch(async (error) => {
  console.error('[member-benefit-lifecycle-integration] FAIL', error);
  await prisma.$disconnect().catch(() => undefined);
  process.exitCode = 1;
});
