import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'

const root = resolve(fileURLToPath(new URL('../../..', import.meta.url)))
const api = readFileSync(resolve(root, 'apps/admin-web/src/api/coupon.ts'), 'utf8')
const list = readFileSync(resolve(root, 'apps/admin-web/src/views/marketing/coupon-list.vue'), 'utf8')
const edit = readFileSync(resolve(root, 'apps/admin-web/src/views/marketing/coupon-edit.vue'), 'utf8')

test('coupon admin uses backend economic fields instead of legacy fake fields', () => {
  assert.match(api, /value: number/)
  assert.match(api, /perLimit: number/)
  assert.match(api, /applicableIds: string\[\]/)
  assert.match(list, /row\.value/)
  assert.match(list, /row\.perLimit/)
  assert.doesNotMatch(list, /row\.amount\b/)
  assert.doesNotMatch(list, /row\.limitPerUser\b/)
})

test('coupon editor preserves bigint ids and explicit timezone conversion', () => {
  assert.match(edit, /const couponId = computed\(\(\) => String\(route\.params\.id/)
  assert.doesNotMatch(edit, /Number\(route\.params\.id/)
  assert.match(edit, /date\.toISOString\(\)/)
  assert.match(edit, /applicableIds: parseScopeIds\(\)/)
  assert.match(edit, /description: form\.description\.trim\(\)/)
})

test('coupon editor maps yuan and discount UI values to backend units explicitly', () => {
  assert.match(edit, /Math\.round\(Number\(value\) \* 100\)/)
  assert.match(edit, /Math\.round\(Number\(form\.discount\) \* 10\)/)
  assert.match(edit, /type: form\.type/)
  assert.match(edit, /value,/)
  assert.match(edit, /minAmount,/)
  assert.match(edit, /discountLimit,/)
})
