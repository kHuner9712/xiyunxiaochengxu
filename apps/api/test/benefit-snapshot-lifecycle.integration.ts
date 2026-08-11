import assert from 'node:assert/strict';
import { PrismaClient } from '@prisma/client';
import { SnapshotAwareStateSafeMerchantSettlementService } from '../src/merchant-settlement/snapshot-aware-state-safe-merchant-settlement.service';
import { VersionedBenefitPackageService } from '../src/benefit-package/versioned-benefit-package.service';

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
  await prisma.merchantSettlementItem.deleteMany();
  await prisma.merchantSettlementBatch.deleteMany();
  await prisma.merchantCommissionRecord.deleteMany();
  await prisma.merchantCommissionRule.deleteMany();
  await prisma.userBenefitVerificationLog.deleteMany();
  await prisma.userBenefitEntitlement.deleteMany();
  await prisma.userBenefitPackage.deleteMany();
  await prisma.businessEvent.deleteMany({
    where: {
      eventType: {
        in: [
          'benefit_product_config_before_change',
          'benefit_order_item_snapshot',
          'benefit_user_package_snapshot',
          'benefit_entitlement_snapshot',
        ],
      },
    },
  });
  await prisma.benefitPackageItem.deleteMany();
  await prisma.benefitPackage.deleteMany();
  await prisma.aftersaleLog.deleteMany();
  await prisma.aftersaleOrder.deleteMany();
  await prisma.orderRefund.deleteMany();
  await prisma.orderLog.deleteMany();
  await prisma.orderPayment.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.productStockLog.deleteMany();
  await prisma.cart.deleteMany();
  await prisma.productSku.deleteMany();
  await prisma.product.deleteMany();
  await prisma.productCategory.deleteMany();
  await prisma.pickupStore.deleteMany();
  await prisma.merchantPromotionSource.deleteMany();
  await prisma.user.deleteMany();
}

async function createProduct(categoryId: bigint, suffix: string) {
  const product = await prisma.product.create({
    data: {
      name: `权益快照测试商品-${suffix}`,
      categoryId,
      status: 1,
      productType: 'service',
      fulfillmentType: 'delivery',
    },
  });
  const sku = await prisma.productSku.create({
    data: {
      productId: product.id,
      skuCode: `BENEFIT-SNAPSHOT-${suffix}`,
      price: 10000,
      stock: 20,
      status: 1,
    },
  });
  return { product, sku };
}

async function createPaidOrder(params: {
  userId: bigint;
  productId: bigint;
  skuId: bigint;
  suffix: string;
  createdAt?: Date;
}) {
  return prisma.order.create({
    data: {
      orderNo: `BENEFIT${params.suffix}${Date.now()}`.slice(0, 32),
      userId: params.userId,
      status: 'pending_delivery',
      totalAmount: 10000,
      payAmount: 10000,
      receiverName: '权益快照用户',
      receiverPhone: '13800138000',
      province: '上海市',
      city: '上海市',
      district: '浦东新区',
      detailAddress: '权益快照测试路1号',
      paidAt: params.createdAt ?? new Date(),
      ...(params.createdAt ? { createdAt: params.createdAt } : {}),
      orderItems: {
        create: {
          productId: params.productId,
          skuId: params.skuId,
          productName: `权益快照测试商品-${params.suffix}`,
          price: 10000,
          quantity: 1,
          subtotal: 10000,
        },
      },
    },
    include: { orderItems: true },
  });
}

