import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(fileURLToPath(new URL('../../..', import.meta.url)))
const source = readFileSync(resolve(root, 'apps/admin-web/src/views/marketing/merchant-settlement-batches.vue'), 'utf8')

function method(name, nextName) {
  const start = source.indexOf(`async function ${name}(`)
  const end = source.indexOf(`async function ${nextName}(`, start + 1)
  return source.slice(start, end === -1 ? undefined : end)
}

test('merchant settlement preview is bound to the exact financial selection', () => {
  assert.match(source, /function createSelectionFingerprint\(\)/)
  assert.match(source, /function isPreviewCurrent\(\)/)
  assert.match(source, /previewFingerprint\.value === createSelectionFingerprint\(\)/)
  assert.match(source, /watch\([\s\S]*previewResult\.value = null[\s\S]*previewFingerprint\.value = ''/)

  const preview = method('previewBatch', 'handleCreate')
  assert.match(preview, /if \(previewing\.value \|\| creating\.value\) return/)
  assert.match(preview, /const requestedFingerprint = createSelectionFingerprint\(\)/)
  assert.match(preview, /if \(requestedFingerprint !== createSelectionFingerprint\(\)\)/)
  assert.match(preview, /previewFingerprint\.value = requestedFingerprint/)

  const create = method('handleCreate', 'viewDetail')
  assert.match(create, /if \(creating\.value \|\| previewing\.value\) return/)
  assert.match(create, /if \(!isPreviewCurrent\(\) \|\| !previewResult\.value\?\.recordCount\)/)
  assert.match(create, /creating\.value = true[\s\S]*merchantSettlementApi\.createBatch/)
  assert.match(create, /finally \{[\s\S]*creating\.value = false/)
})

test('irreversible settlement actions lock before confirmation and remain single-flight', () => {
  for (const [name, key, next] of [
    ['confirmBatch', 'confirm', 'markPaid'],
    ['markPaid', 'paid', 'cancelBatch'],
  ]) {
    const body = method(name, next)
    assert.match(body, /if \(actionBusy\.value\) return/)
    assert.match(body, new RegExp('actionBusy\\.value = `' + key + ':\\$\\{row\\.id\\}`'))
    assert.ok(body.indexOf('actionBusy.value =') < body.indexOf('ElMessageBox.confirm'))
    assert.match(body, /finally \{[\s\S]*actionBusy\.value = null/)
  }

  const cancelStart = source.indexOf('async function cancelBatch(')
  const cancel = source.slice(cancelStart, source.indexOf('onMounted(', cancelStart))
  assert.match(cancel, /if \(actionBusy\.value\) return/)
  assert.match(cancel, /actionBusy\.value = `cancel:\$\{row\.id\}`/)
  assert.ok(cancel.indexOf('actionBusy.value =') < cancel.indexOf('ElMessageBox.confirm'))
  assert.match(cancel, /finally \{[\s\S]*actionBusy\.value = null/)
})

test('paid action explicitly states that it does not initiate an external payout', () => {
  assert.match(source, /“标记已付款”只记录外部\/线下付款已经完成，不会由系统自动向商家发起打款/)
  assert.match(source, /此按钮不会发起打款，只会将账本标记为已付款/)
})
