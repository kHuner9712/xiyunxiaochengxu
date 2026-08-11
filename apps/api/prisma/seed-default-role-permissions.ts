import { PrismaClient } from '@prisma/client';
import {
  ensureDefaultRolePermissions,
  ensureMerchantSettlementPermission,
} from './default-role-permissions';

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

  const settlement = await ensureMerchantSettlementPermission(prisma);
  console.log(
    settlement.financeGranted
      ? '商户结算权限已确保存在并授予财务角色'
      : '商户结算权限已确保存在；财务角色不存在，跳过角色授权',
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
