import assert from 'node:assert/strict';
import { PrismaClient } from '@prisma/client';
import { PAYMENT_STATUS } from '../src/common/constants/payment';
import { NetPaidProductDashboardService } from '../src/dashboard/net-paid-product-dashboard.service';

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
  const productIds: bigint[] = [];
  const skuIds: bigint[] = [];
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

    async function createProduct(name: string, price: number) {
      const product = await prisma.product.create({
        data: {
          name: `${name}-${suffix}`,
          categoryId: category.id,
          status: 1,
        },
      });
      productIds.push(product.id);
      const sku = await prisma.productSku.create({
        data: {
          productId: product.id,
          skuCode: `${name}-${suffix}`.replace(/[^A-Za-z0-9-]/g, '').slice(0, 64),
          price,
          stock: 100,
          status: 1,
        },
      });
      skuIds.push(sku.id);
      return { product, sku };
    }

    const cappedActivity = await createProduct('DASH-CAP-A', 5000);
    const cappedRegular = await createProduct('DASH-CAP-B', 10000);
    const giftBasisA = await createProduct('DASH-GIFT-A', 10000);
    const giftBasisB = await createProduct('DASH-GIFT-B', 10000);
    const zeroGift = await createProduct('DASH-GIFT-Z', 10000);

    const paidAt = new Date();

    // Scenario 1: one item already carries a row-level activity price (subtotal 50 yuan while
    // activityDiscount records another 50 yuan of economic value). A further 10 yuan order-level
    // discount leaves 140 yuan actually paid. Refund accounting caps that first item's cash share
    // at its persisted 50 yuan subtotal, so dashboard allocation must be 50 + 90, not 70 + 70.
    const cappedOrder = await prisma.order.create({
      data: {
        orderNo: `DASHC${suffix}`.slice(0, 32),
        userId: user.id,
        status: 'completed',
        totalAmount: 20000,
        activityDiscountAmount: 5000,
        discountAmount: 1000,
        payAmount: 14000,
        receiverName: 'Dashboard支付事实用户',
        receiverPhone: '13800138000',
        province: '上海市',
        city: '上海市',
        district: '浦东新区',
        detailAddress: 'Dashboard真实数据库测试路1号',
        paidAt,
      },
    });
    orderIds.push(cappedOrder.id);
    await prisma.orderItem.createMany({
      data: [
        {
          orderId: cappedOrder.id,
          productId: cappedActivity.product.id,
          skuId: cappedActivity.sku.id,
          productName: cappedActivity.product.name,
          price: 5000,
          quantity: 1,
          subtotal: 5000,
          activityDiscount: 5000,
        },
        {
          orderId: cappedOrder.id,
          productId: cappedRegular.product.id,
          skuId: cappedRegular.sku.id,
          productName: cappedRegular.product.name,
          price: 10000,
          quantity: 1,
          subtotal: 10000,
        },
      ],
    });
    await prisma.orderPayment.create({
      data: {
        orderId: cappedOrder.id,
        paymentNo: `DASHCPAY${suffix}`.slice(0, 64),
        amount: 14000,
        status: PAYMENT_STATUS.SUCCESS,
        paidAt,
      },
    });

    // Scenario 2: a zero-subtotal gift may retain activityDiscount as an accounting snapshot of
    // its nominal value. Refund allocation deliberately gives such a gift zero economic basis.
    // If dashboard incorrectly keeps the gift in the denominator, the two paid products become
    // 56.25/93.75 instead of the required 50/100 split.
    const giftOrder = await prisma.order.create({
      data: {
        orderNo: `DASHG${suffix}`.slice(0, 32),
        userId: user.id,
        status: 'completed',
        totalAmount: 40000,
        activityDiscountAmount: 20000,
        discountAmount: 5000,
        payAmount: 15000,
        receiverName: 'Dashboard支付事实用户',
        receiverPhone: '13800138000',
        province: '上海市',
        city: '上海市',
        district: '浦东新区',
        detailAddress: 'Dashboard真实数据库测试路2号',
        paidAt,
      },
    });
    orderIds.push(giftOrder.id);
    await prisma.orderItem.createMany({
      data: [
        {
          orderId: giftOrder.id,
          productId: giftBasisA.product.id,
          skuId: giftBasisA.sku.id,
          productName: giftBasisA.product.name,
          price: 10000,
          quantity: 1,
          subtotal: 10000,
        },
        {
          orderId: giftOrder.id,
          productId: giftBasisB.product.id,
          skuId: giftBasisB.sku.id,
          productName: giftBasisB.product.name,
          price: 10000,
          quantity: 1,
          subtotal: 10000,
          activityDiscount: 10000,
        },
        {
          orderId: giftOrder.id,
          productId: zeroGift.product.id,
          skuId: zeroGift.sku.id,
          productName: zeroGift.product.name,
          price: 10000,
          quantity: 1,
          subtotal: 0,
          activityDiscount: 10000,
        },
      ],
    });
    await prisma.orderPayment.create({
      data: {
        orderId: giftOrder.id,
        paymentNo: `DASHGPAY${suffix}`.slice(0, 64),
        amount: 15000,
        status: PAYMENT_STATUS.SUCCESS,
        paidAt,
      },
    });

    // An unpaid order with a large quantity must not contaminate sales facts.
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
        detailAddress: 'Dashboard真实数据库测试路3号',
      },
    });
    orderIds.push(unpaidOrder.id);
    await prisma.orderItem.create({
      data: {
        orderId: unpaidOrder.id,
        productId: cappedRegular.product.id,
        skuId: cappedRegular.sku.id,
        productName: cappedRegular.product.name,
        price: 10000,
        quantity: 99,
        subtotal: 990000,
      },
    });

    const service = new NetPaidProductDashboardService(prisma as any);
    const stats: any = await service.getStats();
    assert.ok(stats.todaySales >= 29000, '两笔成功支付订单必须按真实实付进入今日销售额');
    assert.ok(stats.todayOrders >= 2, '两笔成功支付订单必须进入今日订单数');

    const today = dateKey(paidAt);
    const trend: any[] = await service.getSalesChartByDateRange(today, today);
    assert.equal(trend.length, 1);
    assert.ok(trend[0].salesAmount >= 29000, '已成功支付金额不能因订单后续状态从趋势消失');
    assert.ok(trend[0].orderCount >= 2, '成功支付订单必须进入趋势订单数');

    const topProducts: any[] = await service.getTopProducts(100);
    const byId = new Map(topProducts.map((item) => [item.id, item]));

    const cappedActivityRow = byId.get(cappedActivity.product.id.toString());
    const cappedRegularRow = byId.get(cappedRegular.product.id.toString());
    assert.ok(cappedActivityRow && cappedRegularRow, '封顶分摊场景商品必须进入热销聚合');
    assert.equal(cappedActivityRow.salesAmount, 5000, '活动商品现金分摊不得超过持久化subtotal');
    assert.equal(cappedRegularRow.salesAmount, 9000, '封顶后的剩余现金必须继续分给仍有容量的商品');
    assert.equal(cappedActivityRow.salesAmount + cappedRegularRow.salesAmount, 14000);
    assert.equal(cappedRegularRow.salesCount, 1, '未支付订单的99件商品不能进入热销销量');

    const giftARow = byId.get(giftBasisA.product.id.toString());
    const giftBRow = byId.get(giftBasisB.product.id.toString());
    const zeroGiftRow = byId.get(zeroGift.product.id.toString());
    assert.ok(giftARow && giftBRow && zeroGiftRow, '赠品场景商品必须进入可追踪的热销聚合');
    assert.equal(giftARow.salesAmount, 5000, '零元赠品不能稀释商品A的经济分摊基数');
    assert.equal(giftBRow.salesAmount, 10000, '零元赠品不能稀释商品B的经济分摊基数');
    assert.equal(zeroGiftRow.salesAmount, 0, '零元赠品不能被分配任何真实支付金额');
    assert.equal(giftARow.salesAmount + giftBRow.salesAmount + zeroGiftRow.salesAmount, 15000);

    console.log('[dashboard-payment-facts-integration] PASS');
  } finally {
    if (orderIds.length) {
      await prisma.orderPayment.deleteMany({ where: { orderId: { in: orderIds } } });
      await prisma.orderItem.deleteMany({ where: { orderId: { in: orderIds } } });
      await prisma.order.deleteMany({ where: { id: { in: orderIds } } });
    }
    if (skuIds.length) await prisma.productSku.deleteMany({ where: { id: { in: skuIds } } });
    if (productIds.length) await prisma.product.deleteMany({ where: { id: { in: productIds } } });
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
