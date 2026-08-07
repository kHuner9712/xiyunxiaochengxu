import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../common/prisma/prisma.service';
import { parsePositiveBigIntId } from '../common/utils/bigint-id';
import { AdminService } from './admin.service';

@Injectable()
export class ProductionAdminService extends AdminService {
  constructor(private readonly productionPrisma: PrismaService) {
    super(productionPrisma);
  }

  override async create(data: any) {
    const roleIds = this.normalizeIds(data.roleIds, '角色');
    const passwordHash = await bcrypt.hash(String(data.password), 10);

    const admin = await this.productionPrisma.$transaction(async (tx) => {
      const existing = await tx.adminUser.findFirst({
        where: { username: String(data.username).trim(), deletedAt: null },
        select: { id: true },
      });
      if (existing) throw new BadRequestException('管理员用户名已存在');
      await this.assertActiveRoles(tx, roleIds);

      const created = await tx.adminUser.create({
        data: {
          username: String(data.username).trim(),
          password: passwordHash,
          realName: data.realName?.trim() || null,
          phone: data.phone?.trim() || null,
          avatar: data.avatar?.trim() || null,
          status: data.status ?? 1,
        },
      });
      await tx.adminUserRole.createMany({
        data: roleIds.map((roleId) => ({ adminUserId: created.id, roleId })),
      });
      return created;
    });

    return { id: admin.id.toString(), username: admin.username };
  }

