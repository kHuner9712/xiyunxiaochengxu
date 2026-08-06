import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(fileURLToPath(new URL('../../..', import.meta.url)))

function read(relativePath) {
  return readFileSync(resolve(root, relativePath), 'utf8')
}

const seed = read('apps/api/prisma/seed.ts')
const knownPermissions = new Set(
  [...seed.matchAll(/code:\s*'([^']+)'/g)].map((match) => match[1]),
)

function assertPermissionExists(permission) {
  assert.ok(knownPermissions.has(permission), `permission ${permission} must exist in seed data`)
}

test('core admin operation buttons use defined permission codes', () => {
  const productList = read('apps/admin-web/src/views/product/list.vue')
  const delivery = read('apps/admin-web/src/views/order/delivery.vue')
  const aftersaleDetail = read('apps/admin-web/src/views/order/aftersale-detail.vue')

  for (const permission of [
    'product:create',
    'product:edit',
    'product:publish',
    'product:delete',
    'order:deliver',
    'order:aftersale:review',
    'order:aftersale:refund',
  ]) {
    assertPermissionExists(permission)
  }

  assert.match(productList, /v-permission="'product:create'"[^>]*>新增商品/)
  assert.match(productList, /v-permission="'product:publish'"/)
  assert.match(productList, /v-permission="'product:delete'"[^>]*>删除/)

  assert.equal((delivery.match(/v-permission="'order:deliver'"/g) || []).length, 2)
  assert.doesNotMatch(delivery, /order:delivery/)

  assert.match(aftersaleDetail, /v-permission="'order:aftersale:review'"/)
  assert.match(aftersaleDetail, /v-permission="'order:aftersale:refund'"/)
})

test('core order identifiers remain bigint-safe in the admin client', () => {
  const delivery = read('apps/admin-web/src/views/order/delivery.vue')
  const aftersaleApi = read('apps/admin-web/src/api/aftersale.ts')
  const aftersaleDetail = read('apps/admin-web/src/views/order/aftersale-detail.vue')

  assert.match(delivery, /orderId:\s*undefined as string \| number \| undefined/)
  assert.match(aftersaleApi, /type Id = string \| number/)
  assert.match(aftersaleDetail, /getDetail\(String\(route\.params\.id\)\)/)
  assert.doesNotMatch(aftersaleDetail, /Number\(route\.params\.id\)/)
})
