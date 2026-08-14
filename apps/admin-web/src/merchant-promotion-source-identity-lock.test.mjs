import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(fileURLToPath(new URL('../../..', import.meta.url)))
const source = readFileSync(resolve(root, 'apps/admin-web/src/views/marketing/merchant-promotion-source.vue'), 'utf8')

test('promotion code is visibly immutable in edit mode', () => {
  assert.match(source, /:disabled="!!form\.id \|\| submitting"/)
  assert.match(source, /推广码是订单历史归因身份，创建后不可修改/)
  assert.match(source, /function normalizePromotionCode\(\) \{[\s\S]*if \(form\.id\) return/)
})

test('save is function-level single-flight and locks the form while writing', () => {
  assert.match(source, /<el-form[\s\S]*:disabled="submitting"/)
  const start = source.indexOf('async function handleSubmit()')
  const end = source.indexOf('async function handleStatusChange', start)
  const body = source.slice(start, end)
  assert.match(body, /if \(submitting\.value\) return/)
  assert.match(body, /submitting\.value = true[\s\S]*merchantPromotionSourceApi\.(update|create)/)
  assert.match(body, /finally \{[\s\S]*submitting\.value = false/)
})

test('status switching is single-flight and rolls the optimistic switch back on failure', () => {
  assert.match(source, /:disabled="statusBusyId !== null"/)
  const start = source.indexOf('async function handleStatusChange')
  const end = source.indexOf('async function fetchPromotionOrders', start)
  const body = source.slice(start, end)
  assert.match(body, /if \(statusBusyId\.value !== null\)/)
  assert.match(body, /row\.status = oldStatus/)
  assert.match(body, /statusBusyId\.value = String\(row\.id\)/)
  assert.match(body, /finally \{[\s\S]*statusBusyId\.value = null/)
})
