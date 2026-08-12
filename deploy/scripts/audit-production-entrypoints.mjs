#!/usr/bin/env node
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('../..', import.meta.url)));
const read = (path) => readFileSync(resolve(root, path), 'utf8');

const legacyDeploy = read('deploy/scripts/deploy.sh');
const productionDeploy = read('deploy/scripts/deploy-production.sh');
const backup = read('deploy/scripts/backup.sh');
const restore = read('deploy/scripts/restore.sh');
const publicSmoke = read('deploy/scripts/smoke-public.sh');
const adminLoginSmoke = read('deploy/scripts/smoke-admin-login.sh');
const archivedDeploy = read('deploy/scripts/archive/deploy-preprod.sh');
const archivedSmoke = read('deploy/scripts/archive/smoke-preprod.sh');
const bootstrap = read('deploy/scripts/test-production-container-bootstrap.sh');
const bootstrapWorkflow = read('.github/workflows/production-container-bootstrap.yml');
const productionEnvExample = read('.env.production.example');

assert.match(legacyDeploy, /exec bash "\$SCRIPT_DIR\/deploy-production\.sh" "\$@"/);
assert.doesNotMatch(legacyDeploy, /git\s+(pull|merge|checkout)/);
assert.doesNotMatch(legacyDeploy, /prisma\s+migrate\s+deploy/);
assert.doesNotMatch(legacyDeploy, /docker\s+compose[^\n]*(up|restart)[^\n]*(api|nginx)/);

assert.match(productionDeploy, /EXPECTED_DEPLOY_SHA/);
assert.match(productionDeploy, /production-config-preflight/);
assert.match(productionDeploy, /smoke-runtime\.sh/);

assert.match(backup, /DB_BASENAME="db_\$\{TIMESTAMP\}\.sql\.gz"/);
assert.match(backup, /UPLOAD_BASENAME="uploads_\$\{TIMESTAMP\}\.tar\.gz"/);
assert.match(backup, /CHECKSUM_BASENAME="checksums_\$\{TIMESTAMP\}\.sha256"/);
assert.match(backup, /WRITERS_QUIESCED=true[\s\S]*stop nginx[\s\S]*stop api/);
assert.match(backup, /service_running api \|\| service_running nginx/);
assert.match(backup, /在无应用写入窗口备份 MySQL/);
assert.match(backup, /在同一无写入窗口备份 uploads/);
assert.match(backup, /SKIP_MIGRATE=true "\$\{COMPOSE\[@\]\}" up -d api/);
assert.match(backup, /127\.0\.0\.1:3000\/api\/health/);
assert.match(backup, /cd "\$BACKUP_DIR"[\s\S]*sha256sum "\$DB_BASENAME" "\$UPLOAD_BASENAME"/);
assert.doesNotMatch(backup, /sha256sum "\$DB_FILE" "\$UPLOAD_FILE"/);
const backupDb = backup.indexOf('在无应用写入窗口备份 MySQL');
const backupUploads = backup.indexOf('在同一无写入窗口备份 uploads');
const backupRestoreRuntime = backup.indexOf('恢复备份前生产运行状态');
assert.ok(backupDb >= 0 && backupUploads > backupDb && backupRestoreRuntime > backupUploads, 'DB and uploads must be captured while writers remain quiesced');

assert.match(restore, /ENV_FILE="\$\{ENV_FILE:-\$PROJECT_DIR\/\.env\.production\}"/);
assert.match(restore, /docker compose --env-file "\$ENV_FILE"/);
assert.match(restore, /UPLOAD_BASENAME="uploads_\$\{TIMESTAMP\}\.tar\.gz"/);
assert.match(restore, /CHECKSUM_BASENAME="checksums_\$\{TIMESTAMP\}\.sha256"/);
assert.match(restore, /gzip -t "\$DB_FILE"/);
assert.match(restore, /tar -tzf "\$UPLOAD_FILE"/);
assert.match(restore, /RESTORE_CONFIRM/);
assert.match(restore, /stop nginx api/);
assert.match(restore, /DROP DATABASE IF EXISTS/);
assert.match(restore, /gzip -dc "\$DB_FILE"[\s\S]*exec -T mysql/);
assert.match(restore, /gzip -dc "\$UPLOAD_FILE"[\s\S]*run --rm --no-deps -T --entrypoint sh api/);
assert.match(restore, /up -d api/);
assert.match(restore, /127\.0\.0\.1:3000\/api\/health/);
assert.doesNotMatch(restore, /127\.0\.0\.1:3000\/health/);
assert.match(restore, /ENV_FILE="\$ENV_FILE" bash "\$SCRIPT_DIR\/smoke-runtime\.sh"/);
assert.match(restore, /"\$\{COMPOSE\[@\]\}" stop nginx/);
assert.match(restore, /完整 runtime smoke 已通过/);

