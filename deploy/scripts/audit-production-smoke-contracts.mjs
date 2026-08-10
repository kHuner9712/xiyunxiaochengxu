import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(fileURLToPath(new URL('../..', import.meta.url)))
const smoke = readFileSync(resolve(root, 'deploy/scripts/smoke-runtime.sh'), 'utf8')
const deploy = readFileSync(resolve(root, 'deploy/scripts/deploy-production.sh'), 'utf8')
const envValidation = readFileSync(resolve(root, 'apps/api/src/config/env.validation.ts'), 'utf8')
const failures = []

function requireText(source, text, message) {
  if (!source.includes(text)) failures.push(message)
}

requireText(smoke, '/api/weapp/customer-service/config', 'production smoke must call the public customer-service config endpoint')
requireText(smoke, 'data.enabled !== true', 'production smoke must reject disabled customer service')
requireText(smoke, '["phone", "wechat", "both"]', 'production smoke must validate the supported customer-service modes')
requireText(smoke, 'phone mode has no usable phone number', 'phone customer-service modes must require a usable phone number')
requireText(smoke, 'native WeChat contact still requires real-device acceptance', 'WeChat-only customer service must retain the real-device acceptance boundary')

requireText(deploy, 'container_payment_path_to_host', 'production deploy must map configured payment certificate container paths back to the mounted host directory')
requireText(deploy, 'CONFIGURED_WECHAT_PRIVATE_KEY_PATH', 'production deploy must read the configured merchant private-key path')
requireText(deploy, 'CONFIGURED_WECHAT_PLATFORM_CERT_PATH', 'production deploy must read the configured platform-certificate path')
requireText(deploy, 'validate_wechat_payment_material', 'production deploy must validate WeChat payment certificate material')
requireText(deploy, 'openssl pkey -in "$private_key" -noout', 'merchant private key must be parsed before database work')
requireText(deploy, 'openssl x509 -in "$platform_cert" -checkend 604800', 'platform certificate must remain valid for at least seven days')
requireText(deploy, 'WECHAT_PLATFORM_CERT_SERIAL_NO does not match the configured platform certificate', 'platform certificate serial mismatch must fail deployment')

const paymentValidationIndex = deploy.indexOf("pass 'WeChat merchant private key and platform certificate are valid, current, and serial-consistent'")
const databaseStartIndex = deploy.indexOf('up -d mysql redis')
if (paymentValidationIndex < 0 || databaseStartIndex < 0 || paymentValidationIndex >= databaseStartIndex) {
  failures.push('WeChat payment material validation must finish before production database services are started')
}

requireText(envValidation, 'WECHAT_PLATFORM_CERT_MAP 必须是合法的 JSON 对象', 'production env validation must reject malformed certificate rotation maps')
requireText(envValidation, 'WECHAT_PLATFORM_CERT_MAP 证书文件不可读', 'production env validation must reject missing rotation certificate files')

if (failures.length > 0) {
  console.error('[production-smoke-contract-audit] FAIL')
  for (const failure of failures) console.error(`  - ${failure}`)
  process.exit(1)
}

console.log('[production-smoke-contract-audit] PASS')
