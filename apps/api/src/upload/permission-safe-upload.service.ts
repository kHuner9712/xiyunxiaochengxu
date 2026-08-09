import { ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { parsePositiveBigIntId } from '../common/utils/bigint-id';
import { normalizeGroupName, UploadService } from './upload.service';

const SYSTEM_FILE_PERMISSION = 'system:file';

function allowedAdminPermissionsForGroup(groupName?: string | null): string[] {
  const group = normalizeGroupName(groupName);
  switch (group) {
    case 'aftersale':
      return [
        'order:aftersale',
        'order:aftersale:review',
        'order:aftersale:refund',
        SYSTEM_FILE_PERMISSION,
      ];
    case 'business_license':
      return ['product:supplier', SYSTEM_FILE_PERMISSION];
    default:
      return [SYSTEM_FILE_PERMISSION];
  }
}

@Injectable()
export class PermissionSafeUploadService extends UploadService {
  constructor(private readonly permissionPrisma: PrismaService) {
    super(permissionPrisma);
  }

  override async findPrivateById(
    id: string,
    currentUser: { id?: string; roleType?: string },
  ) {
    if (currentUser?.roleType !== 'admin') {
      return super.findPrivateById(id, currentUser);
    }

    const fileId = parsePositiveBigIntId(id, '文件');
    const adminUserId = parsePositiveBigIntId(currentUser.id, '管理员');
    const file = await this.permissionPrisma.fileAsset.findFirst({
      where: { id: fileId },
      select: { id: true, groupName: true },
    });

    // Let the base service preserve the canonical not-found/private-file behavior.
    if (!file) {
      return super.findPrivateById(id, currentUser);
    }

    const assignments = await this.permissionPrisma.adminUserRole.findMany({
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
    const activeRoles = assignments.filter((assignment) => assignment.role.status === 1);
    if (activeRoles.some((assignment) => assignment.role.code === 'super_admin')) {
      return super.findPrivateById(id, currentUser);
    }

    const permissions = new Set(
      activeRoles.flatMap((assignment) =>
        assignment.role.adminRolePermissions.map((entry) => entry.permission.code),
      ),
    );
    const allowed = allowedAdminPermissionsForGroup(file.groupName);
    if (!allowed.some((permission) => permissions.has(permission))) {
      throw new ForbiddenException(`无权访问该私有文件，需要权限：${allowed.join(' 或 ')}`);
    }

    return super.findPrivateById(id, currentUser);
  }
}

export { allowedAdminPermissionsForGroup };
