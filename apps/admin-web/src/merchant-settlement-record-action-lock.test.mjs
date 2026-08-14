import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(fileURLToPath(new URL('../../..', import.meta.url)))
const source = readFileSync(resolve(root, 'apps/admin-web/src/views/marketing/merchant-settlement-records.vue'), 'utf8')

test('manual commission actions are function-level single-flight', () => {
  assert.match(source, /const actionBusyKey = ref<string \| null>\(null\)/)
  const start = source.indexOf('async function handleUpdateStatus')
  const end = source.indexOf('onMounted(', start)
  const body = source.slice(start, end)
  assert.match(body, /if \(actionBusyKey\.value !== null\) return/)
  assert.match(body, /actionBusyKey\.value = `\$\{status\}:\$\{row\.id\}`/)
  assert.match(body, /finally \{[\s\S]*actionBusyKey\.value = null/)
})

test('cancelling a commission record requires confirmation before the API write', () => {
  const start = source.indexOf('async function handleUpdateStatus')
  const end = source.indexOf('onMounted(', start)
  const body = source.slice(start, end)
  assert.match(body, /if \(status === 'cancelled'\)/)
  assert.ok(body.indexOf('ElMessageBox.confirm') < body.indexOf('merchantSettlementApi.updateRecordStatus'))
})

test('admin copy makes the paid-batch-only settled invariant explicit', () => {
  assert.match(source, /“已结算”只能由结算批次在确认外部付款完成后产生/)
  assert.doesNotMatch(source, /handleUpdateStatus\(row, 'settled'\)/)
})
