import assert from 'node:assert/strict';
import { PrismaClient } from '@prisma/client';
import { DurableAdminIdempotentBigintSafeProductionGroupBuyService } from '../src/group-buy/durable-admin-idempotent-bigint-safe-production-group-buy.service';

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

async function main() {
  await prisma.$connect();
  const suffix = `${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
  const requestIds = [0, 1, 2].map((index) => `${Date.now()}${index}${Math.floor(Math.random() * 1_000_000)}`);
  let categoryId: bigint | null = null;
  let productId: bigint | null = null;
  let skuId: bigint | null = null;

  try {
    const category = await prisma.productCategory.create({
      data: { name: `拼团幂等真库分类-${suffix}`.slice(0, 50) },
    });
    categoryId = category.id;

    const product = await prisma.product.create({
      data: {
        name: `拼团幂等真库商品-${suffix}`,
        categoryId,
        productType: 'physical',
        fulfillmentType: 'delivery',
        status: 1,
      },
    });
    productId = product.id;

    const sku = await prisma.productSku.create({
      data: {
        productId,
        skuCode: `GB-IDEM-${suffix}`.slice(0, 50),
        price: 12_000,
        stock: 100,
        status: 1,
      },
    });
    skuId = sku.id;

    const service = new DurableAdminIdempotentBigintSafeProductionGroupBuyService(
      prisma as any,
      {} as any,
      {} as any,
      {} as any,
    );

    for (let index = 0; index < requestIds.length; index += 1) {
      const clientRequestId = requestIds[index];
      const name = `拼团并发幂等-${suffix}-${index}`.slice(0, 100);
      const dto = {
        name,
        productId: productId.toString(),
        skuId: skuId.toString(),
        groupPrice: 9_900,
        groupSize: 3,
        groupExpireHours: 24,
        stockLimit: 20,
        limitPerUser: 1,
        startTime: new Date(Date.now() + 60_000).toISOString(),
        endTime: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        status: 0,
        clientRequestId,
      } as any;

      const [first, second] = await Promise.all([
        service.createActivity(dto),
        service.createActivity({ ...dto }),
      ]);
      assert.equal(first.id.toString(), second.id.toString(), '同 requestId 的并发创建必须返回同一活动');

      const activities = await prisma.groupBuyActivity.findMany({
        where: { name },
        select: { id: true },
      });
      assert.equal(activities.length, 1, '同 requestId 的并发创建只能持久化一个拼团活动');
      assert.equal(activities[0].id.toString(), first.id.toString());

      const events = await prisma.businessEvent.findMany({
        where: {
          eventType: 'group_buy_activity_create',
          bizType: 'group_buy_activity',
          bizId: clientRequestId,
        },
        select: { id: true, payload: true },
      });
      assert.equal(events.length, 1, '同 requestId 只能持久化一个创建结果事件');
    }

    console.log('[group-buy-admin-idempotency-integration] PASS');
  } finally {
    await prisma.businessEvent.deleteMany({
      where: {
        eventType: 'group_buy_activity_create',
        bizType: 'group_buy_activity',
        bizId: { in: requestIds },
      },
    });
    await prisma.groupBuyActivity.deleteMany({
      where: { name: { startsWith: `拼团并发幂等-${suffix}`.slice(0, 100) } },
    });
    if (skuId) await prisma.productSku.deleteMany({ where: { id: skuId } });
    if (productId) await prisma.product.deleteMany({ where: { id: productId } });
    if (categoryId) await prisma.productCategory.deleteMany({ where: { id: categoryId } });
    await prisma.$disconnect();
  }
}

main().catch(async (error) => {
  console.error('[group-buy-admin-idempotency-integration] FAIL', error);
  await prisma.$disconnect().catch(() => undefined);
  process.exitCode = 1;
});