async function main() {
  await prisma.$connect();
  await cleanup();

  const settlementService = new SnapshotAwareStateSafeMerchantSettlementService(prisma as any);
  const benefitService = new VersionedBenefitPackageService(
    prisma as any,
    settlementService as any,
  );

  try {
    const user = await prisma.user.create({
      data: { openid: 'benefit-snapshot-lifecycle-user' },
    });
    const category = await prisma.productCategory.create({
      data: { name: '权益快照集成测试分类' },
    });
    const merchantA = await prisma.merchantPromotionSource.create({
      data: {
        name: '历史商家A',
        promotionCode: 'BENEFIT-MERCHANT-A',
        status: 1,
      },
    });
    const merchantB = await prisma.merchantPromotionSource.create({
      data: {
        name: '当前商家B',
        promotionCode: 'BENEFIT-MERCHANT-B',
        status: 1,
      },
    });
    const storeA = await prisma.pickupStore.create({
      data: {
        name: '历史门店A',
        province: '上海市',
        city: '上海市',
        district: '浦东新区',
        address: '历史门店路1号',
        status: 1,
      },
    });
    const storeB = await prisma.pickupStore.create({
      data: {
        name: '当前门店B',
        province: '上海市',
        city: '上海市',
        district: '徐汇区',
        address: '当前门店路2号',
        status: 1,
      },
    });

    const { product, sku } = await createProduct(category.id, 'PURCHASE');
    const createdPackage = await benefitService.create({
      productId: product.id.toString(),
      name: '购买时权益包',
      status: 1,
      validDays: 30,
      items: [
        {
          name: '购买时服务A',
          itemType: 'service',
          quantity: 1,
          originalValue: 10000,
          verifyRequired: 1,
          status: 1,
          merchantPromotionSourceId: merchantA.id.toString(),
          pickupStoreId: storeA.id.toString(),
        },
      ],
    });
    const packageId = BigInt(createdPackage.id);
    const oldItem = await prisma.benefitPackageItem.findFirstOrThrow({
      where: { packageId, deletedAt: null },
    });

    const order = await createPaidOrder({
      userId: user.id,
      productId: product.id,
      skuId: sku.id,
      suffix: 'PURCHASE',
    });
    const orderItem = order.orderItems[0]!;

    await new Promise((resolve) => setTimeout(resolve, 5));
    await benefitService.update(packageId.toString(), {
      name: '当前权益包已修改',
      status: 1,
      items: [
        {
          id: oldItem.id.toString(),
          name: '当前服务B',
          itemType: 'service',
          quantity: 1,
          originalValue: 20000,
          verifyRequired: 1,
          status: 0,
          merchantPromotionSourceId: merchantB.id.toString(),
          pickupStoreId: storeB.id.toString(),
        },
      ],
    });

    const currentItem = await prisma.benefitPackageItem.findUniqueOrThrow({ where: { id: oldItem.id } });
    assert.equal(currentItem.name, '当前服务B');
    assert.equal(currentItem.originalValue, 20000);
    assert.equal(currentItem.status, 0);
    assert.equal(currentItem.merchantPromotionSourceId?.toString(), merchantB.id.toString());
    assert.equal(currentItem.pickupStoreId?.toString(), storeB.id.toString());

    await benefitService.grantBenefitsForOrder(order.id, user.id);

    const userPkg = await prisma.userBenefitPackage.findFirstOrThrow({
      where: { orderId: order.id, orderItemId: orderItem.id },
    });
    const entitlement = await prisma.userBenefitEntitlement.findFirstOrThrow({
      where: { userBenefitPackageId: userPkg.id },
    });
    const snapshotEvents = await prisma.businessEvent.findMany({
      where: {
        eventType: {
          in: [
            'benefit_order_item_snapshot',
            'benefit_user_package_snapshot',
            'benefit_entitlement_snapshot',
          ],
        },
      },
    });
    assert.equal(snapshotEvents.filter((event) => event.eventType === 'benefit_order_item_snapshot').length, 1);
    assert.equal(snapshotEvents.filter((event) => event.eventType === 'benefit_user_package_snapshot').length, 1);
    assert.equal(snapshotEvents.filter((event) => event.eventType === 'benefit_entitlement_snapshot').length, 1);

    const preview = await benefitService.previewVerify(entitlement.verifyCode);
    assert.equal(preview.canVerify, true, '当前权益项已停用也不能使历史已购权益失效');
    assert.equal(preview.packageName, '购买时权益包');
    assert.equal(preview.itemName, '购买时服务A');
    assert.equal(preview.originalValue, 10000);
    assert.equal(preview.merchantName, '历史商家A');
    assert.equal(preview.storeName, '历史门店A');

    await prisma.merchantCommissionRule.create({
      data: {
        name: '权益快照服务分佣规则',
        ruleType: 'service_verification',
        benefitPackageItemId: oldItem.id,
        calculationType: 'percent',
        commissionRate: 1000,
        status: 1,
        priority: 100,
      },
    });

    await benefitService.verify(entitlement.verifyCode, '1', '真实 MySQL 权益快照核销');
    const verified = await prisma.userBenefitEntitlement.findUniqueOrThrow({
      where: { id: entitlement.id },
    });
    const commission = await prisma.merchantCommissionRecord.findFirstOrThrow({
      where: {
        entitlementId: entitlement.id,
        sourceType: 'service_verification',
      },
    });
    assert.equal(verified.status, 'used');
    assert.equal(commission.sourceAmount, 10000, '服务分佣计算基数必须来自购买时冻结价值，而不是当前20000');
    assert.equal(commission.commissionAmount, 1000, '10%服务分佣必须基于冻结的10000价值');
    assert.equal(commission.merchantPromotionSourceId?.toString(), merchantA.id.toString());
    assert.equal(commission.pickupStoreId?.toString(), storeA.id.toString());
    const calculationSnapshot = (commission.calculationSnapshot ?? {}) as Record<string, unknown>;
    assert.equal(calculationSnapshot.benefitValueSource, 'purchase_snapshot');

    await benefitService.reconcileOrderBenefits(order.id, user.id);
    const packagesAfterReconcile = await prisma.userBenefitPackage.count({
      where: { orderId: order.id, orderItemId: orderItem.id },
    });
    const entitlementsAfterReconcile = await prisma.userBenefitEntitlement.count({
      where: { userBenefitPackageId: userPkg.id },
    });
    assert.equal(packagesAfterReconcile, 1, '权益补偿必须保持包级幂等');
    assert.equal(entitlementsAfterReconcile, 1, '权益补偿不能因为当前配置变化重复补码');

    await benefitService.delete(packageId.toString());
    const replacementPackage = await benefitService.create({
      productId: product.id.toString(),
      name: '删除后重新绑定权益包',
      status: 1,
      items: [{ name: '新权益', quantity: 1, originalValue: 3000, verifyRequired: 1, status: 1 }],
    });
    assert.ok(replacementPackage.id, '删除旧权益包后同一商品必须能重新绑定新权益包');

    const { product: lateProduct, sku: lateSku } = await createProduct(category.id, 'LATE');
    const orderBeforePackage = await createPaidOrder({
      userId: user.id,
      productId: lateProduct.id,
      skuId: lateSku.id,
      suffix: 'LATE',
    });
    await new Promise((resolve) => setTimeout(resolve, 5));
    await benefitService.create({
      productId: lateProduct.id.toString(),
      name: '订单之后才创建的权益包',
      status: 1,
      items: [{ name: '不能追发的权益', quantity: 1, originalValue: 5000, verifyRequired: 1, status: 1 }],
    });
    await benefitService.grantBenefitsForOrder(orderBeforePackage.id, user.id);
    const retroactiveGrantCount = await prisma.userBenefitPackage.count({
      where: { orderId: orderBeforePackage.id },
    });
    assert.equal(retroactiveGrantCount, 0, '订单创建后才新增的权益包不能追溯发给历史订单');

    const { product: otherProduct } = await createProduct(category.id, 'OTHER');
    const otherPackage = await benefitService.create({
      productId: otherProduct.id.toString(),
      name: '其他权益包',
      status: 1,
      items: [{ name: '其他包权益项', quantity: 1, originalValue: 1000, verifyRequired: 1, status: 1 }],
    });
    const foreignItem = await prisma.benefitPackageItem.findFirstOrThrow({
      where: { packageId: BigInt(otherPackage.id), deletedAt: null },
    });
    const replacementBeforeBadUpdate = await prisma.benefitPackage.findUniqueOrThrow({
      where: { id: BigInt(replacementPackage.id) },
    });
    await assert.rejects(
      () => benefitService.update(String(replacementPackage.id), {
        name: '不应提交的名称',
        items: [{ id: foreignItem.id.toString(), name: '越权移动权益项', quantity: 1, status: 1 }],
      }),
      /不属于当前权益包/,
      '不能通过提交其他权益包的 itemId 把权益项跨包移动',
    );
    const replacementAfterBadUpdate = await prisma.benefitPackage.findUniqueOrThrow({
      where: { id: BigInt(replacementPackage.id) },
    });
    assert.equal(
      replacementAfterBadUpdate.name,
      replacementBeforeBadUpdate.name,
      '权益包和权益项更新必须在同一事务，权益项校验失败时包字段也必须回滚',
    );

    console.log('[benefit-snapshot-lifecycle-integration] PASS');
  } finally {
    await cleanup();
    await prisma.$disconnect();
  }
}

main().catch(async (error) => {
  console.error('[benefit-snapshot-lifecycle-integration] FAIL', error);
  await prisma.$disconnect().catch(() => undefined);
  process.exitCode = 1;
});
