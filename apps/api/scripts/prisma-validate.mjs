import { spawnSync } from 'node:child_process'

const defaultDatabaseUrl = 'mysql://root:dummy@localhost:3306/baby_mall'
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
