import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(fileURLToPath(new URL('../..', import.meta.url)))
const pagesJsonPath = resolve(root, 'apps/miniprogram/src/pages.json')
const manifestPath = resolve(root, 'apps/miniprogram/acceptance/wechat-page-manifest.json')
const miniprogramPackagePath = resolve(root, 'apps/miniprogram/package.json')
const acceptanceRunnerPath = resolve(root, 'apps/miniprogram/scripts/run-wechat-acceptance.mjs')
const acceptanceTestPath = resolve(root, 'apps/miniprogram/src/full-function-acceptance.test.js')
const automatorJestConfigPath = resolve(root, 'apps/miniprogram/jest.config.js')
const realDeviceTemplatePath = resolve(root, 'apps/miniprogram/acceptance/real-device-acceptance.example.json')
const realDeviceVerifierPath = resolve(root, 'deploy/scripts/verify-real-device-acceptance.mjs')
const releaseCheckPath = resolve(root, 'deploy/scripts/run-release-check.mjs')

function fail(message) {
  console.error(`[audit-miniprogram-acceptance] ${message}`)
  process.exitCode = 1
}

function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'))
  } catch (error) {
    console.error(`[audit-miniprogram-acceptance] failed to parse ${path}:`, error)
    process.exit(1)
  }
}

const pagesConfig = readJson(pagesJsonPath)
const manifest = readJson(manifestPath)
const miniprogramPackage = readJson(miniprogramPackagePath)
const registeredPages = Array.isArray(pagesConfig.pages) ? pagesConfig.pages.map((entry) => entry.path) : []
const acceptedPages = Array.isArray(manifest.pages) ? manifest.pages : []

if (!registeredPages.length) fail('pages.json contains no registered pages')
if (!acceptedPages.length) fail('acceptance manifest contains no pages')

for (const [label, path] of [
  ['WeChat acceptance runner', acceptanceRunnerPath],
  ['WeChat automator test', acceptanceTestPath],
  ['uni-automator Jest config', automatorJestConfigPath],
  ['real-device acceptance template', realDeviceTemplatePath],
  ['real-device acceptance verifier', realDeviceVerifierPath],
]) {
  if (!existsSync(path)) fail(`${label} is missing`)
}

for (const scriptName of ['test:wechat:smoke', 'test:wechat:full']) {
  const command = miniprogramPackage?.scripts?.[scriptName]
  if (typeof command !== 'string' || !command.includes('run-wechat-acceptance.mjs')) {
    fail(`apps/miniprogram/package.json must define ${scriptName} through run-wechat-acceptance.mjs`)
  }
}

if (!existsSync(releaseCheckPath)) {
  fail('strict production release check is missing')
} else {
  const releaseCheckSource = readFileSync(releaseCheckPath, 'utf8')
  if (!releaseCheckSource.includes('verify-real-device-acceptance.mjs')) {
    fail('strict production release check must invoke verify-real-device-acceptance.mjs')
  }
  if (!releaseCheckSource.includes('strictProductionGate')) {
    fail('real-device evidence must remain scoped to the strict production gate')
  }
}

const realDeviceTemplate = readJson(realDeviceTemplatePath)
if (realDeviceTemplate.version !== 1) fail('real-device acceptance template version must be 1')
if (!realDeviceTemplate.checks || Object.keys(realDeviceTemplate.checks).length === 0) {
  fail('real-device acceptance template must contain required checks')
}

const registeredSet = new Set(registeredPages)
const acceptedSet = new Set()
const duplicateAccepted = new Set()

for (const entry of acceptedPages) {
  if (!entry || typeof entry.path !== 'string' || !entry.path.trim()) {
    fail('every manifest page must have a non-empty path')
    continue
  }

  const pagePath = entry.path.trim()
  if (acceptedSet.has(pagePath)) duplicateAccepted.add(pagePath)
  acceptedSet.add(pagePath)

  if (typeof entry.authRequired !== 'boolean') {
    fail(`${pagePath}: authRequired must be boolean`)
  }

  const sourcePath = resolve(root, 'apps/miniprogram/src', `${pagePath}.vue`)
  if (!existsSync(sourcePath)) {
    fail(`${pagePath}: backing page file does not exist at apps/miniprogram/src/${pagePath}.vue`)
  }

  if (entry.queryEnv !== undefined) {
    if (!entry.queryEnv || typeof entry.queryEnv !== 'object' || Array.isArray(entry.queryEnv)) {
      fail(`${pagePath}: queryEnv must be an object when present`)
    } else {
      for (const [queryKey, envName] of Object.entries(entry.queryEnv)) {
        if (!queryKey.trim()) fail(`${pagePath}: queryEnv contains an empty query key`)
        if (typeof envName !== 'string' || !/^WECHAT_E2E_[A-Z0-9_]+$/.test(envName)) {
          fail(`${pagePath}: queryEnv ${queryKey} must map to a WECHAT_E2E_* environment variable`)
        }
      }
    }
  }

  if (entry.readySelector !== undefined && (typeof entry.readySelector !== 'string' || !entry.readySelector.trim())) {
    fail(`${pagePath}: readySelector must be a non-empty string when present`)
  }
}

for (const path of duplicateAccepted) fail(`duplicate manifest page: ${path}`)

for (const pagePath of registeredSet) {
  if (!acceptedSet.has(pagePath)) fail(`registered page missing from acceptance manifest: ${pagePath}`)
}
for (const pagePath of acceptedSet) {
  if (!registeredSet.has(pagePath)) fail(`acceptance manifest contains an unregistered page: ${pagePath}`)
}

if (!Array.isArray(manifest.realDeviceOnly) || manifest.realDeviceOnly.length === 0) {
  fail('realDeviceOnly must explicitly list WeChat capabilities that repository automation cannot prove')
}

if (!process.exitCode) {
  const authCount = acceptedPages.filter((entry) => entry.authRequired).length
  const dataDrivenCount = acceptedPages.filter((entry) => entry.queryEnv && Object.keys(entry.queryEnv).length).length
  const realDeviceCount = Object.keys(realDeviceTemplate.checks || {}).length
  console.log(
    `[audit-miniprogram-acceptance] PASS: ${registeredPages.length} registered pages are explicitly covered ` +
    `(${authCount} authenticated, ${dataDrivenCount} data-driven); ${manifest.realDeviceOnly.length} real-device capability classes declared; ` +
    `${realDeviceCount} strict real-device checks protected; WeChat acceptance runner, automator test and Jest configuration are present.`,
  )
}
