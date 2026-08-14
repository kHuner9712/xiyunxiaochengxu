import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import axios from 'axios';
import * as crypto from 'crypto';
import { RecoveringProductionAuthService } from './recovering-production-auth.service';

jest.mock('axios');

function createService() {
  const store = new Map<string, string>();
  const prisma: any = { user: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) } };
  const redis: any = {
    get: jest.fn(async (key: string) => store.get(key) || null),
    set: jest.fn(async (key: string, value: string) => { store.set(key, value); return 'OK'; }),
    del: jest.fn(async (key: string) => { store.delete(key); return 1; }),
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
  const memberService: any = {
    checkAndUpgradeLevel: jest.fn().mockResolvedValue(undefined),
  };
  const service = new RecoveringProductionAuthService(
    prisma,
    new JwtService({ secret: 'jwt-secret-for-access-token-32-chars' }),
    config,
    redis,
    memberService,
  );
  return { service, prisma, redis, store, memberService };
}

function encryptLegacyPhoneData(sessionKey: string, iv: string, payload: unknown) {
  const cipher = crypto.createCipheriv(
    'aes-128-cbc',
    Buffer.from(sessionKey, 'base64'),
    Buffer.from(iv, 'base64'),
  );
  return Buffer.concat([
    cipher.update(JSON.stringify(payload), 'utf8'),
    cipher.final(),
  ]).toString('base64');
}

describe('RecoveringProductionAuthService', () => {
  const mockedAxios = axios as jest.Mocked<typeof axios>;

  beforeEach(() => jest.clearAllMocks());

  it('converges the member level through the final MemberService before session issuance', async () => {
    const { service, memberService } = createService();

    await (service as any).beforeIssueWeappSession('7');

    expect(memberService.checkAndUpgradeLevel).toHaveBeenCalledWith('7');
  });

  it.each([40001, 40014, 42001])('refreshes a cached access token once for WeChat token error %s', async (errcode) => {
    const { service, prisma, redis, store } = createService();
    store.set('wechat_access_token', 'stale-token');
    mockedAxios.post
      .mockResolvedValueOnce({ data: { errcode, errmsg: 'invalid access token' } } as any)
      .mockResolvedValueOnce({ data: { errcode: 0, phone_info: { phoneNumber: '13800138000' } } } as any);
    mockedAxios.get.mockResolvedValue({ data: { access_token: 'fresh-token', expires_in: 7200 } } as any);

    await expect(service.bindPhone('7', 'phone-code')).resolves.toEqual({ phone: '13800138000' });
    expect(redis.del).toHaveBeenCalledWith('wechat_access_token');
    expect(mockedAxios.get).toHaveBeenCalledTimes(1);
    expect(mockedAxios.post).toHaveBeenNthCalledWith(
      2,
      'https://api.weixin.qq.com/wxa/business/getuserphonenumber',
      { code: 'phone-code' },
      { params: { access_token: 'fresh-token' } },
    );
    expect(prisma.user.updateMany).toHaveBeenCalledWith({
      where: { id: 7n, deletedAt: null, status: 1 },
      data: { phone: '13800138000' },
    });
  });

  it('rejects a modern phone write when account cancellation wins the race', async () => {
    const { service, prisma, store } = createService();
    store.set('wechat_access_token', 'cached-token');
    prisma.user.updateMany.mockResolvedValue({ count: 0 });
    mockedAxios.post.mockResolvedValue({
      data: { errcode: 0, phone_info: { phoneNumber: '13800138000' } },
    } as any);

    await expect(service.bindPhone('7', 'phone-code')).rejects.toBeInstanceOf(UnauthorizedException);
    expect(prisma.user.updateMany).toHaveBeenCalledWith({
      where: { id: 7n, deletedAt: null, status: 1 },
      data: { phone: '13800138000' },
    });
  });

  it('keeps legacy binding compatible without restoring phone or Redis session after cancellation', async () => {
    const { service, prisma, redis, store } = createService();
    const sessionKey = Buffer.from('0123456789abcdef').toString('base64');
    const iv = Buffer.from('abcdef9876543210').toString('base64');
    store.set('wechat_session:7', sessionKey);
    prisma.user.updateMany.mockResolvedValue({ count: 0 });
    mockedAxios.get.mockResolvedValue({ data: { session_key: sessionKey } } as any);
    const encryptedData = encryptLegacyPhoneData(sessionKey, iv, {
      phoneNumber: '13800138000',
      watermark: { appid: 'wx-test-appid' },
    });

    await expect(service.bindPhone('7', 'login-code', encryptedData, iv))
      .rejects.toBeInstanceOf(UnauthorizedException);
    expect(prisma.user.updateMany).toHaveBeenCalledWith({
      where: { id: 7n, deletedAt: null, status: 1 },
      data: { phone: '13800138000' },
    });
    expect(redis.set).not.toHaveBeenCalledWith(
      'wechat_session:7',
      expect.any(String),
      expect.any(Number),
    );
  });

  it('does not retry unrelated phone authorization business errors', async () => {
    const { service, redis, store } = createService();
    store.set('wechat_access_token', 'cached-token');
    mockedAxios.post.mockResolvedValue({ data: { errcode: 40029, errmsg: 'invalid code' } } as any);

    await expect(service.bindPhone('7', 'phone-code')).rejects.toThrow(BadRequestException);
    expect(redis.del).not.toHaveBeenCalled();
    expect(mockedAxios.get).not.toHaveBeenCalled();
    expect(mockedAxios.post).toHaveBeenCalledTimes(1);
  });

  it('does not blindly retry an HTTP/network failure whose remote outcome is uncertain', async () => {
    const { service, store } = createService();
    store.set('wechat_access_token', 'cached-token');
    mockedAxios.post.mockRejectedValue(new Error('network timeout'));

    await expect(service.bindPhone('7', 'phone-code')).rejects.toThrow(BadRequestException);
    expect(mockedAxios.get).not.toHaveBeenCalled();
    expect(mockedAxios.post).toHaveBeenCalledTimes(1);
  });
});
