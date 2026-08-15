import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(fileURLToPath(new URL('../../..', import.meta.url)))
const listSource = readFileSync(resolve(root, 'apps/admin-web/src/views/product/list.vue'), 'utf8')
const apiSource = readFileSync(resolve(root, 'apps/admin-web/src/api/product.ts'), 'utf8')

const fetchMethod = listSource.slice(listSource.indexOf('async function fetchList()'), listSource.indexOf('async function fetchCategoryTree()'))
const statusMethod = listSource.slice(listSource.indexOf('async function handleToggleStatus'), listSource.indexOf('async function handleDelete'))
const deleteMethod = listSource.slice(listSource.indexOf('async function handleDelete'), listSource.indexOf('onMounted(() =>'))

test('admin product list ignores stale search and pagination responses', () => {
  assert.match(listSource, /let listRequestVersion = 0/)
  assert.match(fetchMethod, /const requestVersion = \+\+listRequestVersion/)
  assert.match(fetchMethod, /if \(requestVersion !== listRequestVersion\) return/)
  assert.match(fetchMethod, /if \(requestVersion === listRequestVersion\) loading\.value = false/)
})

test('admin product status and delete take per-product locks before network or prompt work', () => {
  assert.match(listSource, /const operationBusy = ref<Record<string, 'status' \| 'delete'>>\(\{\}\)/)
  assert.match(statusMethod, /if \(!beginOperation\(productId, 'status'\)\) return/)
  assert.match(statusMethod, /beginOperation\(productId, 'status'\)[\s\S]*productApi\.updateStatus/)
  assert.match(statusMethod, /finally \{[\s\S]*endOperation\(productId\)/)

  assert.match(deleteMethod, /if \(!beginOperation\(productId, 'delete'\)\) return/)
  assert.match(deleteMethod, /beginOperation\(productId, 'delete'\)[\s\S]*ElMessageBox\.confirm[\s\S]*productApi\.delete/)
  assert.match(deleteMethod, /finally \{[\s\S]*endOperation\(productId\)/)
})

test('product write API also single-flights the same product operation', () => {
  assert.match(apiSource, /runSingleFlight\(`admin:product:delete:\$\{id\}`/)
  assert.match(apiSource, /runSingleFlight\(`admin:product:status:\$\{id\}`/)
})
