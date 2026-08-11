import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { parsePositiveBigIntId } from '../common/utils/bigint-id';

interface OperatorScope {
  isSuper: boolean;
  permissions: Set<string>;
}

@Injectable()
export class AdminPrivilegeService {
  constructor(private readonly prisma: PrismaService) {}

  async assertCanAssignRoles(operatorId: string, roleIds?: string[]) {
    if (roleIds === undefined) return;
    const scope = await this.loadOperatorScope(operatorId);
    const normalized = this.normalizeIds(roleIds, '角色');
    const roles = await this.prisma.adminRole.findMany({
      where: { id: { in: normalized }, status: 1 },
      include: {
        adminRolePermissions: { include: { permission: true } },
      },
    });
    if (roles.length !== normalized.length) {
      throw new BadRequestException('包含不存在或已停用的角色');
    }
    if (scope.isSuper) return;

    if (roles.some((role) => role.code === 'super_admin')) {
      throw new ForbiddenException('只有超级管理员可以授予超级管理员角色');
    }
    for (const role of roles) {
      const excess = role.adminRolePermissions.find(
        (item) => !scope.permissions.has(item.permission.code),
      );
      if (excess) {
        throw new ForbiddenException(`不能授予超出自身权限范围的角色：${role.name}`);
      }
    }
  }

  async assertCanMutateAdmin(
    operatorId: string,
    targetAdminId: string,
    nextRoleIds?: string[],
  ) {
    const scope = await this.loadOperatorScope(operatorId);
    const targetId = parsePositiveBigIntId(targetAdminId, '管理员');
    const target = await this.prisma.adminUser.findFirst({
      where: { id: targetId, deletedAt: null },
      include: {
        adminUserRoles: {
          include: {
            role: {
              include: {
                adminRolePermissions: { include: { permission: true } },
              },
            },
          },
        },
      },
    });
    if (!target) throw new NotFoundException('管理员不存在');

    if (!scope.isSuper) {
      const activeRoles = target.adminUserRoles.filter((item) => item.role.status === 1);
      if (activeRoles.some((item) => item.role.code === 'super_admin')) {
        throw new ForbiddenException('只有超级管理员可以修改超级管理员账号');
      }
      const targetPermissions = new Set(
        activeRoles.flatMap((item) =>
          item.role.adminRolePermissions.map((rp) => rp.permission.code),
        ),
      );
      for (const permission of targetPermissions) {
        if (!scope.permissions.has(permission)) {
          throw new ForbiddenException('不能修改权限范围高于自身的管理员账号');
        }
      }
    }

    if (nextRoleIds !== undefined) {
      await this.assertCanAssignRoles(operatorId, nextRoleIds);
    }
  }

  async assertCanDelegatePermissions(operatorId: string, permissionIds?: string[]) {
    if (permissionIds === undefined) return;
    const scope = await this.loadOperatorScope(operatorId);
    if (scope.isSuper) return;

    const normalized = this.normalizeIds(permissionIds, '权限');
    const permissions = await this.prisma.adminPermission.findMany({
      where: { id: { in: normalized } },
      select: { id: true, code: true },
    });
    if (permissions.length !== normalized.length) {
      throw new BadRequestException('包含不存在的权限');
    }
    const excess = permissions.find((permission) => !scope.permissions.has(permission.code));
    if (excess) {
      throw new ForbiddenException(`不能授予超出自身权限范围的权限：${excess.code}`);
    }
  }

  async assertCanMutateRole(
    operatorId: string,
    roleId: string,
    nextPermissionIds?: string[],
  ) {
    const scope = await this.loadOperatorScope(operatorId);
    const id = parsePositiveBigIntId(roleId, '角色');
    const role = await this.prisma.adminRole.findUnique({
      where: { id },
      include: {
        adminRolePermissions: { include: { permission: true } },
      },
    });
    if (!role) throw new NotFoundException('角色不存在');

    if (!scope.isSuper) {
      if (role.code === 'super_admin') {
        throw new ForbiddenException('只有超级管理员可以修改超级管理员角色');
      }
      for (const item of role.adminRolePermissions) {
        if (!scope.permissions.has(item.permission.code)) {
          throw new ForbiddenException('不能修改权限范围高于自身的角色');
        }
      }
    }

    if (nextPermissionIds !== undefined) {
      await this.assertCanDelegatePermissions(operatorId, nextPermissionIds);
    }
  }

  private async loadOperatorScope(operatorId: string): Promise<OperatorScope> {
    const id = parsePositiveBigIntId(operatorId, '当前管理员');
    const operator = await this.prisma.adminUser.findFirst({
      where: { id, deletedAt: null, status: 1 },
      include: {
        adminUserRoles: {
          include: {
            role: {
              include: {
                adminRolePermissions: { include: { permission: true } },
              },
            },
          },
        },
      },
    });
    if (!operator) throw new ForbiddenException('当前管理员账号不可用');

    const activeRoles = operator.adminUserRoles.filter((item) => item.role.status === 1);
    const isSuper = activeRoles.some((item) => item.role.code === 'super_admin');
    const permissions = new Set(
      activeRoles.flatMap((item) =>
        item.role.adminRolePermissions.map((rp) => rp.permission.code),
      ),
    );
    return { isSuper, permissions };
  }

  private normalizeIds(values: string[], label: string): bigint[] {
    if (!Array.isArray(values) || values.length === 0) {
      throw new BadRequestException(`至少选择一个${label}`);
    }
    return Array.from(
      new Set(values.map((value) => parsePositiveBigIntId(value, label).toString())),
    ).map((value) => BigInt(value));
  }
}
