import assert from 'node:assert/strict';
import { PrismaClient } from '@prisma/client';
import { OrderService } from '../src/order/order.service';
import { PAYMENT_STATUS } from '../src/common/constants';

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
  await prisma.pointsRecord.deleteMany();
  await prisma.orderLog.deleteMany();
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

  try {
    const initialPoints = 1000;
    const initialStock = 20;
    const initialSales = 0;

    const user = await prisma.user.create({
      data: {
        openid: 'normal-order-integration-user',
        availablePoints: initialPoints,
      },
    });
    const address = await prisma.userAddress.create({
      data: {
        userId: user.id,
        receiverName: '普通订单测试用户',
        receiverPhone: '13800138000',
        province: '上海市',
        city: '上海市',
        district: '浦东新区',
        detailAddress: '真实数据库测试路1号',
        isDefault: 1,
      },
    });
    const category = await prisma.productCategory.create({
      data: { name: '普通订单集成测试分类' },
    });
    const product = await prisma.product.create({
      data: {
        name: '普通订单集成测试商品',
        categoryId: category.id,
        status: 1,
      },
    });
    const sku = await prisma.productSku.create({
      data: {
        productId: product.id,
        skuCode: 'NORMAL-ORDER-INTEGRATION-SKU',
        price: 10000,
        originalPrice: 12000,
        stock: initialStock,
        sales: initialSales,
        status: 1,
      },
    });

    await prisma.cart.create({
      data: {
        userId: user.id,
        productId: product.id,
        skuId: sku.id,
        quantity: 2,
        isSelected: 1,
      },
    });

    const input = {
      fulfillmentType: 'delivery',
      addressId: address.id.toString(),
      pointsDeduct: 300,
      items: [{ skuId: sku.id.toString(), quantity: 2 }],
    };

    const preview = await orderService.confirm(user.id.toString(), input);
    assert.equal(preview.totalAmount, 20000, '普通订单预览商品金额必须来自服务端 SKU 价格');
    assert.ok(preview.pointsDeducted > 0, '普通订单预览必须实际计算积分抵扣');
    assert.ok(preview.payAmount > 0, '本用例必须保持非零支付以覆盖支付单创建');

    const created = await orderService.create(user.id.toString(), input);
    const order = await prisma.order.findUniqueOrThrow({
      where: { id: BigInt(created.orderId) },
      include: { orderItems: true, payment: true },
    });
    const afterCreateSku = await prisma.productSku.findUniqueOrThrow({ where: { id: sku.id } });
    const afterCreateUser = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    const remainingCartRows = await prisma.cart.count({ where: { userId: user.id, skuId: sku.id } });

    assert.equal(order.status, 'pending_payment');
    assert.equal(order.totalAmount, preview.totalAmount, '预览与真实订单商品金额必须一致');
    assert.equal(order.freightAmount, preview.freightAmount, '预览与真实订单运费必须一致');
    assert.equal(order.pointsAmount, preview.pointsAmount, '预览与真实订单积分抵扣金额必须一致');
    assert.equal(order.pointsDeducted, preview.pointsDeducted, '预览与真实订单扣除积分必须一致');
    assert.equal(order.payAmount, preview.payAmount, '预览与真实订单实付金额必须一致');
    assert.equal(order.orderItems.length, 1);
    assert.equal(order.orderItems[0]?.price, 10000);
    assert.equal(order.orderItems[0]?.quantity, 2);
    assert.equal(order.orderItems[0]?.subtotal, 20000);
    assert.equal(order.payment?.status, PAYMENT_STATUS.CREATED, '普通非零订单必须创建待支付支付单');
    assert.equal(order.payment?.amount, order.payAmount, '支付单金额必须与订单实付一致');
    assert.equal(afterCreateSku.stock, initialStock - 2, '下单必须真实扣减 SKU 库存');
    assert.equal(afterCreateSku.sales, initialSales + 2, '下单必须真实累计 SKU 销量');
    assert.equal(
      afterCreateUser.availablePoints,
      initialPoints - order.pointsDeducted,
      '下单必须真实扣除用户积分',
    );
    assert.equal(remainingCartRows, 0, '下单后对应购物车项必须被清理');

    const createStockLogs = await prisma.productStockLog.findMany({
      where: { skuId: sku.id, type: 1 },
    });
    assert.equal(createStockLogs.length, 1, '下单必须写入库存预扣流水');
    assert.equal(createStockLogs[0]?.beforeStock, initialStock);
    assert.equal(createStockLogs[0]?.afterStock, initialStock - 2);

    await orderService.cancel(user.id.toString(), order.id.toString());

    const cancelledOrder = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    const afterCancelSku = await prisma.productSku.findUniqueOrThrow({ where: { id: sku.id } });
    const afterCancelUser = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    assert.equal(cancelledOrder.status, 'cancelled');
    assert.equal(afterCancelSku.stock, initialStock, '取消订单必须完整归还库存');
    assert.equal(afterCancelSku.sales, initialSales, '取消订单必须回滚对应销量');
    assert.equal(afterCancelUser.availablePoints, initialPoints, '取消订单必须完整归还抵扣积分');

    const restoreLogsAfterFirstCancel = await prisma.productStockLog.findMany({
      where: { skuId: sku.id, type: 2 },
    });
    assert.equal(restoreLogsAfterFirstCancel.length, 1, '第一次取消必须且只能写一条库存恢复流水');

    await orderService.cancel(user.id.toString(), order.id.toString());

    const afterSecondCancelSku = await prisma.productSku.findUniqueOrThrow({ where: { id: sku.id } });
    const afterSecondCancelUser = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    const restoreLogsAfterSecondCancel = await prisma.productStockLog.findMany({
      where: { skuId: sku.id, type: 2 },
    });
    const cancelPointReturns = await prisma.pointsRecord.findMany({
      where: { userId: user.id, source: 'order_cancel' },
    });

    assert.equal(afterSecondCancelSku.stock, initialStock, '重复取消不能二次增加库存');
    assert.equal(afterSecondCancelSku.sales, initialSales, '重复取消不能二次扣减销量');
    assert.equal(afterSecondCancelUser.availablePoints, initialPoints, '重复取消不能二次返还积分');
    assert.equal(restoreLogsAfterSecondCancel.length, 1, '重复取消不能重复写库存恢复流水');
    assert.equal(cancelPointReturns.length, 1, '重复取消不能重复写积分返还流水');

    console.log('[normal-order-lifecycle-integration] PASS');
  } finally {
    await cleanup();
    await prisma.$disconnect();
  }
}

main().catch(async (error) => {
  console.error('[normal-order-lifecycle-integration] FAIL', error);
  await prisma.$disconnect().catch(() => undefined);
  process.exitCode = 1;
});
