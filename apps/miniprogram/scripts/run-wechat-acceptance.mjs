import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const scriptDir = dirname(fileURLToPath(import.meta.url))
const projectRoot = resolve(scriptDir, '..')
const manifestPath = resolve(projectRoot, 'acceptance/wechat-page-manifest.json')
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
const mode = String(process.argv[2] || 'smoke').trim().toLowerCase()

if (!['smoke', 'full'].includes(mode)) {
  console.error('[wechat-acceptance] mode must be smoke or full')
  process.exit(2)
}

const cliPath = String(process.env.HBUILDERX_CLI || '').trim()
if (!cliPath) {
  console.error('[wechat-acceptance] HBUILDERX_CLI is required and must point to the HBuilderX cli executable.')
  console.error('[wechat-acceptance] Example on Windows: HBUILDERX_CLI=D:\\HBuilderX\\cli.exe')
  console.error('[wechat-acceptance] Example on macOS: HBUILDERX_CLI=/Applications/HBuilderX.app/Contents/MacOS/cli')
  process.exit(2)
}
if (!existsSync(cliPath)) {
  console.error(`[wechat-acceptance] HBuilderX CLI does not exist: ${cliPath}`)
  process.exit(2)
}

const apiBaseUrl = String(process.env.VITE_API_BASE_URL || '').trim()
if (!apiBaseUrl) {
  console.error('[wechat-acceptance] VITE_API_BASE_URL is required so the miniprogram talks to an explicit acceptance backend.')
  process.exit(2)
}
try {
  const parsed = new URL(apiBaseUrl)
  if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('unsupported protocol')
} catch {
  console.error(`[wechat-acceptance] invalid VITE_API_BASE_URL: ${apiBaseUrl}`)
  process.exit(2)
}

const target = String(process.env.WECHAT_ACCEPTANCE_TARGET || 'staging').trim().toLowerCase()
if (!['test', 'staging', 'production'].includes(target)) {
  console.error('[wechat-acceptance] WECHAT_ACCEPTANCE_TARGET must be test, staging, or production')
  process.exit(2)
}
if (target === 'production' && process.env.WECHAT_ACCEPTANCE_ALLOW_PRODUCTION !== 'true') {
  console.error('[wechat-acceptance] refusing production acceptance writes without WECHAT_ACCEPTANCE_ALLOW_PRODUCTION=true')
  process.exit(2)
}

if (!process.env.WECHAT_E2E_QUANTITY) process.env.WECHAT_E2E_QUANTITY = '1'

if (mode === 'full') {
  const requiredEnv = new Set()
  for (const page of manifest.pages || []) {
    for (const envName of Object.values(page.queryEnv || {})) requiredEnv.add(envName)
  }
  const missing = [...requiredEnv].filter((name) => !String(process.env[name] || '').trim())
  if (missing.length) {
    console.error('[wechat-acceptance] full mode is missing required acceptance data:')
    for (const name of missing) console.error(`  - ${name}`)
    process.exit(2)
  }
}

const env = {
  ...process.env,
  WECHAT_ACCEPTANCE_MODE: mode,
  WECHAT_ACCEPTANCE_TARGET: target,
}

console.log(`[wechat-acceptance] starting ${mode} acceptance against ${target}: ${apiBaseUrl}`)
console.log('[wechat-acceptance] HBuilderX/WeChat DevTools must have the automation plugin and service port enabled.')
if (mode === 'full') {
  console.log('[wechat-acceptance] full mode expects the selected WeChat test account to already have a valid baby_mall_token session.')
}

const result = spawnSync(
  cliPath,
  ['uniapp.test', 'mp-weixin', '--project', projectRoot],
  {
    cwd: dirname(cliPath),
    env,
    stdio: 'inherit',
    shell: false,
  },
)

if (result.error) {
  console.error(`[wechat-acceptance] failed to start HBuilderX CLI: ${result.error.message}`)
  process.exit(1)
}
process.exit(result.status ?? 1)
