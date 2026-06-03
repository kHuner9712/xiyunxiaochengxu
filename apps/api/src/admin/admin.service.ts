import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { AdminQueryDto } from './dto/admin-query.dto';
import { OperationLogQueryDto } from './dto/operation-log-query.dto';
import { paginate } from '@baby-mall/shared';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  constructor(private prisma: PrismaService) {}

  async findAll(dto: AdminQueryDto) {
    const where: any = { deletedAt: null };
    if (dto.keyword) {
      where.OR = [
        { username: { contains: dto.keyword } },
        { realName: { contains: dto.keyword } },
      ];
    }
    if (dto.username) where.username = { contains: dto.username };
    if (dto.status !== undefined) where.status = dto.status;

    const [list, total] = await Promise.all([
      this.prisma.adminUser.findMany({
        where,
        skip: dto.skip,
        take: dto.take,
        orderBy: { createdAt: 'desc' },
        include: {
          adminUserRoles: { include: { role: true } },
        },
      }),
      this.prisma.adminUser.count({ where }),
    ]);

    return paginate(
      list.map((u) => ({
        id: u.id.toString(),
        username: u.username,
        realName: u.realName,
        avatar: u.avatar,
        phone: u.phone,
        status: u.status,
        lastLoginAt: u.lastLoginAt,
        roles: u.adminUserRoles.map((ur) => ({
          id: ur.role.id.toString(),
          name: ur.role.name,
          code: ur.role.code,
        })),
        createdAt: u.createdAt,
      })),
      total,
      dto.page,
      dto.pageSize,
    );
  }

  async findById(id: string) {
    const admin = await this.prisma.adminUser.findFirst({
      where: { id: BigInt(id), deletedAt: null },
      include: {
        adminUserRoles: { include: { role: { include: { adminRolePermissions: { include: { permission: true } } } } } },
      },
    });
    if (!admin) throw new NotFoundException('管理员不存在');

    const permissions: string[] = [];
    for (const ur of admin.adminUserRoles) {
      for (const rp of ur.role.adminRolePermissions) {
        if (rp.permission && !permissions.includes(rp.permission.code)) {
          permissions.push(rp.permission.code);
        }
      }
    }

    return {
      id: admin.id.toString(),
      username: admin.username,
      realName: admin.realName,
      avatar: admin.avatar,
      phone: admin.phone,
      status: admin.status,
      lastLoginAt: admin.lastLoginAt,
      roles: admin.adminUserRoles.map((ur) => ({
        id: ur.role.id.toString(),
        name: ur.role.name,
        code: ur.role.code,
      })),
      permissions,
      createdAt: admin.createdAt,
    };
  }

  async create(data: { username: string; password: string; realName?: string; phone?: string; avatar?: string; roleIds?: string[] }) {
    const hashedPassword = await bcrypt.hash(data.password, 10);
    const admin = await this.prisma.adminUser.create({
      data: {
        username: data.username,
        password: hashedPassword,
        realName: data.realName,
        phone: data.phone,
        avatar: data.avatar,
      },
    });

    if (data.roleIds && data.roleIds.length > 0) {
      await this.prisma.adminUserRole.createMany({
        data: data.roleIds.map((roleId) => ({
          adminUserId: admin.id,
          roleId: BigInt(roleId),
        })),
      });
    }

    this.logger.log(`创建管理员：${admin.username}`);
    return { id: admin.id.toString(), username: admin.username };
  }

  async update(id: string, data: { realName?: string; phone?: string; avatar?: string; password?: string; roleIds?: string[] }) {
    const admin = await this.prisma.adminUser.findFirst({ where: { id: BigInt(id), deletedAt: null } });
    if (!admin) throw new NotFoundException('管理员不存在');

    const updateData: any = {};
    if (data.realName !== undefined) updateData.realName = data.realName;
    if (data.phone !== undefined) updateData.phone = data.phone;
    if (data.avatar !== undefined) updateData.avatar = data.avatar;
    if (data.password) updateData.password = await bcrypt.hash(data.password, 10);

    if (data.roleIds !== undefined) {
      await this.prisma.adminUserRole.deleteMany({ where: { adminUserId: BigInt(id) } });
      if (data.roleIds.length > 0) {
        await this.prisma.adminUserRole.createMany({
          data: data.roleIds.map((roleId) => ({
            adminUserId: BigInt(id),
            roleId: BigInt(roleId),
          })),
        });
      }
    }

    const result = await this.prisma.adminUser.update({ where: { id: BigInt(id) }, data: updateData });
    this.logger.log(`更新管理员：${id}`);
    return { id: result.id.toString(), username: result.username };
  }

  async updateStatus(id: string, status: number) {
    const result = await this.prisma.adminUser.update({
      where: { id: BigInt(id) },
      data: { status },
    });
    this.logger.log(`更新管理员状态：${id} -> ${status}`);
    return { id: result.id.toString(), status };
  }

  async delete(id: string) {
    const result = await this.prisma.adminUser.update({
      where: { id: BigInt(id) },
      data: { deletedAt: new Date() },
    });
    this.logger.log(`删除管理员：${id}`);
    return { id: result.id.toString() };
  }

  async findAllRoles() {
    const roles = await this.prisma.adminRole.findMany({
      where: { status: 1 },
      include: {
        adminRolePermissions: { include: { permission: true } },
      },
    });
    return roles.map((r) => ({
      ...r,
      id: r.id.toString(),
      adminRolePermissions: r.adminRolePermissions.map((rp) => ({
        ...rp,
        id: rp.id.toString(),
        roleId: rp.roleId.toString(),
        permissionId: rp.permissionId.toString(),
        permission: rp.permission ? { ...rp.permission, id: rp.permission.id.toString(), parentId: rp.permission.parentId.toString() } : null,
      })),
    }));
  }

  async findRoleById(id: string) {
    const role = await this.prisma.adminRole.findFirst({
      where: { id: BigInt(id) },
      include: {
        adminRolePermissions: { include: { permission: true } },
      },
    });
    if (!role) throw new NotFoundException('角色不存在');
    return {
      ...role,
      id: role.id.toString(),
      adminRolePermissions: role.adminRolePermissions.map((rp) => ({
        ...rp,
        id: rp.id.toString(),
        roleId: rp.roleId.toString(),
        permissionId: rp.permissionId.toString(),
        permission: rp.permission ? { ...rp.permission, id: rp.permission.id.toString(), parentId: rp.permission.parentId.toString() } : null,
      })),
    };
  }

  async createRole(data: { name: string; code: string; description?: string; permissionIds?: string[] }) {
    const role = await this.prisma.adminRole.create({
      data: { name: data.name, code: data.code, description: data.description },
    });

    if (data.permissionIds && data.permissionIds.length > 0) {
      await this.prisma.adminRolePermission.createMany({
        data: data.permissionIds.map((pid) => ({
          roleId: role.id,
          permissionId: BigInt(pid),
        })),
      });
    }

    this.logger.log(`创建角色：${data.name}`);
    return { id: role.id.toString(), name: role.name, code: role.code };
  }

  async updateRole(id: string, data: { name?: string; description?: string; permissionIds?: string[] }) {
    if (data.permissionIds !== undefined) {
      await this.prisma.adminRolePermission.deleteMany({ where: { roleId: BigInt(id) } });
      if (data.permissionIds.length > 0) {
        await this.prisma.adminRolePermission.createMany({
          data: data.permissionIds.map((pid) => ({
            roleId: BigInt(id),
            permissionId: BigInt(pid),
          })),
        });
      }
    }

    const result = await this.prisma.adminRole.update({
      where: { id: BigInt(id) },
      data: { name: data.name, description: data.description },
    });

    this.logger.log(`更新角色：${id}`);
    return { id: result.id.toString(), name: result.name };
  }

  async deleteRole(id: string) {
    const result = await this.prisma.adminRole.update({
      where: { id: BigInt(id) },
      data: { status: 2 },
    });
    this.logger.log(`删除角色：${id}`);
    return { id: result.id.toString() };
  }

  async findAllPermissions() {
    const permissions = await this.prisma.adminPermission.findMany({
      orderBy: { sortOrder: 'asc' },
    });
    return this.buildPermissionTree(permissions);
  }

  async findOperationLogs(dto: OperationLogQueryDto) {
    const where: any = {};
    if (dto.module) where.module = dto.module;
    if (dto.adminUserId) where.adminUserId = BigInt(dto.adminUserId);
    if (dto.action) where.action = dto.action;
    if (dto.adminName) {
      where.adminUser = {
        OR: [
          { username: { contains: dto.adminName } },
          { realName: { contains: dto.adminName } },
        ],
      };
    }
    if (dto.startTime || dto.endTime) {
      where.createdAt = {};
      if (dto.startTime) where.createdAt.gte = new Date(dto.startTime);
      if (dto.endTime) {
        const endTime = new Date(dto.endTime);
        endTime.setDate(endTime.getDate() + 1);
        where.createdAt.lt = endTime;
      }
    }

    const [list, total] = await Promise.all([
      this.prisma.adminOperationLog.findMany({
        where,
        skip: dto.skip,
        take: dto.take,
        orderBy: { createdAt: 'desc' },
        include: { adminUser: { select: { id: true, username: true, realName: true } } },
      }),
      this.prisma.adminOperationLog.count({ where }),
    ]);

    return paginate(
      list.map((l) => ({
        ...l,
        id: l.id.toString(),
        adminUserId: l.adminUserId.toString(),
        targetId: l.targetId?.toString(),
        adminUser: l.adminUser ? { ...l.adminUser, id: l.adminUser.id.toString() } : null,
        adminName: l.adminUser?.realName || l.adminUser?.username || l.adminUserId.toString(),
        description: l.content,
        createTime: l.createdAt,
        requestData: l.content,
      })),
      total,
      dto.page,
      dto.pageSize,
    );
  }

  async createOperationLog(data: {
    adminUserId: string;
    module: string;
    action: string;
    targetType?: string;
    targetId?: string;
    content?: string;
    ip?: string;
    userAgent?: string;
  }) {
    return this.prisma.adminOperationLog.create({
      data: {
        adminUserId: BigInt(data.adminUserId),
        module: data.module,
        action: data.action,
        targetType: data.targetType,
        targetId: data.targetId ? BigInt(data.targetId) : null,
        content: data.content,
        ip: data.ip,
        userAgent: data.userAgent,
      },
    });
  }

  private buildPermissionTree(permissions: any[], parentId: bigint = 0n): any[] {
    return permissions
      .filter((p) => p.parentId === parentId)
      .map((p) => ({
        ...p,
        id: p.id.toString(),
        parentId: p.parentId.toString(),
        children: this.buildPermissionTree(permissions, p.id),
      }));
  }
}
