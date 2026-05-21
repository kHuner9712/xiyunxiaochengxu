import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('开始种子数据初始化...');

  const memberLevels = await Promise.all([
    prisma.memberLevel.upsert({
      where: { id: 1n },
      update: {},
      create: {
        name: '普通会员',
        minGrowthValue: 0,
        maxGrowthValue: 999,
        discountRate: null,
        pointsRate: 10,
        benefits: null,
        sortOrder: 1,
        status: 1,
      },
    }),
    prisma.memberLevel.upsert({
      where: { id: 2n },
      update: {},
      create: {
        name: '银卡会员',
        minGrowthValue: 1000,
        maxGrowthValue: 4999,
        discountRate: 98,
        pointsRate: 20,
        benefits: JSON.stringify({ free_shipping: false, exclusive_coupons: 1 }),
        sortOrder: 2,
        status: 1,
      },
    }),
    prisma.memberLevel.upsert({
      where: { id: 3n },
      update: {},
      create: {
        name: '金卡会员',
        minGrowthValue: 5000,
        maxGrowthValue: 19999,
        discountRate: 95,
        pointsRate: 30,
        benefits: JSON.stringify({ free_shipping: true, exclusive_coupons: 2 }),
        sortOrder: 3,
        status: 1,
      },
    }),
    prisma.memberLevel.upsert({
      where: { id: 4n },
      update: {},
      create: {
        name: '黑金会员',
        minGrowthValue: 20000,
        maxGrowthValue: null,
        discountRate: 90,
        pointsRate: 50,
        benefits: JSON.stringify({ free_shipping: true, exclusive_coupons: 3, birthday_gift: true }),
        sortOrder: 4,
        status: 1,
      },
    }),
  ]);

  console.log(`创建 ${memberLevels.length} 个会员等级`);

  const superAdminRole = await prisma.adminRole.upsert({
    where: { code: 'super_admin' },
    update: {},
    create: {
      name: '超级管理员',
      code: 'super_admin',
      description: '拥有所有权限',
      status: 1,
    },
  });

  const operatorRole = await prisma.adminRole.upsert({
    where: { code: 'operator' },
    update: {},
    create: {
      name: '运营管理',
      code: 'operator',
      description: '商品管理、订单管理、营销管理、内容管理',
      status: 1,
    },
  });

  const csRole = await prisma.adminRole.upsert({
    where: { code: 'cs' },
    update: {},
    create: {
      name: '客服',
      code: 'cs',
      description: '订单查看、售后处理',
      status: 1,
    },
  });

  const financeRole = await prisma.adminRole.upsert({
    where: { code: 'finance' },
    update: {},
    create: {
      name: '财务',
      code: 'finance',
      description: '订单查看、退款审核、数据导出',
      status: 1,
    },
  });

  console.log('创建 4 个角色');

  const parentPermissions = [
    { name: '首页', code: 'dashboard', type: 1, parentId: 0n, sortOrder: 1 },
    { name: '商品管理', code: 'product', type: 1, parentId: 0n, sortOrder: 2 },
    { name: '订单管理', code: 'order', type: 1, parentId: 0n, sortOrder: 3 },
    { name: '用户管理', code: 'user', type: 1, parentId: 0n, sortOrder: 4 },
    { name: '营销管理', code: 'marketing', type: 1, parentId: 0n, sortOrder: 5 },
    { name: '内容管理', code: 'content', type: 1, parentId: 0n, sortOrder: 6 },
    { name: '系统设置', code: 'system', type: 1, parentId: 0n, sortOrder: 7 },
  ];

  const parentMap: Record<string, any> = {};
  for (const perm of parentPermissions) {
    const p = await prisma.adminPermission.upsert({
      where: { code: perm.code },
      update: {},
      create: perm,
    });
    parentMap[perm.code] = p;
  }

  const childPermissions = [
    { name: '商品列表', code: 'product:list', type: 1, parentCode: 'product', sortOrder: 1 },
    { name: '新增商品', code: 'product:create', type: 2, parentCode: 'product', sortOrder: 2 },
    { name: '编辑商品', code: 'product:update', type: 2, parentCode: 'product', sortOrder: 3 },
    { name: '删除商品', code: 'product:delete', type: 2, parentCode: 'product', sortOrder: 4 },
    { name: '上架/下架', code: 'product:publish', type: 2, parentCode: 'product', sortOrder: 5 },
    { name: '分类管理', code: 'product:category', type: 1, parentCode: 'product', sortOrder: 6 },
    { name: '品牌管理', code: 'product:brand', type: 1, parentCode: 'product', sortOrder: 7 },
    { name: '供应商管理', code: 'product:supplier', type: 1, parentCode: 'product', sortOrder: 8 },
    { name: '订单列表', code: 'order:list', type: 1, parentCode: 'order', sortOrder: 1 },
    { name: '订单详情', code: 'order:detail', type: 2, parentCode: 'order', sortOrder: 2 },
    { name: '订单发货', code: 'order:deliver', type: 2, parentCode: 'order', sortOrder: 3 },
    { name: '订单备注', code: 'order:remark', type: 2, parentCode: 'order', sortOrder: 4 },
    { name: '取消订单', code: 'order:cancel', type: 2, parentCode: 'order', sortOrder: 5 },
    { name: '售后管理', code: 'order:aftersale', type: 1, parentCode: 'order', sortOrder: 6 },
    { name: '审核售后', code: 'order:aftersale:review', type: 2, parentCode: 'order', sortOrder: 7 },
    { name: '退款', code: 'order:aftersale:refund', type: 2, parentCode: 'order', sortOrder: 8 },
    { name: '用户列表', code: 'user:list', type: 1, parentCode: 'user', sortOrder: 1 },
    { name: '用户详情', code: 'user:detail', type: 2, parentCode: 'user', sortOrder: 2 },
    { name: '会员管理', code: 'user:member', type: 2, parentCode: 'user', sortOrder: 3 },
    { name: '积分管理', code: 'user:points', type: 2, parentCode: 'user', sortOrder: 4 },
    { name: '优惠券管理', code: 'marketing:coupon', type: 1, parentCode: 'marketing', sortOrder: 1 },
    { name: '活动管理', code: 'marketing:activity', type: 1, parentCode: 'marketing', sortOrder: 2 },
    { name: 'Banner 管理', code: 'marketing:banner', type: 1, parentCode: 'marketing', sortOrder: 3 },
    { name: '首页配置', code: 'marketing:home', type: 1, parentCode: 'marketing', sortOrder: 4 },
    { name: '内容列表', code: 'content:list', type: 1, parentCode: 'content', sortOrder: 1 },
    { name: '内容分类', code: 'content:category', type: 1, parentCode: 'content', sortOrder: 2 },
    { name: '系统配置', code: 'system:config', type: 1, parentCode: 'system', sortOrder: 1 },
    { name: '管理员管理', code: 'system:admin', type: 1, parentCode: 'system', sortOrder: 2 },
    { name: '角色权限', code: 'system:role', type: 1, parentCode: 'system', sortOrder: 3 },
    { name: '文件管理', code: 'system:file', type: 1, parentCode: 'system', sortOrder: 4 },
    { name: '操作日志', code: 'system:log', type: 1, parentCode: 'system', sortOrder: 5 },
  ];

  const createdPermissions = [...Object.values(parentMap)];
  for (const perm of childPermissions) {
    const parent = parentMap[perm.parentCode];
    const p = await prisma.adminPermission.upsert({
      where: { code: perm.code },
      update: {},
      create: {
        name: perm.name,
        code: perm.code,
        type: perm.type,
        parentId: parent.id,
        sortOrder: perm.sortOrder,
      },
    });
    createdPermissions.push(p);
  }

  console.log(`创建 ${createdPermissions.length} 个权限`);

  for (const perm of createdPermissions) {
    await prisma.adminRolePermission.upsert({
      where: {
        uk_role_permission: {
          roleId: superAdminRole.id,
          permissionId: perm.id,
        },
      },
      update: {},
      create: {
        roleId: superAdminRole.id,
        permissionId: perm.id,
      },
    });
  }

  console.log('超级管理员角色关联所有权限');

  const nodeEnv = process.env.NODE_ENV || 'development';
  const adminUsername = process.env.ADMIN_DEFAULT_USERNAME || 'admin';
  const adminPassword = process.env.ADMIN_DEFAULT_PASSWORD || 'admin123';

  if (nodeEnv === 'production') {
    if (!process.env.ADMIN_DEFAULT_USERNAME) {
      throw new Error('生产环境必须配置 ADMIN_DEFAULT_USERNAME');
    }
    if (!process.env.ADMIN_DEFAULT_PASSWORD) {
      throw new Error('生产环境必须配置 ADMIN_DEFAULT_PASSWORD');
    }
    const weakPasswords = ['admin123', 'password', '123456', 'change_this_password'];
    if (weakPasswords.includes(adminPassword)) {
      throw new Error('生产环境不允许使用弱密码(admin123/password/123456/change_this_password)');
    }
    if (adminPassword.length < 12) {
      throw new Error('生产环境管理员密码长度不能少于12位');
    }
    const hasUpper = /[A-Z]/.test(adminPassword);
    const hasLower = /[a-z]/.test(adminPassword);
    const hasDigit = /[0-9]/.test(adminPassword);
    const hasSpecial = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(adminPassword);
    if (!hasUpper || !hasLower || !hasDigit || !hasSpecial) {
      throw new Error('生产环境管理员密码必须包含大小写字母、数字和特殊字符');
    }
  }

  const mustChangePassword = nodeEnv === 'production';
  const hashedPassword = await bcrypt.hash(adminPassword, 10);
  console.log(`Creating admin user: ${adminUsername}${nodeEnv === 'production' ? ' (must change password on first login)' : ''}`);

  const admin = await prisma.adminUser.upsert({
    where: { username: adminUsername },
    update: {},
    create: {
      username: adminUsername,
      password: hashedPassword,
      realName: '超级管理员',
      mustChangePassword,
      status: 1,
    },
  });

  await prisma.adminUserRole.upsert({
    where: {
      uk_admin_role: {
        adminUserId: admin.id,
        roleId: superAdminRole.id,
      },
    },
    update: {},
    create: {
      adminUserId: admin.id,
      roleId: superAdminRole.id,
    },
  });

  console.log(`创建超级管理员账号 ${adminUsername}/${nodeEnv === 'production' ? '***' : adminPassword}`);

  const configs = [
    { groupName: 'basic', configKey: 'shop_name', configValue: '禧孕母婴商城', valueType: 'string', description: '商城名称' },
    { groupName: 'basic', configKey: 'shop_logo', configValue: '', valueType: 'string', description: '商城 Logo' },
    { groupName: 'basic', configKey: 'customer_service_phone', configValue: '400-XXX-XXXX', valueType: 'string', description: '客服电话' },
    { groupName: 'basic', configKey: 'icp_number', configValue: '', valueType: 'string', description: 'ICP 备案号' },
    { groupName: 'payment', configKey: 'wechat_mch_id', configValue: '', valueType: 'string', description: '微信支付商户号' },
    { groupName: 'payment', configKey: 'wechat_api_key', configValue: '', valueType: 'string', description: '微信支付 API 密钥' },
    { groupName: 'payment', configKey: 'order_auto_close_minutes', configValue: '30', valueType: 'number', description: '未付款订单自动关闭时间（分钟）' },
    { groupName: 'logistics', configKey: 'order_auto_complete_days', configValue: '15', valueType: 'number', description: '发货后自动确认收货天数' },
    { groupName: 'logistics', configKey: 'free_shipping_amount', configValue: '9900', valueType: 'number', description: '满额包邮金额（分）' },
    { groupName: 'logistics', configKey: 'default_freight', configValue: '1000', valueType: 'number', description: '默认运费（分）' },
    { groupName: 'points', configKey: 'points_rate', configValue: '1', valueType: 'number', description: '消费 1 元获得积分数' },
    { groupName: 'points', configKey: 'points_expire_months', configValue: '12', valueType: 'number', description: '积分有效月数' },
    { groupName: 'points', configKey: 'sign_in_points', configValue: '5', valueType: 'number', description: '每日签到积分' },
    { groupName: 'points', configKey: 'share_points', configValue: '3', valueType: 'number', description: '分享获得积分' },
    { groupName: 'points', configKey: 'profile_complete_points', configValue: '50', valueType: 'number', description: '完善资料奖励积分' },
    { groupName: 'points', configKey: 'points_deduct_rate', configValue: '100', valueType: 'number', description: '积分抵扣比率（100 积分 = 1 元）' },
    { groupName: 'points', configKey: 'points_deduct_max_percent', configValue: '30', valueType: 'number', description: '积分最多抵扣订单金额百分比' },
  ];

  for (const config of configs) {
    await prisma.systemConfig.upsert({
      where: {
        uk_group_key: {
          groupName: config.groupName,
          configKey: config.configKey,
        },
      },
      update: {},
      create: config,
    });
  }

  console.log(`创建 ${configs.length} 个系统配置`);
  console.log('种子数据初始化完成！');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
