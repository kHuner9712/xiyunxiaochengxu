#!/usr/bin/env node
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('../..', import.meta.url)));
const read = (file) => readFileSync(resolve(root, file), 'utf8');

const readme = read('README.md');
const goLive = read('GO_LIVE.md');
const legacyServerCommands = read('docs/SERVER_DEPLOY_COMMANDS.md');

assert.match(readme, /Node\.js `>=22\.13\.0 <25`/);
assert.match(readme, /pnpm deploy:prod/);
assert.match(readme, /DEPLOYMENT_RUNBOOK\.md/);
assert.doesNotMatch(readme, /deploy-prod-check\.sh/);
assert.doesNotMatch(readme, /Node\.js >= 18/);

for (const workflow of [
  'CI',
  'Release Gate Check',
  'API Unit Diagnostic',
  'API E2E Diagnostic',
  'API Open Handle Diagnostic',
  'Production Container Bootstrap',
]) {
  assert.ok(goLive.includes(workflow), `GO_LIVE missing exact-head workflow gate: ${workflow}`);
}
assert.match(goLive, /正式公开上线保持 \*\*No-Go\*\*/);
assert.doesNotMatch(goLive, /PR #\d+/);
assert.doesNotMatch(goLive, /负责人已确认/);

assert.match(legacyServerCommands, /已停用/);
assert.match(legacyServerCommands, /deploy-production\.sh/);
assert.doesNotMatch(legacyServerCommands, /prisma\s+migrate\s+deploy/);
assert.doesNotMatch(legacyServerCommands, /docker\s+compose[^\n]*up\s+-d/);
assert.doesNotMatch(legacyServerCommands, /deploy-prod-check\.sh/);
assert.doesNotMatch(legacyServerCommands, /deploy\/nginx\/ssl\/fullchain\.pem/);

console.log('[audit-release-document-entrypoints] PASS');
