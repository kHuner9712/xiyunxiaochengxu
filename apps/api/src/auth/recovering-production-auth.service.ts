import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import axios from 'axios';
import { PrismaService } from '../common/prisma/prisma.service';
import { RedisService } from '../common/redis/redis.service';
import { ProductionAuthService } from './production-auth.service';

const WECHAT_ACCESS_TOKEN_CACHE_KEY = 'wechat_access_token';
const RETRYABLE_WECHAT_ACCESS_TOKEN_ERRORS = new Set([40001, 40014, 42001]);

@Injectable()
export class RecoveringProductionAuthService extends ProductionAuthService {
  private readonly recoveryLogger = new Logger(RecoveringProductionAuthService.name);

  constructor(
    private readonly recoveryPrisma: PrismaService,
    jwtService: JwtService,
    private readonly recoveryConfig: ConfigService,
    private readonly recoveryRedis: RedisService,
  ) {
    super(recoveryPrisma, jwtService, recoveryConfig, recoveryRedis);
  }

  override async bindPhone(
    userId: string,
    code: string,
    encryptedData?: string,
    iv?: string,
  ) {
    // Legacy encrypted-data flow has a separate session-key contract and remains delegated to the
    // already-hardened base implementation. Only the modern getPhoneNumber code path depends on
    // the shared WeChat API access-token cache handled below.
    if (encryptedData && iv) {
      return super.bindPhone(userId, code, encryptedData, iv);
    }

    const appId = this.recoveryConfig.get<string>('WECHAT_APP_ID');
    const appSecret = this.recoveryConfig.get<string>('WECHAT_APP_SECRET');
    if (!appId || !appSecret) {
      this.recoveryLogger.error('手机号绑定失败：WECHAT_APP_ID 或 WECHAT_APP_SECRET 未配置');
      throw new BadRequestException('手机号绑定暂不可用，请稍后重试');
    }

    let accessToken = await this.getWechatAccessToken(appId, appSecret, false);
    let phoneResponse = await this.requestPhoneNumber(code, accessToken);
    let phoneErrorCode = Number(phoneResponse?.data?.errcode || 0);

    // A cached access token can be revoked/rotated by WeChat before our Redis TTL elapses. Retry
    // exactly once only for token-invalid/expired responses. Do not retry generic HTTP/network or
    // phone-code/business failures, because their remote outcome may be ambiguous or the one-time
    // authorization code may already have been consumed.
    if (RETRYABLE_WECHAT_ACCESS_TOKEN_ERRORS.has(phoneErrorCode)) {
      this.recoveryLogger.warn(
        `微信 access_token 已失效，清理缓存并刷新后重试一次手机号绑定: errcode=${phoneErrorCode}`,
      );
      await this.recoveryRedis.del(WECHAT_ACCESS_TOKEN_CACHE_KEY);
      accessToken = await this.getWechatAccessToken(appId, appSecret, true);
      phoneResponse = await this.requestPhoneNumber(code, accessToken);
      phoneErrorCode = Number(phoneResponse?.data?.errcode || 0);
    }

    const phoneInfo = phoneResponse?.data?.phone_info;
    if (phoneErrorCode) {
      const phoneErrMsg = phoneResponse?.data?.errmsg || '未知错误';
      this.recoveryLogger.warn(
        `获取微信手机号返回错误: errcode=${phoneErrorCode} errmsg=${phoneErrMsg}`,
      );
      throw new BadRequestException(`获取手机号失败: ${phoneErrMsg}`);
    }
    if (!phoneInfo?.phoneNumber) {
      throw new BadRequestException('获取手机号失败，请重试');
    }

    await this.recoveryPrisma.user.update({
      where: { id: BigInt(userId) },
      data: { phone: phoneInfo.phoneNumber },
    });
    return { phone: phoneInfo.phoneNumber };
  }

  private async getWechatAccessToken(
    appId: string,
    appSecret: string,
    forceRefresh: boolean,
  ): Promise<string> {
    if (!forceRefresh) {
      const cached = await this.recoveryRedis.get(WECHAT_ACCESS_TOKEN_CACHE_KEY);
      if (cached) return cached;
    }

    let tokenResponse;
    try {
      tokenResponse = await axios.get('https://api.weixin.qq.com/cgi-bin/token', {
        params: {
          grant_type: 'client_credential',
          appid: appId,
          secret: appSecret,
        },
      });
    } catch (error: any) {
      this.recoveryLogger.error(
        `获取微信 access_token 请求异常: status=${error?.response?.status || '-'} message=${error?.message || error}`,
      );
      throw new BadRequestException('手机号绑定暂不可用，请稍后重试');
    }

    const { access_token: accessToken, expires_in: expiresIn, errcode, errmsg } = tokenResponse.data || {};
    if (errcode || !accessToken) {
      this.recoveryLogger.warn(
        `获取微信 access_token 返回错误: errcode=${errcode || '-'} errmsg=${errmsg || '-'}`,
      );
      throw new BadRequestException(`获取access_token失败: ${errmsg || '未知错误'}`);
    }

    const ttlSeconds = Math.max(60, Number(expiresIn || 0) - 300);
    await this.recoveryRedis.set(WECHAT_ACCESS_TOKEN_CACHE_KEY, accessToken, ttlSeconds);
    return accessToken;
  }

  private async requestPhoneNumber(code: string, accessToken: string) {
    try {
      return await axios.post(
        'https://api.weixin.qq.com/wxa/business/getuserphonenumber',
        { code },
        { params: { access_token: accessToken } },
      );
    } catch (error: any) {
      this.recoveryLogger.error(
        `获取微信手机号请求异常: status=${error?.response?.status || '-'} message=${error?.message || error}`,
      );
      throw new BadRequestException('获取手机号失败，请稍后重试');
    }
  }
}
