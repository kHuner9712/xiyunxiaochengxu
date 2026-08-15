import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(fileURLToPath(new URL('../../..', import.meta.url)))
const source = readFileSync(resolve(root, 'apps/admin-web/src/views/order/detail.vue'), 'utf8')

function method(start, end) {
  const startIndex = source.indexOf(start)
  const endIndex = source.indexOf(end, startIndex + start.length)
  assert.notEqual(startIndex, -1, `missing method start: ${start}`)
  assert.notEqual(endIndex, -1, `missing method end: ${end}`)
  return source.slice(startIndex, endIndex)
}

const remarkMethod = method('async function handleSaveRemark()', 'function showDeliverDialog()')
const deliverMethod = method('async function handleDeliver()', 'async function handleCancelOrder()')
const cancelMethod = method('async function handleCancelOrder()', 'function showVerifyPickupDialog()')
const pickupMethod = method('async function handleVerifyPickup()', 'watch(')

test('admin order detail locks writes before validation, prompts or network work', () => {
  assert.match(remarkMethod, /if \(remarkSubmitting\.value\) return/)
  assert.match(remarkMethod, /remarkSubmitting\.value = true[\s\S]*orderApi\.remark/)
  assert.match(remarkMethod, /finally \{[\s\S]*remarkSubmitting\.value = false/)

  assert.match(deliverMethod, /if \(submitting\.value\) return/)
  assert.match(deliverMethod, /submitting\.value = true[\s\S]*deliverFormRef\.value\?\.validate[\s\S]*orderApi\.deliver/)
  assert.match(deliverMethod, /finally \{[\s\S]*submitting\.value = false/)

  assert.match(cancelMethod, /if \(submitting\.value\) return/)
  assert.match(cancelMethod, /submitting\.value = true[\s\S]*ElMessageBox\.prompt[\s\S]*orderApi\.cancel/)
  assert.match(cancelMethod, /finally \{[\s\S]*submitting\.value = false/)

  assert.match(pickupMethod, /if \(submitting\.value\) return/)
  assert.match(pickupMethod, /submitting\.value = true[\s\S]*pickupStoreApi\.verifyPickupCode/)
  assert.match(pickupMethod, /finally \{[\s\S]*submitting\.value = false/)
})

test('admin order detail binds reads and writes to the current route order', () => {
  assert.match(source, /let detailRequestVersion = 0/)
  assert.match(source, /const requestVersion = \+\+detailRequestVersion/)
  assert.match(source, /requestVersion !== detailRequestVersion \|\| !isCurrentRouteOrder\(orderId\)/)
  assert.match(source, /String\(nextOrder\.id \|\| ''\) !== orderId/)
  assert.match(source, /watch\([\s\S]*currentRouteOrderId\(\)[\s\S]*resetRouteBoundState\(\)[\s\S]*fetchDetail\(orderId\)[\s\S]*immediate: true/)

  assert.match(remarkMethod, /const orderId = String\(order\.value\.id \|\| ''\)[\s\S]*isCurrentRouteOrder\(orderId\)[\s\S]*orderApi\.remark\(orderId/)
  assert.match(deliverMethod, /const orderId = String\(deliverForm\.orderId \|\| ''\)[\s\S]*isCurrentRouteOrder\(orderId\)[\s\S]*orderApi\.deliver\(\{ orderId/)
  assert.match(cancelMethod, /const orderId = String\(order\.value\.id \|\| ''\)[\s\S]*ElMessageBox\.prompt[\s\S]*!isCurrentRouteOrder\(orderId\)[\s\S]*orderApi\.cancel\(orderId/)
  assert.match(pickupMethod, /const orderId = String\(order\.value\.id \|\| ''\)[\s\S]*isCurrentRouteOrder\(orderId\)[\s\S]*pickupStoreApi\.verifyPickupCode/)
})

test('admin order detail action buttons expose the same lock state', () => {
  assert.match(source, /type="danger" :loading="submitting" :disabled="submitting" @click="handleCancelOrder"/)
  assert.match(source, /type="primary" :loading="submitting" :disabled="submitting" @click="handleDeliver"/)
  assert.match(source, /type="success" :loading="submitting" :disabled="submitting" @click="handleVerifyPickup"/)
  assert.match(source, /type="primary" :loading="remarkSubmitting" :disabled="remarkSubmitting" @click="handleSaveRemark"/)
})
