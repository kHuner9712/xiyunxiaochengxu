import { readFileSync, writeFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const manifestPath = resolve(__dirname, '../src/manifest.json')

const appId = (process.env.VITE_WX_APPID || '').trim()
const appNameFromEnv = (process.env.VITE_APP_NAME || '').trim()
const appName = appNameFromEnv || '禧孕优选'
const isProduction = (process.env.NODE_ENV || '').toLowerCase() === 'production'
const PLACEHOLDER_APPID = 'wx0000000000000000'

if (isProduction && (!appId || appId === PLACEHOLDER_APPID)) {
  console.error('ERROR: 生产构建必须配置真实的 VITE_WX_APPID，当前值为空或占位值')
  process.exit(1)
}

const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'))

manifest.name = isProduction ? (appName || '禧孕优选') : appName
manifest.description = `${appName}商城小程序`

if (appId && appId !== PLACEHOLDER_APPID) {
  manifest.appid = appId
  if (manifest['mp-weixin']) {
    manifest['mp-weixin'].appid = appId
  }
}

writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n')

const patchedManifest = JSON.parse(readFileSync(manifestPath, 'utf-8'))
if (isProduction) {
  const patchedAppId = patchedManifest?.['mp-weixin']?.appid
  if (patchedAppId !== appId) {
    console.error(`ERROR: manifest patch 校验失败，mp-weixin.appid=${patchedAppId || '(empty)'}，预期=${appId}`)
    process.exit(1)
  }
}

console.log(`manifest.json patched: name=${appName}, appid=${appId || '(unchanged)'}`)