  override async update(id: string, data: any) {
    const adminId = parsePositiveBigIntId(id, '管理员');
    const passwordHash = data.password ? await bcrypt.hash(String(data.password), 10) : undefined;
    const requestedRoleIds = data.roleIds !== undefined
      ? this.normalizeIds(data.roleIds, '角色')
      : undefined;

    const result = await this.productionPrisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM admin_users WHERE id = ${adminId} AND deleted_at IS NULL FOR UPDATE`;
      const current = await tx.adminUser.findFirst({
        where: { id: adminId, deletedAt: null },
        include: { adminUserRoles: { include: { role: true } } },
      });
      if (!current) throw new NotFoundException('管理员不存在');

      if (requestedRoleIds) await this.assertActiveRoles(tx, requestedRoleIds);
      const currentIsSuper = current.adminUserRoles.some((item) => item.role.status === 1 && item.role.code === 'super_admin');
      let nextIsSuper = currentIsSuper;
      if (requestedRoleIds) {
        const requestedRoles = await tx.adminRole.findMany({
          where: { id: { in: requestedRoleIds }, status: 1 },
          select: { code: true },
        });
        nextIsSuper = requestedRoles.some((role) => role.code === 'super_admin');
      }
      const nextStatus = data.status ?? current.status;
      if (currentIsSuper && (!nextIsSuper || nextStatus !== 1)) {
        await this.assertAnotherActiveSuperAdmin(tx, adminId);
      }

      const updateData: any = {};
      if (data.realName !== undefined) updateData.realName = data.realName?.trim() || null;
      if (data.phone !== undefined) updateData.phone = data.phone?.trim() || null;
      if (data.avatar !== undefined) updateData.avatar = data.avatar?.trim() || null;
      if (passwordHash) updateData.password = passwordHash;
      if (data.status !== undefined) updateData.status = data.status;

      if (requestedRoleIds) {
        await tx.adminUserRole.deleteMany({ where: { adminUserId: adminId } });
        await tx.adminUserRole.createMany({
          data: requestedRoleIds.map((roleId) => ({ adminUserId: adminId, roleId })),
        });
      }

      return tx.adminUser.update({ where: { id: adminId }, data: updateData });
    });
    return { id: result.id.toString(), username: result.username };
  }

  override async updateStatus(id: string, status: number) {
    const adminId = parsePositiveBigIntId(id, '管理员');
    const result = await this.productionPrisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM admin_users WHERE id = ${adminId} AND deleted_at IS NULL FOR UPDATE`;
      const current = await tx.adminUser.findFirst({
        where: { id: adminId, deletedAt: null },
        include: { adminUserRoles: { include: { role: true } } },
      });
      if (!current) throw new NotFoundException('管理员不存在');
      const isSuper = current.adminUserRoles.some((item) => item.role.status === 1 && item.role.code === 'super_admin');
      if (isSuper && status !== 1) await this.assertAnotherActiveSuperAdmin(tx, adminId);
      return tx.adminUser.update({ where: { id: adminId }, data: { status } });
    });
    return { id: result.id.toString(), status: result.status };
  }

  override async delete(id: string) {
    const adminId = parsePositiveBigIntId(id, '管理员');
    const result = await this.productionPrisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM admin_users WHERE id = ${adminId} AND deleted_at IS NULL FOR UPDATE`;
      const current = await tx.adminUser.findFirst({
        where: { id: adminId, deletedAt: null },
        include: { adminUserRoles: { include: { role: true } } },
      });
      if (!current) throw new NotFoundException('管理员不存在');
      const isSuper = current.adminUserRoles.some((item) => item.role.status === 1 && item.role.code === 'super_admin');
      if (isSuper) await this.assertAnotherActiveSuperAdmin(tx, adminId);
      return tx.adminUser.update({
        where: { id: adminId },
        data: { deletedAt: new Date(), status: 0 },
      });
    });
    return { id: result.id.toString() };
  }

  override async createRole(data: any) {
    const permissionIds = this.normalizeIds(data.permissionIds, '权限');
    const result = await this.productionPrisma.$transaction(async (tx) => {
      const duplicate = await tx.adminRole.findFirst({ where: { code: data.code } });
      if (duplicate) throw new BadRequestException('角色编码已存在');
      await this.assertPermissions(tx, permissionIds);
      const role = await tx.adminRole.create({
        data: {
          name: String(data.name).trim(),
          code: String(data.code).trim(),
          description: data.description?.trim() || null,
          status: 1,
        },
      });
      await tx.adminRolePermission.createMany({
        data: permissionIds.map((permissionId) => ({ roleId: role.id, permissionId })),
      });
      return role;
    });
    return { id: result.id.toString(), name: result.name, code: result.code };
  }

  override async updateRole(id: string, data: any) {
    const roleId = parsePositiveBigIntId(id, '角色');
    const permissionIds = data.permissionIds !== undefined
      ? this.normalizeIds(data.permissionIds, '权限')
      : undefined;
    const result = await this.productionPrisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM admin_roles WHERE id = ${roleId} FOR UPDATE`;
      const current = await tx.adminRole.findUnique({ where: { id: roleId } });
      if (!current || current.status !== 1) throw new NotFoundException('角色不存在或已停用');
      if (permissionIds) {
        await this.assertPermissions(tx, permissionIds);
        await tx.adminRolePermission.deleteMany({ where: { roleId } });
        await tx.adminRolePermission.createMany({
          data: permissionIds.map((permissionId) => ({ roleId, permissionId })),
        });
      }
      return tx.adminRole.update({
        where: { id: roleId },
        data: {
          ...(data.name !== undefined ? { name: String(data.name).trim() } : {}),
          ...(data.description !== undefined ? { description: data.description?.trim() || null } : {}),
        },
      });
    });
    return { id: result.id.toString(), name: result.name };
  }

  override async deleteRole(id: string) {
    const roleId = parsePositiveBigIntId(id, '角色');
    const result = await this.productionPrisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM admin_roles WHERE id = ${roleId} FOR UPDATE`;
      const role = await tx.adminRole.findUnique({ where: { id: roleId } });
      if (!role || role.status !== 1) throw new NotFoundException('角色不存在或已停用');
      if (role.code === 'super_admin') {
        throw new BadRequestException('超级管理员角色是后台安全基线，不能删除');
      }
      return tx.adminRole.update({ where: { id: roleId }, data: { status: 2 } });
    });
    return { id: result.id.toString() };
  }

  private normalizeIds(values: unknown, label: string): bigint[] {
    if (!Array.isArray(values) || values.length === 0) {
      throw new BadRequestException(`至少选择一个${label}`);
    }
    return Array.from(new Set(values.map((value) =>
      parsePositiveBigIntId(value, label).toString(),
    ))).map((value) => BigInt(value));
  }

  private async assertActiveRoles(tx: any, roleIds: bigint[]) {
    const roles = await tx.adminRole.findMany({
      where: { id: { in: roleIds }, status: 1 },
      select: { id: true },
    });
    if (roles.length !== roleIds.length) throw new BadRequestException('包含不存在或已停用的角色');
  }

  private async assertPermissions(tx: any, permissionIds: bigint[]) {
    const count = await tx.adminPermission.count({ where: { id: { in: permissionIds } } });
    if (count !== permissionIds.length) throw new BadRequestException('包含不存在的权限');
  }

  private async assertAnotherActiveSuperAdmin(tx: any, excludedAdminId: bigint) {
    const count = await tx.adminUser.count({
      where: {
        id: { not: excludedAdminId },
        deletedAt: null,
        status: 1,
        adminUserRoles: {
          some: { role: { code: 'super_admin', status: 1 } },
        },
      },
    });
    if (count === 0) {
      throw new BadRequestException('至少必须保留一个启用的超级管理员账号');
    }
  }
}
