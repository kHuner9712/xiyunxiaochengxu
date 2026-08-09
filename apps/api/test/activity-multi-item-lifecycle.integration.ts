import assert from 'node:assert/strict';
import { PrismaClient } from '@prisma/client';
import { ActivityMultiItemCheckoutService } from '../src/activity/activity-multi-item-checkout.service';
import { calculateOrderItemRefundCap } from '../src/common/utils/refund-amount';

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
const systemConfig = {
  getRuntimeConfig: () => ({
    freeShippingAmount: 0,
    defaultFreight: 0,
    orderAutoCloseMinutes: 30,
    pointsDeductRate: 100,
  }),
};

async function cleanup() {
  await prisma.orderLog.deleteMany();
  await prisma.orderPayment.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.productStockLog.deleteMany();
  await prisma.activityProduct.deleteMany();
  await prisma.activity.deleteMany();
  await prisma.productSku.deleteMany();
  await prisma.product.deleteMany();
  await prisma.productCategory.deleteMany();
  await prisma.userAddress.deleteMany();
  await prisma.user.deleteMany();
}

async function main() {
  await prisma.$connect();
  await cleanup();

  const service = new ActivityMultiItemCheckoutService(prisma as any, systemConfig as any);

  try {
    const user = await prisma.user.create({
      data: { openid: 'activity-multi-item-integration-user', status: 1 },
    });
    const address = await prisma.userAddress.create({
      data: {
        userId: user.id,
        receiverName: '活动测试用户',
        receiverPhone: '13800138000',
        province: '上海市',
        city: '上海市',
        district: '浦东新区',
        detailAddress: '测试路 88 号',
        isDefault: 1,
      },
    });
    const category = await prisma.productCategory.create({
      data: { name: '多商品活动集成测试分类' },
    });
    const paidProduct = await prisma.product.create({
      data: {
        name: '活动主商品',
        categoryId: category.id,
        status: 1,
        fulfillmentType: 'delivery',
      },
    });
    const giftProduct = await prisma.product.create({
      data: {
        name: '活动赠品',
        categoryId: category.id,
        status: 1,
        fulfillmentType: 'delivery',
      },
    });
    const paidSku = await prisma.productSku.create({
      data: {
        productId: paidProduct.id,
        skuCode: 'ACTIVITY-MULTI-PAID',
        price: 10000,
        stock: 50,
        status: 1,
      },
    });
    const giftSku = await prisma.productSku.create({
      data: {
        productId: giftProduct.id,
        skuCode: 'ACTIVITY-MULTI-GIFT',
        price: 3000,
        stock: 50,
        status: 1,
      },
    });

    const now = Date.now();
    const fullGiftActivity = await prisma.activity.create({
      data: {
        name: '真实满赠集成测试',
        type: '3',
        rules: {
          fullGiftRules: [
            {
              fullAmount: 15000,
              giftSkuId: giftSku.id.toString(),
              giftQuantity: 1,
            },
          ],
        },
        startTime: new Date(now - 60_000),
        endTime: new Date(now + 3_600_000),
        status: 1,
      },
    });
    const fullGiftPaidRelation = await prisma.activityProduct.create({
      data: {
        activityId: fullGiftActivity.id,
        productId: paidProduct.id,
        skuId: paidSku.id,
        activityPrice: paidSku.price,
        activityStock: 20,
        limitPerUser: 10,
      },
    });
    await prisma.activityProduct.create({
      data: {
        activityId: fullGiftActivity.id,
        productId: giftProduct.id,
        skuId: giftSku.id,
        activityPrice: giftSku.price,
        activityStock: 10,
        limitPerUser: 10,
      },
    });

    const fullGiftDto = {
      activityProductId: fullGiftPaidRelation.id.toString(),
      skuId: paidSku.id.toString(),
      quantity: 2,
      addressId: address.id.toString(),
      fulfillmentType: 'delivery' as const,
    };
    const fullGiftPreview = await service.preview(
      user.id,
      fullGiftActivity.id,
      fullGiftPaidRelation.id,
      paidSku.id,
      fullGiftDto,
    );
    assert.equal(fullGiftPreview.items.length, 2, '满赠试算必须包含主商品和真实赠品订单项');
    assert.equal(fullGiftPreview.totalAmount, 23000, '满赠原价总额必须包含赠品经济价值');
    assert.equal(fullGiftPreview.activityDiscountAmount, 3000, '赠品价值必须记入活动优惠');
    assert.equal(fullGiftPreview.payAmount, 20000, '赠品不得进入用户实付金额');
    assert.equal(fullGiftPreview.items.find((item) => item.isGift)?.subtotal, 0, '赠品小计必须为0');

    const fullGiftOrderResult = await service.createOrder(
      user.id,
      fullGiftActivity.id,
      fullGiftPaidRelation.id,
      paidSku.id,
      fullGiftDto,
    );
    const fullGiftOrder = await prisma.order.findUniqueOrThrow({
      where: { id: BigInt(fullGiftOrderResult.orderId) },
      include: {
        orderItems: true,
        payment: true,
        aftersaleOrders: true,
        orderRefunds: true,
      },
    });
    assert.equal(fullGiftOrder.orderItems.length, 2, '满赠订单必须真实落两条订单项');
    assert.equal(fullGiftOrder.totalAmount, 23000);
    assert.equal(fullGiftOrder.activityDiscountAmount, 3000);
    assert.equal(fullGiftOrder.payAmount, 20000);
    assert.equal(fullGiftOrder.payment?.amount, 20000, '支付单金额必须排除赠品价值');
    const persistedGiftItem = fullGiftOrder.orderItems.find((item) => item.skuId === giftSku.id);
    const persistedPaidItem = fullGiftOrder.orderItems.find((item) => item.skuId === paidSku.id);
    assert.ok(persistedGiftItem && persistedPaidItem, '满赠主商品和赠品都必须落库');
    assert.equal(persistedGiftItem.subtotal, 0);
    assert.equal(persistedGiftItem.activityDiscount, 3000);
    assert.equal(calculateOrderItemRefundCap(fullGiftOrder, persistedGiftItem).maxRefundableAmount, 0);
    assert.equal(calculateOrderItemRefundCap(fullGiftOrder, persistedPaidItem).maxRefundableAmount, 20000);

    const paidSkuAfterGift = await prisma.productSku.findUniqueOrThrow({ where: { id: paidSku.id } });
    const giftSkuAfterGift = await prisma.productSku.findUniqueOrThrow({ where: { id: giftSku.id } });
    assert.equal(paidSkuAfterGift.stock, 48, '主商品必须真实扣减2件库存');
    assert.equal(giftSkuAfterGift.stock, 49, '赠品必须真实扣减1件库存');

    const bundleActivity = await prisma.activity.create({
      data: {
        name: '真实组合套餐集成测试',
        type: '4',
        rules: {
          bundlePrice: 12000,
          bundleItems: [
            { skuId: paidSku.id.toString(), quantity: 1 },
            { skuId: giftSku.id.toString(), quantity: 1 },
          ],
        },
        startTime: new Date(now - 60_000),
        endTime: new Date(now + 3_600_000),
        status: 1,
      },
    });
    const bundlePaidRelation = await prisma.activityProduct.create({
      data: {
        activityId: bundleActivity.id,
        productId: paidProduct.id,
        skuId: paidSku.id,
        activityPrice: paidSku.price,
        activityStock: 20,
        limitPerUser: 10,
      },
    });
    await prisma.activityProduct.create({
      data: {
        activityId: bundleActivity.id,
        productId: giftProduct.id,
        skuId: giftSku.id,
        activityPrice: giftSku.price,
        activityStock: 20,
        limitPerUser: 10,
      },
    });

    const bundleDto = {
      activityProductId: bundlePaidRelation.id.toString(),
      skuId: paidSku.id.toString(),
      quantity: 2,
      addressId: address.id.toString(),
      fulfillmentType: 'delivery' as const,
    };
    const bundlePreview = await service.preview(
      user.id,
      bundleActivity.id,
      bundlePaidRelation.id,
      paidSku.id,
      bundleDto,
    );
    assert.equal(bundlePreview.items.length, 2, '套餐试算必须返回所有SKU');
    assert.deepEqual(
      bundlePreview.items.map((item) => item.quantity).sort((a, b) => a - b),
      [2, 2],
      '购买2套必须按每套构成乘以2',
    );
    assert.equal(bundlePreview.totalAmount, 26000);
    assert.equal(bundlePreview.activityDiscountAmount, 2000);
    assert.equal(bundlePreview.payAmount, 24000);
    assert.equal(bundlePreview.items.reduce((sum, item) => sum + item.subtotal, 0), 24000);

    const bundleOrderResult = await service.createOrder(
      user.id,
      bundleActivity.id,
      bundlePaidRelation.id,
      paidSku.id,
      bundleDto,
    );
    const bundleOrder = await prisma.order.findUniqueOrThrow({
      where: { id: BigInt(bundleOrderResult.orderId) },
      include: {
        orderItems: true,
        payment: true,
        aftersaleOrders: true,
        orderRefunds: true,
      },
    });
    assert.equal(bundleOrder.orderItems.length, 2, '套餐订单必须真实落所有SKU订单项');
    assert.equal(bundleOrder.totalAmount, 26000);
    assert.equal(bundleOrder.activityDiscountAmount, 2000);
    assert.equal(bundleOrder.payAmount, 24000);
    assert.equal(bundleOrder.payment?.amount, 24000);
    assert.equal(bundleOrder.orderItems.reduce((sum, item) => sum + item.subtotal, 0), 24000);
    assert.equal(bundleOrder.orderItems.reduce((sum, item) => sum + item.activityDiscount, 0), 2000);
    assert.equal(
      bundleOrder.orderItems.reduce(
        (sum, item) => sum + calculateOrderItemRefundCap(bundleOrder, item).maxRefundableAmount,
        0,
      ),
      24000,
      '套餐各订单项退款上限合计必须等于用户商品实付',
    );

    const paidSkuAfterBundle = await prisma.productSku.findUniqueOrThrow({ where: { id: paidSku.id } });
    const giftSkuAfterBundle = await prisma.productSku.findUniqueOrThrow({ where: { id: giftSku.id } });
    assert.equal(paidSkuAfterBundle.stock, 46, '2套套餐必须再扣主SKU 2件');
    assert.equal(giftSkuAfterBundle.stock, 47, '2套套餐必须再扣第二SKU 2件');

    console.log('[activity-multi-item-lifecycle-integration] PASS');
  } finally {
    await cleanup();
    await prisma.$disconnect();
  }
}

main().catch(async (error) => {
  console.error('[activity-multi-item-lifecycle-integration] FAIL', error);
  await prisma.$disconnect().catch(() => undefined);
  process.exitCode = 1;
});
