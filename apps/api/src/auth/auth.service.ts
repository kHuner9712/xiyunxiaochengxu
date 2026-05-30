import { Injectable, UnauthorizedException, BadRequestException, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../common/prisma/prisma.service';
import { RedisService } from '../common/redis/redis.service';
import * as bcrypt from 'bcrypt';
import axios from 'axios';
import * as svgCaptcha from 'svg-captcha';
import * as crypto from 'crypto';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly refreshTokenSecret: string;
  private readonly refreshTokenExpiresIn: string;

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private configService: ConfigService,
    private redisService: RedisService,
  ) {
    const nodeEnv = this.configService.get<string>('NODE_ENV', 'development');
    const jwtSecret = this.configService.get<string>('JWT_SECRET', 'baby-mall-secret-key');
    const configuredRefreshSecret = this.configService.get<string>('REFRESH_TOKEN_SECRET');

    if (!configuredRefreshSecret) {
      if (nodeEnv === 'production') {
        throw new Error('生产环境必须配置 REFRESH_TOKEN_SECRET');
      }
      this.logger.warn('REFRESH_TOKEN_SECRET 未配置，development 环境将回退使用 JWT_SECRET（仅用于本地开发）');
    }

    this.refreshTokenSecret = configuredRefreshSecret || jwtSecret;
    this.refreshTokenExpiresIn = this.configService.get<string>('REFRESH_TOKEN_EXPIRES_IN', '30d');
  }

  async getCaptcha() {
    const captcha = svgCaptcha.create({
      size: 4,
      noise: 1,
      color: false,
      width: 120,
      height: 40,
      charPreset: '0123456789',
    });
    const captchaId = `captcha:${Date.now()}:${Math.random().toString(36).substring(2)}`;
    await this.redisService.set(captchaId, captcha.text.toLowerCase(), 300);
    return { captchaId, captchaSvg: captcha.data };
  }

  async adminLogin(username: string, password: string, captchaId: string, captchaCode: string) {
    const nodeEnv = this.configService.get<string>('NODE_ENV', 'development');
    const smokeTestBypass = this.configService.get<string>('SMOKE_TEST_BYPASS_CAPTCHA', 'false');

    if (!(nodeEnv !== 'production' && smokeTestBypass === 'true' && captchaId === 'smoke-test' && captchaCode === 'bypass')) {
      const cachedCode = await this.redisService.get(captchaId);
      if (!cachedCode || cachedCode !== captchaCode.toLowerCase()) {
        throw new BadRequestException('验证码错误');
      }
      await this.redisService.del(captchaId);
    }

    const admin = await this.prisma.adminUser.findFirst({
      where: { username, deletedAt: null, status: 1 },
      include: {
        adminUserRoles: {
          include: {
            role: {
              include: {
                adminRolePermissions: {
                  include: { permission: true },
                },
              },
            },
          },
        },
      },
    });

    if (!admin) {
      throw new UnauthorizedException('用户名或密码错误');
    }

    const isPasswordValid = await bcrypt.compare(password, admin.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('用户名或密码错误');
    }

    await this.prisma.adminUser.update({
      where: { id: admin.id },
      data: { lastLoginAt: new Date() },
    });

    const roles = admin.adminUserRoles.map((ur) => ur.role.code);
    const permissions = admin.adminUserRoles.flatMap((ur) =>
      ur.role.adminRolePermissions.map((rp) => rp.permission.code),
    );

    const tokenId = crypto.randomUUID();
    const accessToken = await this.jwtService.signAsync(
      {
        id: admin.id.toString(),
        username: admin.username,
        roleType: 'admin',
        type: 'admin',
        roles,
        tokenType: 'access',
        tokenId,
      },
      { expiresIn: '2h' },
    );

    const refreshToken = await this.jwtService.signAsync(
      {
        id: admin.id.toString(),
        username: admin.username,
        roleType: 'admin',
        type: 'admin',
        roles,
        tokenType: 'refresh',
        tokenId,
      },
      {
        expiresIn: this.refreshTokenExpiresIn,
        secret: this.refreshTokenSecret,
      },
    );

    const refreshKey = `admin_refresh_token:${admin.id.toString()}:${tokenId}`;
    await this.redisService.set(refreshKey, refreshToken, 30 * 24 * 60 * 60);

    return {
      accessToken,
      refreshToken,
      adminUser: {
        id: admin.id.toString(),
        username: admin.username,
        realName: admin.realName,
        avatar: admin.avatar,
        roles,
        permissions: [...new Set(permissions)],
        mustChangePassword: admin.mustChangePassword,
      },
    };
  }

  async refreshToken(refreshToken: string) {
    let payload: any;
    try {
      payload = await this.jwtService.verifyAsync(refreshToken, { secret: this.refreshTokenSecret });
    } catch {
      throw new UnauthorizedException('Refresh token 无效或已过期');
    }

    if (payload.tokenType !== 'refresh') {
      throw new UnauthorizedException('无效的 token 类型');
    }

    const refreshKey = `admin_refresh_token:${payload.id}:${payload.tokenId}`;
    const storedToken = await this.redisService.get(refreshKey);
    if (!storedToken || storedToken !== refreshToken) {
      throw new UnauthorizedException('Refresh token 已失效，请重新登录');
    }

    const admin = await this.prisma.adminUser.findFirst({
      where: { id: BigInt(payload.id), deletedAt: null, status: 1 },
      include: {
        adminUserRoles: {
          include: {
            role: {
              include: {
                adminRolePermissions: {
                  include: { permission: true },
                },
              },
            },
          },
        },
      },
    });

    if (!admin) {
      throw new UnauthorizedException('管理员账号已禁用或删除');
    }

    const roles = admin.adminUserRoles.map((ur) => ur.role.code);
    const permissions = admin.adminUserRoles.flatMap((ur) =>
      ur.role.adminRolePermissions.map((rp) => rp.permission.code),
    );

    const newTokenId = crypto.randomUUID();
    const newAccessToken = await this.jwtService.signAsync(
      {
        id: admin.id.toString(),
        username: admin.username,
        roleType: 'admin',
        type: 'admin',
        roles,
        tokenType: 'access',
        tokenId: newTokenId,
      },
      { expiresIn: '2h' },
    );

    const newRefreshToken = await this.jwtService.signAsync(
      {
        id: admin.id.toString(),
        username: admin.username,
        roleType: 'admin',
        type: 'admin',
        roles,
        tokenType: 'refresh',
        tokenId: newTokenId,
      },
      {
        expiresIn: this.refreshTokenExpiresIn,
        secret: this.refreshTokenSecret,
      },
    );

    await this.redisService.del(refreshKey);
    await this.redisService.set(`admin_refresh_token:${admin.id.toString()}:${newTokenId}`, newRefreshToken, 30 * 24 * 60 * 60);

    return {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
    };
  }

  async adminLogout(adminId: string, tokenId: string) {
    const refreshKey = `admin_refresh_token:${adminId}:${tokenId}`;
    await this.redisService.del(refreshKey);
    return null;
  }

  async getAdminInfo(adminId: string) {
    const admin = await this.prisma.adminUser.findFirst({
      where: { id: BigInt(adminId), deletedAt: null, status: 1 },
      include: {
        adminUserRoles: {
          include: {
            role: {
              include: {
                adminRolePermissions: {
                  include: { permission: true },
                },
              },
            },
          },
        },
      },
    });

    if (!admin) {
      throw new UnauthorizedException('管理员不存在');
    }

    const roles = admin.adminUserRoles.map((ur) => ur.role.code);
    const permissions = admin.adminUserRoles.flatMap((ur) =>
      ur.role.adminRolePermissions.map((rp) => rp.permission.code),
    );

    return {
      id: admin.id.toString(),
      username: admin.username,
      realName: admin.realName,
      avatar: admin.avatar,
      phone: admin.phone,
      roles,
      permissions: [...new Set(permissions)],
      mustChangePassword: admin.mustChangePassword,
    };
  }

  async changePassword(adminId: string, oldPassword: string, newPassword: string, confirmPassword: string) {
    if (newPassword !== confirmPassword) {
      throw new BadRequestException('两次输入的新密码不一致');
    }

    if (oldPassword === newPassword) {
      throw new BadRequestException('新密码不能与旧密码相同');
    }

    if (newPassword.length < 12) {
      throw new BadRequestException('新密码长度不能少于12位');
    }

    const hasUpper = /[A-Z]/.test(newPassword);
    const hasLower = /[a-z]/.test(newPassword);
    const hasDigit = /[0-9]/.test(newPassword);
    const hasSpecial = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(newPassword);
    if (!hasUpper || !hasLower || !hasDigit || !hasSpecial) {
      throw new BadRequestException('新密码必须包含大小写字母、数字和特殊字符');
    }

    const weakPasswords = ['admin123', 'password', '123456', 'change_this_password'];
    if (weakPasswords.includes(newPassword)) {
      throw new BadRequestException('不允许使用弱密码');
    }

    const admin = await this.prisma.adminUser.findFirst({
      where: { id: BigInt(adminId), deletedAt: null },
    });

    if (!admin) {
      throw new UnauthorizedException('管理员不存在');
    }

    const isPasswordValid = await bcrypt.compare(oldPassword, admin.password);
    if (!isPasswordValid) {
      throw new BadRequestException('原密码错误');
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await this.prisma.adminUser.update({
      where: { id: BigInt(adminId) },
      data: { password: hashedPassword, mustChangePassword: false },
    });

    return null;
  }

  async weappLogin(code: string) {
    const appId = this.configService.get('WECHAT_APP_ID');
    const appSecret = this.configService.get('WECHAT_APP_SECRET');
    const url = `https://api.weixin.qq.com/sns/jscode2session?appid=${appId}&secret=${appSecret}&js_code=${code}&grant_type=authorization_code`;

    const response = await axios.get(url);
    const { openid, unionid, session_key, errcode, errmsg } = response.data;

    if (errcode) {
      throw new UnauthorizedException(`微信登录失败: ${errmsg}`);
    }

    let user = await this.prisma.user.findFirst({
      where: { openid, deletedAt: null },
    });

    let isNewUser = false;

    if (!user) {
      user = await this.prisma.user.create({
        data: {
          openid,
          unionId: unionid || null,
          memberLevelId: 1n,
          status: 1,
        },
      });
      isNewUser = true;
    } else {
      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          lastLoginAt: new Date(),
          unionId: unionid || user.unionId,
        },
      });
    }

    await this.redisService.set(
      `wechat_session:${user.id.toString()}`,
      session_key,
      86400 * 7,
    );

    const token = await this.jwtService.signAsync(
      {
        id: user.id.toString(),
        openid: user.openid,
        roleType: 'user',
        type: 'user',
        tokenType: 'access',
      },
      { expiresIn: '7d' },
    );

    return { token, isNewUser };
  }

  async bindPhone(userId: string, code: string, encryptedData?: string, iv?: string) {
    if (encryptedData && iv) {
      return this.bindPhoneLegacy(userId, code, encryptedData, iv);
    }
    return this.bindPhoneByCode(userId, code);
  }

  private async bindPhoneByCode(userId: string, code: string) {
    const appId = this.configService.get('WECHAT_APP_ID');
    const appSecret = this.configService.get('WECHAT_APP_SECRET');

    const accessTokenCacheKey = 'wechat_access_token';
    let access_token = await this.redisService.get(accessTokenCacheKey);

    if (!access_token) {
      const url = `https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=${appId}&secret=${appSecret}`;
      const tokenRes = await axios.get(url);
      const { access_token: fetchedAccessToken, expires_in, errcode, errmsg } = tokenRes.data;

      if (errcode) {
        throw new BadRequestException(`获取access_token失败: ${errmsg}`);
      }

      access_token = fetchedAccessToken;
      if (access_token) {
        const ttlSeconds = Math.max(60, Number(expires_in || 0) - 300);
        await this.redisService.set(accessTokenCacheKey, access_token, ttlSeconds);
      }
    }

    const phoneUrl = `https://api.weixin.qq.com/wxa/business/getuserphonenumber?access_token=${access_token}&code=${code}`;
    const phoneRes = await axios.post(phoneUrl);
    const { errcode: phoneErrcode, errmsg: phoneErrmsg, phone_info } = phoneRes.data;

    if (phoneErrcode) {
      throw new BadRequestException(`获取手机号失败: ${phoneErrmsg}`);
    }

    if (!phone_info || !phone_info.phoneNumber) {
      throw new BadRequestException('获取手机号失败，请重试');
    }

    await this.prisma.user.update({
      where: { id: BigInt(userId) },
      data: { phone: phone_info.phoneNumber },
    });

    return { phone: phone_info.phoneNumber };
  }

  private async bindPhoneLegacy(userId: string, code: string, encryptedData: string, iv: string) {
    const sessionKey = await this.redisService.get(`wechat_session:${userId}`);
    if (!sessionKey) {
      throw new UnauthorizedException('会话已过期，请重新登录');
    }

    const newAppId = this.configService.get('WECHAT_APP_ID');
    const newUrl = `https://api.weixin.qq.com/sns/jscode2session?appid=${newAppId}&secret=${this.configService.get('WECHAT_APP_SECRET')}&js_code=${code}&grant_type=authorization_code`;
    const newResponse = await axios.get(newUrl);
    const { session_key: newSessionKey, errcode, errmsg } = newResponse.data;

    if (errcode) {
      throw new BadRequestException(`获取会话失败: ${errmsg}`);
    }

    const effectiveSessionKey = newSessionKey || sessionKey;

    try {
      const decrypted = this.decryptWechatData(effectiveSessionKey, iv, encryptedData);
      const phoneData = JSON.parse(decrypted);

      if (newSessionKey) {
        await this.redisService.set(
          `wechat_session:${userId}`,
          newSessionKey,
          86400 * 7,
        );
      }

      await this.prisma.user.update({
        where: { id: BigInt(userId) },
        data: { phone: phoneData.phoneNumber },
      });

      return { phone: phoneData.phoneNumber };
    } catch (e) {
      throw new BadRequestException('手机号解密失败，请重试');
    }
  }

  private decryptWechatData(sessionKey: string, iv: string, encryptedData: string): string {
    const sessionKeyBuf = Buffer.from(sessionKey, 'base64');
    const ivBuf = Buffer.from(iv, 'base64');
    const encryptedBuf = Buffer.from(encryptedData, 'base64');

    const decipher = crypto.createDecipheriv('aes-128-cbc', sessionKeyBuf, ivBuf);
    decipher.setAutoPadding(true);

    let decrypted = decipher.update(encryptedBuf, undefined, 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  }
}
