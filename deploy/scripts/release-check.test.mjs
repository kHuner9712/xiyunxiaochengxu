import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(fileURLToPath(new URL('../..', import.meta.url)))

test('package.json exposes code freeze gate without weakening prod gate', () => {
  const pkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'))

  assert.equal(pkg.scripts['release:check:freeze'], 'bash deploy/scripts/release-check.sh --code-freeze-gate')
  assert.match(pkg.scripts['release:check:prod'], /--strict-prod-gate/)
  assert.match(pkg.scripts['release:check:prod'], /--require-real-wx-appid/)
})

test('release-check.sh recognizes freeze mode and prints both gate conclusions', () => {
  const script = readFileSync(resolve(root, 'deploy/scripts/release-check.sh'), 'utf8')

  assert.match(script, /CODE_FREEZE_GATE=false/)
  assert.match(script, /--code-freeze-gate/)
  assert.match(script, /Code Freeze Gate:/)
  assert.match(script, /Production Release Gate:/)
  assert.match(script, /PRODUCTION_GATE_RESULT="WARN"/)
})
