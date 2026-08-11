import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { REQUIRE_PERMISSION_KEY } from '../decorators/require-permission.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { parsePositiveBigIntId } from '../utils/bigint-id';

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
    if (!user?.id || user.roleType !== 'admin') {
      throw new ForbiddenException('无权限访问');
    }

    const adminUserId = parsePositiveBigIntId(user.id, '管理员');
    const adminUserRoles = await this.prisma.adminUserRole.findMany({
      where: { adminUserId },
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

    // Role deletion is a soft state change. Never let a disabled/deleted role continue granting
    // permissions merely because its historical admin_user_roles rows still exist.
    const activeRoles = adminUserRoles.filter((assignment) => assignment.role.status === 1);
    const roleCodes = activeRoles.map((assignment) => assignment.role.code);
    if (roleCodes.includes('super_admin')) {
      return true;
    }

    const permissions = new Set(
      activeRoles.flatMap((assignment) =>
        assignment.role.adminRolePermissions.map((rp) => rp.permission.code),
      ),
    );
    if (requiredPermissions.some((permission) => permissions.has(permission))) {
      return true;
    }

    throw new ForbiddenException(`缺少权限：${requiredPermissions.join(' 或 ')}`);
  }
}
