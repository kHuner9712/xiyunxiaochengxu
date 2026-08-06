import { spawnSync } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const apiRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const databaseUrl = process.env.DATABASE_URL

if (!databaseUrl) {
  console.error('[prisma-migration-drift] DATABASE_URL is required')
  process.exit(1)
}

let databaseName = ''
try {
  databaseName = decodeURIComponent(new URL(databaseUrl).pathname.replace(/^\//, ''))
} catch {
  console.error('[prisma-migration-drift] DATABASE_URL is invalid')
  process.exit(1)
}

const clearlyTestDatabase = /(^|[_-])test($|[_-])/i.test(databaseName)
if (!clearlyTestDatabase && process.env.ALLOW_SCHEMA_DRIFT_CHECK !== 'true') {
  console.error(
    `[prisma-migration-drift] refusing diff against database "${databaseName || '(unknown)'}"; `
      + 'use a test database or set ALLOW_SCHEMA_DRIFT_CHECK=true explicitly',
  )
  process.exit(1)
}

const pnpm = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm'
const result = spawnSync(
  pnpm,
  [
    'exec',
    'prisma',
    'migrate',
    'diff',
    '--from-url',
    databaseUrl,
    '--to-schema-datamodel',
    'prisma/schema.prisma',
    '--exit-code',
  ],
  {
    cwd: apiRoot,
    env: process.env,
    stdio: 'inherit',
  },
)

if (result.error) {
  console.error('[prisma-migration-drift] failed to launch Prisma:', result.error.message)
  process.exit(1)
}

if (result.status !== 0) {
  console.error('[prisma-migration-drift] FAIL: migration-built database differs from schema.prisma')
  process.exit(result.status ?? 1)
}

console.log('[prisma-migration-drift] PASS')
