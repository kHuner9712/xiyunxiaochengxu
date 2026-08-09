import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { parsePositiveBigIntId } from '../common/utils/bigint-id';
import { normalizeGroupName, UploadService } from './upload.service';

const SYSTEM_FILE_PERMISSION = 'system:file';
const USER_PUBLIC_UPLOAD_GROUPS = new Set(['user-avatar', 'baby-avatar']);
const USER_PRIVATE_UPLOAD_GROUPS = new Set(['aftersale']);
const MAX_USER_IMAGE_SIZE = 10 * 1024 * 1024;

type AdminFileAccess = {
  isSuperAdmin: boolean;
  permissions: Set<string>;
};

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

  override async uploadFile(
    file: Express.Multer.File,
    uploaderId: string,
    uploaderType: string,
    groupName?: string,
  ) {
    if (uploaderType === 'admin') {
      await this.assertAdminHasAnyPermission(uploaderId, [SYSTEM_FILE_PERMISSION]);
      return super.uploadFile(file, uploaderId, uploaderType, groupName);
    }

    if (uploaderType !== 'user') {
      throw new ForbiddenException('不支持的上传者类型');
    }

    const group = normalizeGroupName(groupName);
    if (!group || (!USER_PUBLIC_UPLOAD_GROUPS.has(group) && !USER_PRIVATE_UPLOAD_GROUPS.has(group))) {
      throw new BadRequestException('用户上传必须指定受支持的业务用途');
    }
    if (!file?.mimetype?.startsWith('image/')) {
      throw new BadRequestException('当前用户上传场景仅支持图片');
    }
    if (file.size > MAX_USER_IMAGE_SIZE) {
      throw new BadRequestException('用户图片大小不能超过10MB');
    }

    return super.uploadFile(file, uploaderId, uploaderType, group);
  }

  override async findPrivateById(
    id: string,
    currentUser: { id?: string; roleType?: string },
  ) {
    if (currentUser?.roleType !== 'admin') {
      return super.findPrivateById(id, currentUser);
    }

    const fileId = parsePositiveBigIntId(id, '文件');
    const file = await this.permissionPrisma.fileAsset.findFirst({
      where: { id: fileId },
      select: { id: true, groupName: true },
    });

    // Let the base service preserve the canonical not-found/private-file behavior.
    if (!file) {
      return super.findPrivateById(id, currentUser);
    }

    const access = await this.loadAdminAccess(currentUser.id);
    if (access.isSuperAdmin || access.permissions.has(SYSTEM_FILE_PERMISSION)) {
      return super.findPrivateById(id, currentUser);
    }

    const allowed = allowedAdminPermissionsForGroup(file.groupName)
      .filter((permission) => permission !== SYSTEM_FILE_PERMISSION);
    if (!allowed.some((permission) => access.permissions.has(permission))) {
      throw new ForbiddenException(`无权访问该私有文件，需要权限：${allowed.length ? allowed.join(' 或 ') : SYSTEM_FILE_PERMISSION}`);
    }

    const group = normalizeGroupName(file.groupName);
    const referenced = await this.isReferencedByAuthorizedBusiness(group, file.id);
    if (!referenced) {
      throw new ForbiddenException('该私有文件尚未进入可访问的业务记录');
    }

    return super.findPrivateById(id, currentUser);
  }

  private async isReferencedByAuthorizedBusiness(group: string | undefined, fileId: bigint) {
    const privateUrl = `/api/common/file/private/${fileId.toString()}`;
    if (group === 'aftersale') {
      const aftersale = await this.permissionPrisma.aftersaleOrder.findFirst({
        where: {
          images: {
            array_contains: privateUrl,
          },
        },
        select: { id: true },
      });
      return !!aftersale;
    }
    if (group === 'business_license') {
      const supplier = await this.permissionPrisma.supplier.findFirst({
        where: { businessLicense: privateUrl, deletedAt: null },
        select: { id: true },
      });
      return !!supplier;
    }
    return false;
  }

  private async assertAdminHasAnyPermission(
    adminId: string | number | bigint | null | undefined,
    allowed: string[],
  ) {
    const access = await this.loadAdminAccess(adminId);
    if (access.isSuperAdmin) return;
    if (!allowed.some((permission) => access.permissions.has(permission))) {
      throw new ForbiddenException(`无权执行该文件操作，需要权限：${allowed.join(' 或 ')}`);
    }
  }

  private async loadAdminAccess(
    adminId: string | number | bigint | null | undefined,
  ): Promise<AdminFileAccess> {
    const adminUserId = parsePositiveBigIntId(adminId, '管理员');
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
    return {
      isSuperAdmin: activeRoles.some((assignment) => assignment.role.code === 'super_admin'),
      permissions: new Set(
        activeRoles.flatMap((assignment) =>
          assignment.role.adminRolePermissions.map((entry) => entry.permission.code),
        ),
      ),
    };
  }
}

export {
  allowedAdminPermissionsForGroup,
  USER_PRIVATE_UPLOAD_GROUPS,
  USER_PUBLIC_UPLOAD_GROUPS,
};
