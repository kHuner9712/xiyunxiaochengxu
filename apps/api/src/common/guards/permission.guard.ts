import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { REQUIRE_PERMISSION_KEY } from '../decorators/require-permission.decorator';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(
      REQUIRE_PERMISSION_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user || !user.id) {
      throw new ForbiddenException('无权限访问');
    }

    if (user.roleType !== 'admin') {
      throw new ForbiddenException('无权限访问');
    }

    const adminUserRoles = await this.prisma.adminUserRole.findMany({
      where: { adminUserId: BigInt(user.id) },
      include: {
        role: {
          include: {
            adminRolePermissions: {
              include: { permission: true },
            },
          },
        },
      },
    });

    const roleCodes = adminUserRoles.map((ur) => ur.role.code);
    if (roleCodes.includes('super_admin')) {
      return true;
    }

    const permissions = adminUserRoles.flatMap((ur) =>
      ur.role.adminRolePermissions.map((rp) => rp.permission.code),
    );

    // 检查用户是否拥有任一需要的权限
    const hasPermission = requiredPermissions.some(perm => permissions.includes(perm));
    if (hasPermission) {
      return true;
    }

    throw new ForbiddenException(`缺少权限：${requiredPermissions.join(' 或 ')}`);
  }
}
