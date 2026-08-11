import assert from 'node:assert/strict';
import { PrismaClient } from '@prisma/client';
import { OrderService } from '../src/order/order.service';
import { PromotionCheckoutService } from '../src/order/promotion-checkout.service';
import { TransactionalFlashSaleService } from '../src/flash-sale/transactional-flash-sale.service';
import { TransactionalGroupBuyService } from '../src/group-buy/transactional-group-buy.service';

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

async function cleanup() {
  await prisma.groupBuyMember.deleteMany();
  await prisma.groupBuyGroup.deleteMany();
  await prisma.groupBuyActivity.deleteMany();
  await prisma.flashSaleOrder.deleteMany();
  await prisma.flashSaleActivity.deleteMany();
  await prisma.orderLog.deleteMany();
  await prisma.orderPayment.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.productStockLog.deleteMany();
  await prisma.productSku.deleteMany();
  await prisma.product.deleteMany();
  await prisma.productCategory.deleteMany();
  await prisma.userAddress.deleteMany();
  await prisma.user.deleteMany();
}

async function main() {
  await prisma.$connect();
  await cleanup();

  const orderService = new OrderService(
    prisma as any,
    businessEvent as any,
    benefitPackage as any,
    promotionHooks as any,
    promotionHooks as any,
  );
  const promotionCheckout = new PromotionCheckoutService();
  const flashSaleService = new TransactionalFlashSaleService(
    prisma as any,
    orderService,
    promotionCheckout,
    benefitPackage as any,
  );
  const groupBuyService = new TransactionalGroupBuyService(
    prisma as any,
    orderService,
    promotionCheckout,
    benefitPackage as any,
  );

  try {
    const user = await prisma.user.create({
      data: { openid: 'promotion-integration-user' },
    });
    const address = await prisma.userAddress.create({
      data: {
        userId: user.id,
        receiverName: '测试用户',
        receiverPhone: '13800138000',
        province: '上海市',
        city: '上海市',
        district: '浦东新区',
        detailAddress: '测试路1号',
        isDefault: 1,
      },
    });
    const category = await prisma.productCategory.create({
      data: { name: '集成测试分类' },
    });
    const product = await prisma.product.create({
      data: { name: '促销测试商品', categoryId: category.id, status: 1 },
    });
    const sku = await prisma.productSku.create({
      data: {
        productId: product.id,
        skuCode: 'PROMO-INTEGRATION-SKU',
        price: 100000,
        stock: 100,
        status: 1,
      },
    });

    const now = Date.now();
    const flashActivity = await prisma.flashSaleActivity.create({
      data: {
        name: '真实秒杀价测试',
        productId: product.id,
        skuId: sku.id,
        flashPrice: 5000,
        originalPrice: 100000,
        stockLimit: 10,
        limitPerUser: 1,
        lockMinutes: 15,
        startTime: new Date(now - 60_000),
        endTime: new Date(now + 3_600_000),
        status: 1,
      },
    });

    const flashResult = await flashSaleService.weappBuy(user.id.toString(), {
      activityId: flashActivity.id.toString() as any,
      quantity: 1,
      addressId: address.id.toString(),
      fulfillmentType: 'delivery',
    });
    const flashOrder = await prisma.order.findUniqueOrThrow({
      where: { id: BigInt(flashResult.orderId) },
      include: { orderItems: true, payment: true },
    });
    assert.equal(
      flashOrder.payAmount,
      5000,
      '秒杀订单实付必须使用服务端活动价',
    );
    assert.equal(
      flashOrder.activityDiscountAmount,
      95000,
      '秒杀优惠金额必须真实落库',
    );
    assert.equal(
      flashOrder.orderItems[0]?.price,
      5000,
      '秒杀订单项单价必须是活动价',
    );
    assert.equal(flashOrder.orderItems[0]?.originalPrice, 100000);
    assert.equal(flashOrder.orderItems[0]?.activityDiscount, 95000);
    assert.equal(flashOrder.orderItems[0]?.activityType, 'flash_sale');
    assert.equal(flashOrder.orderItems[0]?.activityId, flashActivity.id);
    assert.equal(flashOrder.payment?.amount, 5000, '秒杀支付单金额必须同步');

    const flashLink = await prisma.flashSaleOrder.findUniqueOrThrow({
      where: { orderId: flashOrder.id },
    });
    assert.equal(flashLink.orderItemId, flashOrder.orderItems[0]?.id);
    assert.equal(flashLink.status, 'pending_payment');

    const groupActivity = await prisma.groupBuyActivity.create({
      data: {
        name: '真实拼团价测试',
        productId: product.id,
        skuId: sku.id,
        groupPrice: 4000,
        originalPrice: 100000,
        groupSize: 2,
        groupExpireHours: 24,
        stockLimit: 10,
        limitPerUser: 2,
        startTime: new Date(now - 60_000),
        endTime: new Date(now + 3_600_000),
        status: 1,
      },
    });

    const groupResult = await groupBuyService.startGroupBuy(
      user.id.toString(),
      {
        activityId: groupActivity.id.toString() as any,
        skuId: sku.id.toString() as any,
        quantity: 1,
        addressId: address.id.toString(),
        fulfillmentType: 'delivery',
      },
    );
    const groupOrder = await prisma.order.findUniqueOrThrow({
      where: { id: BigInt(groupResult.orderId) },
      include: { orderItems: true, payment: true },
    });
    assert.equal(
      groupOrder.payAmount,
      4000,
      '拼团订单实付必须使用服务端活动价',
    );
    assert.equal(
      groupOrder.activityDiscountAmount,
      96000,
      '拼团优惠金额必须真实落库',
    );
    assert.equal(
      groupOrder.orderItems[0]?.price,
      4000,
      '拼团订单项单价必须是活动价',
    );
    assert.equal(groupOrder.orderItems[0]?.originalPrice, 100000);
    assert.equal(groupOrder.orderItems[0]?.activityDiscount, 96000);
    assert.equal(groupOrder.orderItems[0]?.activityType, 'group_buy');
    assert.equal(groupOrder.orderItems[0]?.activityId, groupActivity.id);
    assert.equal(groupOrder.payment?.amount, 4000, '拼团支付单金额必须同步');

    const groupMember = await prisma.groupBuyMember.findUniqueOrThrow({
      where: { orderId: groupOrder.id },
    });
    assert.equal(groupMember.orderItemId, groupOrder.orderItems[0]?.id);
    assert.equal(groupMember.status, 'pending_payment');

    const leader2 = await prisma.user.create({
      data: { openid: 'promotion-integration-leader-2' },
    });
    const highIdA = 9007199254740992n;
    const highIdB = 9007199254740993n;
    const highGroupA = await prisma.groupBuyGroup.create({
      data: {
        id: highIdA,
        activityId: groupActivity.id,
        leaderUserId: user.id,
        groupNo: 'BIGINT-GROUP-A',
        status: 'forming',
        currentCount: 1,
        targetCount: 2,
        expiresAt: new Date(now + 3_600_000),
      },
    });
    const highGroupB = await prisma.groupBuyGroup.create({
      data: {
        id: highIdB,
        activityId: groupActivity.id,
        leaderUserId: leader2.id,
        groupNo: 'BIGINT-GROUP-B',
        status: 'forming',
        currentCount: 1,
        targetCount: 2,
        expiresAt: new Date(now + 3_600_000),
      },
    });
    const secondMemberOrder = await prisma.order.create({
      data: {
        orderNo: 'BIGINT-MEMBER-ORDER-B',
        userId: leader2.id,
        status: 'pending_payment',
        totalAmount: 0,
        payAmount: 0,
        receiverName: '',
        receiverPhone: '',
      },
    });
    await prisma.groupBuyMember.createMany({
      data: [
        {
          groupId: highGroupA.id,
          activityId: groupActivity.id,
          userId: user.id,
          orderId: flashOrder.id,
          role: 'leader',
          status: 'paid',
        },
        {
          groupId: highGroupB.id,
          activityId: groupActivity.id,
          userId: leader2.id,
          orderId: secondMemberOrder.id,
          role: 'leader',
          status: 'paid',
        },
      ],
    });

    const available = await groupBuyService.weappFindAvailableGroups(
      groupActivity.id.toString(),
    );
    const a = available.find((item: any) => item.id === highIdA);
    const b = available.find((item: any) => item.id === highIdB);
    assert.equal(a?.members.length, 1, 'BIGINT 团 A 只能包含自己的成员');
    assert.equal(b?.members.length, 1, 'BIGINT 团 B 只能包含自己的成员');
    assert.equal(a?.members[0]?.groupId, highIdA);
    assert.equal(b?.members[0]?.groupId, highIdB);

    console.log('[promotion-order-lifecycle-integration] PASS');
  } finally {
    await cleanup();
    await prisma.$disconnect();
  }
}

main().catch(async (error) => {
  console.error('[promotion-order-lifecycle-integration] FAIL', error);
  await prisma.$disconnect().catch(() => undefined);
  process.exitCode = 1;
});
