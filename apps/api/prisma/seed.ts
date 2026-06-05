import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function upsertAdminRoleByCode(code: string, data: {
  name: string;
  description?: string | null;
  status?: number;
}) {
  const existing = await prisma.adminRole.findFirst({ where: { code } });
  if (existing) {
    return prisma.adminRole.update({
      where: { id: existing.id },
      data: {
        name: data.name,
        description: data.description ?? null,
        status: data.status ?? 1,
      },
    });
  }
  return prisma.adminRole.create({
    data: {
      code,
      name: data.name,
      description: data.description ?? null,
      status: data.status ?? 1,
    },
  });
}

async function upsertAdminPermissionByCode(code: string, data: {
  name: string;
  type: number;
  parentId: bigint;
  sortOrder: number;
}) {
  const existing = await prisma.adminPermission.findFirst({ where: { code } });
  if (existing) {
    return prisma.adminPermission.update({
      where: { id: existing.id },
      data,
    });
  }
  return prisma.adminPermission.create({
    data: { code, ...data },
  });
}

async function upsertAdminUserByUsername(username: string, data: {
  password: string;
  realName: string;
  mustChangePassword: boolean;
  status: number;
}) {
  const existing = await prisma.adminUser.findFirst({ where: { username } });
  if (existing) {
    // Do not overwrite an existing admin password during seed; use a separate reset flow.
    return prisma.adminUser.update({
      where: { id: existing.id },
      data: {
        realName: data.realName,
        status: data.status,
        deletedAt: null,
      },
    });
  }
  return prisma.adminUser.create({ data: { username, ...data } });
}

async function ensureAdminRolePermission(roleId: bigint, permissionId: bigint) {
  const existing = await prisma.adminRolePermission.findFirst({
    where: { roleId, permissionId },
  });
  if (existing) return existing;
  return prisma.adminRolePermission.create({
    data: { roleId, permissionId },
  });
}

async function ensureAdminUserRole(adminUserId: bigint, roleId: bigint) {
  const existing = await prisma.adminUserRole.findFirst({
    where: { adminUserId, roleId },
  });
  if (existing) return existing;
  return prisma.adminUserRole.create({
    data: { adminUserId, roleId },
  });
}

async function upsertSystemConfigByGroupKey(data: {
  groupName: string;
  configKey: string;
  configValue: string;
  valueType: string;
  description?: string | null;
}) {
  const existing = await prisma.systemConfig.findFirst({
    where: {
      groupName: data.groupName,
      configKey: data.configKey,
    },
  });
  if (existing) {
    return prisma.systemConfig.update({
      where: { id: existing.id },
      data,
    });
  }
  return prisma.systemConfig.create({ data });
}

function defaultMemberBenefits(levelCode: number, levelName: string, pointsRate: number) {
  const pointsMultiplier = (pointsRate / 10).toFixed(1).replace(/\.0$/, '');
  return [
    {
      id: `member_price_${levelCode}`,
      name: '会员价',
      icon: '/static/tab/cart.png',
      description: `${levelName}可查看会员专享价与活动价`,
      level: levelCode,
    },
    {
      id: `points_growth_${levelCode}`,
      name: '积分成长',
      icon: '/static/tab/activity.png',
      description: `消费可获得${pointsMultiplier}倍成长积分`,
      level: levelCode,
    },
    {
      id: `priority_service_${levelCode}`,
      name: '售后优先',
      icon: '/static/tab/user-active.png',
      description: '售后咨询与处理优先响应',
      level: levelCode,
    },
    {
      id: `care_${levelCode}`,
      name: '生日/孕产期关怀',
      icon: '/static/default-baby.png',
      description: '按宝宝生日或孕产阶段推送关怀福利',
      level: levelCode,
    },
  ];
}

function hasRenderableBenefits(raw?: string | null): boolean {
  if (!raw) return false;
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.some((item) => item?.name && item?.icon && item?.description);
  } catch {
    return false;
  }
}

async function ensureMemberLevel(data: {
  name: string;
  icon?: string | null;
  minGrowthValue: number;
  maxGrowthValue: number | null;
  discountRate: number | null;
  pointsRate: number;
  sortOrder: number;
  status: number;
  levelCode: number;
}) {
  const benefits = JSON.stringify(defaultMemberBenefits(data.levelCode, data.name, data.pointsRate));
  const existing = await prisma.memberLevel.findFirst({ where: { name: data.name } });
  if (existing) {
    const updateData: any = {};
    if (!hasRenderableBenefits(existing.benefits)) updateData.benefits = benefits;
    if (!existing.icon && data.icon) updateData.icon = data.icon;
    if (Object.keys(updateData).length === 0) return existing;
    return prisma.memberLevel.update({
      where: { id: existing.id },
      data: updateData,
    });
  }
  return prisma.memberLevel.create({
    data: {
      name: data.name,
      icon: data.icon ?? null,
      minGrowthValue: data.minGrowthValue,
      maxGrowthValue: data.maxGrowthValue,
      discountRate: data.discountRate,
      pointsRate: data.pointsRate,
      benefits,
      sortOrder: data.sortOrder,
      status: data.status,
    },
  });
}

