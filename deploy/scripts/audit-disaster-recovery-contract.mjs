import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const failures = []
const read = (file) => readFileSync(resolve(root, file), 'utf8')
const expectText = (file, text, message) => {
  if (!read(file).includes(text)) failures.push(`${file}: ${message}`)
}
const rejectText = (file, text, message) => {
  if (read(file).includes(text)) failures.push(`${file}: ${message}`)
}
const expectBefore = (file, first, second, message) => {
  const source = read(file)
  const a = source.indexOf(first)
  const b = source.indexOf(second)
  if (a < 0 || b < 0 || a >= b) failures.push(`${file}: ${message}`)
}

for (const legacy of ['deploy/scripts/deploy.sh', 'deploy/scripts/deploy-prod-check.sh']) {
  expectText(legacy, 'exec bash "$SCRIPT_DIR/deploy-production.sh" "$@"', 'legacy production entrypoint must delegate to deploy-production.sh')
  rejectText(legacy, 'git merge --ff-only', 'legacy production entrypoint must not implement an independent deployment flow')
  rejectText(legacy, 'prisma migrate deploy', 'legacy production entrypoint must not run migrations independently')
}

expectText('deploy/scripts/backup.sh', '.env.production', 'backup must load the production env contract')
expectText('deploy/scripts/backup.sh', 'stop -t 10 nginx', 'backup must quiesce public traffic before snapshotting')
expectText('deploy/scripts/backup.sh', 'stop -t 30 api', 'backup must stop API/background writers before snapshotting')
expectBefore('deploy/scripts/backup.sh', 'stop -t 30 api', 'mysqldump', 'API writers must stop before the database snapshot starts')
expectBefore('deploy/scripts/backup.sh', 'stop -t 30 api', 'tar -czf - .', 'API writers must stop before the uploads snapshot starts')
expectText('deploy/scripts/backup.sh', 'uploads_${TIMESTAMP}.tar.gz', 'backup must include uploads in the same timestamped set')
expectText('deploy/scripts/backup.sh', 'checksums_${TIMESTAMP}.sha256', 'backup must emit a checksum manifest')
expectText('deploy/scripts/backup.sh', 'sha256sum "$(basename "$DB_FILE")" "$(basename "$UPLOAD_FILE")"', 'backup manifest must use portable relative filenames')

expectText('deploy/scripts/restore.sh', '.env.production', 'restore must load the production env contract')
expectText('deploy/scripts/restore.sh', 'uploads_${TIMESTAMP}.tar.gz', 'restore must require the matching uploads archive')
expectText('deploy/scripts/restore.sh', 'checksums_${TIMESTAMP}.sha256', 'restore must require the matching checksum manifest')
expectText('deploy/scripts/restore.sh', 'verify_manifest_file "$DB_FILE"', 'restore must verify the database archive checksum')
expectText('deploy/scripts/restore.sh', 'verify_manifest_file "$UPLOAD_FILE"', 'restore must verify the uploads archive checksum')
expectText('deploy/scripts/restore.sh', 'DROP DATABASE IF EXISTS', 'restore must rebuild the target database rather than overlay stale rows')
expectText('deploy/scripts/restore.sh', 'find /app/apps/api/uploads -mindepth 1', 'restore must clear stale upload files before extraction')
expectText('deploy/scripts/restore.sh', 'tar -xzf - -C /app/apps/api/uploads', 'restore must restore the matching uploads archive')
expectText('deploy/scripts/restore.sh', 'npx prisma migrate deploy', 'restored data must migrate to the current code schema')
expectText('deploy/scripts/restore.sh', 'bash "$SCRIPT_DIR/smoke-runtime.sh"', 'restore must pass the full runtime smoke before success')
expectText('deploy/scripts/restore.sh', 'stop nginx', 'failed post-restore smoke must close public traffic')
expectText('deploy/scripts/restore.sh', 'pre_restore_db_', 'restore must preserve a rescue snapshot before destructive changes when possible')
rejectText('deploy/scripts/restore.sh', 'baby_mall_2024', 'hard-coded legacy database password is forbidden')
rejectText('deploy/scripts/restore.sh', 'docker-compose', 'legacy docker-compose v1 invocation is forbidden')

if (failures.length) {
  console.error('[disaster-recovery-contract-audit] FAIL')
  for (const failure of failures) console.error(`  - ${failure}`)
  process.exit(1)
}

console.log('[disaster-recovery-contract-audit] PASS')
