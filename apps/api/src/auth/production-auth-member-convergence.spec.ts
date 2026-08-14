import axios from 'axios';
import { ProductionAuthService } from './production-auth.service';

jest.mock('axios');

const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('ProductionAuthService member convergence ordering', () => {
  beforeEach(() => jest.clearAllMocks());

  it('runs the pre-session convergence hook before Redis session state or JWT issuance', async () => {
    const user = {
      id: 7n,
      openid: 'openid-7',
      unionId: null,
      status: 1,
      deletedAt: null,
      lastLoginAt: new Date(),
    };
    const prisma: any = {
      user: {
        findFirst: jest
          .fn()
          .mockResolvedValueOnce(user)
          .mockResolvedValueOnce({ id: 7n }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };
    const jwt: any = {
      signAsync: jest.fn().mockResolvedValue('access-token'),
    };
    const config: any = {
      get: jest.fn((key: string, fallback?: string) => ({
        NODE_ENV: 'test',
        JWT_SECRET: 'jwt-secret-for-access-token-32-chars',
        REFRESH_TOKEN_SECRET: 'refresh-secret-for-refresh-token-32c',
        WECHAT_APP_ID: 'wx-test-appid',
        WECHAT_APP_SECRET: 'wx-test-secret',
      } as Record<string, string>)[key] ?? fallback),
    };
    const redis: any = {
      set: jest.fn().mockResolvedValue('OK'),
      del: jest.fn().mockResolvedValue(1),
    };
    mockedAxios.get.mockResolvedValueOnce({
      data: {
        openid: 'openid-7',
        session_key: 'session-key',
      },
    } as any);

    const service = new ProductionAuthService(prisma, jwt, config, redis);
    const convergence = jest
      .spyOn(service as any, 'beforeIssueWeappSession')
      .mockResolvedValue(undefined);

    await service.weappLogin('login-code');

    expect(convergence).toHaveBeenCalledWith('7');
    expect(convergence.mock.invocationCallOrder[0]).toBeLessThan(redis.set.mock.invocationCallOrder[0]);
    expect(convergence.mock.invocationCallOrder[0]).toBeLessThan(jwt.signAsync.mock.invocationCallOrder[0]);
  });
});
