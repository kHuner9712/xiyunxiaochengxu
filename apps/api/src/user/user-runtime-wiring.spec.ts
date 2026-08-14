import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(__dirname, '../../../..');

function read(relativePath: string): string {
  return fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');
}

describe('user production runtime wiring', () => {
  it('uses one session-revoking production user service instance for runtime user operations', () => {
    const userModule = read('apps/api/src/user/user.module.ts');
    const userController = read('apps/api/src/user/user.controller.ts');
    const productionUserService = read('apps/api/src/user/production-user.service.ts');

    expect(userModule).toContain("import { ProductionUserService } from './production-user.service'");
    expect(userModule).toContain('ProductionUserService,');
    expect(userModule).toContain('provide: UserService');
    expect(userModule).toContain('useExisting: ProductionUserService');
    expect(userController).toContain('constructor(private readonly userService: ProductionUserService)');
    expect(userController).toContain("@Delete('account')");
    expect(userController).toContain('this.userService.cancelAccount(userId)');
    expect(productionUserService).toContain('weapp_access_token:${userId.toString()}:*');
    expect(productionUserService).toContain('wechat_session:${userId.toString()}');
    expect(productionUserService).toContain('async cancelAccount(id: string)');
    expect(productionUserService).toContain('openid: tombstoneOpenid');
  });
});
