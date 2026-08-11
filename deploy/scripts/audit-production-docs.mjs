import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const failures = []
const read = (file) => readFileSync(resolve(root, file), 'utf8')
const docs = {
  runbook: read('docs/DEPLOYMENT_RUNBOOK.md'),
  checklist: read('docs/DEPLOYMENT_CHECKLIST.md'),
  env: read('docs/ENV_PRODUCTION_FILL_GUIDE.md'),
}

const requireText = (name, source, text, message) => {
  if (!source.includes(text)) failures.push(`${name}: ${message}`)
}
const forbid = (name, source, pattern, message) => {
  if (pattern.test(source)) failures.push(`${name}: ${message}`)
}

for (const [name, source] of Object.entries(docs)) {
  forbid(name, source, /62\.234\.69\.19/, 'historical server IP must not be part of production instructions')
  forbid(name, source, /deploy\/nginx\/ssl\/fullchain\.pem/, 'legacy single-domain TLS path is forbidden')
  forbid(name, source, /deploy\/nginx\/ssl\/privkey\.pem/, 'legacy single-domain TLS key path is forbidden')
  forbid(name, source, /docker-compose\b/, 'Docker Compose v1 command is forbidden')
  forbid(name, source, /package\.json[^\n]*>=18/, 'obsolete Node engine guidance is forbidden')
}

for (const [name, source] of Object.entries({ runbook: docs.runbook, checklist: docs.checklist, env: docs.env })) {
  requireText(name, source, 'deploy/scripts/deploy-production.sh', 'must name the canonical production deployment implementation')
  requireText(name, source, 'EXPECTED_DEPLOY_SHA', 'must require an explicitly approved deployment SHA')
  requireText(name, source, 'deploy/nginx/ssl/api/fullchain.pem', 'must document the API TLS certificate path')
  requireText(name, source, 'deploy/nginx/ssl/admin/fullchain.pem', 'must document the Admin TLS certificate path')
}

forbid('runbook', docs.runbook, /\(cd deploy &&[^\n]*docker compose[^\n]*up -d/, 'must not instruct operators to bypass the audited deployment flow')
forbid('runbook', docs.runbook, /docker compose down && docker compose up -d/, 'unsafe compose-only rollback instruction is forbidden')
forbid('checklist', docs.checklist, /docker compose --env-file[^\n]*up -d --build/, 'must not instruct direct production Compose startup')
forbid('checklist', docs.checklist, /^\s*-\s*`RUN_SEED=true`/m, 'must not require manual fresh-production seeding')

const fakeEnvAssignment = /^(?:\|\s*`?)?(SSL_FULLCHAIN_PATH|SSL_PRIVKEY_PATH|STORAGE_PROVIDER|STORAGE_PRIVATE_ASSET_POLICY|ORDER_AUTO_CLOSE_MINUTES|ORDER_AUTO_COMPLETE_DAYS|FREIGHT_FREE_AMOUNT|FREIGHT_DEFAULT_FEE|FREIGHT_REMOTE_FEE|POINTS_DEDUCT_RATE|POINTS_DEDUCT_MAX_PERCENT)(?:`?\s*\||\s*=)/m
forbid('env', docs.env, fakeEnvAssignment, 'non-runtime fields must not be presented as production env assignments/table fields')

requireText('runbook', docs.runbook, 'deploy/scripts/backup.sh', 'must document the audited consistency backup entrypoint')
requireText('runbook', docs.runbook, 'deploy/scripts/restore.sh', 'must document the complete restore entrypoint')
requireText('checklist', docs.checklist, 'deploy/scripts/backup.sh', 'must include backup acceptance')
requireText('checklist', docs.checklist, 'deploy/scripts/restore.sh', 'must include restore acceptance')
requireText('env', docs.env, 'system_configs', 'must document the database business-config source of truth')

if (failures.length) {
  console.error('[production-docs-audit] FAIL')
  for (const failure of failures) console.error(`  - ${failure}`)
  process.exit(1)
}
console.log('[production-docs-audit] PASS')
