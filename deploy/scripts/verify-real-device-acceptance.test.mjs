import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const root = resolve(fileURLToPath(new URL('../..', import.meta.url)))
const verifierPath = resolve(root, 'deploy/scripts/verify-real-device-acceptance.mjs')
const templatePath = resolve(root, 'apps/miniprogram/acceptance/real-device-acceptance.example.json')
const template = JSON.parse(readFileSync(templatePath, 'utf8'))

function currentSha() {
  const result = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' })
  assert.equal(result.status, 0, result.stderr)
  return result.stdout.trim()
}

function completedEvidence(overrides = {}) {
  return {
    ...template,
    commitSha: currentSha(),
    apiBaseUrl: 'https://api.acceptance.example.cn',
    appId: 'wx_acceptance_test',
    acceptedAt: new Date().toISOString(),
    operator: 'release-test',
    device: 'CI synthetic evidence verifier',
    wechatVersion: 'test-only',
    testAccount: 'dedicated-test-account',
    checks: Object.fromEntries(
      Object.keys(template.checks).map((key) => [key, { passed: true, evidence: `synthetic:${key}` }]),
    ),
    ...overrides,
  }
}

function runVerifier(evidence) {
  const dir = mkdtempSync(join(tmpdir(), 'baby-mall-real-device-'))
  const evidencePath = join(dir, 'evidence.json')
  writeFileSync(evidencePath, JSON.stringify(evidence, null, 2))
  try {
    return spawnSync(process.execPath, [verifierPath], {
      cwd: root,
      encoding: 'utf8',
      env: {
        ...process.env,
        REAL_DEVICE_ACCEPTANCE_FILE: evidencePath,
        VITE_API_BASE_URL: 'https://api.acceptance.example.cn/',
        WECHAT_APP_ID: 'wx_acceptance_test',
        RELEASE_COMMIT_SHA: currentSha(),
      },
    })
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

test('accepts complete evidence bound to the exact checkout SHA, API and AppID', () => {
  const result = runVerifier(completedEvidence())
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`)
  assert.match(result.stdout, /PASS:/)
})

test('rejects evidence from a different commit SHA', () => {
  const staleSha = currentSha() === 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
    ? 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'
    : 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
  const result = runVerifier(completedEvidence({ commitSha: staleSha }))
  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /evidence is stale/)
})

test('rejects any required real-device check without passed=true', () => {
  const evidence = completedEvidence()
  const [firstKey] = Object.keys(evidence.checks)
  evidence.checks[firstKey] = { passed: false, evidence: 'failed on device' }
  const result = runVerifier(evidence)
  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /passed must be true/)
})

test('rejects completed-looking checks without an evidence note or reference', () => {
  const evidence = completedEvidence()
  const [firstKey] = Object.keys(evidence.checks)
  evidence.checks[firstKey] = { passed: true, evidence: '' }
  const result = runVerifier(evidence)
  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /evidence note\/reference is required/)
})
