import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const failures = []

function read(file) {
  return readFileSync(join(root, file), 'utf8')
}

function requireText(file, text, message) {
  if (!read(file).includes(text)) failures.push(`${file}: ${message}`)
}

const redisConf = read('deploy/redis/redis.conf')
for (const [pattern, message] of [
  [/^maxmemory-policy\s+noeviction\s*$/m, 'maxmemory-policy must be noeviction so correctness keys cannot be evicted'],
  [/^appendonly\s+yes\s*$/m, 'AOF persistence must remain enabled'],
  [/^appendfsync\s+everysec\s*$/m, 'AOF fsync policy must remain everysec or stronger'],
]) {
  if (!pattern.test(redisConf)) failures.push(`deploy/redis/redis.conf: ${message}`)
}

for (const file of ['deploy/docker-compose.yml', 'deploy/docker-compose.bt.yml']) {
  requireText(file, './redis/redis.conf:/etc/redis/redis.conf:ro', 'production Redis must mount the audited redis.conf read-only')
  requireText(file, 'redis_data:/data', 'production Redis must keep a persistent data volume')
  requireText(file, './scripts/redis-entrypoint.sh:/usr/local/bin/redis-entrypoint.sh:ro', 'production Redis must use the audited host-safety entrypoint')
}

requireText('deploy/scripts/redis-entrypoint.sh', '/proc/sys/vm/overcommit_memory', 'Redis startup must inspect the host overcommit setting')
requireText('deploy/scripts/redis-entrypoint.sh', '[ "$OVERCOMMIT_VALUE" != "1" ]', 'Redis startup must fail closed unless vm.overcommit_memory=1')
requireText('deploy/scripts/redis-entrypoint.sh', 'exit 1', 'unsafe Redis host settings must stop the container instead of logging and continuing')
requireText('deploy/scripts/redis-entrypoint.sh', '/sys/kernel/mm/transparent_hugepage/enabled', 'Redis startup should surface unsafe Transparent Huge Pages host tuning')

requireText('apps/api/src/common/redis/redis.service.ts', "getConfigValue('maxmemory-policy')", 'runtime must inspect Redis eviction policy')
requireText('apps/api/src/common/redis/redis.service.ts', "getConfigValue('appendonly')", 'runtime must inspect AOF enablement')
requireText('apps/api/src/common/redis/redis.service.ts', "getConfigValue('appendfsync')", 'runtime must inspect AOF fsync policy')
requireText('apps/api/src/health/health.controller.ts', 'getRuntimeSafetyConfig()', 'production health must validate actual Redis safety config')
requireText('apps/api/src/health/health.controller.ts', "safety.maxmemoryPolicy === 'noeviction'", 'health must fail closed when Redis can evict correctness keys')
requireText('apps/api/src/health/health.controller.ts', "safety.appendonly === 'yes'", 'health must require Redis AOF persistence')
requireText('apps/api/src/health/health.controller.ts', "safety.appendfsync === 'everysec'", 'health must require the audited AOF fsync policy')

if (failures.length) {
  console.error('[redis-safety-audit] FAIL')
  for (const failure of failures) console.error(`  - ${failure}`)
  process.exit(1)
}
console.log('[redis-safety-audit] PASS')
