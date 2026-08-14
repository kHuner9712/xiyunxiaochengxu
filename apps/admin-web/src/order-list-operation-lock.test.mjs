import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(fileURLToPath(new URL('../../..', import.meta.url)))
const source = readFileSync(resolve(root, 'apps/admin-web/src/views/order/list.vue'), 'utf8')
const fetchMethod = source.slice(source.indexOf('async function fetchList()'), source.indexOf('function handleSearch()'))
const cancelMethod = source.slice(source.indexOf('async function handleCancel(row: any)'), source.indexOf('async function handleExport()'))

test('admin order list ignores stale search and pagination responses', () => {
  assert.match(source, /let listRequestVersion = 0/)
  assert.match(fetchMethod, /const requestVersion = \+\+listRequestVersion/)
  assert.match(fetchMethod, /if \(requestVersion !== listRequestVersion\) return/)
  assert.match(fetchMethod, /if \(requestVersion === listRequestVersion\) loading\.value = false/)
})

test('admin order cancel takes a per-order lock before opening the confirmation flow', () => {
  assert.match(source, /const cancelBusy = ref<Record<string, boolean>>\(\{\}\)/)
  assert.match(cancelMethod, /if \(!beginCancel\(orderId\)\) return/)
  assert.match(cancelMethod, /beginCancel\(orderId\)[\s\S]*ElMessageBox\.prompt[\s\S]*orderApi\.cancel/)
  assert.match(cancelMethod, /finally \{[\s\S]*endCancel\(orderId\)/)
  assert.match(source, /:loading="isCancelBusy\(row\.id\)"/)
})
