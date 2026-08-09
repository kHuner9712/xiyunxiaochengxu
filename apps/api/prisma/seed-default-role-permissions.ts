import { PrismaClient } from '@prisma/client';
import { ensureDefaultRolePermissions } from './default-role-permissions';

const prisma = new PrismaClient();

async function main() {
  const results = await ensureDefaultRolePermissions(prisma);
  for (const result of results) {
    if (result.action === 'seeded') {
      console.log(`默认角色 ${result.roleCode} 补齐 ${result.count} 条基线权限`);
    } else if (result.action === 'preserved') {
      console.log(`默认角色 ${result.roleCode} 已有 ${result.count} 条权限，保留现有配置`);
    } else {
      console.log(`默认角色 ${result.roleCode} 不存在，跳过`);
    }
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
