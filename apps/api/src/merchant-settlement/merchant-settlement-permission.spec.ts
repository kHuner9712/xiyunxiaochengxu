import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(__dirname, '../../..');

function read(relativePath: string): string {
  return fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');
}

describe('merchant settlement financial permission', () => {
  it('keeps commission rule configuration with marketing but protects financial operations separately', () => {
    const controller = read('apps/api/src/merchant-settlement/merchant-settlement.controller.ts');
    expect(controller).toContain("const SETTLEMENT_PERMISSION = 'order:merchant-settlement'");
    expect(controller).toMatch(/@Post\('rule\/create'\)[\s\S]{0,120}@RequirePermission\('marketing:activity'\)/);
    expect(controller).toMatch(/@Put\('batches\/:id\/paid'\)[\s\S]{0,120}@RequirePermission\(SETTLEMENT_PERMISSION\)/);
    expect(controller).toMatch(/@Put\('records\/:id\/status'\)[\s\S]{0,120}@RequirePermission\(SETTLEMENT_PERMISSION\)/);
  });

  it('creates the permission for old databases and grants it to finance', () => {
    const migration = read(
      'apps/api/prisma/migrations/20260811143000_add_merchant_settlement_permission/migration.sql',
    );
    expect(migration).toContain("'order:merchant-settlement'");
    expect(migration).toContain("WHERE r.`code` = 'finance'");
    expect(migration).toContain('INSERT IGNORE INTO `admin_role_permissions`');
  });

  it('repairs fresh-install parent linkage and finance assignment after seed', () => {
    const helper = read('apps/api/prisma/default-role-permissions.ts');
    const postSeed = read('apps/api/prisma/seed-default-role-permissions.ts');
    expect(helper).toContain('ensureMerchantSettlementPermission');
    expect(helper).toContain("code: 'order:merchant-settlement'");
    expect(helper).toContain("code: 'finance'");
    expect(postSeed).toContain('ensureMerchantSettlementPermission(prisma)');
  });
});
