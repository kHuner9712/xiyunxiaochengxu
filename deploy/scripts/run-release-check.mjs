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

const pnpmCommand = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm'

console.log('[release-gate-boundary] API test:ci covers unit tests and mocked HTTP tests; it is not a real-database end-to-end test.')
console.log('[release-gate-boundary] Production runtime, admin browser flows, WeChat DevTools, real-device and payment acceptance remain separate evidence gates.')

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

console.log('\n━━━ Supplemental gate B: Miniprogram unit/component tests ━━━')
const miniprogramTestStatus = run(pnpmCommand, ['--filter', '@baby-mall/miniprogram', 'test'])
if (miniprogramTestStatus !== 0) {
  console.error('[run-release-check] miniprogram unit/component tests failed')
  process.exit(miniprogramTestStatus)
}

console.log('\n━━━ Supplemental gate C: Real MySQL content lifecycle integration ━━━')
if (isClearlyTestDatabase(env.DATABASE_URL)) {
  const migrationStatus = run(
    pnpmCommand,
    ['--filter', '@baby-mall/api', 'prisma:migrate:deploy'],
  )
  if (migrationStatus !== 0) {
    console.error('[run-release-check] test database migrations failed')
    process.exit(migrationStatus)
  }

  const integrationStatus = run(
    pnpmCommand,
    ['--filter', '@baby-mall/api', 'test:integration'],
    { ALLOW_DESTRUCTIVE_INTEGRATION_TESTS: 'false' },
  )
  if (integrationStatus !== 0) {
    console.error('[run-release-check] real MySQL content lifecycle integration failed')
    process.exit(integrationStatus)
  }
} else {
  const databaseName = getDatabaseName(env.DATABASE_URL)
  console.warn(
    `[run-release-check] SKIP real MySQL integration: DATABASE_URL database "${databaseName || '(missing/invalid)'}" is not an explicit test database.`,
  )
  console.warn('[run-release-check] CI must provide a dedicated test database and run test:integration before merge.')
}

console.log('\n[release-gate-boundary] Repository checks passed. This does not constitute production runtime or real-device acceptance.')
