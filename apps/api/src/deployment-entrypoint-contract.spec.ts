import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('production migration entrypoint contract', () => {
  const readEntrypoint = () => readFileSync(
    resolve(__dirname, '../../../deploy/scripts/entrypoint.sh'),
    'utf8',
  );

  it('always removes the shared scheduler pause marker after one-off migrations', () => {
    const entrypoint = readEntrypoint();

    expect(entrypoint).toContain('pause_marker="$pause_dir/.scheduler-paused"');
    expect(entrypoint).toContain('cleanup_scheduler_pause()');
    expect(entrypoint).toContain('rm -f "$pause_marker"');
    expect(entrypoint).toContain('trap cleanup_scheduler_pause EXIT HUP INT TERM');

    const migrationBranch = entrypoint.indexOf('[ "${1:-}" = "npx" ]');
    const cleanup = entrypoint.indexOf('trap cleanup_scheduler_pause EXIT HUP INT TERM');
    const migrationRun = entrypoint.indexOf('"$@"', cleanup);
    const generalExec = entrypoint.lastIndexOf('exec "$@"');

    expect(migrationBranch).toBeGreaterThanOrEqual(0);
    expect(cleanup).toBeGreaterThan(migrationBranch);
    expect(migrationRun).toBeGreaterThan(cleanup);
    expect(generalExec).toBeGreaterThan(migrationRun);
  });

  it('automatically seeds only a truly fresh production database', () => {
    const entrypoint = readEntrypoint();

    expect(entrypoint).toContain('const count = await prisma.adminUser.count()');
    expect(entrypoint).toContain('if [ "$admin_count" = "0" ]; then');
    expect(entrypoint).toContain('检测到全新生产数据库（admin_users=0）');
    expect(entrypoint).toContain('elif [ "$RUN_SEED" = "true" ]; then');
    expect(entrypoint).toContain('检测到已有管理员账号（admin_users=$admin_count），跳过自动 seed');
    expect(entrypoint).toContain('npx prisma db seed');

    const migrationIndex = entrypoint.indexOf('npx prisma migrate deploy');
    const countIndex = entrypoint.indexOf('const count = await prisma.adminUser.count()');
    const freshSeedIndex = entrypoint.indexOf('if [ "$admin_count" = "0" ]; then');
    const startIndex = entrypoint.lastIndexOf('exec node dist/main.js');

    expect(migrationIndex).toBeGreaterThanOrEqual(0);
    expect(countIndex).toBeGreaterThan(migrationIndex);
    expect(freshSeedIndex).toBeGreaterThan(countIndex);
    expect(startIndex).toBeGreaterThan(freshSeedIndex);
  });

  it('makes a fresh production customer-service config smoke-compatible without fake phone data', () => {
    const entrypoint = readEntrypoint();

    expect(entrypoint).toContain('finalize_fresh_production_seed()');
    expect(entrypoint).toContain("configKey: 'type'");
    expect(entrypoint).toContain("configValue: 'wechat'");
    expect(entrypoint).toContain("configKey: 'enabled'");
    expect(entrypoint).toContain("configValue: 'true'");

    const freshSeedBranch = entrypoint.indexOf('if [ "$admin_count" = "0" ]; then');
    const runSeedIndex = entrypoint.indexOf('run_seed', freshSeedBranch);
    const finalizeIndex = entrypoint.indexOf('finalize_fresh_production_seed', runSeedIndex);
    const explicitSeedBranch = entrypoint.indexOf('elif [ "$RUN_SEED" = "true" ]; then');

    expect(freshSeedBranch).toBeGreaterThanOrEqual(0);
    expect(runSeedIndex).toBeGreaterThan(freshSeedBranch);
    expect(finalizeIndex).toBeGreaterThan(runSeedIndex);
    expect(explicitSeedBranch).toBeGreaterThan(finalizeIndex);
  });
});