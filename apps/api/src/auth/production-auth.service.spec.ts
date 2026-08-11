import axios from 'axios';
import * as bcrypt from 'bcrypt';
import { Prisma } from '@prisma/client';
import { ProductionAuthService } from './production-auth.service';

jest.mock('axios');
jest.mock('bcrypt', () => ({
  compare: jest.fn(),
  hash: jest.fn(),
}));

const mockedAxios = axios as jest.Mocked<typeof axios>;
const mockedBcrypt = bcrypt as jest.Mocked<typeof bcrypt>;

describe('ProductionAuthService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('recovers when another request wins the first-login openid create race and issues a revocable access session', async () => {
    const durableUser = {
      id: 123n,
      openid: 'openid-race',
      unionId: null,
      status: 1,
      deletedAt: null,
      lastLoginAt: new Date(),
    };
    const p2002 = new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
      code: 'P2002',
      clientVersion: '5.22.0',
      meta: { target: ['openid'] },
    });
    const prisma: any = {
      user: {
        findFirst: jest
          .fn()
          .mockResolvedValueOnce(null)
          .mockResolvedValueOnce(durableUser),
        create: jest.fn().mockRejectedValue(p2002),
        update: jest.fn().mockResolvedValue(durableUser),
      },
      memberLevel: {
        findFirst: jest.fn().mockResolvedValue(null),
      },
    };
    const jwt: any = {
      signAsync: jest.fn().mockResolvedValue('access-token'),
    };
    const config: any = {
      get: jest.fn((key: string, defaultValue?: unknown) => {
        if (key === 'WECHAT_APP_ID') return 'app-id';
        if (key === 'WECHAT_APP_SECRET') return 'app-secret';
        return defaultValue;
      }),
    };
    const redis: any = {
      set: jest.fn().mockResolvedValue('OK'),
    };
    mockedAxios.get.mockResolvedValueOnce({
      data: {
        openid: 'openid-race',
        session_key: 'session-key',
      },
    } as any);

    const service = new ProductionAuthService(prisma, jwt, config, redis);
    const result = await service.weappLogin('code');

    expect(result).toEqual({ token: 'access-token', isNewUser: false });
    expect(prisma.user.create).toHaveBeenCalledTimes(1);
    expect(prisma.user.findFirst).toHaveBeenCalledTimes(2);
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 123n },
      data: expect.objectContaining({ lastLoginAt: expect.any(Date) }),
    });
    expect(redis.set).toHaveBeenNthCalledWith(1, 'wechat_session:123', 'session-key', 86400 * 7);
    expect(jwt.signAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        id: '123',
        roleType: 'user',
        type: 'user',
        tokenType: 'access',
        tokenId: expect.any(String),
      }),
      { expiresIn: '7d' },
    );
    const accessPayload = jwt.signAsync.mock.calls[0][0];
    expect(accessPayload.tokenId).toBeTruthy();
    expect(redis.set).toHaveBeenNthCalledWith(
      2,
      `weapp_access_token:123:${accessPayload.tokenId}`,
      '1',
      86400 * 7,
    );
  });

  it('revokes every existing admin refresh session after a successful password change', async () => {
    const prisma: any = {
      adminUser: {
        findFirst: jest.fn().mockResolvedValue({ id: 7n, password: 'old-hash' }),
        update: jest.fn().mockResolvedValue({}),
      },
    };
    const jwt: any = {};
    const config: any = {
      get: jest.fn((key: string, defaultValue?: unknown) => {
        const values: Record<string, string> = {
          NODE_ENV: 'test',
          JWT_SECRET: 'test-jwt-secret-long-enough-for-unit-test',
          REFRESH_TOKEN_SECRET: 'test-refresh-secret-long-enough-for-unit-test',
          REFRESH_TOKEN_EXPIRES_IN: '30d',
          JWT_ADMIN_EXPIRES_IN: '2h',
        };
        return values[key] ?? defaultValue;
      }),
    };
    const redis: any = {
      delByPattern: jest.fn().mockResolvedValue(3),
    };
    mockedBcrypt.compare.mockResolvedValue(true as never);
    mockedBcrypt.hash.mockResolvedValue('new-hash' as never);

    const service = new ProductionAuthService(prisma, jwt, config, redis);
    await service.changePassword(
      '7',
      'OldPassword1!',
      'NewPassword2@',
      'NewPassword2@',
    );

    expect(prisma.adminUser.update).toHaveBeenCalledWith({
      where: { id: 7n },
      data: { password: 'new-hash', mustChangePassword: false },
    });
    expect(redis.delByPattern).toHaveBeenCalledWith('admin_refresh_token:7:*');
  });
});