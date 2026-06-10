import { existsSync, readFileSync, writeFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const manifestPath = resolve(__dirname, '../src/manifest.json')
const backupPath = resolve(__dirname, '../src/manifest.json.bak')

const appId = (process.env.VITE_WX_APPID || '').trim()
const apiBaseUrl = (process.env.VITE_API_BASE_URL || '').trim()
const appNameFromEnv = (process.env.VITE_APP_NAME || '').trim()
const appName = appNameFromEnv || '禧孕优选'
const isProduction = (process.env.NODE_ENV || '').toLowerCase() === 'production'
const PLACEHOLDER_APPID = 'wx0000000000000000'
const APPID_PATTERN = /^wx[a-zA-Z0-9]{16}$/
const FORBIDDEN_API_PATTERNS = [/localhost/i, /127\.0\.0\.1/, /0\.0\.0\.0/, /example\.com/i, /your-domain/i]

if (isProduction && (!appId || appId === PLACEHOLDER_APPID || !APPID_PATTERN.test(appId))) {
  console.error('ERROR: 生产构建必须配置真实且格式合法的 VITE_WX_APPID，格式应为 wx + 16 位字母数字，且不能为占位值')
  process.exit(1)
}
if (isProduction && !apiBaseUrl) {
  console.error('ERROR: 生产构建必须配置 VITE_API_BASE_URL，禁止空 API 地址打包')
  process.exit(1)
}
if (isProduction && apiBaseUrl) {
  if (!apiBaseUrl.startsWith('https://')) {
    console.error(`ERROR: 生产构建 VITE_API_BASE_URL 必须以 https:// 开头，当前值: ${apiBaseUrl}，正确格式: https://域名/api`)
    process.exit(1)
  }
  const trimmedUrl = apiBaseUrl.replace(/\/+$/, '')
  if (!trimmedUrl.endsWith('/api')) {
    console.error(`ERROR: 生产构建 VITE_API_BASE_URL 必须以 /api 结尾，当前值: ${apiBaseUrl}，正确格式: https://域名/api`)
    process.exit(1)
  }
  const forbiddenPattern = FORBIDDEN_API_PATTERNS.find((pattern) => pattern.test(trimmedUrl))
  if (forbiddenPattern) {
    console.error(`ERROR: 生产构建 VITE_API_BASE_URL 禁止使用本地或占位域名，当前值: ${apiBaseUrl}`)
    process.exit(1)
  }
}

const originalManifestText = readFileSync(manifestPath, 'utf-8')
if (!existsSync(backupPath)) {
  writeFileSync(backupPath, originalManifestText)
}
const manifest = JSON.parse(originalManifestText)

manifest.name = isProduction ? (appName || '禧孕优选') : appName
manifest.description = `${appName}商城小程序`

if (appId && appId !== PLACEHOLDER_APPID) {
  manifest.appid = appId
  if (manifest['mp-weixin']) {
    manifest['mp-weixin'].appid = appId
  }
}

manifest['mp-weixin'] = manifest['mp-weixin'] || {}
manifest['mp-weixin'].setting = manifest['mp-weixin'].setting || {}
manifest['mp-weixin'].setting.urlCheck = !isProduction ? false : true

writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n')

const patchedManifest = JSON.parse(readFileSync(manifestPath, 'utf-8'))
if (isProduction) {
  const patchedAppId = patchedManifest?.['mp-weixin']?.appid
  if (patchedAppId !== appId) {
    console.error(`ERROR: manifest patch 校验失败，mp-weixin.appid=${patchedAppId || '(empty)'}，预期=${appId}`)
    process.exit(1)
  }
  if (patchedManifest?.['mp-weixin']?.setting?.urlCheck === false) {
    console.error('ERROR: 生产构建禁止 mp-weixin.setting.urlCheck=false')
    process.exit(1)
  }
}

console.log(`manifest.json patched: name=${appName}, appid=${appId || '(unchanged)'}`)
