import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(fileURLToPath(new URL('../../..', import.meta.url)))
const delivery = readFileSync(resolve(root, 'apps/admin-web/src/views/order/delivery.vue'), 'utf8')

test('batch delivery requires a tracking number for every selected order', () => {
  assert.match(delivery, /const batchRows = ref<BatchDeliveryRow\[\]>\(\[\]\)/)
  assert.match(delivery, /v-model="row\.logisticsNo"/)
  assert.match(delivery, /orderId:\s*String\(o\.id\)/)
  assert.match(delivery, /const missingTrackingOrder = batchRows\.value\.find\(\(row\) => !row\.logisticsNo\.trim\(\)\)/)
  assert.match(delivery, /const orders = batchRows\.value\.map\(\(row\) => \(\{/)
  assert.match(delivery, /orderId:\s*row\.orderId/)
  assert.match(delivery, /logisticsNo:\s*row\.logisticsNo\.trim\(\)/)
  assert.doesNotMatch(
    delivery,
    /const orders = selectedOrders\.value\.map\([\s\S]*?logisticsNo,\s*\}\)\)/,
  )
})
