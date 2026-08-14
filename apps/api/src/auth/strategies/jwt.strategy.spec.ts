import { UnauthorizedException } from '@nestjs/common';
import { JwtStrategy } from './jwt.strategy';

function createStrategy(options?: {
  user?: any;
  admin?: any;
  session?: string | null;
}) {
  const config: any = {
    get: jest.fn((_key: string, fallback?: unknown) => fallback || 'test-jwt-secret'),
  };
  const prisma: any = {
    user: { findFirst: jest.fn().mockResolvedValue(options?.user ?? { id: 7n, status: 1 }) },
    adminUser: { findFirst: jest.fn().mockResolvedValue(options?.admin ?? { id: 9n, status: 1 }) },
  };
  const redis: any = {
    get: jest.fn().mockResolvedValue(options?.session === undefined ? '1' : options.session),
  };

  return {
    strategy: new JwtStrategy(config, prisma, redis),
    prisma,
    redis,
  };
}

describe('JwtStrategy revocable production sessions', () => {
  it('returns tokenId to controllers and validates the mini-program session registry', async () => {
    const { strategy, redis } = createStrategy();

    await expect(strategy.validate({
      id: '7',
      roleType: 'user',
      tokenType: 'access',
      tokenId: 'user-session-1',
    })).resolves.toEqual(expect.objectContaining({
      id: '7',
      roleType: 'user',
      tokenId: 'user-session-1',
    }));

    expect(redis.get).toHaveBeenCalledWith('weapp_access_token:7:user-session-1');
  });

  it('rejects a mini-program JWT after logout removed its Redis session', async () => {
    const { strategy } = createStrategy({ session: null });

    await expect(strategy.validate({
      id: '7',
      roleType: 'user',
      tokenType: 'access',
      tokenId: 'revoked-user-session',
    })).rejects.toThrow(UnauthorizedException);
  });

  it('validates admin access tokens against the refresh/session registry', async () => {
    const { strategy, redis } = createStrategy();

    await expect(strategy.validate({
      id: '9',
      roleType: 'admin',
      tokenType: 'access',
      tokenId: 'admin-session-1',
      username: 'admin',
      roles: ['super_admin'],
    })).resolves.toEqual(expect.objectContaining({
      tokenId: 'admin-session-1',
    }));

    expect(redis.get).toHaveBeenCalledWith('admin_refresh_token:9:admin-session-1');
  });

  it('rejects legacy or malformed access tokens without tokenId', async () => {
    const { strategy, redis } = createStrategy();

    await expect(strategy.validate({
      id: '7',
      roleType: 'user',
      tokenType: 'access',
    })).rejects.toThrow('登录会话无效，请重新登录');
    expect(redis.get).not.toHaveBeenCalled();
  });

  it('rejects non-access token types on protected routes', async () => {
    const { strategy } = createStrategy();

    await expect(strategy.validate({
      id: '9',
      roleType: 'admin',
      tokenType: 'refresh',
      tokenId: 'admin-session-1',
    })).rejects.toThrow('无效的 token 类型');
  });
});
