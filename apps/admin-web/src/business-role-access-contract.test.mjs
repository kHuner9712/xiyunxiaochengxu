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
  const layout = read('apps/admin-web/src/layouts/AdminLayout.vue')
  const routePermissionGuard = read('apps/admin-web/src/router/permission-guard.ts')
  const main = read('apps/admin-web/src/main.ts')
  const defaultRoles = read('apps/api/prisma/default-role-permissions.ts')
  const roleMigration = read('apps/api/prisma/migrations/20260809154000_seed_default_role_permissions_if_empty/migration.sql')
  const pickupMigration = read('apps/api/prisma/migrations/20260811174000_repair_pickup_permission_hierarchy/migration.sql')
  const settlementController = read('apps/api/src/merchant-settlement/merchant-settlement.controller.ts')
  const benefitController = read('apps/api/src/benefit-package/benefit-package.controller.ts')

  const productCreateRoute = router.match(/path: 'edit',[\s\S]*?name: 'ProductEdit'[\s\S]*?meta: \{[^}]+\}/)?.[0] || ''
  const reconcileRoute = router.match(/path: 'reconcile',[\s\S]*?name: 'ReconcileCenter'[\s\S]*?meta: \{[^}]+\}/)?.[0] || ''
  const settlementRecordsRoute = router.match(/path: 'merchant-settlement-records',[\s\S]*?name: 'MerchantSettlementRecords'[\s\S]*?meta: \{[^}]+\}/)?.[0] || ''
  const settlementBatchesRoute = router.match(/path: 'merchant-settlement-batches',[\s\S]*?name: 'MerchantSettlementBatches'[\s\S]*?meta: \{[^}]+\}/)?.[0] || ''
  const benefitVerifyRoute = router.match(/path: 'benefit-package-verify',[\s\S]*?name: 'BenefitPackageVerify'[\s\S]*?meta: \{[^}]+\}/)?.[0] || ''
  const orderBlock = router.match(/path: 'order',[\s\S]*?\n      \},\n      \{\n        path: 'user'/)?.[0] || ''
  const marketingBlock = router.match(/path: 'marketing',[\s\S]*?\n      \},\n      \{\n        path: 'content'/)?.[0] || ''

  assert.match(productCreateRoute, /permission: 'product:create'/)
  assert.match(reconcileRoute, /permission: 'order:aftersale:refund'/)
  assert.doesNotMatch(reconcileRoute, /permission: 'system:config'/)

  assert.match(settlementRecordsRoute, /permission: 'order:merchant-settlement'/)
  assert.match(settlementBatchesRoute, /permission: 'order:merchant-settlement'/)
  assert.match(orderBlock, /name: 'MerchantSettlementRecords'/)
  assert.match(orderBlock, /name: 'MerchantSettlementBatches'/)
  assert.doesNotMatch(marketingBlock, /name: 'MerchantSettlementRecords'/)
  assert.doesNotMatch(marketingBlock, /name: 'MerchantSettlementBatches'/)
  assert.match(settlementController, /const SETTLEMENT_PERMISSION = 'order:merchant-settlement'/)

  assert.match(benefitVerifyRoute, /permission: 'pickup:verify'/)
  assert.match(benefitController, /@Get\('verify\/preview'\)[\s\S]*?@RequirePermission\('pickup:verify'\)/)
  assert.match(benefitController, /@Post\('verify'\)[\s\S]*?@RequirePermission\('pickup:verify'\)/)
  assert.match(layout, /function hasVisibleAuthorizedChild\(route: RouteRecordRaw\)/)
  assert.match(layout, /hasMenuPermission\(route\) \|\| hasVisibleAuthorizedChild\(route\)/)
  assert.match(layout, /children\.filter\(\(child\) => !child\.meta\?\.hidden && hasMenuPermission\(child\)\)/)

  assert.match(routePermissionGuard, /router\.beforeResolve/)
  assert.match(routePermissionGuard, /typeof to\.meta\.permission === 'string'/)
  assert.match(routePermissionGuard, /userStore\.hasPermission\(required\)/)
  assert.match(routePermissionGuard, /path: '\/403'/)
  assert.match(main, /setupRoutePermissionGuard\(router, pinia\)/)
  assert.ok(
    main.indexOf('setupRoutePermissionGuard(router, pinia)') < main.indexOf('app.use(router)'),
    'route permission guard must be registered before the router starts initial navigation',
  )

  assert.match(defaultRoles, /'pickup',\s*'pickup:store',\s*'pickup:verify'/)
  assert.match(roleMigration, /'pickup', 'pickup:store', 'pickup:verify'/)
  assert.match(roleMigration, /\) = 41;/)
  assert.match(pickupMigration, /'自提管理', 'pickup'/)
  assert.match(pickupMigration, /child\.`code` IN \('pickup:store', 'pickup:verify'\)/)
  assert.match(pickupMigration, /r\.`code` = 'operator'/)
})
