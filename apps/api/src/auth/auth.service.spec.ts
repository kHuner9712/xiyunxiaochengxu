import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import axios from 'axios';

jest.mock('bcrypt', () => ({
  compare: jest.fn(),
  hash: jest.fn(),
}));

jest.mock('axios');

function createMockPrisma() {
  return {
    adminUser: {
      findFirst: jest.fn(),
    },
    user: {
      update: jest.fn(),
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

describe('AuthService bindPhone access_token cache', () => {
  let prisma: ReturnType<typeof createMockPrisma>;
  let redis: ReturnType<typeof createMockRedis>;
  let jwtService: JwtService;
  let authService: AuthService;
  const mockedAxios = axios as jest.Mocked<typeof axios>;

  beforeEach(() => {
    jest.clearAllMocks();
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
          WECHAT_APP_ID: 'wx-test-appid',
          WECHAT_APP_SECRET: 'wx-test-secret',
        };
        return map[key] ?? defaultValue;
      }),
    };
    authService = new AuthService(prisma as any, jwtService, config as any, redis as any);
    (prisma.user.update as any).mockResolvedValue({});
  });

  it('缓存命中时复用 wechat_access_token，不再请求 token 接口', async () => {
    await redis.set('wechat_access_token', 'cached-token');
    mockedAxios.post.mockResolvedValue({
      data: { errcode: 0, phone_info: { phoneNumber: '13800138000' } },
    } as any);

    const result = await authService.bindPhone('1', 'phone-code');

    expect(result).toEqual({ phone: '13800138000' });
    expect(mockedAxios.get).not.toHaveBeenCalled();
    expect(mockedAxios.post).toHaveBeenCalledWith(
      expect.stringContaining('access_token=cached-token&code=phone-code'),
    );
  });

  it('缓存未命中时请求 token 并按 expires_in - 300 写入 Redis', async () => {
    mockedAxios.get.mockResolvedValue({
      data: { access_token: 'fresh-token', expires_in: 7200 },
    } as any);
    mockedAxios.post.mockResolvedValue({
      data: { errcode: 0, phone_info: { phoneNumber: '13800138000' } },
    } as any);

    await authService.bindPhone('1', 'phone-code');

    expect(mockedAxios.get).toHaveBeenCalledWith(expect.stringContaining('/cgi-bin/token'));
    expect(redis.set).toHaveBeenCalledWith('wechat_access_token', 'fresh-token', 6900);
    expect(mockedAxios.post).toHaveBeenCalledWith(
      expect.stringContaining('access_token=fresh-token&code=phone-code'),
    );
  });

  it('微信 token 返回错误时保持现有异常逻辑', async () => {
    mockedAxios.get.mockResolvedValue({
      data: { errcode: 40013, errmsg: 'invalid appid' },
    } as any);

    await expect(authService.bindPhone('1', 'phone-code')).rejects.toThrow(BadRequestException);
    expect(mockedAxios.post).not.toHaveBeenCalled();
    expect(prisma.user.update).not.toHaveBeenCalled();
  });
});

