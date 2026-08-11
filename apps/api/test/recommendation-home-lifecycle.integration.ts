import assert from 'node:assert/strict';
import { PrismaClient } from '@prisma/client';
import { HomeService } from '../src/home/home.service';
import { RecommendationService } from '../src/recommendation/recommendation.service';

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
  const suffix = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const recommendationService = new RecommendationService(prisma as any);
  const homeService = new HomeService(prisma as any);

  let categoryId: bigint | null = null;
  let productId: bigint | null = null;
  let activityId: bigint | null = null;
  let contentId: bigint | null = null;
  const sectionIds: bigint[] = [];

  try {
    const category = await prisma.productCategory.create({
      data: { name: `推荐真库分类-${suffix}` },
    });
    categoryId = category.id;

    const product = await prisma.product.create({
      data: {
        name: `推荐真库商品-${suffix}`,
        categoryId: category.id,
        status: 1,
        mainImage: '/uploads/public/recommendation-product.jpg',
        minPrice: 12800,
        maxPrice: 12800,
      },
    });
    productId = product.id;

    const now = Date.now();
    const activity = await prisma.activity.create({
      data: {
        name: `推荐真库活动-${suffix}`,
        type: '1',
        bannerImage: '/uploads/public/recommendation-activity.jpg',
        startTime: new Date(now - 60_000),
        endTime: new Date(now + 3_600_000),
        status: 2,
      },
    });
    activityId = activity.id;

    const content = await prisma.content.create({
      data: {
        title: `推荐真库内容-${suffix}`,
        contentType: 'article',
        coverImage: '/uploads/public/recommendation-content.jpg',
        summary: '推荐位真库内容摘要',
        content: '推荐位真库内容正文',
        status: 1,
        publishedAt: new Date(),
      },
    });
    contentId = content.id;

    const productSection: any = await recommendationService.create({
      name: '真库商品精选',
      code: `integration_product_${suffix}`,
      type: 1,
      sort: 10,
      status: 1,
    });
    sectionIds.push(BigInt(productSection.id));

    const activitySection: any = await recommendationService.create({
      name: '真库活动精选',
      code: `integration_activity_${suffix}`,
      type: 2,
      sort: 20,
      status: 1,
    });
    sectionIds.push(BigInt(activitySection.id));

    const contentSection: any = await recommendationService.create({
      name: '真库内容精选',
      code: `integration_content_${suffix}`,
      type: 3,
      sort: 30,
      status: 1,
    });
    sectionIds.push(BigInt(contentSection.id));

    const productItems = await recommendationService.saveItems(productSection.id, [
      { targetId: product.id.toString(), sort: 5 },
    ]);
    const activityItems = await recommendationService.saveItems(activitySection.id, [
      { targetId: activity.id.toString(), sort: 6 },
    ]);
    const contentItems = await recommendationService.saveItems(contentSection.id, [
      { targetId: content.id.toString(), sort: 7 },
    ]);

    assert.equal(productItems[0].targetName, product.name, '商品名称必须由服务端解析');
    assert.equal(activityItems[0].targetName, activity.name, '活动名称必须由服务端解析');
    assert.equal(contentItems[0].targetName, content.title, '内容名称必须由服务端解析');

    const productCandidates: any = await recommendationService.findCandidates(productSection.id, {
      page: 1,
      pageSize: 20,
      skip: 0,
      take: 20,
      keyword: suffix,
    } as any);
    assert.ok(productCandidates.list.some((item: any) => item.targetId === product.id.toString()));

    const firstHome: any = await homeService.getHomeData();
    const byCode = new Map(firstHome.recommendations.map((section: any) => [section.code, section]));
    assert.equal(byCode.get(`integration_product_${suffix}`)?.items?.[0]?.id, product.id.toString());
    assert.equal(byCode.get(`integration_activity_${suffix}`)?.items?.[0]?.id, activity.id.toString());
    assert.equal(byCode.get(`integration_content_${suffix}`)?.items?.[0]?.id, content.id.toString());

    await prisma.product.update({ where: { id: product.id }, data: { status: 0 } });
    const afterProductOffline: any = await homeService.getHomeData();
    assert.ok(
      !afterProductOffline.recommendations.some((section: any) => section.code === `integration_product_${suffix}`),
      '下架商品不得继续出现在首页推荐位',
    );
    await assert.rejects(
      recommendationService.saveItems(productSection.id, [{ targetId: product.id.toString(), sort: 1 }]),
      /不存在、已下线或已失效/,
      '下架商品不能重新写入推荐位',
    );

    await prisma.activity.update({ where: { id: activity.id }, data: { endTime: new Date(now - 1_000) } });
    await prisma.content.update({ where: { id: content.id }, data: { deletedAt: new Date() } });
    const afterAllInvalid: any = await homeService.getHomeData();
    assert.ok(
      !afterAllInvalid.recommendations.some((section: any) => section.code.startsWith('integration_') && section.code.endsWith(suffix)),
      '过期活动和已删除内容不得继续出现在首页推荐位',
    );

    console.log('[recommendation-home-lifecycle-integration] PASS');
  } finally {
    if (sectionIds.length > 0) await prisma.homeSection.deleteMany({ where: { id: { in: sectionIds } } });
    if (contentId) await prisma.content.deleteMany({ where: { id: contentId } });
    if (activityId) await prisma.activity.deleteMany({ where: { id: activityId } });
    if (productId) await prisma.product.deleteMany({ where: { id: productId } });
    if (categoryId) await prisma.productCategory.deleteMany({ where: { id: categoryId } });
    await prisma.$disconnect();
  }
}

main().catch(async (error) => {
  console.error('[recommendation-home-lifecycle-integration] FAIL', error);
  await prisma.$disconnect().catch(() => undefined);
  process.exitCode = 1;
});
