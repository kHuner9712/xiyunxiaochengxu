import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { ExecutionContext, UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';

describe('JwtAuthGuard', () => {
  let guard: JwtAuthGuard;
  let reflector: Reflector;
  let jwtService: JwtService;

  beforeEach(() => {
    reflector = new Reflector();
    jwtService = new JwtService({
      secret: 'test_jwt_secret_key_that_is_long_enough_32chars',
    });
    guard = new JwtAuthGuard(reflector, jwtService);
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
        { id: '1', roleType: 'admin', tokenType: 'access' },
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
      });

      const mockContext = createMockExecutionContext({
        url: '/api/admin/test',
        authorization: `Bearer ${tokenWithoutType}`,
      });
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);

      await expect(guard.canActivate(mockContext)).rejects.toThrow(UnauthorizedException);
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
      });

      const mockContext = createMockExecutionContext({
        url: '/api/weapp/user/profile',
        authorization: `Bearer ${userAccessToken}`,
      });
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);

      const result = await guard.canActivate(mockContext);
      expect(result).toBe(true);
    });

    it('user token 缺少 tokenType 应该被拒绝', async () => {
      const userTokenWithoutType = await jwtService.signAsync({
        id: '1',
        openid: 'test_openid',
        roleType: 'user',
        type: 'user',
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
    it('/api/common/* 应该允许任何有效 token', async () => {
      const adminToken = await jwtService.signAsync({
        id: '1',
        roleType: 'admin',
        type: 'admin',
        tokenType: 'access',
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
    });
  });
});
