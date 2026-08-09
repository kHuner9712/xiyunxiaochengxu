import assert from 'node:assert/strict';
import { PrismaClient } from '@prisma/client';
import { PAYMENT_STATUS } from '../src/common/constants/payment';
import { PaymentFactDashboardService } from '../src/dashboard/payment-fact-dashboard.service';

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

function dateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

assertSafeIntegrationDatabase();
const prisma = new PrismaClient();

async function main() {
  await prisma.$connect();
  const suffix = Date.now().toString();
  let userId: bigint | null = null;
  let categoryId: bigint | null = null;
  let productId: bigint | null = null;
  let skuId: bigint | null = null;
  const orderIds: bigint[] = [];

  try {
    const user = await prisma.user.create({
      data: { openid: `dashboard-payment-${suffix}`, nickname: 'Dashboard支付事实用户' },
    });
    userId = user.id;
    const category = await prisma.productCategory.create({
      data: { name: `Dashboard支付事实分类-${suffix}` },
    });
    categoryId = category.id;
    const product = await prisma.product.create({
      data: {
        name: `Dashboard支付事实商品-${suffix}`,
        categoryId: category.id,
        status: 1,
      },
    });
    productId = product.id;
    const sku = await prisma.productSku.create({
      data: {
        productId: product.id,
        skuCode: `DASH-PAY-${suffix}`,
        price: 10000,
        stock: 100,
        status: 1,
      },
    });
    skuId = sku.id;

    const paidAt = new Date();
    const paidOrder = await prisma.order.create({
      data: {
        orderNo: `DASHP${suffix}`.slice(0, 32),
        userId: user.id,
        status: 'aftersale',
        totalAmount: 10000,
        payAmount: 10000,
        receiverName: 'Dashboard支付事实用户',
        receiverPhone: '13800138000',
        province: '上海市',
        city: '上海市',
        district: '浦东新区',
        detailAddress: 'Dashboard真实数据库测试路1号',
        paidAt,
      },
    });
    orderIds.push(paidOrder.id);
    await prisma.orderItem.create({
      data: {
        orderId: paidOrder.id,
        productId: product.id,
        skuId: sku.id,
        productName: product.name,
        price: 10000,
        quantity: 1,
        subtotal: 10000,
      },
    });
    await prisma.orderPayment.create({
      data: {
        orderId: paidOrder.id,
        paymentNo: `DASHPAY${suffix}`.slice(0, 64),
        amount: 10000,
        status: PAYMENT_STATUS.SUCCESS,
        paidAt,
      },
    });

    const unpaidOrder = await prisma.order.create({
      data: {
        orderNo: `DASHU${suffix}`.slice(0, 32),
        userId: user.id,
        status: 'pending_payment',
        totalAmount: 990000,
        payAmount: 990000,
        receiverName: 'Dashboard未支付用户',
        receiverPhone: '13800138000',
        province: '上海市',
        city: '上海市',
        district: '浦东新区',
        detailAddress: 'Dashboard真实数据库测试路2号',
      },
    });
    orderIds.push(unpaidOrder.id);
    await prisma.orderItem.create({
      data: {
        orderId: unpaidOrder.id,
        productId: product.id,
        skuId: sku.id,
        productName: product.name,
        price: 10000,
        quantity: 99,
        subtotal: 990000,
      },
    });

    const service = new PaymentFactDashboardService(prisma as any);
    const stats: any = await service.getStats();
    assert.ok(stats.todaySales >= 10000, '成功支付订单必须进入今日销售额');
    assert.ok(stats.todayOrders >= 1, '成功支付订单必须进入今日订单数');

    const today = dateKey(paidAt);
    const trend: any[] = await service.getSalesChartByDateRange(today, today);
    assert.equal(trend.length, 1);
    assert.ok(trend[0].salesAmount >= 10000, '售后状态不能让已成功支付金额从趋势消失');
    assert.ok(trend[0].orderCount >= 1, '售后状态不能让已成功支付订单从趋势消失');

    const topProducts: any[] = await service.getTopProducts(100);
    const row = topProducts.find((item) => item.id === product.id.toString());
    assert.ok(row, '成功支付商品必须进入热销商品聚合');
    assert.equal(row.salesCount, 1, '未支付订单的99件商品不能进入热销销量');
    assert.equal(row.salesAmount, 10000, '未支付订单金额不能进入热销销售额');

    console.log('[dashboard-payment-facts-integration] PASS');
  } finally {
    if (orderIds.length) {
      await prisma.orderPayment.deleteMany({ where: { orderId: { in: orderIds } } });
      await prisma.orderItem.deleteMany({ where: { orderId: { in: orderIds } } });
      await prisma.order.deleteMany({ where: { id: { in: orderIds } } });
    }
    if (skuId) await prisma.productSku.deleteMany({ where: { id: skuId } });
    if (productId) await prisma.product.deleteMany({ where: { id: productId } });
    if (categoryId) await prisma.productCategory.deleteMany({ where: { id: categoryId } });
    if (userId) await prisma.user.deleteMany({ where: { id: userId } });
    await prisma.$disconnect();
  }
}

main().catch(async (error) => {
  console.error('[dashboard-payment-facts-integration] FAIL', error);
  await prisma.$disconnect().catch(() => undefined);
  process.exitCode = 1;
});
