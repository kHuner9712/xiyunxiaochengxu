import { spawnSync } from 'child_process'
import { existsSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const backupPath = resolve(__dirname, '../src/manifest.json.bak')
const scriptsDir = __dirname
const isProduction = (process.env.NODE_ENV || '').toLowerCase() === 'production'

if (existsSync(backupPath)) {
  console.error('检测到残留的 manifest.json.bak，请先运行 node scripts/restore-miniprogram-manifest.mjs 清理')
  process.exit(1)
}

let exitCode = 0
let patchCreatedBak = false

const patchResult = spawnSync('node', [resolve(scriptsDir, 'patch-miniprogram-manifest.mjs')], {
  stdio: 'inherit',
})

if (patchResult.status !== 0) {
  exitCode = patchResult.status ?? 1
  if (existsSync(backupPath)) {
    patchCreatedBak = true
  }
  if (patchCreatedBak) {
    spawnSync('node', [resolve(scriptsDir, 'restore-miniprogram-manifest.mjs')], { stdio: 'inherit' })
  }
  process.exit(exitCode)
}

patchCreatedBak = existsSync(backupPath)

try {
  const buildResult = spawnSync('npx', ['uni', 'build', '-p', 'mp-weixin'], {
    stdio: 'inherit',
    shell: true,
  })
  exitCode = buildResult.status ?? 1
  if (exitCode === 0 && isProduction) {
    const verifyResult = spawnSync('node', [resolve(scriptsDir, 'verify-mp-weixin-prod.mjs')], {
      stdio: 'inherit',
    })
    exitCode = verifyResult.status ?? 1
  }
} finally {
  if (patchCreatedBak) {
    spawnSync('node', [resolve(scriptsDir, 'restore-miniprogram-manifest.mjs')], { stdio: 'inherit' })
  }
}

process.exit(exitCode)
