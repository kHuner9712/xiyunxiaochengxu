import { spawnSync } from 'node:child_process'

const defaultDatabaseUrl = 'mysql://release_check:release_check@127.0.0.1:3306/release_check'
const env = {
  ...process.env,
  DATABASE_URL: process.env.DATABASE_URL || defaultDatabaseUrl,
}

const result = spawnSync('prisma', ['validate'], {
  env,
  shell: process.platform === 'win32',
  stdio: 'inherit',
})

process.exit(result.status ?? 1)
