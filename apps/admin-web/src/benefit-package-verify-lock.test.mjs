import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(fileURLToPath(new URL('../../..', import.meta.url)))
const source = readFileSync(resolve(root, 'apps/admin-web/src/views/marketing/benefit-package-verify.vue'), 'utf8')
const previewMethod = source.slice(source.indexOf('async function handlePreview()'), source.indexOf('async function handleVerify()'))
const verifyMethod = source.slice(source.indexOf('async function handleVerify()'), source.indexOf('function handleReset'))

test('benefit verification handlers reject duplicate preview and verify work at function level', () => {
  assert.match(previewMethod, /if \(previewLoading\.value \|\| verifyLoading\.value\) return/)
  assert.match(verifyMethod, /if \(verifyLoading\.value \|\| previewLoading\.value \|\| !preview\.value\?\.canVerify\) return/)
  assert.match(verifyMethod, /verifyLoading\.value = true[\s\S]*benefitPackageApi\.verify/)
  assert.match(verifyMethod, /finally \{[\s\S]*verifyLoading\.value = false/)
  assert.match(source, /handleReset\(true\)/)
  assert.match(source, /function handleReset\(force = false\)/)
})

test('benefit verification is bound to the latest previewed code', () => {
  assert.match(source, /const previewedVerifyCode = ref\(''\)/)
  assert.match(source, /let previewSeq = 0/)
  assert.match(source, /@input="handleCodeInput"/)
  assert.match(previewMethod, /const requestSeq = \+\+previewSeq/)
  assert.match(previewMethod, /requestSeq !== previewSeq/)
  assert.match(previewMethod, /normalizeVerifyCode\(verifyCode\.value\) !== code/)
  assert.match(previewMethod, /normalizeVerifyCode\(data\?\.verifyCode\) !== code/)
  assert.match(verifyMethod, /const code = previewedVerifyCode\.value/)
  assert.match(verifyMethod, /normalizeVerifyCode\(verifyCode\.value\) !== code/)
  assert.match(verifyMethod, /normalizeVerifyCode\(preview\.value\.verifyCode\) !== code/)
  assert.match(source, /previewSeq \+= 1[\s\S]*previewLoading\.value = false/)
})
