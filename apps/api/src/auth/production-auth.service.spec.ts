import axios from 'axios';
import { Prisma } from '@prisma/client';
import { ProductionAuthService } from './production-auth.service';

jest.mock('axios');

const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('ProductionAuthService', () => {
  it('recovers when another request wins the first-login openid create race', async () => {
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
      get: jest.fn((key: string) => {
        if (key === 'WECHAT_APP_ID') return 'app-id';
        if (key === 'WECHAT_APP_SECRET') return 'app-secret';
        return undefined;
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
    expect(redis.set).toHaveBeenCalledWith('wechat_session:123', 'session-key', 86400 * 7);
    expect(jwt.signAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        id: '123',
        roleType: 'user',
        type: 'user',
        tokenType: 'access',
      }),
      { expiresIn: '7d' },
    );
  });
});