async function ensureProductCategory(parentId: bigint, data: {
  name: string;
  icon: string;
  complianceConfig?: Record<string, any>;
  sortOrder: number;
}) {
  const existing = await prisma.productCategory.findFirst({
    where: { parentId, name: data.name, deletedAt: null },
  });
  if (existing) {
    const updateData: any = {};
    if (!existing.icon) updateData.icon = data.icon;
    if (existing.isShow !== 1) updateData.isShow = 1;
    if (Object.keys(updateData).length === 0) return existing;
    return prisma.productCategory.update({
      where: { id: existing.id },
      data: updateData,
    });
  }
  return prisma.productCategory.create({
    data: {
      parentId,
      name: data.name,
      icon: data.icon,
      complianceConfig: data.complianceConfig ?? {},
      sortOrder: data.sortOrder,
      isShow: 1,
    },
  });
}

async function seedDefaultCategories() {
  const icon = '/static/default-cover.png';
  const categoryDefs = [
    { name: '奶粉辅食', children: ['配方奶粉', '米粉果泥', '宝宝零食', '营养面点'] },
    { name: '纸尿裤', children: ['纸尿裤', '拉拉裤', '湿巾棉柔巾', '隔尿护理'] },
    { name: '洗护清洁', children: ['宝宝护肤', '沐浴洗发', '洗衣清洁', '口腔护理'] },
    { name: '喂养用品', children: ['奶瓶奶嘴', '水杯餐具', '辅食工具', '消毒暖奶'] },
    { name: '孕产用品', children: ['待产护理', '产后修复', '哺乳用品', '孕妈营养'] },
    { name: '童装童鞋', children: ['婴儿服饰', '童鞋袜帽', '家居睡袋'] },
    { name: '玩具早教', children: ['安抚玩具', '布书早教', '牙胶摇铃', '益智积木'] },
  ];

  const result: any[] = [];
  for (const [parentIndex, parent] of categoryDefs.entries()) {
    const parentCategory = await ensureProductCategory(0n, {
      name: parent.name,
      icon,
      complianceConfig: { defaultSeed: true, level: 1 },
      sortOrder: (parentIndex + 1) * 10,
    });
    result.push(parentCategory);

    for (const [childIndex, childName] of parent.children.entries()) {
      result.push(await ensureProductCategory(parentCategory.id, {
        name: childName,
        icon,
        complianceConfig: {
          defaultSeed: true,
          level: 2,
          isFood: ['配方奶粉', '米粉果泥', '宝宝零食', '营养面点', '孕妈营养'].includes(childName),
          isInfantFormula: childName === '配方奶粉',
        },
        sortOrder: (parentIndex + 1) * 100 + childIndex + 1,
      }));
    }
  }
  return result;
}

