import { readFileSync, writeFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const manifestPath = resolve(__dirname, '../src/manifest.json')

const appId = process.env.VITE_WX_APPID || ''
const appName = process.env.VITE_APP_NAME || '禧孕优选'
const isProduction = (process.env.NODE_ENV || '').toLowerCase() === 'production'

if (isProduction && (!appId || appId === 'wx0000000000000000')) {
  console.error('ERROR: 生产构建必须配置真实的 VITE_WX_APPID，当前值为空或占位值')
  process.exit(1)
}

const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'))

manifest.name = appName
manifest.description = `${appName}商城小程序`

if (appId && appId !== 'wx0000000000000000') {
  manifest.appid = appId
  if (manifest['mp-weixin']) {
    manifest['mp-weixin'].appid = appId
  }
}

writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n')

console.log(`manifest.json patched: name=${appName}, appid=${appId || '(unchanged)'}`)
