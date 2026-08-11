import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(__dirname, '../../../..');

function read(relativePath: string): string {
  return fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');
}

describe('user production runtime wiring', () => {
  it('uses the session-revoking user service in the real module', () => {
    const userModule = read('apps/api/src/user/user.module.ts');
    const productionUserService = read('apps/api/src/user/production-user.service.ts');

    expect(userModule).toContain("import { ProductionUserService } from './production-user.service'");
    expect(userModule).toContain('provide: UserService');
    expect(userModule).toContain('useClass: ProductionUserService');
    expect(productionUserService).toContain('weapp_access_token:${userId.toString()}:*');
    expect(productionUserService).toContain('wechat_session:${userId.toString()}');
  });
});
