import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../common/prisma/prisma.service';
import { RedisService } from '../../common/redis/redis.service';

interface JwtPayload {
  id: string;
  roleType: 'admin' | 'user';
  tokenType?: string;
  tokenId?: string;
  [key: string]: any;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
    private redis: RedisService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get('JWT_SECRET', 'baby-mall-secret-key'),
    });
  }

  async validate(payload: JwtPayload) {
    if (payload.tokenType && payload.tokenType !== 'access') {
      throw new UnauthorizedException('无效的 token 类型');
    }

    const tokenId = String(payload.tokenId || '').trim();
    if (!tokenId) {
      throw new UnauthorizedException('登录会话无效，请重新登录');
    }

    if (payload.roleType === 'admin') {
      const admin = await this.prisma.adminUser.findFirst({
        where: { id: BigInt(payload.id), deletedAt: null, status: 1 },
      });
      if (!admin) {
        throw new UnauthorizedException('管理员账号已禁用或删除');
      }

      // Admin access/refresh tokens share the same tokenId. The refresh-token registry therefore
      // doubles as the authoritative session registry: logout, password rotation and refresh-token
      // rotation immediately revoke the corresponding access token instead of waiting for JWT TTL.
      const activeSession = await this.redis.get(
        `admin_refresh_token:${payload.id}:${tokenId}`,
      );
      if (!activeSession) {
        throw new UnauthorizedException('登录会话已失效，请重新登录');
      }
    } else if (payload.roleType === 'user') {
      const user = await this.prisma.user.findFirst({
        where: { id: BigInt(payload.id), deletedAt: null, status: 1 },
      });
      if (!user) {
        throw new UnauthorizedException('用户账号已禁用或删除');
      }

      const activeSession = await this.redis.get(
        `weapp_access_token:${payload.id}:${tokenId}`,
      );
      if (!activeSession) {
        throw new UnauthorizedException('登录会话已失效，请重新登录');
      }
    } else {
      throw new UnauthorizedException('无效的登录身份');
    }

    return {
      id: payload.id,
      roleType: payload.roleType,
      username: payload.username,
      roles: payload.roles,
      tokenId,
    };
  }
}
