import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(fileURLToPath(new URL('../..', import.meta.url)))
const smoke = readFileSync(resolve(root, 'deploy/scripts/smoke-runtime.sh'), 'utf8')
const failures = []

function requireText(text, message) {
  if (!smoke.includes(text)) failures.push(message)
}

requireText('/api/weapp/customer-service/config', 'production smoke must call the public customer-service config endpoint')
requireText('data.enabled !== true', 'production smoke must reject disabled customer service')
requireText('["phone", "wechat", "both"]', 'production smoke must validate the supported customer-service modes')
requireText('phone mode has no usable phone number', 'phone customer-service modes must require a usable phone number')
requireText('native WeChat contact still requires real-device acceptance', 'WeChat-only customer service must retain the real-device acceptance boundary')

if (failures.length > 0) {
  console.error('[production-smoke-contract-audit] FAIL')
  for (const failure of failures) console.error(`  - ${failure}`)
  process.exit(1)
}

console.log('[production-smoke-contract-audit] PASS')
