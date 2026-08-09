import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(fileURLToPath(new URL('../../..', import.meta.url)))
const read = (relativePath) => readFileSync(resolve(root, relativePath), 'utf8')

test('product workflows can read reference data without receiving reference write permissions', () => {
  const category = read('apps/api/src/category/category.controller.ts')
  const brand = read('apps/api/src/brand/brand.controller.ts')
  const supplier = read('apps/api/src/supplier/supplier.controller.ts')
  const product = read('apps/api/src/product/product.controller.ts')

  assert.ok(category.includes("@Get('list')\n  @RequirePermission('product:category', 'product:list', 'product:create', 'product:edit')"))
  assert.ok(category.includes("@Get('detail/:id')\n  @RequirePermission('product:category', 'product:list', 'product:create', 'product:edit')"))
  assert.ok(category.includes("@Post('create')\n  @RequirePermission('product:category')"))
  assert.ok(category.includes("@Put('update/:id')\n  @RequirePermission('product:category')"))
  assert.ok(category.includes("@Delete('delete/:id')\n  @RequirePermission('product:category')"))

  assert.ok(brand.includes("@Get('list')\n  @RequirePermission('product:brand', 'product:list', 'product:create', 'product:edit')"))
  assert.ok(brand.includes("@Get('detail/:id')\n  @RequirePermission('product:brand', 'product:list', 'product:create', 'product:edit')"))
  assert.ok(brand.includes("@Post('create')\n  @RequirePermission('product:brand')"))
  assert.ok(brand.includes("@Put('update/:id')\n  @RequirePermission('product:brand')"))
  assert.ok(brand.includes("@Delete('delete/:id')\n  @RequirePermission('product:brand')"))

  assert.ok(supplier.includes("@Get('list')\n  @RequirePermission('supplier:list', 'product:create', 'product:edit')"))
  assert.ok(supplier.includes("@Get('detail/:id')\n  @RequirePermission('supplier:list', 'product:create', 'product:edit')"))
  assert.ok(supplier.includes("@Post('create')\n  @RequirePermission('supplier:create')"))
  assert.ok(supplier.includes("@Put('update/:id')\n  @RequirePermission('supplier:edit')"))
  assert.ok(supplier.includes("@Delete('delete/:id')\n  @RequirePermission('supplier:delete')"))

  assert.ok(product.includes("@Get('list')\n  @RequirePermission('product:list', 'product:create', 'product:edit', 'marketing:activity')"))
  assert.ok(product.includes("@Get('detail/:id')\n  @RequirePermission('product:list', 'product:edit', 'marketing:activity')"))
  assert.ok(product.includes("@Post('create')\n  @RequirePermission('product:create')"))
  assert.ok(product.includes("@Put('update/:id')\n  @RequirePermission('product:edit')"))
  assert.ok(product.includes("@Delete('delete/:id')\n  @RequirePermission('product:delete')"))
})

test('business menus use operational permissions instead of unrelated system privileges', () => {
  const router = read('apps/admin-web/src/router/index.ts')
  const defaultRoles = read('apps/api/prisma/default-role-permissions.ts')
  const roleMigration = read('apps/api/prisma/migrations/20260809154000_seed_default_role_permissions_if_empty/migration.sql')

  const productCreateRoute = router.match(/path: 'edit',[\s\S]*?name: 'ProductEdit'[\s\S]*?meta: \{[^}]+\}/)?.[0] || ''
  const reconcileRoute = router.match(/path: 'reconcile',[\s\S]*?name: 'ReconcileCenter'[\s\S]*?meta: \{[^}]+\}/)?.[0] || ''

  assert.match(productCreateRoute, /permission: 'product:create'/)
  assert.match(reconcileRoute, /permission: 'order:aftersale:refund'/)
  assert.doesNotMatch(reconcileRoute, /permission: 'system:config'/)

  assert.match(defaultRoles, /'pickup',\s*'pickup:store',\s*'pickup:verify'/)
  assert.match(roleMigration, /'pickup', 'pickup:store', 'pickup:verify'/)
  assert.match(roleMigration, /\) = 41;/)
})
