import assert from 'node:assert/strict';
import { PrismaClient } from '@prisma/client';
import { SnapshotAwareStateSafeMerchantSettlementService } from '../src/merchant-settlement/snapshot-aware-state-safe-merchant-settlement.service';
import { SnapshotViewBenefitPackageService } from '../src/benefit-package/snapshot-view-benefit-package.service';

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
      eventType: { in: ['benefit_user_package_snapshot', 'benefit_entitlement_snapshot'] },
    },
  });
  await prisma.benefitPackageItem.deleteMany();
  await prisma.benefitPackage.deleteMany();
  await prisma.orderPayment.deleteMany();
  await prisma.orderLog.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.pickupStore.deleteMany();
  await prisma.merchantPromotionSource.deleteMany();
  await prisma.user.deleteMany();
}

async function main() {
  await prisma.$connect();
  await cleanup();

  const settlementService = new SnapshotAwareStateSafeMerchantSettlementService(prisma as any);
  const service = new SnapshotViewBenefitPackageService(prisma as any, settlementService as any);

  try {
    const user = await prisma.user.create({
      data: {
        openid: 'benefit-snapshot-view-user',
        nickname: '权益历史用户',
        phone: '13800138001',
      },
    });
    const merchantA = await prisma.merchantPromotionSource.create({
      data: { name: '历史商家A', promotionCode: 'VIEW-MERCHANT-A', status: 1 },
    });
    const merchantB = await prisma.merchantPromotionSource.create({
      data: { name: '当前商家B', promotionCode: 'VIEW-MERCHANT-B', status: 1 },
    });
    const storeA = await prisma.pickupStore.create({
      data: {
        name: '历史门店A',
        province: '上海市',
        city: '上海市',
        district: '浦东新区',
        address: '历史门店路1号',
        contactPhone: '021-10000001',
        businessHours: '09:00-18:00',
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
        contactPhone: '021-20000002',
        businessHours: '10:00-20:00',
        status: 1,
      },
    });

    const pkg = await prisma.benefitPackage.create({
      data: {
        name: '当前权益包B',
        subtitle: '当前副标题B',
        coverImage: 'https://example.invalid/current-b.png',
        status: 1,
      },
    });
    const item = await prisma.benefitPackageItem.create({
      data: {
        packageId: pkg.id,
        name: '当前权益项B',
        itemType: 'service',
        description: '当前描述B',
        quantity: 1,
        originalValue: 20000,
        verifyRequired: 1,
        status: 1,
        merchantPromotionSourceId: merchantB.id,
        pickupStoreId: storeB.id,
      },
    });
    const order = await prisma.order.create({
      data: {
        orderNo: `BENEFITVIEW${Date.now()}`,
        userId: user.id,
        status: 'completed',
        totalAmount: 10000,
        payAmount: 10000,
        paidAt: new Date(),
        completedAt: new Date(),
      },
    });
    const userPkg = await prisma.userBenefitPackage.create({
      data: {
        userId: user.id,
        packageId: pkg.id,
        orderId: order.id,
        grantKey: `benefit-view:${order.id}`,
        status: 'active',
        validFrom: new Date(Date.now() - 60_000),
        validTo: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });
    const entitlement = await prisma.userBenefitEntitlement.create({
      data: {
        userBenefitPackageId: userPkg.id,
        userId: user.id,
        packageItemId: item.id,
        verifyCode: 'VIEWA001',
        status: 'used',
        usedAt: new Date(),
      },
    });
    await prisma.userBenefitVerificationLog.create({
      data: {
        entitlementId: entitlement.id,
        userId: user.id,
        packageId: pkg.id,
        packageItemId: item.id,
        verifyCode: entitlement.verifyCode,
        verifierType: 'admin',
        verifierId: 1n,
        action: 'verify',
        createdAt: new Date(),
      },
    });

    const packageSnapshot = {
      id: pkg.id.toString(),
      productId: null,
      name: '购买时权益包A',
      subtitle: '购买时副标题A',
      coverImage: 'https://example.invalid/purchase-a.png',
      description: '购买时权益包描述A',
      price: 10000,
      validDays: 30,
      validStartAt: null,
      validEndAt: null,
      status: 1,
      sortOrder: 0,
      items: [
        {
          id: item.id.toString(),
          merchantPromotionSourceId: merchantA.id.toString(),
          pickupStoreId: storeA.id.toString(),
          name: '购买时权益项A',
          itemType: 'service',
          description: '购买时描述A',
          quantity: 1,
          originalValue: 10000,
          verifyRequired: 1,
          status: 1,
          sortOrder: 0,
        },
      ],
    };
    await prisma.businessEvent.createMany({
      data: [
        {
          eventType: 'benefit_user_package_snapshot',
          bizType: 'benefit_user_package',
          bizId: userPkg.id.toString(),
          level: 'info',
          message: '冻结用户权益包历史展示快照',
          payload: { version: 1, grantKey: userPkg.grantKey, package: packageSnapshot },
        },
        {
          eventType: 'benefit_entitlement_snapshot',
          bizType: 'benefit_entitlement',
          bizId: entitlement.id.toString(),
          level: 'info',
          message: '冻结用户权益项历史展示快照',
          payload: { version: 1, packageId: pkg.id.toString(), item: packageSnapshot.items[0] },
        },
      ],
    });

    const myPackages: any = await service.findMyPackages(user.id.toString(), 1, 20);
    assert.equal(myPackages.list.length, 1);
    assert.equal(myPackages.list[0].packageName, '购买时权益包A');
    assert.equal(myPackages.list[0].packageCoverImage, 'https://example.invalid/purchase-a.png');

    const adminPackages: any = await service.findUserPackages({ page: 1, pageSize: 20, userId: user.id.toString() });
    assert.equal(adminPackages.list[0].packageName, '购买时权益包A');
    assert.equal(adminPackages.list[0].coverImage, 'https://example.invalid/purchase-a.png');

    const myEntitlements: any = await service.findMyEntitlements(user.id.toString(), 1, 20);
    assert.equal(myEntitlements.list[0].packageName, '购买时权益包A');
    assert.equal(myEntitlements.list[0].itemName, '购买时权益项A');
    assert.equal(myEntitlements.list[0].itemType, 'service');
    assert.equal(myEntitlements.list[0].originalValue, 10000);
    assert.equal(myEntitlements.list[0].merchantPromotionSourceId, merchantA.id.toString());
    assert.equal(myEntitlements.list[0].pickupStoreId, storeA.id.toString());

    const adminEntitlements: any = await service.findEntitlements({ page: 1, pageSize: 20, userId: user.id.toString() });
    assert.equal(adminEntitlements.list[0].packageName, '购买时权益包A');
    assert.equal(adminEntitlements.list[0].itemName, '购买时权益项A');
    assert.equal(adminEntitlements.list[0].originalValue, 10000);

    const detail: any = await service.findEntitlementForUser(user.id.toString(), entitlement.id.toString());
    assert.equal(detail.packageName, '购买时权益包A');
    assert.equal(detail.packageSubtitle, '购买时副标题A');
    assert.equal(detail.itemName, '购买时权益项A');
    assert.equal(detail.itemDescription, '购买时描述A');
    assert.equal(detail.originalValue, 10000);
    assert.equal(detail.merchantName, '历史商家A');
    assert.equal(detail.storeName, '历史门店A');
    assert.equal(detail.storePhone, '021-10000001');
    assert.equal(detail.businessHours, '09:00-18:00');

    const logs: any = await service.findVerificationLogs({ page: 1, pageSize: 20, userId: user.id.toString() });
    assert.equal(logs.list[0].itemName, '购买时权益项A');

    const stats: any = await service.getStats();
    assert.ok(stats.byStore.some((row: any) => row.name === '历史门店A' && row.count === 1));
    assert.ok(!stats.byStore.some((row: any) => row.name === '当前门店B' && row.count === 1));
    assert.ok(stats.byMerchant.some((row: any) => row.name === '历史商家A' && row.count === 1));
    assert.ok(!stats.byMerchant.some((row: any) => row.name === '当前商家B' && row.count === 1));

    console.log('[benefit-snapshot-view-integration] PASS');
  } finally {
    await cleanup();
    await prisma.$disconnect();
  }
}

main().catch(async (error) => {
  console.error('[benefit-snapshot-view-integration] FAIL', error);
  await prisma.$disconnect().catch(() => undefined);
  process.exitCode = 1;
});
