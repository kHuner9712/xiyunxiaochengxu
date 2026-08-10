import { Injectable, InternalServerErrorException, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Prisma } from '@prisma/client';
import axios from 'axios';
import { PrismaService } from '../common/prisma/prisma.service';
import { RedisService } from '../common/redis/redis.service';
import { AuthService } from './auth.service';

@Injectable()
export class ProductionAuthService extends AuthService {
  private readonly productionLogger = new Logger(ProductionAuthService.name);

  constructor(
    private readonly productionPrisma: PrismaService,
    private readonly productionJwt: JwtService,
    private readonly productionConfig: ConfigService,
    private readonly productionRedis: RedisService,
  ) {
    super(productionPrisma, productionJwt, productionConfig, productionRedis);
  }

  override async changePassword(
    adminId: string,
    oldPassword: string,
    newPassword: string,
    confirmPassword: string,
  ) {
    const result = await super.changePassword(
      adminId,
      oldPassword,
      newPassword,
      confirmPassword,
    );

    try {
      const revoked = await this.productionRedis.delByPattern(
        `admin_refresh_token:${adminId}:*`,
      );
      this.productionLogger.log(
        `管理员修改密码后已撤销全部登录会话: adminId=${adminId}, revokedSessions=${revoked}`,
      );
    } catch (error) {
      // The password is already changed at this point. Do not falsely report a clean security
      // transition if session revocation could not be completed; operations must repair Redis
      // and require a fresh login before considering the change fully closed.
      this.productionLogger.error(
        `管理员密码已修改但旧会话撤销失败: adminId=${adminId}, error=${(error as Error).message}`,
        (error as Error).stack,
      );
      throw new InternalServerErrorException(
        '密码已修改，但旧登录会话撤销失败；请联系管理员检查 Redis 后重新登录',
      );
    }

    return result;
  }

  override async weappLogin(code: string) {
    const appId = this.productionConfig.get<string>('WECHAT_APP_ID');
    const appSecret = this.productionConfig.get<string>('WECHAT_APP_SECRET');
    if (!appId || !appSecret) {
      this.productionLogger.error('微信登录失败：WECHAT_APP_ID 或 WECHAT_APP_SECRET 未配置');
      throw new UnauthorizedException('微信登录暂不可用，请稍后重试');
    }

    let response;
    try {
      response = await axios.get('https://api.weixin.qq.com/sns/jscode2session', {
        params: {
          appid: appId,
          secret: appSecret,
          js_code: code,
          grant_type: 'authorization_code',
        },
      });
    } catch (error: any) {
      this.productionLogger.error(
        `微信登录请求异常: status=${error?.response?.status || '-'} message=${error?.message || error}`,
      );
      throw new UnauthorizedException('微信登录暂不可用，请稍后重试');
    }

    const { openid, unionid, session_key, errcode, errmsg } = response.data || {};
    if (errcode) {
      this.productionLogger.warn(`微信登录返回错误: errcode=${errcode} errmsg=${errmsg || '-'}`);
      throw new UnauthorizedException(`微信登录失败: ${errmsg || '未知错误'}`);
    }
    if (!openid || !session_key) {
      throw new UnauthorizedException('微信登录失败，请稍后重试');
    }

    let user = await this.productionPrisma.user.findFirst({
      where: { openid, deletedAt: null },
    });
    let isNewUser = false;

    if (!user) {
      const defaultLevel = await this.productionPrisma.memberLevel.findFirst({
        where: { status: 1, minGrowthValue: 0 },
        orderBy: { sortOrder: 'asc' },
      });
      try {
        user = await this.productionPrisma.user.create({
          data: {
            openid,
            unionId: unionid || null,
            memberLevelId: defaultLevel?.id || null,
            status: 1,
            lastLoginAt: new Date(),
          },
        });
        isNewUser = true;
      } catch (error) {
        if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') {
          throw error;
        }
        // Another concurrent first-login request created the same openid. Re-read the durable
        // user instead of surfacing a transient 500 to the mini-program.
        user = await this.productionPrisma.user.findFirst({
          where: { openid, deletedAt: null },
        });
        if (!user) throw error;
        isNewUser = false;
      }
    }

    if (user.status !== 1 || user.deletedAt) {
      throw new UnauthorizedException('账号已停用，请联系客服');
    }

    user = await this.productionPrisma.user.update({
      where: { id: user.id },
      data: {
        lastLoginAt: new Date(),
        ...(unionid ? { unionId: unionid } : {}),
      },
    });

    await this.productionRedis.set(
      `wechat_session:${user.id.toString()}`,
      session_key,
      86400 * 7,
    );

    const token = await this.productionJwt.signAsync(
      {
        id: user.id.toString(),
        roleType: 'user',
        type: 'user',
        tokenType: 'access',
      },
      { expiresIn: '7d' },
    );

    return { token, isNewUser };
  }
}
