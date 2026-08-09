import assert from 'node:assert/strict';
import { PrismaClient } from '@prisma/client';
import { ensureDefaultRolePermissions } from '../prisma/default-role-permissions';

function assertSafeIntegrationDatabase() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error('DATABASE_URL is required');
  const databaseName = decodeURIComponent(new URL(databaseUrl).pathname.replace(/^\//, ''));
  if (
    !/(^|[_-])test($|[_-])/i.test(databaseName) &&
    process.env.ALLOW_DESTRUCTIVE_INTEGRATION_TESTS !== 'true'
  ) {
    throw new Error(`Refusing destructive integration test against database "${databaseName}"`);
  }
}

assertSafeIntegrationDatabase();
const prisma = new PrismaClient();

async function main() {
  await prisma.$connect();
  const suffix = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const emptyRoleCode = `test_empty_role_${suffix}`;
  const preservedRoleCode = `test_preserved_role_${suffix}`;
  const permissionCodes = [
    `test_role_perm_a_${suffix}`,
    `test_role_perm_b_${suffix}`,
  ];
  const manualPermissionCode = `test_manual_perm_${suffix}`;
  const createdRoleIds: bigint[] = [];
  const createdPermissionIds: bigint[] = [];

  try {
    for (const [index, code] of [...permissionCodes, manualPermissionCode].entries()) {
      const permission = await prisma.adminPermission.create({
        data: {
          code,
          name: `默认角色真库权限-${index}-${suffix}`,
          type: 2,
          parentId: 0n,
          sortOrder: index,
        },
      });
      createdPermissionIds.push(permission.id);
    }

    const emptyRole = await prisma.adminRole.create({
      data: {
        code: emptyRoleCode,
        name: `空权限测试角色-${suffix}`,
        status: 1,
      },
    });
    createdRoleIds.push(emptyRole.id);

    const preservedRole = await prisma.adminRole.create({
      data: {
        code: preservedRoleCode,
        name: `人工权限测试角色-${suffix}`,
        status: 1,
      },
    });
    createdRoleIds.push(preservedRole.id);

    const manualPermission = await prisma.adminPermission.findFirstOrThrow({
      where: { code: manualPermissionCode },
    });
    await prisma.adminRolePermission.create({
      data: {
        roleId: preservedRole.id,
        permissionId: manualPermission.id,
      },
    });

    const rolePermissionCodes = {
      [emptyRoleCode]: permissionCodes,
      [preservedRoleCode]: permissionCodes,
    };
    const results = await ensureDefaultRolePermissions(prisma, rolePermissionCodes);

    const emptyResult = results.find((result) => result.roleCode === emptyRoleCode);
    const preservedResult = results.find((result) => result.roleCode === preservedRoleCode);
    assert.deepEqual(emptyResult, {
      roleCode: emptyRoleCode,
      action: 'seeded',
      count: 2,
    });
    assert.deepEqual(preservedResult, {
      roleCode: preservedRoleCode,
      action: 'preserved',
      count: 1,
    });

    const emptyPermissions = await prisma.adminRolePermission.findMany({
      where: { roleId: emptyRole.id },
      include: { permission: true },
    });
    assert.deepEqual(
      emptyPermissions.map((entry) => entry.permission.code).sort(),
      [...permissionCodes].sort(),
      '0 权限角色必须获得完整基线权限',
    );

    const preservedPermissions = await prisma.adminRolePermission.findMany({
      where: { roleId: preservedRole.id },
      include: { permission: true },
    });
    assert.deepEqual(
      preservedPermissions.map((entry) => entry.permission.code),
      [manualPermissionCode],
      '已有人工权限的角色不得被基线脚本覆盖或扩权',
    );

    console.log('[default-role-permissions-integration] PASS');
  } finally {
    if (createdRoleIds.length > 0) {
      await prisma.adminRolePermission.deleteMany({
        where: { roleId: { in: createdRoleIds } },
      });
      await prisma.adminRole.deleteMany({
        where: { id: { in: createdRoleIds } },
      });
    }
    if (createdPermissionIds.length > 0) {
      await prisma.adminPermission.deleteMany({
        where: { id: { in: createdPermissionIds } },
      });
    }
    await prisma.$disconnect();
  }
}

main().catch(async (error) => {
  console.error('[default-role-permissions-integration] FAIL', error);
  await prisma.$disconnect().catch(() => undefined);
  process.exitCode = 1;
});
