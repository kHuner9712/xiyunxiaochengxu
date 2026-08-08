import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('coupon migration privileges', () => {
  it('keeps used-count reconciliation compatible with a non-SUPER production database user', () => {
    const migration = readFileSync(
      resolve(process.cwd(), 'prisma/migrations/20260808021500_track_coupon_used_count/migration.sql'),
      'utf8',
    );

    expect(migration).toMatch(/UPDATE\s+`coupons`/i);
    expect(migration).toMatch(/WHERE\s+`status`\s*=\s*3/i);
    expect(migration).not.toMatch(/CREATE\s+TRIGGER/i);
    expect(migration).not.toMatch(/CREATE\s+(?:DEFINER|PROCEDURE|FUNCTION|EVENT)/i);
  });
});
