import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
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
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private configService: ConfigService,
    private redisService: RedisService,
  ) {}

  async getCaptcha() {
    const captcha = svgCaptcha.create({
      size: 4,
      noise: 3,
      color: true,
      width: 120,
      height: 40,
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

    const token = await this.jwtService.signAsync(
      {
        id: admin.id.toString(),
        username: admin.username,
        roleType: 'admin',
        type: 'admin',
        roles,
      },
      { expiresIn: '2h' },
    );

    return {
      token,
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
      },
      { expiresIn: '7d' },
    );

    return { token, isNewUser };
  }

  async bindPhone(userId: string, code: string, encryptedData: string, iv: string) {
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