describe('parseDurationToSeconds', () => {
  let authService: AuthService;

  beforeEach(() => {
    const prisma = createMockPrisma();
    const redis = createMockRedis();
    const jwtService = new JwtService({ secret: 'test' });
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

  it("'2h' → 7200", () => {
    expect((authService as any).parseDurationToSeconds('2h')).toBe(7200);
  });

  it("'30d' → 2592000", () => {
    expect((authService as any).parseDurationToSeconds('30d')).toBe(2592000);
  });

  it("'7d' → 604800", () => {
    expect((authService as any).parseDurationToSeconds('7d')).toBe(604800);
  });

  it("'15m' → 900", () => {
    expect((authService as any).parseDurationToSeconds('15m')).toBe(900);
  });

  it("'3600' (纯数字) → 3600", () => {
    expect((authService as any).parseDurationToSeconds('3600')).toBe(3600);
  });

  it("'1w' → 604800", () => {
    expect((authService as any).parseDurationToSeconds('1w')).toBe(604800);
  });

  it("'90s' → 90", () => {
    expect((authService as any).parseDurationToSeconds('90s')).toBe(90);
  });

  it('无效字符串回退到 2592000', () => {
    expect((authService as any).parseDurationToSeconds('invalid')).toBe(2592000);
  });
});

describe('adminLogin 使用 JWT_ADMIN_EXPIRES_IN 配置', () => {
  let prisma: any;
  let redis: ReturnType<typeof createMockRedis>;
  let jwtService: JwtService;
  let authService: AuthService;

  beforeEach(() => {
    jest.clearAllMocks();
    prisma = {
      adminUser: {
        findFirst: jest.fn(),
        update: jest.fn(),
      },
    };
    redis = createMockRedis();
    jwtService = new JwtService({ secret: 'jwt-secret-for-access-token-32-chars' });
    const config = {
      get: jest.fn((key: string, defaultValue?: string) => {
        const map: Record<string, string> = {
          NODE_ENV: 'development',
          JWT_SECRET: 'jwt-secret-for-access-token-32-chars',
          REFRESH_TOKEN_SECRET: 'refresh-secret-for-refresh-token-32c',
          REFRESH_TOKEN_EXPIRES_IN: '30d',
          JWT_ADMIN_EXPIRES_IN: '4h',
          SMOKE_TEST_BYPASS_CAPTCHA: 'true',
        };
        return map[key] ?? defaultValue;
      }),
    };
    authService = new AuthService(prisma, jwtService, config as any, redis as any);
    (prisma.adminUser.findFirst as any).mockResolvedValue({
      id: 1n,
      username: 'admin',
      password: 'hashed-password',
      avatar: null,
      realName: '管理员',
      mustChangePassword: false,
      adminUserRoles: [],
    });
    (prisma.adminUser.update as any).mockResolvedValue({});
    const bcrypt = require('bcrypt');
    (bcrypt.compare as any).mockResolvedValue(true);
  });

  it('accessToken expiresIn 使用 JWT_ADMIN_EXPIRES_IN 配置的 4h', async () => {
    const signSpy = jest.spyOn(jwtService, 'signAsync');
    await authService.adminLogin('admin', 'password', 'smoke-test', 'bypass');
    expect(signSpy).toHaveBeenCalledWith(
      expect.objectContaining({ tokenType: 'access' }),
      expect.objectContaining({ expiresIn: '4h' }),
    );
  });
});

describe('adminLogin 默认 JWT_ADMIN_EXPIRES_IN 为 2h', () => {
  let prisma: any;
  let redis: ReturnType<typeof createMockRedis>;
  let jwtService: JwtService;
  let authService: AuthService;

  beforeEach(() => {
    jest.clearAllMocks();
    prisma = {
      adminUser: {
        findFirst: jest.fn(),
        update: jest.fn(),
      },
    };
    redis = createMockRedis();
    jwtService = new JwtService({ secret: 'jwt-secret-for-access-token-32-chars' });
    const config = {
      get: jest.fn((key: string, defaultValue?: string) => {
        const map: Record<string, string> = {
          NODE_ENV: 'development',
          JWT_SECRET: 'jwt-secret-for-access-token-32-chars',
          REFRESH_TOKEN_SECRET: 'refresh-secret-for-refresh-token-32c',
          REFRESH_TOKEN_EXPIRES_IN: '30d',
          SMOKE_TEST_BYPASS_CAPTCHA: 'true',
        };
        return map[key] ?? defaultValue;
      }),
    };
    authService = new AuthService(prisma, jwtService, config as any, redis as any);
    (prisma.adminUser.findFirst as any).mockResolvedValue({
      id: 1n,
      username: 'admin',
      password: 'hashed-password',
      avatar: null,
      realName: '管理员',
      mustChangePassword: false,
      adminUserRoles: [],
    });
    (prisma.adminUser.update as any).mockResolvedValue({});
    const bcrypt = require('bcrypt');
    (bcrypt.compare as any).mockResolvedValue(true);
  });

  it('未配置 JWT_ADMIN_EXPIRES_IN 时 accessToken expiresIn 默认为 2h', async () => {
    const signSpy = jest.spyOn(jwtService, 'signAsync');
    await authService.adminLogin('admin', 'password', 'smoke-test', 'bypass');
    expect(signSpy).toHaveBeenCalledWith(
      expect.objectContaining({ tokenType: 'access' }),
      expect.objectContaining({ expiresIn: '2h' }),
    );
  });
});

describe('adminLogin Redis TTL 与 REFRESH_TOKEN_EXPIRES_IN 同步', () => {
  let prisma: any;
  let redis: ReturnType<typeof createMockRedis>;
  let jwtService: JwtService;
  let authService: AuthService;

  beforeEach(() => {
    jest.clearAllMocks();
    prisma = {
      adminUser: {
        findFirst: jest.fn(),
        update: jest.fn(),
      },
    };
    redis = createMockRedis();
    jwtService = new JwtService({ secret: 'jwt-secret-for-access-token-32-chars' });
    const config = {
      get: jest.fn((key: string, defaultValue?: string) => {
        const map: Record<string, string> = {
          NODE_ENV: 'development',
          JWT_SECRET: 'jwt-secret-for-access-token-32-chars',
          REFRESH_TOKEN_SECRET: 'refresh-secret-for-refresh-token-32c',
          REFRESH_TOKEN_EXPIRES_IN: '7d',
          SMOKE_TEST_BYPASS_CAPTCHA: 'true',
        };
        return map[key] ?? defaultValue;
      }),
    };
    authService = new AuthService(prisma, jwtService, config as any, redis as any);
    (prisma.adminUser.findFirst as any).mockResolvedValue({
      id: 1n,
      username: 'admin',
      password: 'hashed-password',
      avatar: null,
      realName: '管理员',
      mustChangePassword: false,
      adminUserRoles: [],
    });
    (prisma.adminUser.update as any).mockResolvedValue({});
    const bcrypt = require('bcrypt');
    (bcrypt.compare as any).mockResolvedValue(true);
  });

  it('redis.set 的 TTL 为 7d 对应的 604800 秒', async () => {
    await authService.adminLogin('admin', 'password', 'smoke-test', 'bypass');
    expect(redis.set).toHaveBeenCalledWith(
      expect.stringContaining('admin_refresh_token:'),
      expect.any(String),
      604800,
    );
  });
});

describe('refreshToken 旋转时使用同一 TTL', () => {
  let prisma: any;
  let redis: ReturnType<typeof createMockRedis>;
  let jwtService: JwtService;
  let authService: AuthService;

  beforeEach(() => {
    jest.clearAllMocks();
    prisma = {
      adminUser: {
        findFirst: jest.fn(),
      },
    };
    redis = createMockRedis();
    jwtService = new JwtService({ secret: 'jwt-secret-for-access-token-32-chars' });
    const config = {
      get: jest.fn((key: string, defaultValue?: string) => {
        const map: Record<string, string> = {
          NODE_ENV: 'development',
          JWT_SECRET: 'jwt-secret-for-access-token-32-chars',
          REFRESH_TOKEN_SECRET: 'refresh-secret-for-refresh-token-32c',
          REFRESH_TOKEN_EXPIRES_IN: '7d',
        };
        return map[key] ?? defaultValue;
      }),
    };
    authService = new AuthService(prisma, jwtService, config as any, redis as any);
    (prisma.adminUser.findFirst as any).mockResolvedValue({
      id: 1n,
      username: 'admin',
      avatar: null,
      realName: '管理员',
      mustChangePassword: false,
      adminUserRoles: [],
    });
  });

  it('refreshToken 旋转后 redis.set 的 TTL 为 7d 对应的 604800 秒', async () => {
    const tokenId = 'test-token-id';
    const refreshToken = await jwtService.signAsync(
      { id: '1', username: 'admin', roleType: 'admin', tokenType: 'refresh', tokenId },
      { secret: 'refresh-secret-for-refresh-token-32c', expiresIn: '7d' },
    );
    await redis.set(`admin_refresh_token:1:${tokenId}`, refreshToken);
    await authService.refreshToken(refreshToken);
    expect(redis.set).toHaveBeenCalledWith(
      expect.stringContaining('admin_refresh_token:'),
      expect.any(String),
      604800,
    );
  });
});
