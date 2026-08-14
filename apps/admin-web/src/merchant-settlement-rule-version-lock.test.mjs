import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(fileURLToPath(new URL('../../..', import.meta.url)))
const source = readFileSync(resolve(root, 'apps/admin-web/src/views/marketing/merchant-settlement-rules.vue'), 'utf8')

function method(name, nextName) {
  const start = source.indexOf(`async function ${name}(`)
  const end = source.indexOf(`${nextName ? `async function ${nextName}(` : 'onMounted('}`, start + 1)
  return source.slice(start, end === -1 ? undefined : end)
}

test('rule writes build a DTO whitelist payload and never spread the UI editing object', () => {
  assert.match(source, /function buildRulePayload\(\)/)
  assert.doesNotMatch(source, /createRule\(\{\s*\.\.\.editing\s*\}\)/)
  assert.doesNotMatch(source, /updateRule\([^\n]+\{\s*\.\.\.editing\s*\}\)/)

  const submit = method('handleSubmit', 'handleStatusChange')
  assert.match(submit, /const payload = buildRulePayload\(\)/)
  assert.match(submit, /merchantSettlementApi\.updateRule\(editing\.id, payload\)/)
  assert.match(submit, /merchantSettlementApi\.createRule\(payload\)/)
})

test('save, status and delete operations are function-level single-flight', () => {
  const submit = method('handleSubmit', 'handleStatusChange')
  assert.match(submit, /if \(submitting\.value \|\| editLoading\.value\) return/)
  assert.match(submit, /submitting\.value = true/)
  assert.match(submit, /finally \{[\s\S]*submitting\.value = false/)

  const status = method('handleStatusChange', 'handleDelete')
  assert.match(status, /statusBusyId\.value !== null/)
  assert.match(status, /statusBusyId\.value = String\(row\.id\)/)
  assert.match(status, /await merchantSettlementApi\.updateRuleStatus/)
  assert.match(status, /await loadList\(\)/)
  assert.match(status, /row\.status = previousStatus/)

  const remove = method('handleDelete', '')
  assert.match(remove, /if \(deleteBusyId\.value !== null/)
  assert.match(remove, /deleteBusyId\.value = String\(row\.id\)/)
  assert.ok(remove.indexOf('deleteBusyId.value =') < remove.indexOf('ElMessageBox.confirm'))
  assert.match(remove, /finally \{[\s\S]*deleteBusyId\.value = null/)
})

test('slow edit detail responses cannot overwrite a newer selection', () => {
  assert.match(source, /let editRequestSeq = 0/)
  const edit = method('handleEdit', 'handleSubmit')
  assert.match(edit, /const requestSeq = \+\+editRequestSeq/)
  assert.match(edit, /if \(requestSeq !== editRequestSeq\) return/)
})

test('admin copy explains historical pricing and future changes', () => {
  assert.match(source, /按订单实际支付时间匹配当时的规则版本/)
  assert.match(source, /服务结算按权益核销时间匹配当时版本/)
  assert.match(source, /未来生效的新价格或新范围时，请使用“新增规则”/)
})
