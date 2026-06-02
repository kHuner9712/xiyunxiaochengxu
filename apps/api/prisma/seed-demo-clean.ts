import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();
const DEMO_TAG = '[Demo]';
const TEST_TAG = '[测试]';

function assertNonProduction() {
  if ((process.env.NODE_ENV || '').toLowerCase() === 'production') {
    console.error('ERROR: Demo 清理脚本禁止在 NODE_ENV=production 环境执行。');
    process.exit(1);
  }
}

function isNonEmpty<T>(items: T[]) {
  return Array.isArray(items) && items.length > 0;
}

function orWhere(conditions: Record<string, unknown>[]) {
  return conditions.length > 0 ? { OR: conditions } : { id: -1n };
}

async function remove(label: string, delegate: any, args: any) {
  const result = await delegate.deleteMany(args);
  console.log(`${label}: ${result.count}`);
  return result.count;
}

async function main() {
  assertNonProduction();
  console.log('开始清理 Demo 数据...');

  const demoUsers = await prisma.user.findMany({
    where: {
      OR: [
        { openid: { startsWith: 'demo_openid_' } },
        { nickname: { contains: DEMO_TAG } },
        { nickname: { contains: TEST_TAG } },
      ],
    },
    select: { id: true },
  });
  const demoUserIds = demoUsers.map((item) => item.id);

  const demoOrders = await prisma.order.findMany({
    where: {
      OR: [
        { orderNo: { startsWith: 'DEMO-ORDER-' } },
        { source: 'demo_seed' },
        { adminRemark: { contains: DEMO_TAG } },
      ],
    },
    select: { id: true },
  });
  const demoOrderIds = demoOrders.map((item) => item.id);

  const demoProducts = await prisma.product.findMany({
    where: {
      OR: [
        { name: { contains: DEMO_TAG } },
        { description: { contains: '仅供演示测试' } },
      ],
    },
    select: { id: true },
  });
  const demoProductIds = demoProducts.map((item) => item.id);

  const demoSkus = await prisma.productSku.findMany({
    where: {
      OR: [
        { skuCode: { startsWith: 'DEMO-SKU-' } },
        ...(isNonEmpty(demoProductIds) ? [{ productId: { in: demoProductIds } }] : []),
      ],
    },
    select: { id: true },
  });
  const demoSkuIds = demoSkus.map((item) => item.id);

  const demoActivities = await prisma.activity.findMany({
    where: { name: { contains: DEMO_TAG } },
    select: { id: true },
  });
  const demoActivityIds = demoActivities.map((item) => item.id);

  const demoCoupons = await prisma.coupon.findMany({
    where: { name: { contains: DEMO_TAG } },
    select: { id: true },
  });
  const demoCouponIds = demoCoupons.map((item) => item.id);

  const demoAftersales = await prisma.aftersaleOrder.findMany({
    where: {
      OR: [
        { aftersaleNo: { startsWith: 'DEMO-AFTERSALE-' } },
        { description: { contains: DEMO_TAG } },
        ...(isNonEmpty(demoOrderIds) ? [{ orderId: { in: demoOrderIds } }] : []),
      ],
    },
    select: { id: true },
  });
  const demoAftersaleIds = demoAftersales.map((item) => item.id);

  await remove('退款回调日志', prisma.refundCallbackLog, {
    where: { outRefundNo: { startsWith: 'DEMO-' } },
  });
  await remove('退款记录', prisma.orderRefund, {
    where: {
      OR: [
        { refundNo: { startsWith: 'DEMO-REFUND-' } },
        { outRefundNo: { startsWith: 'DEMO-' } },
        ...(isNonEmpty(demoOrderIds) ? [{ orderId: { in: demoOrderIds } }] : []),
        ...(isNonEmpty(demoAftersaleIds) ? [{ aftersaleId: { in: demoAftersaleIds } }] : []),
      ],
    },
  });
  await remove('售后日志', prisma.aftersaleLog, {
    where: {
      OR: [
        { content: { contains: DEMO_TAG } },
        ...(isNonEmpty(demoAftersaleIds) ? [{ aftersaleId: { in: demoAftersaleIds } }] : []),
      ],
    },
  });
  await remove('售后单', prisma.aftersaleOrder, {
    where: {
      OR: [
        { aftersaleNo: { startsWith: 'DEMO-AFTERSALE-' } },
        ...(isNonEmpty(demoAftersaleIds) ? [{ id: { in: demoAftersaleIds } }] : []),
      ],
    },
  });
  await remove('订单日志', prisma.orderLog, {
    where: {
      OR: [
        { content: { contains: DEMO_TAG } },
        { action: 'demo_seed' },
        ...(isNonEmpty(demoOrderIds) ? [{ orderId: { in: demoOrderIds } }] : []),
      ],
    },
  });
  await remove('支付记录', prisma.orderPayment, {
    where: {
      OR: [
        { paymentNo: { startsWith: 'DEMO-PAY-' } },
        { transactionId: { startsWith: 'DEMO-' } },
        ...(isNonEmpty(demoOrderIds) ? [{ orderId: { in: demoOrderIds } }] : []),
      ],
    },
  });
  await remove('发货记录', prisma.orderDelivery, {
    where: {
      OR: [
        { logisticsNo: { startsWith: 'DEMO-' } },
        { logisticsCompany: { contains: DEMO_TAG } },
        ...(isNonEmpty(demoOrderIds) ? [{ orderId: { in: demoOrderIds } }] : []),
      ],
    },
  });
  await remove('订单项', prisma.orderItem, {
    where: isNonEmpty(demoOrderIds) ? { orderId: { in: demoOrderIds } } : { productName: { contains: DEMO_TAG } },
  });
  await remove('订单补偿任务', prisma.paymentCompensationTask, {
    where: { orderNo: { startsWith: 'DEMO-ORDER-' } },
  });
  await remove('订单', prisma.order, {
    where: {
      OR: [
        { orderNo: { startsWith: 'DEMO-ORDER-' } },
        { source: 'demo_seed' },
      ],
    },
  });

  await remove('用户优惠券', prisma.userCoupon, {
    where: orWhere([
      ...(isNonEmpty(demoUserIds) ? [{ userId: { in: demoUserIds } }] : []),
      ...(isNonEmpty(demoCouponIds) ? [{ couponId: { in: demoCouponIds } }] : []),
    ]),
  });
  await remove('购物车', prisma.cart, {
    where: orWhere([
      ...(isNonEmpty(demoUserIds) ? [{ userId: { in: demoUserIds } }] : []),
      ...(isNonEmpty(demoProductIds) ? [{ productId: { in: demoProductIds } }] : []),
      ...(isNonEmpty(demoSkuIds) ? [{ skuId: { in: demoSkuIds } }] : []),
    ]),
  });
  await remove('积分记录', prisma.pointsRecord, {
    where: {
      OR: [
        { source: { startsWith: 'demo' } },
        { description: { contains: DEMO_TAG } },
        ...(isNonEmpty(demoUserIds) ? [{ userId: { in: demoUserIds } }] : []),
      ],
    },
  });
  await remove('会员记录', prisma.userMemberRecord, {
    where: isNonEmpty(demoUserIds) ? { userId: { in: demoUserIds } } : { changeReason: { contains: DEMO_TAG } },
  });
  await remove('用户地址', prisma.userAddress, {
    where: {
      OR: [
        { detailAddress: { contains: 'Demo测试地址' } },
        ...(isNonEmpty(demoUserIds) ? [{ userId: { in: demoUserIds } }] : []),
      ],
    },
  });
  await remove('宝宝档案', prisma.babyProfile, {
    where: {
      OR: [
        { nickname: { contains: DEMO_TAG } },
        ...(isNonEmpty(demoUserIds) ? [{ userId: { in: demoUserIds } }] : []),
      ],
    },
  });
  await remove('用户资料', prisma.userProfile, {
    where: isNonEmpty(demoUserIds) ? { userId: { in: demoUserIds } } : { source: 'demo_seed' },
  });
  await remove('分享记录', prisma.shareRecord, {
    where: {
      OR: [
        ...(isNonEmpty(demoUserIds) ? [{ userId: { in: demoUserIds } }, { inviterUserId: { in: demoUserIds } }] : []),
        { sceneCode: { startsWith: 'DEMO-' } },
      ],
    },
  });
  await remove('邀请关系', prisma.userInviteRelation, {
    where: isNonEmpty(demoUserIds)
      ? { OR: [{ inviterUserId: { in: demoUserIds } }, { inviteeUserId: { in: demoUserIds } }] }
      : { status: -999 },
  });
  await remove('Demo 用户', prisma.user, {
    where: {
      OR: [
        { openid: { startsWith: 'demo_openid_' } },
        { nickname: { contains: DEMO_TAG } },
      ],
    },
  });

  await remove('活动商品', prisma.activityProduct, {
    where: orWhere([
      ...(isNonEmpty(demoActivityIds) ? [{ activityId: { in: demoActivityIds } }] : []),
      ...(isNonEmpty(demoProductIds) ? [{ productId: { in: demoProductIds } }] : []),
      ...(isNonEmpty(demoSkuIds) ? [{ skuId: { in: demoSkuIds } }] : []),
    ]),
  });
  await remove('活动', prisma.activity, { where: { name: { contains: DEMO_TAG } } });
  await remove('优惠券', prisma.coupon, { where: { name: { contains: DEMO_TAG } } });
  await remove('商品图片', prisma.productImage, {
    where: isNonEmpty(demoProductIds) ? { productId: { in: demoProductIds } } : { imageUrl: { contains: '/uploads/demo/' } },
  });
  await remove('库存日志', prisma.productStockLog, {
    where: {
      OR: [
        { reason: { contains: DEMO_TAG } },
        ...(isNonEmpty(demoProductIds) ? [{ productId: { in: demoProductIds } }] : []),
        ...(isNonEmpty(demoSkuIds) ? [{ skuId: { in: demoSkuIds } }] : []),
      ],
    },
  });
  await remove('SKU', prisma.productSku, {
    where: {
      OR: [
        { skuCode: { startsWith: 'DEMO-SKU-' } },
        ...(isNonEmpty(demoProductIds) ? [{ productId: { in: demoProductIds } }] : []),
      ],
    },
  });
  await remove('商品', prisma.product, {
    where: {
      OR: [
        { name: { contains: DEMO_TAG } },
        { description: { contains: '仅供演示测试' } },
      ],
    },
  });
  await remove('品牌', prisma.brand, { where: { name: { contains: DEMO_TAG } } });
  await remove('供应商', prisma.supplier, { where: { name: { contains: DEMO_TAG } } });
  await remove('商品属性', prisma.productAttribute, { where: { name: { contains: DEMO_TAG } } });
  await remove('分类', prisma.productCategory, { where: { name: { contains: DEMO_TAG } } });
  await remove('Banner', prisma.banner, { where: { title: { contains: DEMO_TAG } } });
  await remove('首页模块', prisma.homeSection, { where: { title: { contains: DEMO_TAG } } });
  await remove('内容', prisma.content, { where: { title: { contains: DEMO_TAG } } });
  await remove('内容分类', prisma.contentCategory, { where: { name: { contains: DEMO_TAG } } });
  await remove('系统配置 Demo 项', prisma.systemConfig, {
    where: {
      OR: [
        { groupName: { startsWith: 'demo_' } },
        { description: { contains: DEMO_TAG } },
        { configValue: { contains: DEMO_TAG } },
        { configValue: { contains: 'DEMO-' } },
      ],
    },
  });

  cleanupDemoFiles(path.resolve(process.cwd(), 'uploads', 'demo'));
  cleanupDemoFiles(path.resolve(process.cwd(), 'prisma', 'demo-assets'));
  console.log('Demo 数据清理完成');
}

function cleanupDemoFiles(dir: string) {
  if (!fs.existsSync(dir)) return;
  const files = fs.readdirSync(dir).filter((file) => file.endsWith('.png'));
  for (const file of files) fs.unlinkSync(path.join(dir, file));
  console.log(`Demo 图片文件: ${files.length} (${dir})`);
}

main()
  .catch((error) => {
    console.error('Demo 数据清理失败:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
