import assert from 'node:assert/strict';
import { PrismaClient } from '@prisma/client';
import { ProductionProductService } from '../src/product/production-product.service';
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
  const supplierIds: bigint[] = [];
  let categoryId: bigint | null = null;
  let productId: bigint | null = null;

  try {
    const service = new SupplierService(prisma as any);
    const productService = new ProductionProductService(prisma as any);
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
    const supplierId = BigInt(created.id);
    supplierIds.push(supplierId);

    const persisted = await prisma.supplier.findUniqueOrThrow({ where: { id: supplierId } });
    assert.equal(persisted.contactName, '联系人A');
    assert.equal(persisted.email, 'supplier-a@example.com');
    assert.equal(persisted.status, 0, '创建时显式停用状态必须落库');

    const category = await prisma.productCategory.create({
      data: { name: `供应商真库分类-${suffix}` },
    });
    categoryId = category.id;

    await assert.rejects(
      productService.create({
        name: `停用供应商商品-${suffix}`,
        categoryId: category.id.toString(),
        supplierId: supplierId.toString(),
        skus: [{ skuCode: `SUP-INACTIVE-${suffix}`.slice(0, 64), price: 1000, stock: 1 }],
      } as any),
      /供应商不存在或已停用，请选择合作中的供应商/,
      '停用供应商不能被新商品绑定，即使提交的是合法数据库ID',
    );

    const updated: any = await service.update(created.id, {
      contactName: '联系人B',
      email: 'supplier-b@example.com',
      status: 1,
      remark: '更新态备注',
    });
    assert.equal(updated.contactName, '联系人B');
    assert.equal(updated.email, 'supplier-b@example.com');
    assert.equal(updated.status, 1);

    const product: any = await productService.create({
      name: `供应商真库商品-${suffix}`,
      categoryId: category.id.toString(),
      supplierId: supplierId.toString(),
      skus: [{ skuCode: `SUP-ACTIVE-${suffix}`.slice(0, 64), price: 1200, stock: 2 }],
    } as any);
    productId = BigInt(product.id);
    const persistedProduct = await prisma.product.findUniqueOrThrow({ where: { id: productId } });
    assert.equal(persistedProduct.supplierId, supplierId, '合作中供应商必须可被商品正常绑定');

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

    // Stopping future cooperation must not make an existing product impossible to edit when the
    // product keeps the same historical supplier relation. It only blocks new/re-bound relations.
    await service.update(supplierId.toString(), { status: 0 });
    const unchangedBinding: any = await productService.update(productId.toString(), {
      name: `供应商真库商品-已停用历史关系-${suffix}`,
      supplierId: supplierId.toString(),
    } as any);
    assert.equal(unchangedBinding.supplierId, supplierId.toString());

    const inactiveTarget: any = await service.create({
      name: `供应商真库-停用目标-${suffix}`,
      contactName: '联系人C',
      contactPhone: '13900139000',
      status: 0,
    });
    const inactiveTargetId = BigInt(inactiveTarget.id);
    supplierIds.push(inactiveTargetId);

    await assert.rejects(
      productService.update(productId.toString(), { supplierId: inactiveTarget.id } as any),
      /供应商不存在或已停用，请选择合作中的供应商/,
      '已有商品不能改绑到停用供应商',
    );

    await service.delete(inactiveTarget.id);
    await assert.rejects(
      productService.update(productId.toString(), { supplierId: inactiveTarget.id } as any),
      /供应商不存在或已停用，请选择合作中的供应商/,
      '软删除供应商不能通过旧ID重新绑定到商品',
    );

    await prisma.product.update({
      where: { id: productId },
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
    if (productId) {
      await prisma.productStockLog.deleteMany({ where: { productId } });
      await prisma.productSku.deleteMany({ where: { productId } });
      await prisma.product.deleteMany({ where: { id: productId } });
    }
    if (supplierIds.length) await prisma.supplier.deleteMany({ where: { id: { in: supplierIds } } });
    if (categoryId) await prisma.productCategory.deleteMany({ where: { id: categoryId } });
    await prisma.$disconnect();
  }
}

main().catch(async (error) => {
  console.error('[supplier-admin-lifecycle-integration] FAIL', error);
  await prisma.$disconnect().catch(() => undefined);
  process.exitCode = 1;
});
