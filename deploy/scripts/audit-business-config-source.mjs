import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const failures = []
const files = [
  'deploy/docker-compose.yml',
  'deploy/docker-compose.bt.yml',
  '.env.production.example',
]
const forbiddenBusinessEnv = [
  'ORDER_AUTO_CLOSE_MINUTES',
  'ORDER_AUTO_COMPLETE_DAYS',
  'FREIGHT_FREE_AMOUNT',
  'FREIGHT_DEFAULT_FEE',
  'FREIGHT_REMOTE_FEE',
  'POINTS_DEDUCT_RATE',
  'POINTS_DEDUCT_MAX_PERCENT',
]

for (const file of files) {
  const source = readFileSync(resolve(root, file), 'utf8')
  for (const name of forbiddenBusinessEnv) {
    const assignment = new RegExp(`^\\s*${name}\\s*[:=]`, 'm')
    if (assignment.test(source)) {
      failures.push(`${file}: ${name} must not be exposed as a production environment override`)
    }
  }
}

const productionEnv = readFileSync(resolve(root, '.env.production.example'), 'utf8')
if (!productionEnv.includes('统一由数据库 system_configs 与管理后台“系统配置”控制')) {
  failures.push('.env.production.example: must document system_configs/Admin as the mutable business-config source of truth')
}
if (!productionEnv.includes('偏远地区名单和附加运费目前是代码版本化常量')) {
  failures.push('.env.production.example: must document remote freight as a versioned code constant')
}

const productionOrder = readFileSync(resolve(root, 'apps/api/src/order/production-order.service.ts'), 'utf8')
if (!productionOrder.includes('this.systemConfigService?.getRuntimeConfig()')) {
  failures.push('apps/api/src/order/production-order.service.ts: production order must read mutable business config from SystemConfigService')
}
if (!productionOrder.includes('return FREIGHT_REMOTE_FEE')) {
  failures.push('apps/api/src/order/production-order.service.ts: remote freight source changed; update the production config contract deliberately')
}

if (failures.length > 0) {
  console.error('[business-config-source-audit] FAIL')
  for (const failure of failures) console.error(`  - ${failure}`)
  process.exit(1)
}

console.log('[business-config-source-audit] PASS')
