#!/usr/bin/env node
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('../..', import.meta.url)));
const read = (path) => readFileSync(resolve(root, path), 'utf8');

const runbook = read('docs/DEPLOYMENT_RUNBOOK.md');
const checklist = read('docs/DEPLOYMENT_CHECKLIST.md');
const envGuide = read('docs/ENV_PRODUCTION_FILL_GUIDE.md');
const docs = `${runbook}\n${checklist}\n${envGuide}`;

for (const source of [runbook, checklist]) {
  assert.match(source, /EXPECTED_DEPLOY_SHA/);
  assert.match(source, /deploy\/scripts\/deploy-production\.sh/);
  assert.match(source, /deploy\/scripts\/restore\.sh/);
  assert.match(source, /deploy\/nginx\/ssl\/api\/fullchain\.pem/);
  assert.match(source, /deploy\/nginx\/ssl\/admin\/fullchain\.pem/);
}

assert.match(runbook, /Node\.js `22\.13\.0`/);
assert.match(runbook, /Production Container Bootstrap/);
assert.match(checklist, /Production Container Bootstrap/);
assert.match(envGuide, /UPLOAD_MAX_SIZE=52428800/);
assert.match(envGuide, /system_configs/);
assert.match(envGuide, /不要直接 `docker compose up`/);

for (const stale of [
  'deploy/nginx/ssl/fullchain.pem',
  'deploy/nginx/ssl/privkey.pem',
  'v24.15.0',
  '62.234.69.19',
]) {
  assert.ok(!docs.includes(stale), `stale production documentation token is forbidden: ${stale}`);
}

// Business pricing/timeouts are database-backed runtime configuration. Documentation may name
// these keys only to explicitly say they are not environment overrides; active KEY=value examples
// would again mislead operators.
for (const key of [
  'ORDER_AUTO_CLOSE_MINUTES',
  'ORDER_AUTO_COMPLETE_DAYS',
  'FREIGHT_FREE_AMOUNT',
  'FREIGHT_DEFAULT_FEE',
  'FREIGHT_REMOTE_FEE',
  'POINTS_DEDUCT_RATE',
  'POINTS_DEDUCT_MAX_PERCENT',
]) {
  assert.doesNotMatch(docs, new RegExp(`^\\s*${key}=`, 'm'));
}

// The obsolete direct-deploy snippets were executable instructions that bypassed release identity,
// preflight and backup-clone migration verification. Keep them out of operational docs.
assert.doesNotMatch(runbook, /\(cd deploy &&[^\n]*docker compose[^\n]*up -d/);
assert.doesNotMatch(checklist, /- `cd deploy && docker compose[^`]*up -d/);
assert.doesNotMatch(checklist, /RUN_SEED=true.*启动 API/);

console.log('[audit-production-docs] PASS');
