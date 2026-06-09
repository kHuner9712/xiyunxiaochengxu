import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const appDir = resolve(__dirname, '..')
const distDir = join(appDir, 'dist/build/mp-weixin')
const expectedAppId = (process.env.VITE_WX_APPID || '').trim()
const expectedApiBaseUrl = (process.env.VITE_API_BASE_URL || '').trim().replace(/\/+$/, '')
const placeholderAppId = 'wx0000000000000000'
const appIdPattern = /^wx[a-zA-Z0-9]{16}$/
const forbiddenApiPatterns = [/localhost/i, /127\.0\.0\.1/, /0\.0\.0\.0/, /example\.com/i, /your-domain/i]

function fail(message) {
  console.error(`[verify-mp-weixin-prod] FAIL ${message}`)
  process.exit(1)
}

function pass(message) {
  console.log(`[verify-mp-weixin-prod] PASS ${message}`)
}

function readJsonIfExists(path) {
  if (!existsSync(path)) return null
  return JSON.parse(readFileSync(path, 'utf8'))
}

function listFiles(path) {
  if (!existsSync(path)) return []
  const stat = statSync(path)
  if (stat.isFile()) return [path]
  return readdirSync(path).flatMap((entry) => listFiles(join(path, entry)))
}

if (!existsSync(distDir)) {
  fail(`dist directory not found: ${distDir}`)
}

if (!appIdPattern.test(expectedAppId) || expectedAppId === placeholderAppId) {
  fail('VITE_WX_APPID must be a real wx + 16 alphanumeric AppID')
}

if (!expectedApiBaseUrl || !expectedApiBaseUrl.startsWith('https://') || !expectedApiBaseUrl.endsWith('/api')) {
  fail('VITE_API_BASE_URL must be https://.../api')
}

if (forbiddenApiPatterns.some((pattern) => pattern.test(expectedApiBaseUrl))) {
  fail(`VITE_API_BASE_URL contains a forbidden placeholder/local host: ${expectedApiBaseUrl}`)
}

const projectConfig = readJsonIfExists(join(distDir, 'project.config.json'))
const manifest = readJsonIfExists(join(distDir, 'manifest.json'))
const discoveredAppId = projectConfig?.appid || manifest?.['mp-weixin']?.appid || manifest?.appid

if (discoveredAppId !== expectedAppId) {
  fail(`built AppID mismatch: expected ${expectedAppId}, found ${discoveredAppId || '(missing)'}`)
}
pass(`built AppID matches ${expectedAppId}`)

const urlCheck = projectConfig?.setting?.urlCheck ?? manifest?.['mp-weixin']?.setting?.urlCheck
if (urlCheck !== true) {
  fail(`production urlCheck must be true, found ${String(urlCheck)}`)
}
pass('production urlCheck is true')

const textFiles = listFiles(distDir).filter((file) => /\.(js|json|wxml|wxss)$/.test(file))
const combined = textFiles.map((file) => readFileSync(file, 'utf8')).join('\n')

if (combined.includes(placeholderAppId)) {
  fail(`built package contains placeholder AppID ${placeholderAppId}`)
}

if (!combined.includes(expectedApiBaseUrl)) {
  fail(`built package does not contain expected API base URL: ${expectedApiBaseUrl}`)
}

for (const pattern of forbiddenApiPatterns) {
  if (pattern.test(combined)) {
    fail(`built package contains forbidden API placeholder/local pattern: ${pattern}`)
  }
}

pass(`built API base URL matches ${expectedApiBaseUrl}`)
