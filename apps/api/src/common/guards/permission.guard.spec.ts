import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PermissionGuard } from './permission.guard';
import { REQUIRE_PERMISSION_KEY } from '../decorators/require-permission.decorator';

describe('PermissionGuard', () => {
  let guard: PermissionGuard;
  let reflector: Reflector;
  let mockPrisma: any;

  beforeEach(() => {
    reflector = new Reflector();
    mockPrisma = {
      adminUserRole: { findMany: jest.fn() },
    };
    guard = new PermissionGuard(reflector, mockPrisma);
  });

  const createMockContext = (user: any = { id: '1', roleType: 'admin' }) => ({
    switchToHttp: () => ({
      getRequest: () => ({ user }),
    }),
    getHandler: () => jest.fn(),
    getClass: () => jest.fn(),
  });

  it('没有 @RequirePermission 装饰器时应放行', async () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);
    const context = createMockContext() as any;
    const result = await guard.canActivate(context);
    expect(result).toBe(true);
  });

  it('super_admin 角色应放行所有权限', async () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['system:config']);
    mockPrisma.adminUserRole.findMany.mockResolvedValue([
      { role: { code: 'super_admin', adminRolePermissions: [] } },
    ]);
    const context = createMockContext() as any;
    const result = await guard.canActivate(context);
    expect(result).toBe(true);
  });

  it('用户有所需权限时应放行', async () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['order:list']);
    mockPrisma.adminUserRole.findMany.mockResolvedValue([
      {
        role: {
          code: 'order_manager',
          adminRolePermissions: [{ permission: { code: 'order:list' } }],
        },
      },
    ]);
    const context = createMockContext() as any;
    const result = await guard.canActivate(context);
    expect(result).toBe(true);
  });

  it('用户没有所需权限时应抛出 ForbiddenException', async () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['order:list']);
    mockPrisma.adminUserRole.findMany.mockResolvedValue([
      {
        role: {
          code: 'product_manager',
          adminRolePermissions: [{ permission: { code: 'product:list' } }],
        },
      },
    ]);
    const context = createMockContext() as any;
    await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
  });

  it('多个权限要求中有一个匹配即放行', async () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['order:refund', 'order:aftersale:refund']);
    mockPrisma.adminUserRole.findMany.mockResolvedValue([
      {
        role: {
          code: 'aftersale_manager',
          adminRolePermissions: [{ permission: { code: 'order:aftersale:refund' } }],
        },
      },
    ]);
    const context = createMockContext() as any;
    const result = await guard.canActivate(context);
    expect(result).toBe(true);
  });

  it('业务事件权限 system:log 未授权时应拒绝', async () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['system:log']);
    mockPrisma.adminUserRole.findMany.mockResolvedValue([
      {
        role: {
          code: 'order_manager',
          adminRolePermissions: [{ permission: { code: 'order:list' } }],
        },
      },
    ]);
    const context = createMockContext() as any;
    await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
  });

  it('对账权限 system:config 未授权时应拒绝', async () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['system:config']);
    mockPrisma.adminUserRole.findMany.mockResolvedValue([
      {
        role: {
          code: 'order_manager',
          adminRolePermissions: [{ permission: { code: 'order:list' } }],
        },
      },
    ]);
    const context = createMockContext() as any;
    await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
  });

  it('退款确认权限 order:aftersale:refund 未授权时应拒绝', async () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['order:aftersale:refund']);
    mockPrisma.adminUserRole.findMany.mockResolvedValue([
      {
        role: {
          code: 'order_manager',
          adminRolePermissions: [{ permission: { code: 'order:list' } }],
        },
      },
    ]);
    const context = createMockContext() as any;
    await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
  });

  it('文件上传权限 system:file 未授权时应拒绝', async () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['system:file']);
    mockPrisma.adminUserRole.findMany.mockResolvedValue([
      {
        role: {
          code: 'order_manager',
          adminRolePermissions: [{ permission: { code: 'order:list' } }],
        },
      },
    ]);
    const context = createMockContext() as any;
    await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
  });

  it('非 admin 角色应直接拒绝', async () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['order:list']);
    const context = createMockContext({ id: '1', roleType: 'user' }) as any;
    await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
  });

  it('无 user 信息应直接拒绝', async () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['order:list']);
    const context = createMockContext(null) as any;
    await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
  });
});
