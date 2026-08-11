import type { PrismaClient } from '@prisma/client';

export const DEFAULT_ROLE_PERMISSION_CODES: Record<string, string[]> = {
  operator: [
    'dashboard',
    'product',
    'product:list',
    'product:create',
    'product:edit',
    'product:delete',
    'product:publish',
    'product:stock',
    'product:category',
    'product:brand',
    'supplier',
    'supplier:list',
    'supplier:create',
    'supplier:edit',
    'supplier:delete',
    'order',
    'order:list',
    'order:detail',
    'order:deliver',
    'order:remark',
    'order:cancel',
    'order:aftersale',
    'order:aftersale:review',
    'pickup',
    'pickup:store',
    'pickup:verify',
    'marketing',
    'marketing:coupon',
    'marketing:activity',
    'marketing:banner',
    'marketing:recommendation',
    'marketing:decor',
    'share',
    'share:campaign',
    'share:record',
    'share:invite',
    'content',
    'content:list',
    'content:edit',
    'statistics',
    'statistics:index',
  ],
  cs: [
    'dashboard',
    'order',
    'order:list',
    'order:detail',
    'order:remark',
    'order:aftersale',
    'order:aftersale:review',
    'user',
    'user:list',
    'user:detail',
  ],
  finance: [
    'dashboard',
    'order',
    'order:list',
    'order:detail',
    'order:aftersale',
    'order:aftersale:refund',
    'order:export',
    'statistics',
    'statistics:index',
  ],
};

/**
 * Keep the permission tree aligned with the Admin router:
 * /pickup-store requires the parent `pickup` permission, while its two pages use
 * `pickup:store` and `pickup:verify`. Older seeds created only the children and attached them to
 * `order`, which made an otherwise-authorized role unable to enter the pickup menu.
 *
 * This helper is intentionally idempotent and safe for both fresh seeds and existing databases.
 * Existing roles receive the parent only when they already own one of the pickup child
 * permissions, so custom roles are not broadened beyond their current pickup capability.
 */
export async function ensurePickupPermissionStructure(prisma: PrismaClient) {
  let parent = await prisma.adminPermission.findFirst({ where: { code: 'pickup' } });
  if (parent) {
    parent = await prisma.adminPermission.update({
      where: { id: parent.id },
      data: {
        parentId: 0n,
        name: '自提管理',
        type: 1,
        sortOrder: 10,
      },
    });
  } else {
    parent = await prisma.adminPermission.create({
      data: {
        parentId: 0n,
        name: '自提管理',
        code: 'pickup',
        type: 1,
        sortOrder: 10,
      },
    });
  }

  const childDefinitions = [
    { code: 'pickup:store', name: '自提点管理', sortOrder: 1 },
    { code: 'pickup:verify', name: '自提核销', sortOrder: 2 },
  ];
  const childIds: bigint[] = [];

  for (const definition of childDefinitions) {
    const existing = await prisma.adminPermission.findFirst({ where: { code: definition.code } });
    const child = existing
      ? await prisma.adminPermission.update({
          where: { id: existing.id },
          data: {
            parentId: parent.id,
            name: definition.name,
            type: 2,
            sortOrder: definition.sortOrder,
          },
        })
      : await prisma.adminPermission.create({
          data: {
            parentId: parent.id,
            name: definition.name,
            code: definition.code,
            type: 2,
            sortOrder: definition.sortOrder,
          },
        });
    childIds.push(child.id);
  }

  const childAssignments = await prisma.adminRolePermission.findMany({
    where: { permissionId: { in: childIds } },
    select: { roleId: true },
  });
  const roleIds = [...new Set(childAssignments.map((assignment) => assignment.roleId.toString()))]
    .map((roleId) => BigInt(roleId));

  if (roleIds.length > 0) {
    await prisma.adminRolePermission.createMany({
      data: roleIds.map((roleId) => ({ roleId, permissionId: parent.id })),
      skipDuplicates: true,
    });
  }

  return { parentId: parent.id, childIds, inheritedRoleCount: roleIds.length };
}

export async function ensureDefaultRolePermissions(
  prisma: PrismaClient,
  rolePermissionCodes: Record<string, string[]> = DEFAULT_ROLE_PERMISSION_CODES,
) {
  const results: Array<{ roleCode: string; action: 'seeded' | 'preserved' | 'missing-role'; count: number }> = [];

  for (const [roleCode, permissionCodes] of Object.entries(rolePermissionCodes)) {
    const role = await prisma.adminRole.findFirst({ where: { code: roleCode } });
    if (!role) {
      results.push({ roleCode, action: 'missing-role', count: 0 });
      continue;
    }

    const existingCount = await prisma.adminRolePermission.count({
      where: { roleId: role.id },
    });
    if (existingCount > 0) {
      results.push({ roleCode, action: 'preserved', count: existingCount });
      continue;
    }

    const permissions = await prisma.adminPermission.findMany({
      where: { code: { in: permissionCodes } },
      select: { id: true, code: true },
    });
    const foundCodes = new Set(permissions.map((permission) => permission.code));
    const missingCodes = permissionCodes.filter((code) => !foundCodes.has(code));
    if (missingCodes.length > 0) {
      throw new Error(`默认角色 ${roleCode} 缺少权限定义：${missingCodes.join(', ')}`);
    }

    await prisma.adminRolePermission.createMany({
      data: permissions.map((permission) => ({
        roleId: role.id,
        permissionId: permission.id,
      })),
      skipDuplicates: true,
    });
    results.push({ roleCode, action: 'seeded', count: permissions.length });
  }

  return results;
}

export async function ensureMerchantSettlementPermission(prisma: PrismaClient) {
  const parent = await prisma.adminPermission.findFirst({ where: { code: 'order' } });
  let permission = await prisma.adminPermission.findFirst({
    where: { code: 'order:merchant-settlement' },
  });

  if (permission) {
    permission = await prisma.adminPermission.update({
      where: { id: permission.id },
      data: {
        parentId: parent?.id ?? permission.parentId,
        name: '商户结算',
        type: 2,
        sortOrder: 12,
      },
    });
  } else {
    permission = await prisma.adminPermission.create({
      data: {
        parentId: parent?.id ?? 0n,
        name: '商户结算',
        code: 'order:merchant-settlement',
        type: 2,
        sortOrder: 12,
      },
    });
  }

  const financeRole = await prisma.adminRole.findFirst({ where: { code: 'finance' } });
  if (!financeRole) {
    return { permissionId: permission.id, financeGranted: false };
  }

  const existing = await prisma.adminRolePermission.findFirst({
    where: { roleId: financeRole.id, permissionId: permission.id },
  });
  if (!existing) {
    await prisma.adminRolePermission.create({
      data: { roleId: financeRole.id, permissionId: permission.id },
    });
  }
  return { permissionId: permission.id, financeGranted: true };
}
