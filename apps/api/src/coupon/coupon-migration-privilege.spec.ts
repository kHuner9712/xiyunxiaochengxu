import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

function executableSql(sql: string) {
  return sql
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/--.*$/gm, '');
}

describe('coupon migration privileges', () => {
  it('keeps used-count reconciliation compatible with a non-SUPER production database user', () => {
    const migration = readFileSync(
      resolve(process.cwd(), 'prisma/migrations/20260808021500_track_coupon_used_count/migration.sql'),
      'utf8',
    );
    const sql = executableSql(migration);

    expect(sql).toMatch(/UPDATE\s+`coupons`/i);
    expect(sql).toMatch(/WHERE\s+`status`\s*=\s*3/i);
    expect(sql).not.toMatch(/CREATE\s+TRIGGER/i);
    expect(sql).not.toMatch(/CREATE\s+(?:DEFINER|PROCEDURE|FUNCTION|EVENT)/i);
  });
});
