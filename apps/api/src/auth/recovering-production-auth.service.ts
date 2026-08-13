import { BadRequestException, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import axios from 'axios';
import * as crypto from 'crypto';
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
    // Keep legacy compatibility in the production provider, but do not delegate its final database
    // write to the base implementation: an in-flight legacy request must obey the same active-user
    // compare-and-set rule as the modern getPhoneNumber flow when account cancellation races it.
    if (encryptedData && iv) {
      return this.bindLegacyPhoneSafely(userId, code, encryptedData, iv);
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

    return this.persistPhoneForActiveUser(userId, phoneInfo.phoneNumber);
  }

  private async persistPhoneForActiveUser(userId: string, phone: string) {
    const updated = await this.recoveryPrisma.user.updateMany({
      where: { id: BigInt(userId), deletedAt: null, status: 1 },
      data: { phone },
    });
    if (updated.count !== 1) {
      throw new UnauthorizedException('账号已停用或注销，请重新登录');
    }
    return { phone };
  }

  private async bindLegacyPhoneSafely(
    userId: string,
    code: string,
    encryptedData: string,
    iv: string,
  ) {
    const existingSessionKey = await this.recoveryRedis.get(`wechat_session:${userId}`);
    if (!existingSessionKey) {
      throw new UnauthorizedException('会话已过期，请重新登录');
    }

    const appId = this.recoveryConfig.get<string>('WECHAT_APP_ID');
    const appSecret = this.recoveryConfig.get<string>('WECHAT_APP_SECRET');
    if (!appId || !appSecret) {
      this.recoveryLogger.error('手机号兼容绑定失败：WECHAT_APP_ID 或 WECHAT_APP_SECRET 未配置');
      throw new BadRequestException('手机号绑定暂不可用，请稍后重试');
    }

    let sessionResponse;
    try {
      sessionResponse = await axios.get('https://api.weixin.qq.com/sns/jscode2session', {
        params: {
          appid: appId,
          secret: appSecret,
          js_code: code,
          grant_type: 'authorization_code',
        },
      });
    } catch (error: any) {
      this.recoveryLogger.error(
        `手机号兼容绑定获取会话异常: status=${error?.response?.status || '-'} message=${error?.message || error}`,
      );
      throw new BadRequestException('手机号绑定暂不可用，请稍后重试');
    }

    const { session_key: freshSessionKey, errcode, errmsg } = sessionResponse.data || {};
    if (errcode) {
      throw new BadRequestException(`获取会话失败: ${errmsg || '未知错误'}`);
    }

    const phone = this.decryptLegacyPhoneNumber(
      freshSessionKey || existingSessionKey,
      iv,
      encryptedData,
      appId,
    );

    // Do not refresh wechat_session here. The caller already has an authenticated access session,
    // and writing a new session_key after the durable cancellation transaction would recreate
    // sensitive Redis state that cancellation just removed.
    return this.persistPhoneForActiveUser(userId, phone);
  }

  private decryptLegacyPhoneNumber(
    sessionKey: string,
    iv: string,
    encryptedData: string,
    expectedAppId: string,
  ): string {
    let phoneData: any;
    try {
      const decipher = crypto.createDecipheriv(
        'aes-128-cbc',
        Buffer.from(sessionKey, 'base64'),
        Buffer.from(iv, 'base64'),
      );
      decipher.setAutoPadding(true);
      const decrypted = Buffer.concat([
        decipher.update(Buffer.from(encryptedData, 'base64')),
        decipher.final(),
      ]).toString('utf8');
      phoneData = JSON.parse(decrypted);
    } catch {
      throw new BadRequestException('手机号解密失败，请重试');
    }

    const isPlainObject = phoneData && typeof phoneData === 'object' && !Array.isArray(phoneData);
    const phoneNumber = isPlainObject ? phoneData.phoneNumber : undefined;
    const watermark = isPlainObject ? phoneData.watermark : undefined;
    const watermarkAppId = watermark && typeof watermark === 'object' ? watermark.appid : undefined;
    if (typeof phoneNumber !== 'string' || phoneNumber.trim() === '' || watermarkAppId !== expectedAppId) {
      throw new BadRequestException('手机号解密失败，请重试');
    }
    return phoneNumber;
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
