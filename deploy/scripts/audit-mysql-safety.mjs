import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const failures = []

function read(file) {
  return readFileSync(join(root, file), 'utf8')
}

function requirePattern(source, pattern, message) {
  if (!pattern.test(source)) failures.push(message)
}

const myCnf = read('deploy/mysql/my.cnf')
requirePattern(
  myCnf,
  /^innodb_flush_log_at_trx_commit\s*=\s*1\s*$/m,
  'deploy/mysql/my.cnf: innodb_flush_log_at_trx_commit must remain 1 for durable acknowledged commits',
)
requirePattern(
  myCnf,
  /^character-set-server\s*=\s*utf8mb4\s*$/m,
  'deploy/mysql/my.cnf: character-set-server must remain utf8mb4',
)
requirePattern(
  myCnf,
  /^collation-server\s*=\s*utf8mb4_unicode_ci\s*$/m,
  'deploy/mysql/my.cnf: collation-server must remain utf8mb4_unicode_ci',
)
requirePattern(
  myCnf,
  /^default-time-zone\s*=\s*['"]?\+08:00['"]?\s*$/m,
  'deploy/mysql/my.cnf: default-time-zone must remain +08:00',
)

for (const file of ['deploy/docker-compose.yml', 'deploy/docker-compose.bt.yml']) {
  const compose = read(file)
  if (!compose.includes('image: mysql:8.0')) {
    failures.push(`${file}: production MySQL image must remain pinned to mysql:8.0`)
  }
  if (!compose.includes('./mysql/my.cnf:/etc/mysql/conf.d/my.cnf:ro')) {
    failures.push(`${file}: audited MySQL config must be mounted read-only`)
  }
  if (!compose.includes('mysql_data:/var/lib/mysql')) {
    failures.push(`${file}: MySQL data must remain on the persistent mysql_data volume`)
  }
}

if (failures.length) {
  console.error('[mysql-safety-audit] FAIL')
  for (const failure of failures) console.error(`  - ${failure}`)
  process.exit(1)
}

console.log('[mysql-safety-audit] PASS')