const apiStart = restore.indexOf('up -d api');
const health = restore.indexOf('127.0.0.1:3000/api/health');
const nginxStart = restore.indexOf('up -d nginx');
const smoke = restore.indexOf('smoke-runtime.sh');
const success = restore.indexOf('完整 runtime smoke 已通过');
assert.ok(apiStart >= 0 && health > apiStart && nginxStart > health, 'Nginx must reopen only after restored API health succeeds');
assert.ok(smoke > nginxStart && success > smoke, 'Restore must declare success only after the full runtime smoke passes');
assert.match(restore, /恢复失败且公网保持关闭/);

assert.match(publicSmoke, /exec bash "\$SCRIPT_DIR\/smoke-runtime\.sh" "\$@"/);
assert.doesNotMatch(publicSmoke, /curl\s+-k/);
assert.doesNotMatch(publicSmoke, /PAY_NOTIFY_URL/);

assert.match(adminLoginSmoke, /LOGIN_MODE="\$\{LOGIN_MODE:-manual\}"/);
assert.match(adminLoginSmoke, /production login smoke forbids captcha bypass/);
assert.match(adminLoginSmoke, /production login smoke must use https:\/\/api\.yunxixiaochengxu\.com\.cn/);
assert.match(adminLoginSmoke, /refresh token flow did not return a new accessToken/);
assert.doesNotMatch(adminLoginSmoke, /ADMIN_PASSWORD=.*admin123/);
assert.doesNotMatch(adminLoginSmoke, /ADMIN_USERNAME=.*:-admin/);
assert.doesNotMatch(adminLoginSmoke, /curl\s+-k/);

for (const archived of [archivedDeploy, archivedSmoke]) {
  assert.match(archived, /intentionally disabled/);
  assert.match(archived, /exit 64/);
  assert.doesNotMatch(archived, /git\s+(pull|merge|checkout)/);
  assert.doesNotMatch(archived, /prisma\s+migrate\s+deploy/);
  assert.doesNotMatch(archived, /docker\s+compose[^\n]*(down|up|restart)/);
  assert.doesNotMatch(archived, /curl\s+/);
}
assert.match(archivedDeploy, /deploy\/scripts\/deploy-production\.sh/);
assert.match(archivedSmoke, /deploy\/scripts\/smoke-runtime\.sh/);

assert.match(bootstrap, /BOOTSTRAP_DB="baby_mall_bootstrap"/);
assert.match(bootstrap, /docker image inspect "\$IMAGE_NAME"/);
assert.match(bootstrap, /NODE_ENV=production/);
assert.match(bootstrap, /SKIP_MIGRATE=false/);
assert.match(bootstrap, /RUN_SEED=false/);
assert.match(bootstrap, /检测到全新生产数据库/);
assert.match(bootstrap, /must_change_password/);
assert.match(bootstrap, /customer_service/);
assert.match(bootstrap, /_prisma_migrations/);
assert.match(bootstrapWorkflow, /Validate production shell entrypoints/);
assert.match(bootstrapWorkflow, /smoke-public\.sh/);
assert.match(bootstrapWorkflow, /smoke-admin-login\.sh/);
assert.match(bootstrapWorkflow, /archive\/deploy-preprod\.sh/);
assert.match(bootstrapWorkflow, /archive\/smoke-preprod\.sh/);
assert.match(bootstrapWorkflow, /Build production API image/);
assert.match(bootstrapWorkflow, /test-production-container-bootstrap\.sh baby-mall-api:bootstrap-ci/);

for (const key of [
  'ORDER_AUTO_CLOSE_MINUTES',
  'ORDER_AUTO_COMPLETE_DAYS',
  'FREIGHT_FREE_AMOUNT',
  'FREIGHT_DEFAULT_FEE',
  'FREIGHT_REMOTE_FEE',
  'POINTS_DEDUCT_RATE',
  'POINTS_DEDUCT_MAX_PERCENT',
]) {
  assert.doesNotMatch(productionEnvExample, new RegExp(`^${key}=`, 'm'));
}
assert.match(productionEnvExample, /由数据库 system_configs \+ 管理后台“系统配置”控制/);
assert.match(productionEnvExample, /金额型配置（如运费、包邮门槛）在数据库中使用“分”/);

console.log('[audit-production-entrypoints] PASS');
