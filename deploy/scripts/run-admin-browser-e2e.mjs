import { spawnSync } from 'node:child_process'
import { readdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const scriptPath = resolve(root, 'deploy/scripts/admin-browser-e2e.mjs')

const result = spawnSync(process.execPath, [scriptPath], {
  cwd: root,
  env: process.env,
  encoding: 'utf8',
  maxBuffer: 10 * 1024 * 1024,
})

if (result.stdout) process.stdout.write(result.stdout)
if (result.stderr) process.stderr.write(result.stderr)

if (result.error) {
  console.error(`[admin-browser-e2e-runner] failed to start browser test: ${result.error.message}`)
  process.exit(1)
}

if (result.status === 0) {
  process.exit(0)
}

const output = `${result.stdout || ''}\n${result.stderr || ''}`
const browserFlowPassed = output.includes(
  '[admin-browser-e2e] PASS login → permission menu → config save → reload persistence',
)
const knownCleanupRace =
  output.includes('ENOTEMPTY: directory not empty') &&
  output.includes('xiyun-admin-browser-e2e-')

if (!browserFlowPassed || !knownCleanupRace) {
  process.exit(result.status ?? 1)
}

let cleanupFailed = false
for (const entry of readdirSync(tmpdir())) {
  if (!entry.startsWith('xiyun-admin-browser-e2e-')) continue
  try {
    rmSync(resolve(tmpdir(), entry), {
      recursive: true,
      force: true,
      maxRetries: 10,
      retryDelay: 100,
    })
  } catch (error) {
    cleanupFailed = true
    console.error(
      `[admin-browser-e2e-runner] Chrome profile cleanup still failed for ${entry}: ${error.message}`,
    )
  }
}

if (cleanupFailed) {
  process.exit(1)
}

console.log(
  '[admin-browser-e2e-runner] PASS browser assertions completed; Chrome profile cleanup retried after process exit',
)
