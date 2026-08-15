import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(fileURLToPath(new URL('../../..', import.meta.url)))
const delivery = readFileSync(resolve(root, 'apps/admin-web/src/views/order/delivery.vue'), 'utf8')
const orderList = readFileSync(resolve(root, 'apps/admin-web/src/views/order/list.vue'), 'utf8')
const orderDetail = readFileSync(resolve(root, 'apps/admin-web/src/views/order/detail.vue'), 'utf8')

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

test('delivery inputs match the backend VARCHAR(50) contract', () => {
  assert.match(delivery, /v-model="deliverForm\.logisticsNo"[^>]*maxlength="50"/)
  assert.match(delivery, /v-model="row\.logisticsNo"[\s\S]*?maxlength="50"/)
  assert.doesNotMatch(delivery, /maxlength="80"/)
})

test('delivery list uses latest-request-wins and submit locks start at function entry', () => {
  assert.match(delivery, /let listRequestVersion = 0/)
  assert.match(delivery, /const requestVersion = \+\+listRequestVersion/)
  assert.match(delivery, /if \(requestVersion !== listRequestVersion\) return/)
  assert.match(delivery, /if \(requestVersion === listRequestVersion\) loading\.value = false/)
  assert.match(delivery, /async function handleSubmitDeliver\(\) \{\s*if \(submitting\.value\) return\s*submitting\.value = true/)
  assert.match(delivery, /function handleDeliver\(row: any\) \{\s*if \(submitting\.value\) return/)
  assert.match(delivery, /function handleBatchDeliver\(\) \{\s*if \(submitting\.value \|\| !selectedOrders\.value\.length\) return/)
  assert.match(delivery, /:disabled="!selectedOrders\.length \|\| submitting"/)
  assert.match(delivery, /:close-on-click-modal="!submitting"/)
  assert.match(delivery, /await fetchList\(\)/)
})

test('delivery list uses serialized receiver fields and actual purchased units', () => {
  assert.match(delivery, /\{\{ getDeliveryItemQuantity\(row\.orderItems\) \}\}/)
  assert.match(delivery, /function getDeliveryItemQuantity\(orderItems: unknown\)/)
  assert.match(delivery, /const quantity = Number\(item\?\.quantity\)/)
  assert.match(delivery, /row\.receiverName \|\| '-'/)
  assert.match(delivery, /row\.receiverPhone \|\| '-'/)
  assert.match(delivery, /\{\{ formatDeliveryAddress\(row\) \}\}/)
  assert.match(delivery, /\[row\?\.province, row\?\.city, row\?\.district, row\?\.detailAddress\]/)
  assert.match(delivery, /consignee:\s*String\(o\.receiverName \|\| ''\)/)
  assert.doesNotMatch(delivery, /consignee:\s*String\(o\.consignee \|\| ''\)/)
  assert.match(delivery, /<el-table-column label="商品金额" width="120">[\s\S]*?formatPrice\(row\.totalAmount\)/)
  assert.doesNotMatch(delivery, /<el-table-column label="订单金额"/)
  assert.match(delivery, /\{\{ formatDate\(row\.createdAt\) \}\}/)
  assert.doesNotMatch(delivery, /formatDate\(row\.createTime\)/)
})

test('order list displays purchased units and truthful product amount labels', () => {
  assert.match(orderList, /\{\{ getOrderItemQuantity\(row\.items\) \}\}/)
  assert.match(orderList, /function getOrderItemQuantity\(items: unknown\)/)
  assert.match(orderList, /const quantity = Number\(item\?\.quantity\)/)
  assert.match(orderList, /Number\.isFinite\(quantity\) && quantity > 0 \? quantity : 0/)
  assert.doesNotMatch(orderList, /row\.items\?\.length \|\| 0/)
  assert.match(orderList, /<el-table-column label="商品金额" width="120">[\s\S]*?formatPrice\(row\.totalAmount\)/)
  assert.doesNotMatch(orderList, /<el-table-column label="订单金额"/)
})

test('order detail distinguishes system logs from user operations', () => {
  assert.match(orderDetail, /\{\{ formatOrderLogOperator\(log\) \}\}/)
  assert.match(orderDetail, /if \(log\?\.operatorType === 'admin'\) return '管理员'/)
  assert.match(orderDetail, /if \(log\?\.operatorType === 'system'\) return '系统'/)
  assert.match(orderDetail, /if \(log\?\.operatorType === 'user'\) return '用户'/)
  assert.match(orderDetail, /return String\(log\?\.operator \|\| '未知'\)/)
  assert.doesNotMatch(orderDetail, /\{\{ log\.operator \}\}/)
})
