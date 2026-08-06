import assert from 'node:assert/strict';
import { PrismaClient } from '@prisma/client';
import { TransactionalOrderService } from '../src/order/transactional-order.service';
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

  let flashSaleService!: TransactionalFlashSaleService;
  let groupBuyService!: TransactionalGroupBuyService;
  const flashSaleHook = {
    handleOrderCancel: (orderId: bigint | string) =>
      flashSaleService.handleOrderCancel(orderId),
  };
  const groupBuyHook = {
    handleOrderCancel: (orderId: bigint | string) =>
      groupBuyService.handleOrderCancel(orderId),
  };
  const orderService = new TransactionalOrderService(
    prisma as any,
    businessEvent as any,
    benefitPackage as any,
    groupBuyHook as any,
    flashSaleHook as any,
  );
  const promotionCheckout = new PromotionCheckoutService();
  flashSaleService = new TransactionalFlashSaleService(
    prisma as any,
    orderService,
    promotionCheckout,
  );
  groupBuyService = new TransactionalGroupBuyService(
    prisma as any,
    orderService,
    promotionCheckout,
  );

  try {
    const user = await prisma.user.create({
      data: { openid: 'promotion-timeout-user' },
    });
    const address = await prisma.userAddress.create({
      data: {
        userId: user.id,
        receiverName: '超时测试用户',
        receiverPhone: '13800138001',
        province: '上海市',
        city: '上海市',
        district: '徐汇区',
        detailAddress: '超时测试路1号',
        isDefault: 1,
      },
    });
    const category = await prisma.productCategory.create({
      data: { name: '超时测试分类' },
    });
    const product = await prisma.product.create({
      data: { name: '超时测试商品', categoryId: category.id, status: 1 },
    });
    const initialStock = 20;
    const sku = await prisma.productSku.create({
      data: {
        productId: product.id,
        skuCode: 'PROMO-TIMEOUT-SKU',
        price: 10000,
        stock: initialStock,
        status: 1,
      },
    });

    const now = Date.now();
    const flashActivity = await prisma.flashSaleActivity.create({
      data: {
        name: '秒杀超时测试',
        productId: product.id,
        skuId: sku.id,
        flashPrice: 5000,
        originalPrice: 10000,
        stockLimit: 5,
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
    const flashOrderId = BigInt(flashResult.orderId);
    const flashLinkBefore = await prisma.flashSaleOrder.findUniqueOrThrow({
      where: { orderId: flashOrderId },
    });
    const flashOrderBefore = await prisma.order.findUniqueOrThrow({
      where: { id: flashOrderId },
    });
    assert.equal(
      flashOrderBefore.autoCloseAt?.getTime(),
      flashLinkBefore.lockExpireAt.getTime(),
      '秒杀普通订单截止时间必须与秒杀库存锁截止时间完全一致',
    );

    const groupActivity = await prisma.groupBuyActivity.create({
      data: {
        name: '拼团超时测试',
        productId: product.id,
        skuId: sku.id,
        groupPrice: 4000,
        originalPrice: 10000,
        groupSize: 2,
        groupExpireHours: 24,
        stockLimit: 5,
        limitPerUser: 1,
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
    const groupOrderId = BigInt(groupResult.orderId);

    await prisma.order.updateMany({
      where: { id: { in: [flashOrderId, groupOrderId] } },
      data: { autoCloseAt: new Date(Date.now() - 1_000) },
    });

    const stockAfterCreate = await prisma.productSku.findUniqueOrThrow({
      where: { id: sku.id },
    });
    assert.equal(stockAfterCreate.stock, initialStock - 2);
    assert.equal(stockAfterCreate.sales, 2);

    const closeResult = await orderService.closeTimeoutOrders();
    assert.equal(closeResult.closedCount, 2, '两个超时促销订单都应被关闭');

    const [flashOrder, groupOrder, flashLink, flashActivityAfter, groupMember, skuAfter] =
      await Promise.all([
        prisma.order.findUniqueOrThrow({ where: { id: flashOrderId } }),
        prisma.order.findUniqueOrThrow({ where: { id: groupOrderId } }),
        prisma.flashSaleOrder.findUniqueOrThrow({
          where: { orderId: flashOrderId },
        }),
        prisma.flashSaleActivity.findUniqueOrThrow({
          where: { id: flashActivity.id },
        }),
        prisma.groupBuyMember.findUniqueOrThrow({
          where: { orderId: groupOrderId },
        }),
        prisma.productSku.findUniqueOrThrow({ where: { id: sku.id } }),
      ]);

    assert.equal(flashOrder.status, 'cancelled');
    assert.equal(groupOrder.status, 'cancelled');
    assert.equal(
      flashLink.status,
      'cancelled',
      '普通订单超时关闭必须同步取消秒杀关联记录',
    );
    assert.equal(
      flashActivityAfter.lockedCount,
      0,
      '普通订单超时关闭必须释放秒杀库存锁',
    );
    assert.equal(
      groupMember.status,
      'cancelled',
      '普通订单超时关闭必须释放拼团席位',
    );
    assert.equal(skuAfter.stock, initialStock, 'SKU 库存必须完整归还');
    assert.equal(skuAfter.sales, 0, 'SKU 销量必须回退且不得为负');

    console.log('[promotion-timeout-lifecycle-integration] PASS');
  } finally {
    await cleanup();
    await prisma.$disconnect();
  }
}

main().catch(async (error) => {
  console.error('[promotion-timeout-lifecycle-integration] FAIL', error);
  await prisma.$disconnect().catch(() => undefined);
  process.exitCode = 1;
});
