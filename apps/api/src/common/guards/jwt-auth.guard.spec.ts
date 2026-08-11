import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { ExecutionContext, UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';

describe('JwtAuthGuard', () => {
  let guard: JwtAuthGuard;
  let reflector: Reflector;
  let jwtService: JwtService;
  let prisma: any;
  let redisService: any;

  beforeEach(() => {
    reflector = new Reflector();
    jwtService = new JwtService({
      secret: 'test_jwt_secret_key_that_is_long_enough_32chars',
    });
    prisma = {
      adminUser: {
        findFirst: jest.fn<any>().mockResolvedValue({ id: 1n }),
      },
      user: {
        findFirst: jest.fn<any>().mockResolvedValue({ id: 1n }),
      },
    };
    redisService = {
      exists: jest.fn<any>().mockResolvedValue(true),
    };
    guard = new JwtAuthGuard(reflector, jwtService, prisma, redisService);
  });

  const createMockExecutionContext = (options: {
    url?: string;
    authorization?: string;
    getHandler?: () => any;
    getClass?: () => any;
  }): ExecutionContext => {
    const request = {
      url: options.url || '/api/admin/test',
      headers: {
        authorization: options.authorization,
      },
      user: null,
    };
    return {
      switchToHttp: () => ({
        getRequest: () => request,
      }),
      getHandler: () => options.getHandler || jest.fn(),
      getClass: () => options.getClass || jest.fn(),
    } as unknown as ExecutionContext;
  };

  describe('公共接口 (有 @Public 装饰器)', () => {
    it('有 @Public 装饰器的接口应该直接通过', async () => {
      const mockContext = createMockExecutionContext({ url: '/api/admin/auth/login' });
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValueOnce(true).mockReturnValueOnce(false);

      const result = await guard.canActivate(mockContext);
      expect(result).toBe(true);
      expect(prisma.adminUser.findFirst).not.toHaveBeenCalled();
    });
  });

  describe('JWT 验证', () => {
    it('没有 Authorization header 应该抛出 UnauthorizedException', async () => {
      const mockContext = createMockExecutionContext({
        url: '/api/admin/test',
        authorization: undefined,
      });
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);

      await expect(guard.canActivate(mockContext)).rejects.toThrow(UnauthorizedException);
    });

    it('无效的 token 格式应该抛出 UnauthorizedException', async () => {
      const mockContext = createMockExecutionContext({
        url: '/api/admin/test',
        authorization: 'InvalidToken',
      });
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);

      await expect(guard.canActivate(mockContext)).rejects.toThrow(UnauthorizedException);
    });

    it('过期的 token 应该抛出 UnauthorizedException', async () => {
      const expiredToken = await jwtService.signAsync(
        { id: '1', roleType: 'admin', tokenType: 'access', tokenId: 'expired-token' },
        { expiresIn: '-1s' },
      );

      const mockContext = createMockExecutionContext({
        url: '/api/admin/test',
        authorization: `Bearer ${expiredToken}`,
      });
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);

      await expect(guard.canActivate(mockContext)).rejects.toThrow(UnauthorizedException);
    });

    it('缺少 tokenType 的 token 应该被拒绝', async () => {
      const tokenWithoutType = await jwtService.signAsync({
        id: '1',
        roleType: 'admin',
        tokenId: 'test-token-id',
      });

      const mockContext = createMockExecutionContext({
        url: '/api/admin/test',
        authorization: `Bearer ${tokenWithoutType}`,
      });
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);

      await expect(guard.canActivate(mockContext)).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('实时账号与会话状态', () => {
    it('已停用管理员即使 JWT 尚未过期也应该立即失效', async () => {
      prisma.adminUser.findFirst.mockResolvedValue(null);
      const token = await jwtService.signAsync({
        id: '1',
        roleType: 'admin',
        tokenType: 'access',
        tokenId: 'admin-session',
      });
      const context = createMockExecutionContext({
        url: '/api/admin/dashboard/overview',
        authorization: `Bearer ${token}`,
      });
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);

      await expect(guard.canActivate(context)).rejects.toThrow('管理员账号已停用或删除');
    });

    it('管理员 refresh 会话已撤销时 access token 也应该立即失效', async () => {
      redisService.exists.mockResolvedValue(false);
      const token = await jwtService.signAsync({
        id: '1',
        roleType: 'admin',
        tokenType: 'access',
        tokenId: 'revoked-session',
      });
      const context = createMockExecutionContext({
        url: '/api/admin/dashboard/overview',
        authorization: `Bearer ${token}`,
      });
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);

      await expect(guard.canActivate(context)).rejects.toThrow('管理员登录会话已失效');
    });

    it('已停用小程序用户即使 JWT 尚未过期也应该立即失效', async () => {
      prisma.user.findFirst.mockResolvedValue(null);
      const token = await jwtService.signAsync({
        id: '1',
        roleType: 'user',
        tokenType: 'access',
        tokenId: 'user-session',
      });
      const context = createMockExecutionContext({
        url: '/api/weapp/order/list',
        authorization: `Bearer ${token}`,
      });
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);

      await expect(guard.canActivate(context)).rejects.toThrow('账号已停用或删除');
    });

    it('小程序 access 会话被撤销后旧 JWT 应立即失效', async () => {
      redisService.exists.mockResolvedValue(false);
      const token = await jwtService.signAsync({
        id: '1',
        roleType: 'user',
        tokenType: 'access',
        tokenId: 'revoked-weapp-session',
      });
      const context = createMockExecutionContext({
        url: '/api/weapp/order/list',
        authorization: `Bearer ${token}`,
      });
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);

      await expect(guard.canActivate(context)).rejects.toThrow('登录会话已失效');
      expect(redisService.exists).toHaveBeenCalledWith('weapp_access_token:1:revoked-weapp-session');
    });

    it('升级前不含 tokenId 的普通用户 JWT 应强制重新登录', async () => {
      const token = await jwtService.signAsync({
        id: '1',
        roleType: 'user',
        tokenType: 'access',
      });
      const context = createMockExecutionContext({
        url: '/api/weapp/order/list',
        authorization: `Bearer ${token}`,
      });
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);

      await expect(guard.canActivate(context)).rejects.toThrow('登录会话无效');
    });
  });

  describe('tokenType 验证', () => {
    it('admin access token 应该允许访问 /api/admin/*', async () => {
      const adminAccessToken = await jwtService.signAsync({
        id: '1',
        username: 'admin',
        roleType: 'admin',
        type: 'admin',
        roles: ['super_admin'],
        tokenType: 'access',
        tokenId: 'test-token-id',
      });

      const mockContext = createMockExecutionContext({
        url: '/api/admin/user/list',
        authorization: `Bearer ${adminAccessToken}`,
      });
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);

      const result = await guard.canActivate(mockContext);
      expect(result).toBe(true);
      expect(redisService.exists).toHaveBeenCalledWith('admin_refresh_token:1:test-token-id');
    });

    it('admin refresh token 不应该允许访问业务接口', async () => {
      const adminRefreshToken = await jwtService.signAsync({
        id: '1',
        username: 'admin',
        roleType: 'admin',
        type: 'admin',
        roles: ['super_admin'],
        tokenType: 'refresh',
        tokenId: 'test-token-id',
      });

      const mockContext = createMockExecutionContext({
        url: '/api/admin/user/list',
        authorization: `Bearer ${adminRefreshToken}`,
      });
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);

      await expect(guard.canActivate(mockContext)).rejects.toThrow(UnauthorizedException);
    });

    it('user access token 应该允许访问 /api/weapp/*', async () => {
      const userAccessToken = await jwtService.signAsync({
        id: '1',
        openid: 'test_openid',
        roleType: 'user',
        type: 'user',
        tokenType: 'access',
        tokenId: 'user-session',
      });

      const mockContext = createMockExecutionContext({
        url: '/api/weapp/user/profile',
        authorization: `Bearer ${userAccessToken}`,
      });
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);

      const result = await guard.canActivate(mockContext);
      expect(result).toBe(true);
      expect(redisService.exists).toHaveBeenCalledWith('weapp_access_token:1:user-session');
    });

    it('user token 缺少 tokenType 应该被拒绝', async () => {
      const userTokenWithoutType = await jwtService.signAsync({
        id: '1',
        openid: 'test_openid',
        roleType: 'user',
        type: 'user',
        tokenId: 'user-session',
      });

      const mockContext = createMockExecutionContext({
        url: '/api/weapp/user/profile',
        authorization: `Bearer ${userTokenWithoutType}`,
      });
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);

      await expect(guard.canActivate(mockContext)).rejects.toThrow(UnauthorizedException);
    });

    it('admin token 访问 /api/weapp/* 应该被拒绝', async () => {
      const adminToken = await jwtService.signAsync({
        id: '1',
        roleType: 'admin',
        type: 'admin',
        tokenType: 'access',
        tokenId: 'test-token-id',
      });

      const mockContext = createMockExecutionContext({
        url: '/api/weapp/user/profile',
        authorization: `Bearer ${adminToken}`,
      });
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);

      await expect(guard.canActivate(mockContext)).rejects.toThrow(ForbiddenException);
    });

    it('user token 访问 /api/admin/* 应该被拒绝', async () => {
      const userToken = await jwtService.signAsync({
        id: '1',
        roleType: 'user',
        type: 'user',
        tokenType: 'access',
        tokenId: 'user-session',
      });

      const mockContext = createMockExecutionContext({
        url: '/api/admin/user/list',
        authorization: `Bearer ${userToken}`,
      });
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);

      await expect(guard.canActivate(mockContext)).rejects.toThrow(ForbiddenException);
    });
  });

  describe('通用接口', () => {
    it('/api/common/* 应该允许任何有效且仍存活的 token', async () => {
      const adminToken = await jwtService.signAsync({
        id: '1',
        roleType: 'admin',
        type: 'admin',
        tokenType: 'access',
        tokenId: 'test-token-id',
      });

      const mockContext = createMockExecutionContext({
        url: '/api/common/health',
        authorization: `Bearer ${adminToken}`,
      });
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);

      const result = await guard.canActivate(mockContext);
      expect(result).toBe(true);
    });
  });

  describe('OptionalAuth', () => {
    it('无 token 时放行', async () => {
      const mockContext = createMockExecutionContext({
        url: '/api/weapp/home/data',
        authorization: undefined,
      });
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValueOnce(false).mockReturnValueOnce(true);
      const result = await guard.canActivate(mockContext);
      expect(result).toBe(true);
    });

    it('有合法 token 时注入 user', async () => {
      const token = await jwtService.signAsync({
        id: '1',
        roleType: 'user',
        tokenType: 'access',
        tokenId: 'user-session',
      });
      const mockContext = createMockExecutionContext({
        url: '/api/weapp/home/data',
        authorization: `Bearer ${token}`,
      });
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValueOnce(false).mockReturnValueOnce(true);
      const result = await guard.canActivate(mockContext);
      const request = mockContext.switchToHttp().getRequest();
      expect(result).toBe(true);
      expect(request.user?.id).toBe('1');
      expect(redisService.exists).toHaveBeenCalledWith('weapp_access_token:1:user-session');
    });
  });
});