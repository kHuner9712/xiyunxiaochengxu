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

test('core order identifiers remain bigint-safe in delivery and aftersale operations', () => {
  const delivery = read('apps/admin-web/src/views/order/delivery.vue')
  const orderApi = read('apps/admin-web/src/api/order.ts')
  const deliverDto = read('apps/api/src/order/dto/deliver.dto.ts')
  const aftersaleApi = read('apps/admin-web/src/api/aftersale.ts')
  const aftersaleDetail = read('apps/admin-web/src/views/order/aftersale-detail.vue')

  assert.match(delivery, /orderId:\s*undefined as string \| undefined/)
  assert.match(delivery, /deliverForm\.orderId\s*=\s*String\(row\.id\)/)
  assert.match(delivery, /orderId:\s*String\(o\.id\)/)
  assert.match(orderApi, /orderId: string; logisticsCompany: string; logisticsNo: string/)

  assert.match(deliverDto, /type DeliveryOrderId = string \| number/)
  assert.equal((deliverDto.match(/orderId!:\s*DeliveryOrderId/g) || []).length, 2)
  assert.equal((deliverDto.match(/@IsString\(\)/g) || []).length, 6)
  assert.equal((deliverDto.match(/@Matches\(\/\^\\d\+\$\//g) || []).length, 2)
  assert.doesNotMatch(deliverDto, /@Type\(\(\) => Number\)/)

  assert.match(aftersaleApi, /type Id = string \| number/)
  assert.match(aftersaleDetail, /getDetail\(String\(route\.params\.id\)\)/)
  assert.doesNotMatch(aftersaleDetail, /Number\(route\.params\.id\)/)
})

test('admin aftersale UI matches the existing API and string status model', () => {
  const aftersaleApi = read('apps/admin-web/src/api/aftersale.ts')
  const aftersaleList = read('apps/admin-web/src/views/order/aftersale.vue')
  const aftersaleDetail = read('apps/admin-web/src/views/order/aftersale-detail.vue')
  const format = read('apps/admin-web/src/utils/format.ts')

  assert.match(aftersaleApi, /approve\(id: Id, refundAmount: number\)/)
  assert.match(aftersaleApi, /approve`, \{ refundAmount \}\)/)
  assert.match(aftersaleApi, /reject\(id: Id, rejectReason: string\)/)
  assert.match(aftersaleApi, /reject`, \{ rejectReason \}\)/)
  assert.match(aftersaleApi, /refund\(id: Id\)[\s\S]*request\.put\(`\/admin\/aftersale\/\$\{id\}\/refund`\)/)

  assert.match(aftersaleList, /:value="key"/)
  assert.doesNotMatch(aftersaleList, /Number\(key\)/)
  assert.match(aftersaleList, /row\.order\?\.orderNo/)
  assert.match(aftersaleList, /row\.createdAt/)

  assert.match(aftersaleDetail, /detail\.status === 'pending_review'/)
  assert.match(aftersaleDetail, /detail\.value\.status === 'approved'/)
  assert.match(aftersaleDetail, /detail\.value\.status === 'returned'/)
  assert.match(aftersaleDetail, /aftersaleApi\.approve\(String\(detail\.value\.id\), refundAmount\)/)
  assert.match(aftersaleDetail, /aftersaleApi\.reject\(String\(detail\.value\.id\), rejectReason\.value\.trim\(\)\)/)
  assert.match(aftersaleDetail, /aftersaleApi\.refund\(String\(detail\.value\.id\)\)/)

  assert.match(format, /pending_refund: '退款处理中'/)
})
