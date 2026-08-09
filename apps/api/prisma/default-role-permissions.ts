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

export async function ensureDefaultRolePermissions(prisma: PrismaClient) {
  const results: Array<{ roleCode: string; action: 'seeded' | 'preserved' | 'missing-role'; count: number }> = [];

  for (const [roleCode, permissionCodes] of Object.entries(DEFAULT_ROLE_PERMISSION_CODES)) {
    const role = await prisma.adminRole.findUnique({ where: { code: roleCode } });
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
