import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from './auth.service';

jest.mock('bcrypt', () => ({
  compare: jest.fn(),
  hash: jest.fn(),
}));

function createMockPrisma() {
  return {
    adminUser: {
      findFirst: jest.fn(),
    },
  };
}

function createMockRedis() {
  const store = new Map<string, string>();
  return {
    get: jest.fn(async (key: string) => store.get(key) || null),
    set: jest.fn(async (key: string, value: string) => {
      store.set(key, value);
      return 'OK';
    }),
    del: jest.fn(async (key: string) => {
      store.delete(key);
      return 1;
    }),
  };
}

describe('AuthService refresh token secret and rotation', () => {
  let prisma: ReturnType<typeof createMockPrisma>;
  let redis: ReturnType<typeof createMockRedis>;
  let jwtService: JwtService;
  let authService: AuthService;

  beforeEach(() => {
    prisma = createMockPrisma();
    redis = createMockRedis();
    jwtService = new JwtService({ secret: 'jwt-secret-for-access-token-32-chars' });
    const config = {
      get: jest.fn((key: string, defaultValue?: string) => {
        const map: Record<string, string> = {
          NODE_ENV: 'development',
          JWT_SECRET: 'jwt-secret-for-access-token-32-chars',
          REFRESH_TOKEN_SECRET: 'refresh-secret-for-refresh-token-32c',
          REFRESH_TOKEN_EXPIRES_IN: '30d',
        };
        return map[key] ?? defaultValue;
      }),
    };
    authService = new AuthService(prisma as any, jwtService, config as any, redis as any);
  });

  it('refresh token 仅能用 REFRESH_TOKEN_SECRET 验证', async () => {
    const refreshToken = await jwtService.signAsync(
      { id: '1', roleType: 'admin', tokenType: 'refresh', tokenId: 'token-1' },
      { secret: 'refresh-secret-for-refresh-token-32c', expiresIn: '30d' },
    );
    await expect(jwtService.verifyAsync(refreshToken)).rejects.toThrow();
    const payload = await jwtService.verifyAsync(refreshToken, { secret: 'refresh-secret-for-refresh-token-32c' });
    expect(payload.tokenType).toBe('refresh');
  });

  it('refresh token 轮换后旧 token 失效', async () => {
    const oldTokenId = 'token-old';
    const oldRefreshToken = await jwtService.signAsync(
      { id: '1', username: 'admin', roleType: 'admin', tokenType: 'refresh', tokenId: oldTokenId },
      { secret: 'refresh-secret-for-refresh-token-32c', expiresIn: '30d' },
    );
    await redis.set(`admin_refresh_token:1:${oldTokenId}`, oldRefreshToken);
    (prisma.adminUser.findFirst as any).mockResolvedValue({
      id: 1n,
      username: 'admin',
      avatar: null,
      realName: '管理员',
      mustChangePassword: false,
      adminUserRoles: [],
    });

    const rotated = await authService.refreshToken(oldRefreshToken);
    expect(rotated.refreshToken).toBeDefined();
    await expect(authService.refreshToken(oldRefreshToken)).rejects.toThrow(UnauthorizedException);
  });
});
