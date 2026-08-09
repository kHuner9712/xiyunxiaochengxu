import assert from 'node:assert/strict';
import { PrismaClient } from '@prisma/client';
import { SupplierService } from '../src/supplier/supplier.service';

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
  let supplierId: bigint | null = null;
  let categoryId: bigint | null = null;
  let productId: bigint | null = null;

  try {
    const service = new SupplierService(prisma as any);
    const supplierName = `供应商真库-${suffix}`;

    const created: any = await service.create({
      name: supplierName,
      contactName: '联系人A',
      contactPhone: '13800138000',
      email: 'supplier-a@example.com',
      address: '上海市浦东新区真实数据库路1号',
      status: 0,
      remark: '创建态备注',
    });
    supplierId = BigInt(created.id);

    const persisted = await prisma.supplier.findUniqueOrThrow({ where: { id: supplierId } });
    assert.equal(persisted.contactName, '联系人A');
    assert.equal(persisted.email, 'supplier-a@example.com');
    assert.equal(persisted.status, 0, '创建时显式停用状态必须落库');

    const updated: any = await service.update(created.id, {
      contactName: '联系人B',
      email: 'supplier-b@example.com',
      status: 1,
      remark: '更新态备注',
    });
    assert.equal(updated.contactName, '联系人B');
    assert.equal(updated.email, 'supplier-b@example.com');
    assert.equal(updated.status, 1);

    const category = await prisma.productCategory.create({
      data: { name: `供应商真库分类-${suffix}` },
    });
    categoryId = category.id;
    const product = await prisma.product.create({
      data: {
        name: `供应商真库商品-${suffix}`,
        categoryId: category.id,
        supplierId,
        status: 1,
      },
    });
    productId = product.id;

    const list: any = await service.findAll({
      page: 1,
      pageSize: 20,
      skip: 0,
      take: 20,
      name: supplierName,
    } as any);
    assert.equal(list.list.length, 1);
    assert.equal(list.list[0].id, supplierId.toString());
    assert.equal(list.list[0].email, 'supplier-b@example.com');
    assert.equal(list.list[0].productCount, 1, '供应商列表商品数必须来自真实未删除商品关联');

    await assert.rejects(
      service.delete(supplierId.toString()),
      /供应商下存在商品，无法删除/,
      '仍有关联商品时禁止删除供应商',
    );

    await prisma.product.update({
      where: { id: product.id },
      data: { deletedAt: new Date() },
    });
    const afterProductDelete: any = await service.findAll({
      page: 1,
      pageSize: 20,
      skip: 0,
      take: 20,
      name: supplierName,
    } as any);
    assert.equal(afterProductDelete.list[0].productCount, 0, '软删除商品不能继续计入商品数');

    await service.delete(supplierId.toString());
    const deletedSupplier = await prisma.supplier.findUniqueOrThrow({ where: { id: supplierId } });
    assert.ok(deletedSupplier.deletedAt, '无活跃商品后供应商必须可被软删除');

    console.log('[supplier-admin-lifecycle-integration] PASS');
  } finally {
    if (productId) await prisma.product.deleteMany({ where: { id: productId } });
    if (supplierId) await prisma.supplier.deleteMany({ where: { id: supplierId } });
    if (categoryId) await prisma.productCategory.deleteMany({ where: { id: categoryId } });
    await prisma.$disconnect();
  }
}

main().catch(async (error) => {
  console.error('[supplier-admin-lifecycle-integration] FAIL', error);
  await prisma.$disconnect().catch(() => undefined);
  process.exitCode = 1;
});
