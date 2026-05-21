import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../common/prisma/prisma.service';

interface JwtPayload {
  id: string;
  roleType: 'admin' | 'user';
  [key: string]: any;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get('JWT_SECRET', 'baby-mall-secret-key'),
    });
  }

  async validate(payload: JwtPayload) {
    if (payload.roleType === 'admin') {
      const admin = await this.prisma.adminUser.findFirst({
        where: { id: BigInt(payload.id), deletedAt: null, status: 1 },
      });
      if (!admin) {
        throw new UnauthorizedException('管理员账号已禁用或删除');
      }
    } else if (payload.roleType === 'user') {
      const user = await this.prisma.user.findFirst({
        where: { id: BigInt(payload.id), deletedAt: null, status: 1 },
      });
      if (!user) {
        throw new UnauthorizedException('用户账号已禁用或删除');
      }
    }

    return {
      id: payload.id,
      roleType: payload.roleType,
      openid: payload.openid,
      username: payload.username,
      roles: payload.roles,
    };
  }
}
