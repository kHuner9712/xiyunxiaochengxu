import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const apiRoot = resolve(__dirname, '..');
const pnpm = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
const username = 'ci_production_bootstrap_admin';
const password = 'CiBootstrap#2026-Strong-Password';

function runSeed() {
  const result = spawnSync(pnpm, ['prisma:seed'], {
    cwd: apiRoot,
    env: {
      ...process.env,
      NODE_ENV: 'production',
      ADMIN_DEFAULT_USERNAME: username,
      ADMIN_DEFAULT_PASSWORD: password,
    },
    encoding: 'utf8',
  });
  if (result.status !== 0) {
    throw new Error(
      `production seed failed with status ${result.status}:\n${result.stdout}\n${result.stderr}`,
    );
  }
}

async function main() {
  await prisma.adminUserRole.deleteMany({
    where: { adminUser: { username } },
  });
  await prisma.adminUser.deleteMany({ where: { username } });

  runSeed();
  runSeed();

  const admins = await prisma.adminUser.findMany({
    where: { username },
    include: {
      adminUserRoles: {
        include: { role: true },
      },
    },
  });

  if (admins.length !== 1) {
    throw new Error(`expected exactly one seeded admin, found ${admins.length}`);
  }
  const admin = admins[0];
  if (!admin.mustChangePassword) {
    throw new Error('production bootstrap admin must require password change');
  }
  if (admin.status !== 1 || admin.deletedAt) {
    throw new Error('production bootstrap admin must be active and not deleted');
  }
  if (!admin.adminUserRoles.some((assignment) => assignment.role.code === 'super_admin' && assignment.role.status === 1)) {
    throw new Error('production bootstrap admin must have the active super_admin role');
  }

  const superAdminRole = await prisma.adminRole.findFirst({ where: { code: 'super_admin', status: 1 } });
  if (!superAdminRole) throw new Error('super_admin role was not seeded');
  const permissionCount = await prisma.adminRolePermission.count({ where: { roleId: superAdminRole.id } });
  if (permissionCount === 0) throw new Error('super_admin role has no permissions after seed');

  console.log(
    `[production-seed-lifecycle] PASS admin=${admin.id.toString()} permissions=${permissionCount}`,
  );
}

main()
  .catch((error) => {
    console.error('[production-seed-lifecycle] FAIL', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
