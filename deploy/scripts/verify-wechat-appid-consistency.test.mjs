import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const script = resolve(root, 'deploy/scripts/verify-wechat-appid-consistency.mjs')
const APP_ID = 'wxe40f76a33427090f'
const OTHER_APP_ID = 'wx1234567890abcdef'

function run(extraEnv = {}, args = []) {
  return spawnSync(process.execPath, [script, ...args], {
    cwd: root,
    env: {
      ...process.env,
      VITE_WX_APPID: '',
      WECHAT_APP_ID: '',
      ...extraEnv,
    },
    encoding: 'utf8',
  })
}

test('public gate may omit both AppIDs', () => {
  const result = run()
  assert.equal(result.status, 0)
  assert.match(result.stdout, /SKIP/)
})

test('strict production gate requires both AppIDs', () => {
  const result = run({}, ['--require-both'])
  assert.equal(result.status, 1)
  assert.match(result.stderr, /必须同时提供/)
})

test('strict production gate rejects one-sided AppID configuration', () => {
  const result = run({ VITE_WX_APPID: APP_ID }, ['--require-both'])
  assert.equal(result.status, 1)
  assert.match(result.stderr, /必须同时提供/)
})

test('rejects two valid but different AppIDs', () => {
  const result = run({ VITE_WX_APPID: APP_ID, WECHAT_APP_ID: OTHER_APP_ID })
  assert.equal(result.status, 1)
  assert.match(result.stderr, /不一致/)
})

test('rejects placeholders', () => {
  const result = run({ VITE_WX_APPID: 'wx0000000000000000', WECHAT_APP_ID: 'wx0000000000000000' })
  assert.equal(result.status, 1)
  assert.match(result.stderr, /占位值/)
})

test('accepts the exact same real AppID on both sides', () => {
  const result = run({ VITE_WX_APPID: APP_ID, WECHAT_APP_ID: APP_ID }, ['--require-both'])
  assert.equal(result.status, 0)
  assert.match(result.stdout, /PASS/)
})
