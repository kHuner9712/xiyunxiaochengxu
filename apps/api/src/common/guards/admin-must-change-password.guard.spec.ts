import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AdminMustChangePasswordGuard } from './admin-must-change-password.guard';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { SKIP_MUST_CHANGE_PASSWORD_KEY } from '../decorators/skip-must-change-password.decorator';

function createMockContext(user: any, url: string) {
  const request = { url, user };
  return {
    switchToHttp: () => ({ getRequest: () => request }),
    getHandler: () => jest.fn(),
    getClass: () => jest.fn(),
  } as any;
}

function setupReflector(reflector: Reflector, isPublic: boolean, skipMustChangePassword: boolean) {
  (reflector.getAllAndOverride as any).mockImplementation((key: any) => {
    if (key === IS_PUBLIC_KEY) return isPublic;
    if (key === SKIP_MUST_CHANGE_PASSWORD_KEY) return skipMustChangePassword;
    return undefined;
  });
}

describe('AdminMustChangePasswordGuard', () => {
  let guard: AdminMustChangePasswordGuard;
  let reflector: any;
  let prisma: any;

  beforeEach(() => {
    reflector = { getAllAndOverride: jest.fn() };
    prisma = {
      adminUser: {
        findFirst: jest.fn(),
      },
    };
    guard = new AdminMustChangePasswordGuard(reflector, prisma);
  });

  it('mustChangePassword=true 的管理员访问非白名单接口抛出 ForbiddenException', async () => {
    setupReflector(reflector, false, false);
    prisma.adminUser.findFirst.mockResolvedValue({ mustChangePassword: true });

    const ctx = createMockContext(
      { id: '1', roleType: 'admin' },
      '/api/admin/order/list',
    );

    await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
    await expect(guard.canActivate(ctx)).rejects.toThrow('请先修改初始密码');
  });

  it('mustChangePassword=true 的管理员访问白名单接口正常通过', async () => {
    setupReflector(reflector, false, true);

    const ctx = createMockContext(
      { id: '1', roleType: 'admin' },
      '/api/admin/auth/info',
    );

    const result = await guard.canActivate(ctx);
    expect(result).toBe(true);
  });

  it('小程序用户不受影响', async () => {
    setupReflector(reflector, false, false);

    const ctx = createMockContext(
      { id: '1', roleType: 'user' },
      '/api/weapp/order/list',
    );

    const result = await guard.canActivate(ctx);
    expect(result).toBe(true);
  });

  it('mustChangePassword=false 的管理员不受影响', async () => {
    setupReflector(reflector, false, false);
    prisma.adminUser.findFirst.mockResolvedValue({ mustChangePassword: false });

    const ctx = createMockContext(
      { id: '1', roleType: 'admin' },
      '/api/admin/order/list',
    );

    const result = await guard.canActivate(ctx);
    expect(result).toBe(true);
  });

  it('@Public() 接口不受影响', async () => {
    setupReflector(reflector, true, false);

    const ctx = createMockContext(
      { id: '1', roleType: 'admin' },
      '/api/admin/auth/login',
    );

    const result = await guard.canActivate(ctx);
    expect(result).toBe(true);
  });

  it('改密后可正常访问（mustChangePassword=false 后 guard 放行）', async () => {
    setupReflector(reflector, false, false);
    prisma.adminUser.findFirst.mockResolvedValue({ mustChangePassword: false });

    const ctx = createMockContext(
      { id: '1', roleType: 'admin' },
      '/api/admin/order/list',
    );

    const result = await guard.canActivate(ctx);
    expect(result).toBe(true);
  });

  it('无 user 对象时放行', async () => {
    setupReflector(reflector, false, false);

    const ctx = createMockContext(null, '/api/admin/auth/info');

    const result = await guard.canActivate(ctx);
    expect(result).toBe(true);
  });

  it('非 /api/admin/ 路径放行', async () => {
    setupReflector(reflector, false, false);

    const ctx = createMockContext(
      { id: '1', roleType: 'admin' },
      '/api/common/health',
    );

    const result = await guard.canActivate(ctx);
    expect(result).toBe(true);
  });
});
