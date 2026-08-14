import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(fileURLToPath(new URL('../../..', import.meta.url)))
const source = readFileSync(resolve(root, 'apps/admin-web/src/views/pickup-store/verify.vue'), 'utf8')
const previewMethod = source.slice(source.indexOf('async function handlePreview()'), source.indexOf('async function handleVerify()'))
const verifyMethod = source.slice(source.indexOf('async function handleVerify()'), source.indexOf('function resetPreview'))

test('pickup verification takes function-level locks before preview and confirmation', () => {
  assert.match(previewMethod, /if \(previewing\.value \|\| verifying\.value\) return/)
  assert.match(verifyMethod, /if \(verifying\.value \|\| previewing\.value \|\| !preview\.value\) return/)
  assert.match(verifyMethod, /verifying\.value = true[\s\S]*ElMessageBox\.confirm[\s\S]*pickupStoreApi\.verifyPickupCode/)
  assert.match(verifyMethod, /finally \{[\s\S]*verifying\.value = false/)
  assert.match(source, /function resetPreview\(force = false\)/)
  assert.match(source, /resetPreview\(true\)/)
})
