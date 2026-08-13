import { existsSync, readFileSync } from 'node:fs'
import { isAbsolute, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const templatePath = resolve(root, 'apps/miniprogram/acceptance/real-device-acceptance.example.json')
const evidenceEnv = String(process.env.REAL_DEVICE_ACCEPTANCE_FILE || '').trim()

function fail(message) {
  console.error(`[real-device-acceptance] ${message}`)
  process.exit(1)
}

function readJson(path, label) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'))
  } catch (error) {
    fail(`failed to read ${label} JSON at ${path}: ${error instanceof Error ? error.message : String(error)}`)
  }
}

function normalizeUrl(raw, label) {
  try {
    const url = new URL(String(raw || '').trim())
    if (!['http:', 'https:'].includes(url.protocol)) throw new Error('protocol must be http or https')
    url.hash = ''
    url.search = ''
    url.pathname = url.pathname.replace(/\/+$/, '') || '/'
    return url.toString().replace(/\/$/, '')
  } catch (error) {
    fail(`${label} must be a valid http(s) URL: ${error instanceof Error ? error.message : String(error)}`)
  }
}

function resolveCurrentSha() {
  const candidates = [
    process.env.RELEASE_COMMIT_SHA,
    process.env.EXPECTED_DEPLOY_SHA,
    process.env.GITHUB_SHA,
  ]
  for (const candidate of candidates) {
    const sha = String(candidate || '').trim().toLowerCase()
    if (/^[0-9a-f]{40}$/.test(sha)) return sha
  }

  const result = spawnSync('git', ['rev-parse', 'HEAD'], {
    cwd: root,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  if (result.status !== 0) {
    fail(`cannot resolve current git SHA: ${String(result.stderr || result.error?.message || '').trim()}`)
  }
  const sha = String(result.stdout || '').trim().toLowerCase()
  if (!/^[0-9a-f]{40}$/.test(sha)) fail(`git rev-parse returned an invalid SHA: ${sha || '(empty)'}`)
  return sha
}

if (!existsSync(templatePath)) fail('real-device acceptance template is missing from the repository')
if (!evidenceEnv) {
  fail('REAL_DEVICE_ACCEPTANCE_FILE is required for the strict production gate')
}

const evidencePath = isAbsolute(evidenceEnv) ? evidenceEnv : resolve(root, evidenceEnv)
if (resolve(evidencePath) === resolve(templatePath)) {
  fail('the example acceptance template cannot be used as completed evidence')
}
if (!existsSync(evidencePath)) fail(`REAL_DEVICE_ACCEPTANCE_FILE does not exist: ${evidencePath}`)

const template = readJson(templatePath, 'template')
const evidence = readJson(evidencePath, 'evidence')
const currentSha = resolveCurrentSha()

if (evidence.version !== template.version) {
  fail(`evidence version ${String(evidence.version)} does not match required version ${String(template.version)}`)
}

const evidenceSha = String(evidence.commitSha || '').trim().toLowerCase()
if (!/^[0-9a-f]{40}$/.test(evidenceSha)) fail('evidence commitSha must be an exact 40-character git SHA')
if (evidenceSha !== currentSha) {
  fail(`evidence is stale: accepted ${evidenceSha}, current checkout is ${currentSha}`)
}

const expectedApiBaseUrl = String(process.env.VITE_API_BASE_URL || '').trim()
if (!expectedApiBaseUrl) fail('VITE_API_BASE_URL is required when verifying real-device acceptance')
const evidenceApiBaseUrl = normalizeUrl(evidence.apiBaseUrl, 'evidence apiBaseUrl')
const normalizedExpectedApiBaseUrl = normalizeUrl(expectedApiBaseUrl, 'VITE_API_BASE_URL')
if (evidenceApiBaseUrl !== normalizedExpectedApiBaseUrl) {
  fail(`evidence API mismatch: accepted ${evidenceApiBaseUrl}, expected ${normalizedExpectedApiBaseUrl}`)
}

const expectedAppId = String(process.env.WECHAT_APP_ID || '').trim()
const evidenceAppId = String(evidence.appId || '').trim()
if (!evidenceAppId) fail('evidence appId is required')
if (expectedAppId && evidenceAppId !== expectedAppId) {
  fail(`evidence AppID mismatch: accepted ${evidenceAppId}, expected ${expectedAppId}`)
}

for (const field of ['operator', 'device', 'wechatVersion', 'testAccount']) {
  if (!String(evidence[field] || '').trim()) fail(`evidence ${field} is required`)
}

const acceptedAtMs = Date.parse(String(evidence.acceptedAt || ''))
if (!Number.isFinite(acceptedAtMs)) fail('evidence acceptedAt must be a valid timestamp')
if (acceptedAtMs > Date.now() + 5 * 60 * 1000) fail('evidence acceptedAt is unexpectedly in the future')

const requiredChecks = Object.keys(template.checks || {})
if (!requiredChecks.length) fail('acceptance template contains no required checks')
if (!evidence.checks || typeof evidence.checks !== 'object' || Array.isArray(evidence.checks)) {
  fail('evidence checks must be an object')
}

const failures = []
for (const key of requiredChecks) {
  const check = evidence.checks[key]
  if (!check || typeof check !== 'object' || check.passed !== true) {
    failures.push(`${key}: passed must be true`)
    continue
  }
  if (!String(check.evidence || '').trim()) {
    failures.push(`${key}: evidence note/reference is required`)
  }
}

const unknownChecks = Object.keys(evidence.checks).filter((key) => !requiredChecks.includes(key))
if (unknownChecks.length) {
  console.warn(`[real-device-acceptance] ignoring additional evidence checks: ${unknownChecks.join(', ')}`)
}

if (failures.length) {
  console.error('[real-device-acceptance] required real-device checks are incomplete:')
  for (const item of failures) console.error(`  - ${item}`)
  process.exit(1)
}

console.log(
  `[real-device-acceptance] PASS: ${requiredChecks.length} required checks passed on ${evidence.device} ` +
  `for exact SHA ${currentSha} against ${normalizedExpectedApiBaseUrl}.`,
)
