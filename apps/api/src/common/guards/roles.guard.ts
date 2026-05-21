import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user || !user.id) {
      throw new ForbiddenException('无权限访问');
    }

    if (user.roleType === 'admin') {
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

      if (requiredRoles.some((role) => roleCodes.includes(role))) {
        return true;
      }
    }

    throw new ForbiddenException('无权限访问');
  }
}
