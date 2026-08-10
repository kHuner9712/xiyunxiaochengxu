import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('production migration entrypoint contract', () => {
  it('always removes the shared scheduler pause marker after one-off migrations', () => {
    const entrypoint = readFileSync(
      resolve(__dirname, '../../../deploy/scripts/entrypoint.sh'),
      'utf8',
    );

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
});