async function main() {
  console.log('开始种子数据初始化...');

  const memberLevels = await Promise.all([
    ensureMemberLevel({
      name: '普通会员',
      icon: '/static/tab/user.png',
      minGrowthValue: 0,
      maxGrowthValue: 999,
      discountRate: null,
      pointsRate: 10,
      sortOrder: 1,
      status: 1,
      levelCode: 0,
    }),
    ensureMemberLevel({
      name: '银卡会员',
      icon: '/static/tab/user-active.png',
      minGrowthValue: 1000,
      maxGrowthValue: 4999,
      discountRate: 98,
      pointsRate: 20,
      sortOrder: 2,
      status: 1,
      levelCode: 1,
    }),
    ensureMemberLevel({
      name: '金卡会员',
      icon: '/static/tab/activity-active.png',
      minGrowthValue: 5000,
      maxGrowthValue: 19999,
      discountRate: 95,
      pointsRate: 30,
      sortOrder: 3,
      status: 1,
      levelCode: 2,
    }),
    ensureMemberLevel({
      name: '黑金会员',
      icon: '/static/tab/cart-active.png',
      minGrowthValue: 20000,
      maxGrowthValue: null,
      discountRate: 90,
      pointsRate: 50,
      sortOrder: 4,
      status: 1,
      levelCode: 3,
    }),
  ]);

  console.log(`创建 ${memberLevels.length} 个会员等级`);

  const defaultCategories = await seedDefaultCategories();
  console.log(`补齐 ${defaultCategories.length} 个默认母婴分类`);

  const superAdminRole = await upsertAdminRoleByCode('super_admin', {
    name: '超级管理员',
    description: '拥有所有权限',
    status: 1,
  });

  const operatorRole = await upsertAdminRoleByCode('operator', {
    name: '运营管理',
    description: '商品管理、订单管理、营销管理、内容管理',
    status: 1,
  });

  const csRole = await upsertAdminRoleByCode('cs', {
    name: '客服',
    description: '订单查看、售后处理',
    status: 1,
  });

  const financeRole = await upsertAdminRoleByCode('finance', {
    name: '财务',
    description: '订单查看、退款审核、数据导出',
    status: 1,
  });

  console.log('创建 4 个角色');

  const parentPermissions = [
    { name: '首页', code: 'dashboard', type: 1, parentId: 0n, sortOrder: 1 },
    { name: '商品管理', code: 'product', type: 1, parentId: 0n, sortOrder: 2 },
    { name: '订单管理', code: 'order', type: 1, parentId: 0n, sortOrder: 3 },
    { name: '用户管理', code: 'user', type: 1, parentId: 0n, sortOrder: 4 },
    { name: '营销管理', code: 'marketing', type: 1, parentId: 0n, sortOrder: 5 },
    { name: '内容管理', code: 'content', type: 1, parentId: 0n, sortOrder: 6 },
    { name: '供应商管理', code: 'supplier', type: 1, parentId: 0n, sortOrder: 7 },
    { name: '数据统计', code: 'statistics', type: 1, parentId: 0n, sortOrder: 8 },
    { name: '系统设置', code: 'system', type: 1, parentId: 0n, sortOrder: 9 },
  ];

  const parentMap: Record<string, any> = {};
  for (const perm of parentPermissions) {
    const p = await upsertAdminPermissionByCode(perm.code, {
      name: perm.name,
      type: perm.type,
      parentId: perm.parentId,
      sortOrder: perm.sortOrder,
    });
    parentMap[perm.code] = p;
  }

  const childPermissions = [
    { name: '商品列表', code: 'product:list', type: 1, parentCode: 'product', sortOrder: 1 },
    { name: '新增商品', code: 'product:create', type: 2, parentCode: 'product', sortOrder: 2 },
    { name: '编辑商品', code: 'product:edit', type: 2, parentCode: 'product', sortOrder: 3 },
    { name: '删除商品', code: 'product:delete', type: 2, parentCode: 'product', sortOrder: 4 },
    { name: '上架/下架', code: 'product:publish', type: 2, parentCode: 'product', sortOrder: 5 },
    { name: '库存管理', code: 'product:stock', type: 1, parentCode: 'product', sortOrder: 6 },
    { name: '分类管理', code: 'product:category', type: 1, parentCode: 'product', sortOrder: 7 },
    { name: '品牌管理', code: 'product:brand', type: 1, parentCode: 'product', sortOrder: 8 },
    { name: '订单列表', code: 'order:list', type: 1, parentCode: 'order', sortOrder: 1 },
    { name: '订单详情', code: 'order:detail', type: 2, parentCode: 'order', sortOrder: 2 },
    { name: '订单发货', code: 'order:deliver', type: 2, parentCode: 'order', sortOrder: 3 },
    { name: '订单备注', code: 'order:remark', type: 2, parentCode: 'order', sortOrder: 4 },
    { name: '取消订单', code: 'order:cancel', type: 2, parentCode: 'order', sortOrder: 5 },
    { name: '售后管理', code: 'order:aftersale', type: 1, parentCode: 'order', sortOrder: 6 },
    { name: '审核售后', code: 'order:aftersale:review', type: 2, parentCode: 'order', sortOrder: 7 },
    { name: '退款', code: 'order:aftersale:refund', type: 2, parentCode: 'order', sortOrder: 8 },
    { name: '订单导出', code: 'order:export', type: 2, parentCode: 'order', sortOrder: 9 },
    { name: '自提点管理', code: 'pickup:store', type: 2, parentCode: 'order', sortOrder: 10 },
    { name: '自提核销', code: 'pickup:verify', type: 2, parentCode: 'order', sortOrder: 11 },
    { name: '用户列表', code: 'user:list', type: 1, parentCode: 'user', sortOrder: 1 },
    { name: '用户详情', code: 'user:detail', type: 2, parentCode: 'user', sortOrder: 2 },
    { name: '会员管理', code: 'user:member', type: 2, parentCode: 'user', sortOrder: 3 },
    { name: '积分管理', code: 'user:points', type: 2, parentCode: 'user', sortOrder: 4 },
    { name: '宝宝档案', code: 'user:baby', type: 2, parentCode: 'user', sortOrder: 5 },
    { name: '优惠券管理', code: 'marketing:coupon', type: 1, parentCode: 'marketing', sortOrder: 1 },
    { name: '活动管理', code: 'marketing:activity', type: 1, parentCode: 'marketing', sortOrder: 2 },
    { name: 'Banner 管理', code: 'marketing:banner', type: 1, parentCode: 'marketing', sortOrder: 3 },
    { name: '推荐位管理', code: 'marketing:recommendation', type: 1, parentCode: 'marketing', sortOrder: 4 },
    { name: '首页装修', code: 'marketing:decor', type: 1, parentCode: 'marketing', sortOrder: 5 },
    { name: '分享管理', code: 'share', type: 1, parentCode: 'marketing', sortOrder: 6 },
    { name: '裂变活动', code: 'share:campaign', type: 2, parentCode: 'marketing', sortOrder: 7 },
    { name: '分享记录', code: 'share:record', type: 2, parentCode: 'marketing', sortOrder: 8 },
    { name: '邀请关系', code: 'share:invite', type: 2, parentCode: 'marketing', sortOrder: 9 },
    { name: '内容列表', code: 'content:list', type: 1, parentCode: 'content', sortOrder: 1 },
    { name: '编辑内容', code: 'content:edit', type: 2, parentCode: 'content', sortOrder: 2 },
    { name: '供应商列表', code: 'supplier:list', type: 1, parentCode: 'supplier', sortOrder: 1 },
    { name: '新增供应商', code: 'supplier:create', type: 2, parentCode: 'supplier', sortOrder: 2 },
    { name: '编辑供应商', code: 'supplier:edit', type: 2, parentCode: 'supplier', sortOrder: 3 },
    { name: '删除供应商', code: 'supplier:delete', type: 2, parentCode: 'supplier', sortOrder: 4 },
    { name: '数据统计', code: 'statistics:index', type: 1, parentCode: 'statistics', sortOrder: 1 },
    { name: '系统配置', code: 'system:config', type: 1, parentCode: 'system', sortOrder: 1 },
    { name: '管理员管理', code: 'system:admin', type: 1, parentCode: 'system', sortOrder: 2 },
    { name: '角色权限', code: 'system:role', type: 1, parentCode: 'system', sortOrder: 3 },
    { name: '操作日志', code: 'system:log', type: 1, parentCode: 'system', sortOrder: 4 },
    { name: '文件管理', code: 'system:file', type: 1, parentCode: 'system', sortOrder: 5 },
    { name: '客服配置', code: 'system:customer-service', type: 2, parentCode: 'system', sortOrder: 6 },
  ];

  const createdPermissions = [...Object.values(parentMap)];
  for (const perm of childPermissions) {
    const parent = parentMap[perm.parentCode];
    const p = await upsertAdminPermissionByCode(perm.code, {
      name: perm.name,
      type: perm.type,
      parentId: parent.id,
      sortOrder: perm.sortOrder,
    });
    createdPermissions.push(p);
  }

  console.log(`创建 ${createdPermissions.length} 个权限`);

  for (const perm of createdPermissions) {
    await ensureAdminRolePermission(superAdminRole.id, perm.id);
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

  const admin = await upsertAdminUserByUsername(adminUsername, {
    password: hashedPassword,
    realName: '超级管理员',
    mustChangePassword,
    status: 1,
  });

  await ensureAdminUserRole(admin.id, superAdminRole.id);

  console.log(`创建超级管理员账号 ${adminUsername} (密码已隐藏)`);

  const configs = [
    { groupName: 'basic', configKey: 'shop_name', configValue: '禧孕优选商城', valueType: 'string', description: '商城名称' },
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
    { groupName: 'customer_service', configKey: 'enabled', configValue: 'true', valueType: 'boolean', description: '客服功能启用' },
    { groupName: 'customer_service', configKey: 'type', configValue: 'phone', valueType: 'string', description: '客服类型 wechat/phone/both' },
    { groupName: 'customer_service', configKey: 'phone', configValue: '', valueType: 'string', description: '客服电话' },
    { groupName: 'customer_service', configKey: 'wechatQrCode', configValue: '', valueType: 'string', description: '微信客服二维码' },
    { groupName: 'customer_service', configKey: 'serviceTime', configValue: '周一至周五 9:00-18:00', valueType: 'string', description: '服务时间' },
    { groupName: 'customer_service', configKey: 'autoReplyText', configValue: '您好，客服正在为您服务，请稍候...', valueType: 'string', description: '自动回复文本' },
    { groupName: 'customer_service', configKey: 'faqContent', configValue: '[]', valueType: 'json', description: '常见问题内容' },
    { groupName: 'customer_service', configKey: 'notice', configValue: '', valueType: 'string', description: '客服公告' },
  ];

  for (const config of configs) {
    await upsertSystemConfigByGroupKey(config);
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
