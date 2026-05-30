import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../prisma/prisma.service';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { SKIP_MUST_CHANGE_PASSWORD_KEY } from '../decorators/skip-must-change-password.decorator';

@Injectable()
export class AdminMustChangePasswordGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const skipMustChangePassword = this.reflector.getAllAndOverride<boolean>(
      SKIP_MUST_CHANGE_PASSWORD_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (skipMustChangePassword) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user || user.roleType !== 'admin') {
      return true;
    }

    const url: string = request.url || '';
    if (!url.startsWith('/api/admin/')) {
      return true;
    }

    const admin = await this.prisma.adminUser.findFirst({
      where: { id: BigInt(user.id), deletedAt: null },
      select: { mustChangePassword: true },
    });

    if (admin && admin.mustChangePassword) {
      throw new ForbiddenException('请先修改初始密码');
    }

    return true;
  }
}
