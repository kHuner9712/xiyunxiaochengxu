import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { OPTIONAL_AUTH_KEY } from '../decorators/optional-auth.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { parsePositiveBigIntId } from '../utils/bigint-id';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private jwtService: JwtService,
    private prisma: PrismaService,
    private redisService: RedisService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    const isOptionalAuth = this.reflector.getAllAndOverride<boolean>(OPTIONAL_AUTH_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic && !isOptionalAuth) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const url: string = request.url || '';
    const authHeader = request.headers.authorization;

    if (!authHeader && isOptionalAuth) {
      return true;
    }

    if (!authHeader) {
      throw new UnauthorizedException('未登录');
    }

    const token = authHeader.startsWith('Bearer ')
      ? authHeader.substring(7)
      : authHeader;

    let payload: any;
    try {
      payload = await this.jwtService.verifyAsync(token);
    } catch {
      throw new UnauthorizedException('登录已过期');
    }

    if (payload.tokenType !== 'access') {
      throw new UnauthorizedException('无效的 token 类型，请使用 access token');
    }

    await this.assertLiveAccountSession(payload);
    request.user = payload;

    if (url.startsWith('/api/common/')) {
      return true;
    }

    if (url.startsWith('/api/weapp/')) {
      if (payload.roleType !== 'user') {
        throw new ForbiddenException('仅允许小程序用户访问');
      }
      return true;
    }

    if (url.startsWith('/api/admin/')) {
      if (payload.roleType !== 'admin') {
        throw new ForbiddenException('仅允许管理员访问');
      }
      return true;
    }

    return true;
  }

  private async assertLiveAccountSession(payload: any): Promise<void> {
    let accountId: bigint;
    try {
      accountId = parsePositiveBigIntId(payload?.id, '账号');
    } catch {
      throw new UnauthorizedException('登录凭证中的账号ID无效');
    }

    if (payload.roleType === 'admin') {
      const admin = await this.prisma.adminUser.findFirst({
        where: { id: accountId, deletedAt: null, status: 1 },
        select: { id: true },
      });
      if (!admin) {
        throw new UnauthorizedException('管理员账号已停用或删除，请重新登录');
      }

      const tokenId = typeof payload.tokenId === 'string' ? payload.tokenId.trim() : '';
      if (!tokenId) {
        throw new UnauthorizedException('管理员登录会话无效，请重新登录');
      }
      const refreshSessionExists = await this.redisService.exists(
        `admin_refresh_token:${accountId.toString()}:${tokenId}`,
      );
      if (!refreshSessionExists) {
        throw new UnauthorizedException('管理员登录会话已失效，请重新登录');
      }
      return;
    }

    if (payload.roleType === 'user') {
      const user = await this.prisma.user.findFirst({
        where: { id: accountId, deletedAt: null, status: 1 },
        select: { id: true },
      });
      if (!user) {
        throw new UnauthorizedException('账号已停用或删除，请重新登录');
      }
      return;
    }

    throw new UnauthorizedException('无效的账号类型');
  }
}
