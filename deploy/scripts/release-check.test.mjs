import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(fileURLToPath(new URL('../..', import.meta.url)))

test('package.json exposes audited freeze and production gates', () => {
  const pkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'))
  const freeze = pkg.scripts['release:check:freeze']
  const production = pkg.scripts['release:check:prod']

  assert.match(freeze, /^pnpm audit:project && /)
  assert.match(freeze, /node deploy\/scripts\/run-release-check\.mjs/)
  assert.match(freeze, /--code-freeze-gate/)

  assert.match(production, /^pnpm audit:project && /)
  assert.match(production, /node deploy\/scripts\/run-release-check\.mjs/)
  assert.match(production, /--strict-prod-gate/)
  assert.match(production, /--require-real-wx-appid/)
  assert.equal(pkg.scripts['test:admin'], 'node --test apps/admin-web/src/utils/pending-content-asset-cleanup.test.mjs')
  assert.equal(pkg.scripts['test:admin:browser'], 'node deploy/scripts/admin-browser-e2e.mjs')
})

test('release gate wrapper preserves env, reports boundaries and runs supplemental tests safely', () => {
  const wrapper = readFileSync(resolve(root, 'deploy/scripts/run-release-check.mjs'), 'utf8')

  assert.match(wrapper, /process\.env\.UPLOAD_MAX_SIZE \|\| '52428800'/)
  assert.match(wrapper, /run\('bash', \['deploy\/scripts\/release-check\.sh', \.\.\.args\]\)/)
  assert.match(wrapper, /env: \{ \.\.\.env, \.\.\.extraEnv \}/)
  assert.match(wrapper, /unit tests and mocked HTTP tests/)
  assert.match(wrapper, /controlled mock API/)
  assert.match(wrapper, /run\(pnpmCommand, \['test:admin'\]\)/)
  assert.match(wrapper, /run\(pnpmCommand, \['test:admin:browser'\]\)/)
  assert.match(wrapper, /@baby-mall\/miniprogram', 'test'/)
  assert.match(wrapper, /@baby-mall\/api', 'prisma:migrate:drift-check'/)
  assert.match(wrapper, /@baby-mall\/api', 'test:integration'/)
  assert.match(wrapper, /isClearlyTestDatabase\(env\.DATABASE_URL\)/)
  assert.match(wrapper, /does not constitute production runtime or real-device acceptance/)
})

test('admin browser gate uses a built SPA, Chrome DevTools and refresh persistence evidence', () => {
  const browserGate = readFileSync(resolve(root, 'deploy/scripts/admin-browser-e2e.mjs'), 'utf8')

  assert.match(browserGate, /apps\/admin-web\/dist/)
  assert.match(browserGate, /remote-debugging-port=0/)
  assert.match(browserGate, /\/api\/admin\/auth\/login/)
  assert.match(browserGate, /\/api\/admin\/system-config\/update/)
  assert.match(browserGate, /Page\.reload/)
  assert.match(browserGate, /reload persistence/)
  assert.doesNotMatch(browserGate, /puppeteer|playwright|selenium/i)
})

test('release-check.sh recognizes freeze mode and prints both gate conclusions', () => {
  const script = readFileSync(resolve(root, 'deploy/scripts/release-check.sh'), 'utf8')

  assert.match(script, /CODE_FREEZE_GATE=false/)
  assert.match(script, /--code-freeze-gate/)
  assert.match(script, /Code Freeze Gate:/)
  assert.match(script, /Production Release Gate:/)
  assert.match(script, /Production Runtime Acceptance:/)
  assert.match(script, /PRODUCTION_GATE_RESULT="WARN"/)
})

test('release-check.sh treats public placeholders as external production config', () => {
  const script = readFileSync(resolve(root, 'deploy/scripts/release-check.sh'), 'utf8')

  assert.match(script, /公开仓库不复核真实 AppID 明文值/)
  assert.match(script, /manifest\.json 保留公开仓库占位 AppID/)
  assert.match(script, /legal\.ts 保留公开占位联系方式/)
  assert.match(script, /run_pnpm_with_node_env development "\$MINI_BUILD_SCRIPT"/)
  assert.doesNotMatch(script, /legal\.ts 仍包含待确认联系方式占位：\$pattern（生产严格门禁下不可发布）/)
})
