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
requirePattern(myCnf, /^innodb_flush_log_at_trx_commit\s*=\s*1\s*$/m, 'deploy/mysql/my.cnf: innodb_flush_log_at_trx_commit must remain 1 for durable acknowledged commits')
requirePattern(myCnf, /^character-set-server\s*=\s*utf8mb4\s*$/m, 'deploy/mysql/my.cnf: character-set-server must remain utf8mb4')
requirePattern(myCnf, /^collation-server\s*=\s*utf8mb4_unicode_ci\s*$/m, 'deploy/mysql/my.cnf: collation-server must remain utf8mb4_unicode_ci')
requirePattern(myCnf, /^default-time-zone\s*=\s*['"]?\+08:00['"]?\s*$/m, 'deploy/mysql/my.cnf: default-time-zone must remain +08:00')

const appUserHealthcheck = read('deploy/scripts/mysql-app-user-healthcheck.sh')
requirePattern(appUserHealthcheck, /final mysqld is not PID 1 yet/, 'mysql app-user healthcheck must not mutate grants during the official image temporary-init server')
requirePattern(appUserHealthcheck, /MYSQL_USER" != root/, 'mysql app-user healthcheck must reject root as the application account')
requirePattern(appUserHealthcheck, /MYSQL_ROOT_PASSWORD" != "\$MYSQL_PASSWORD/, 'mysql root and application passwords must be distinct')
requirePattern(appUserHealthcheck, /REVOKE ALL PRIVILEGES, GRANT OPTION/, 'mysql app-user healthcheck must normalize away stale/global grants')
requirePattern(appUserHealthcheck, /GRANT ALL PRIVILEGES ON \\`\$\{MYSQL_DATABASE\}\\`\.\*/, 'mysql app-user healthcheck must grant privileges only on the configured business database')
requirePattern(appUserHealthcheck, /SELECT COUNT\(\*\) FROM mysql\.user/, 'mysql app-user healthcheck must verify that the application account cannot read mysql.user')

const apiEntrypoint = read('deploy/scripts/entrypoint.sh')
requirePattern(apiEntrypoint, /API 禁止使用 MySQL root 账号/, 'production API entrypoint must fail closed when DB_USER=root')

const productionEnvExample = read('.env.production.example')
requirePattern(productionEnvExample, /^DB_ROOT_PASSWORD=/m, '.env.production.example must expose a separate MySQL root credential')
requirePattern(productionEnvExample, /^DB_USER=baby_mall_app$/m, '.env.production.example must default the API to baby_mall_app')
requirePattern(productionEnvExample, /^DB_PASSWORD=/m, '.env.production.example must expose a separate application DB credential')
requirePattern(productionEnvExample, /^DATABASE_URL=mysql:\/\/baby_mall_app:/m, '.env.production.example DATABASE_URL must use the application DB account')
if (/^DB_USER=root$/m.test(productionEnvExample)) failures.push('.env.production.example must never instruct production API to use MySQL root')

for (const file of ['deploy/docker-compose.yml', 'deploy/docker-compose.bt.yml']) {
  const compose = read(file)
  if (!compose.includes('image: mysql:8.0')) failures.push(`${file}: production MySQL image must remain pinned to mysql:8.0`)
  if (!compose.includes('./mysql/my.cnf:/etc/mysql/conf.d/my.cnf:ro')) failures.push(`${file}: audited MySQL config must be mounted read-only`)
  if (!compose.includes('mysql_data:/var/lib/mysql')) failures.push(`${file}: MySQL data must remain on the persistent mysql_data volume`)
  requirePattern(compose, /MYSQL_ROOT_PASSWORD: \$\{DB_ROOT_PASSWORD:\?DB_ROOT_PASSWORD required\}/, `${file}: MySQL root secret must come from dedicated DB_ROOT_PASSWORD`)
  requirePattern(compose, /MYSQL_USER: \$\{DB_USER:-baby_mall_app\}/, `${file}: MySQL must create/use the dedicated application account`)
  requirePattern(compose, /MYSQL_PASSWORD: \$\{DB_PASSWORD:\?DB_PASSWORD required\}/, `${file}: MySQL application password must be separate from the root secret`)
  requirePattern(compose, /\.\/scripts\/mysql-app-user-healthcheck\.sh:\/usr\/local\/bin\/mysql-app-user-healthcheck\.sh:ro/, `${file}: least-privilege MySQL healthcheck must be mounted read-only`)
  requirePattern(compose, /test: \["CMD", "sh", "\/usr\/local\/bin\/mysql-app-user-healthcheck\.sh"\]/, `${file}: MySQL health must depend on application-account privilege normalization`)

  const apiStart = compose.indexOf('\n  api:')
  const nextService = file.endsWith('docker-compose.yml') ? compose.indexOf('\n  nginx:', apiStart) : compose.indexOf('\nvolumes:', apiStart)
  const apiBlock = apiStart >= 0 ? compose.slice(apiStart, nextService > apiStart ? nextService : undefined) : ''
  if (!apiBlock) failures.push(`${file}: API service block could not be parsed for DB credential audit`)
  if (apiBlock.includes('DB_ROOT_PASSWORD')) failures.push(`${file}: API service must never receive DB_ROOT_PASSWORD`)
  requirePattern(apiBlock, /DB_USER: \$\{DB_USER:-baby_mall_app\}/, `${file}: API runtime must use the dedicated application DB account`)
}

if (failures.length) {
  console.error('[mysql-safety-audit] FAIL')
  for (const failure of failures) console.error(`  - ${failure}`)
  process.exit(1)
}

console.log('[mysql-safety-audit] PASS')
