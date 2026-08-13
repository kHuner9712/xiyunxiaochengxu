import { spawnSync } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const args = process.argv.slice(2)
const env = {
  ...process.env,
  UPLOAD_MAX_SIZE: process.env.UPLOAD_MAX_SIZE || '52428800',
}

function run(command, commandArgs, extraEnv = {}) {
  const result = spawnSync(command, commandArgs, {
    cwd: root,
    env: { ...env, ...extraEnv },
    stdio: 'inherit',
  })

  if (result.error) {
    console.error(`[run-release-check] failed to start ${command}: ${result.error.message}`)
    return 1
  }
  return result.status ?? 1
}

function getDatabaseName(databaseUrl) {
  if (!databaseUrl) return ''
  try {
    return decodeURIComponent(new URL(databaseUrl).pathname.replace(/^\//, ''))
  } catch {
    return ''
  }
}

function isClearlyTestDatabase(databaseUrl) {
  return /(^|[_-])test($|[_-])/i.test(getDatabaseName(databaseUrl))
}

function isReservedProductionApiHost(rawUrl) {
  if (!rawUrl) return false
  try {
    const hostname = new URL(rawUrl).hostname.toLowerCase().replace(/\.$/, '')
    if (!hostname) return false
    if (hostname === 'localhost' || hostname === '::1' || hostname === '0.0.0.0') return true
    if (hostname === 'example.com' || hostname === 'example.net' || hostname === 'example.org') return true
    if (hostname.startsWith('127.')) return true
    return ['.invalid', '.test', '.example', '.localhost'].some(
      (suffix) => hostname === suffix.slice(1) || hostname.endsWith(suffix),
    )
  } catch {
    return false
  }
}

const pnpmCommand = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm'
const strictProductionGate = args.includes('--strict-prod-gate')
if (strictProductionGate && isReservedProductionApiHost(env.VITE_API_BASE_URL)) {
  console.error(
    `[run-release-check] strict production gate refuses reserved/local VITE_API_BASE_URL: ${env.VITE_API_BASE_URL}`,
  )
  process.exit(1)
}

const appIdGateArgs = ['deploy/scripts/verify-wechat-appid-consistency.mjs']
if (strictProductionGate) appIdGateArgs.push('--require-both')
const appIdGateStatus = run(process.execPath, appIdGateArgs)
if (appIdGateStatus !== 0) {
  console.error('[run-release-check] WeChat frontend/backend AppID consistency gate failed')
  process.exit(appIdGateStatus)
}

console.log('[release-gate-boundary] API test:ci covers unit tests and mocked HTTP tests; it is not a real-database end-to-end test.')
console.log('[release-gate-boundary] Admin browser E2E uses a built frontend and controlled mock API; production runtime, WeChat DevTools, real-device and payment acceptance remain separate evidence gates.')

const repositoryGateStatus = run('bash', ['deploy/scripts/release-check.sh', ...args])
if (repositoryGateStatus !== 0) {
  process.exit(repositoryGateStatus)
}

console.log('\n━━━ Supplemental gate A: Admin pending content asset cleanup tests ━━━')
const adminCleanupTestStatus = run(pnpmCommand, ['test:admin'])
if (adminCleanupTestStatus !== 0) {
  console.error('[run-release-check] admin pending content asset cleanup tests failed')
  process.exit(adminCleanupTestStatus)
}

console.log('\n━━━ Supplemental gate B: Admin built-browser operation flow ━━━')
const adminBrowserTestStatus = run(pnpmCommand, ['test:admin:browser'])
if (adminBrowserTestStatus !== 0) {
  console.error('[run-release-check] admin browser operation flow failed')
  process.exit(adminBrowserTestStatus)
}

console.log('\n━━━ Supplemental gate C: Miniprogram unit/component tests ━━━')
const miniprogramTestStatus = run(pnpmCommand, ['--filter', '@baby-mall/miniprogram', 'test'])
if (miniprogramTestStatus !== 0) {
  console.error('[run-release-check] miniprogram unit/component tests failed')
  process.exit(miniprogramTestStatus)
}

console.log('\n━━━ Supplemental gate D: Real MySQL schema and operation lifecycle integrations ━━━')
if (isClearlyTestDatabase(env.DATABASE_URL)) {
  const migrationStatus = run(
    pnpmCommand,
    ['--filter', '@baby-mall/api', 'prisma:migrate:deploy'],
  )
  if (migrationStatus !== 0) {
    console.error('[run-release-check] test database migrations failed')
    process.exit(migrationStatus)
  }

  const driftStatus = run(
    pnpmCommand,
    ['--filter', '@baby-mall/api', 'prisma:migrate:drift-check'],
  )
  if (driftStatus !== 0) {
    console.error('[run-release-check] migration-built database differs from Prisma schema')
    process.exit(driftStatus)
  }

  const integrationStatus = run(
    pnpmCommand,
    ['--filter', '@baby-mall/api', 'test:integration'],
    { ALLOW_DESTRUCTIVE_INTEGRATION_TESTS: 'false' },
  )
  if (integrationStatus !== 0) {
    console.error('[run-release-check] real MySQL operation lifecycle integration failed')
    process.exit(integrationStatus)
  }
} else {
  const databaseName = getDatabaseName(env.DATABASE_URL)
  console.warn(
    `[run-release-check] SKIP real MySQL integration: DATABASE_URL database "${databaseName || '(missing/invalid)'}" is not an explicit test database.`,
  )
  console.warn('[run-release-check] CI must provide a dedicated test database, migration drift check and test:integration before merge.')
}

if (strictProductionGate) {
  console.log('\n━━━ Supplemental gate E: Exact-head real-device full-function acceptance ━━━')
  const realDeviceAcceptanceStatus = run(process.execPath, ['deploy/scripts/verify-real-device-acceptance.mjs'])
  if (realDeviceAcceptanceStatus !== 0) {
    console.error('[run-release-check] strict production gate requires completed real-device acceptance evidence')
    process.exit(realDeviceAcceptanceStatus)
  }
  console.log('\n[release-gate-boundary] Repository checks and exact-head real-device acceptance passed.')
} else {
  console.log('\n[release-gate-boundary] Repository checks passed. This does not constitute production runtime or real-device acceptance.')
}
