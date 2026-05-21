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

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private jwtService: JwtService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const url: string = request.url || '';
    const authHeader = request.headers.authorization;

    if (!authHeader) {
      throw new UnauthorizedException('未登录');
    }

    const token = authHeader.startsWith('Bearer ')
      ? authHeader.substring(7)
      : authHeader;

    let payload: any;
    try {
      payload = await this.jwtService.verifyAsync(token);
      request.user = payload;
    } catch {
      throw new UnauthorizedException('登录已过期');
    }

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
}
