import assert from 'node:assert/strict';
import { PrismaClient } from '@prisma/client';
import { AttachmentSafeProductionAftersaleService } from '../src/aftersale/attachment-safe-production-aftersale.service';

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
  const suffix = Date.now().toString();
  const created = {
    aftersaleIds: [] as bigint[],
    fileIds: [] as bigint[],
    orderIds: [] as bigint[],
    skuIds: [] as bigint[],
    productIds: [] as bigint[],
    categoryIds: [] as bigint[],
    userIds: [] as bigint[],
  };

  try {
    const [owner, foreignUser] = await Promise.all([
      prisma.user.create({ data: { openid: `aftersale-owner-${suffix}`, nickname: '售后附件用户A' } }),
      prisma.user.create({ data: { openid: `aftersale-foreign-${suffix}`, nickname: '售后附件用户B' } }),
    ]);
    created.userIds.push(owner.id, foreignUser.id);

    const category = await prisma.productCategory.create({
      data: { name: `售后附件分类-${suffix}` },
    });
    created.categoryIds.push(category.id);
    const product = await prisma.product.create({
      data: { name: `售后附件商品-${suffix}`, categoryId: category.id, status: 1 },
    });
    created.productIds.push(product.id);
    const sku = await prisma.productSku.create({
      data: {
        productId: product.id,
        skuCode: `AFTERSALE-ATT-${suffix}`,
        price: 10000,
        stock: 10,
        status: 1,
      },
    });
    created.skuIds.push(sku.id);

    const order = await prisma.order.create({
      data: {
        orderNo: `AFATT${suffix}`.slice(0, 32),
        userId: owner.id,
        status: 'completed',
        totalAmount: 10000,
        payAmount: 10000,
        receiverName: '售后附件用户A',
        receiverPhone: '13800138000',
        province: '上海市',
        city: '上海市',
        district: '浦东新区',
        detailAddress: '售后附件真实数据库测试路1号',
        completedAt: new Date(),
      },
    });
    created.orderIds.push(order.id);
    const orderItem = await prisma.orderItem.create({
      data: {
        orderId: order.id,
        productId: product.id,
        skuId: sku.id,
        productName: product.name,
        price: 10000,
        quantity: 1,
        subtotal: 10000,
      },
    });

    const ownFile = await prisma.fileAsset.create({
      data: {
        fileName: `own-${suffix}.jpg`,
        originalName: 'own.jpg',
        filePath: `/uploads/private/own-${suffix}.jpg`,
        fileSize: 4n,
        fileType: 'image',
        mimeType: 'image/jpeg',
        groupName: 'aftersale',
        uploaderId: owner.id,
        uploaderType: 'user',
      },
    });
    const foreignFile = await prisma.fileAsset.create({
      data: {
        fileName: `foreign-${suffix}.jpg`,
        originalName: 'foreign.jpg',
        filePath: `/uploads/private/foreign-${suffix}.jpg`,
        fileSize: 4n,
        fileType: 'image',
        mimeType: 'image/jpeg',
        groupName: 'aftersale',
        uploaderId: foreignUser.id,
        uploaderType: 'user',
      },
    });
    created.fileIds.push(ownFile.id, foreignFile.id);

    const service = new AttachmentSafeProductionAftersaleService(prisma as any, {} as any);
    const baseDto = {
      orderId: order.id.toString(),
      orderItemId: orderItem.id.toString(),
      type: 1,
      reason: '真实数据库附件归属测试',
    };

    await assert.rejects(
      service.create(owner.id.toString(), {
        ...baseDto,
        images: [`/api/common/file/private/${foreignFile.id.toString()}`],
      }),
      /归属不符|有效私有图片/,
      '用户不能把其他用户的私有附件写入自己的售后单',
    );
    assert.equal(
      await prisma.aftersaleOrder.count({ where: { orderItemId: orderItem.id } }),
      0,
      '非法附件不能留下售后单',
    );

    const ownUrl = `/api/common/file/private/${ownFile.id.toString()}`;
    const result: any = await service.create(owner.id.toString(), {
      ...baseDto,
      images: [ownUrl],
    });
    const aftersaleId = BigInt(result.id);
    created.aftersaleIds.push(aftersaleId);

    const persisted = await prisma.aftersaleOrder.findUniqueOrThrow({
      where: { id: aftersaleId },
      select: { images: true, userId: true, orderItemId: true },
    });
    assert.deepEqual(persisted.images, [ownUrl]);
    assert.equal(persisted.userId, owner.id);
    assert.equal(persisted.orderItemId, orderItem.id);

    const referenced = await prisma.aftersaleOrder.findFirst({
      where: {
        images: {
          array_contains: ownUrl,
        },
      },
      select: { id: true },
    });
    assert.equal(referenced?.id, aftersaleId, 'MySQL JSON array_contains 必须能定位已引用售后附件');

    const foreignReferenced = await prisma.aftersaleOrder.findFirst({
      where: {
        images: {
          array_contains: `/api/common/file/private/${foreignFile.id.toString()}`,
        },
      },
      select: { id: true },
    });
    assert.equal(foreignReferenced, null, '他人私有附件不能被售后业务记录引用');

    console.log('[aftersale-attachment-ownership-integration] PASS');
  } finally {
    if (created.aftersaleIds.length) {
      await prisma.aftersaleLog.deleteMany({ where: { aftersaleId: { in: created.aftersaleIds } } });
      await prisma.aftersaleOrder.deleteMany({ where: { id: { in: created.aftersaleIds } } });
    }
    if (created.fileIds.length) await prisma.fileAsset.deleteMany({ where: { id: { in: created.fileIds } } });
    if (created.orderIds.length) {
      await prisma.orderItem.deleteMany({ where: { orderId: { in: created.orderIds } } });
      await prisma.order.deleteMany({ where: { id: { in: created.orderIds } } });
    }
    if (created.skuIds.length) await prisma.productSku.deleteMany({ where: { id: { in: created.skuIds } } });
    if (created.productIds.length) await prisma.product.deleteMany({ where: { id: { in: created.productIds } } });
    if (created.categoryIds.length) await prisma.productCategory.deleteMany({ where: { id: { in: created.categoryIds } } });
    if (created.userIds.length) await prisma.user.deleteMany({ where: { id: { in: created.userIds } } });
    await prisma.$disconnect();
  }
}

main().catch(async (error) => {
  console.error('[aftersale-attachment-ownership-integration] FAIL', error);
  await prisma.$disconnect().catch(() => undefined);
  process.exitCode = 1;
});
