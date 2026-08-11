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
assert.match(backup, /cd "\$BACKUP_DIR"[\s\S]*sha256sum "\$DB_BASENAME" "\$UPLOAD_BASENAME"/);
assert.doesNotMatch(backup, /sha256sum "\$DB_FILE" "\$UPLOAD_FILE"/);

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
assert.match(restore, /127\.0\.0\.1:3000\/health/);
assert.match(restore, /ENV_FILE="\$ENV_FILE" bash "\$SCRIPT_DIR\/smoke-runtime\.sh"/);
assert.match(restore, /"\$\{COMPOSE\[@\]\}" stop nginx/);
assert.match(restore, /完整 runtime smoke 已通过/);

const apiStart = restore.indexOf('up -d api');
const health = restore.indexOf('127.0.0.1:3000/health');
const nginxStart = restore.indexOf('up -d nginx');
const smoke = restore.indexOf('smoke-runtime.sh');
const success = restore.indexOf('完整 runtime smoke 已通过');
assert.ok(apiStart >= 0 && health > apiStart && nginxStart > health, 'Nginx must reopen only after restored API health succeeds');
assert.ok(smoke > nginxStart && success > smoke, 'Restore must declare success only after the full runtime smoke passes');
assert.match(restore, /恢复失败且公网保持关闭/);

console.log('[audit-production-entrypoints] PASS');
