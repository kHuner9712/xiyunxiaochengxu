import { spawnSync } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const args = process.argv.slice(2)
const env = {
  ...process.env,
  UPLOAD_MAX_SIZE: process.env.UPLOAD_MAX_SIZE || '52428800',
}

const result = spawnSync('bash', ['deploy/scripts/release-check.sh', ...args], {
  cwd: root,
  env,
  stdio: 'inherit',
})

if (result.error) {
  console.error(`[run-release-check] failed to start release gate: ${result.error.message}`)
  process.exit(1)
}

process.exit(result.status ?? 1)
