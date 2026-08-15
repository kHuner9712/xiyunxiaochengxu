import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(fileURLToPath(new URL('../../..', import.meta.url)))
const source = readFileSync(resolve(root, 'apps/admin-web/src/views/user/list.vue'), 'utf8')
const fetchMethod = source.slice(source.indexOf('async function fetchList()'), source.indexOf('async function fetchMemberLevels()'))

test('admin user list ignores stale responses after filters, pages, or point adjustments change facts', () => {
  assert.match(source, /let listLoadSeq = 0/)
  assert.match(fetchMethod, /const requestSeq = \+\+listLoadSeq/)
  assert.match(fetchMethod, /if \(requestSeq !== listLoadSeq\) return/)
  assert.match(fetchMethod, /if \(requestSeq === listLoadSeq\) loading\.value = false/)
})
