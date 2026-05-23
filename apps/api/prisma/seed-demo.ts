import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

const DEMO_TAG = '[Demo]';

function demoName(name: string): string {
  return `${DEMO_TAG} ${name}`;
}

const now = new Date();
const futureDate = (days: number) => new Date(now.getTime() + days * 86400000);
const pastDate = (days: number) => new Date(now.getTime() - days * 86400000);

function ensureDemoAssets(): void {
  const srcDir = path.resolve(process.cwd(), 'prisma', 'demo-assets');
  const destDir = path.resolve(process.cwd(), 'uploads', 'demo');

  if (!fs.existsSync(srcDir)) {
    console.warn(`演示图片源目录不存在: ${srcDir}，跳过图片复制`);
    return;
  }

  if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
    console.log(`创建目标目录: ${destDir}`);
  }

  const files = fs.readdirSync(srcDir).filter(f => f.endsWith('.png'));
  let copied = 0;
  for (const file of files) {
    const src = path.join(srcDir, file);
    const dest = path.join(destDir, file);
    fs.copyFileSync(src, dest);
    copied++;
  }
  console.log(`复制演示图片: ${copied} 个文件 -> ${destDir}`);
}

async function main() {
  console.log('开始演示数据初始化...');

  ensureDemoAssets();

  const categories: any[] = await seedCategories();
  const brands: any[] = await seedBrands();
  const suppliers: any[] = await seedSuppliers();
  const products: any[] = await seedProducts(categories, brands, suppliers);
  const banners: any[] = await seedBanners();
  const homeSections: any[] = await seedHomeSections();
  const activities: any[] = await seedActivities(products);
  const coupons: any[] = await seedCoupons();
  const contentCategory: any = await seedContentCategory();
  const contents: any[] = await seedContents(contentCategory);
  const systemConfigs: any[] = await seedSystemConfigs();

  console.log('演示数据初始化完成！');
  console.log(`  分类: ${categories.length}`);
  console.log(`  品牌: ${brands.length}`);
  console.log(`  供应商: ${suppliers.length}`);
  console.log(`  商品: ${products.length}`);
  console.log(`  Banner: ${banners.length}`);
  console.log(`  首页模块: ${homeSections.length}`);
  console.log(`  活动: ${activities.length}`);
  console.log(`  优惠券: ${coupons.length}`);
  console.log(`  内容: ${contents.length}`);
  console.log(`  系统配置: ${systemConfigs.length}`);
}

async function seedCategories() {
  const items = [
    { name: '奶粉辅食', icon: '/uploads/demo/category-milk.png', sortOrder: 1 },
    { name: '纸尿裤', icon: '/uploads/demo/category-diaper.png', sortOrder: 2 },
    { name: '洗护用品', icon: '/uploads/demo/category-care.png', sortOrder: 3 },
    { name: '喂养用品', icon: '/uploads/demo/category-feeding.png', sortOrder: 4 },
    { name: '母婴出行', icon: '/uploads/demo/category-travel.png', sortOrder: 5 },
  ];

  const result: any[] = [];
  for (const item of items) {
    const existing: any = await prisma.productCategory.findFirst({ where: { name: demoName(item.name) } });
    if (existing) {
      result.push(existing);
      continue;
    }
    const cat: any = await prisma.productCategory.create({
      data: { name: demoName(item.name), icon: item.icon, sortOrder: item.sortOrder, isShow: 1, parentId: 0n },
    });
    result.push(cat);
  }
  return result;
}

async function seedBrands() {
  const items = [
    { name: '禧孕严选', logo: '/uploads/demo/brand-1.png', description: '禧孕母婴自有品牌', sortOrder: 1 },
    { name: 'Demo Baby', logo: '/uploads/demo/brand-2.png', description: 'Demo演示品牌', sortOrder: 2 },
    { name: '安心母婴', logo: '/uploads/demo/brand-3.png', description: '安心之选', sortOrder: 3 },
  ];

  const result: any[] = [];
  for (const item of items) {
    const existing: any = await prisma.brand.findFirst({ where: { name: demoName(item.name) } });
    if (existing) {
      result.push(existing);
      continue;
    }
    const brand: any = await prisma.brand.create({
      data: { name: demoName(item.name), logo: item.logo, description: item.description, sortOrder: item.sortOrder, status: 1 },
    });
    result.push(brand);
  }
  return result;
}

async function seedSuppliers() {
  const items = [
    { name: '演示供应商A', contactName: '张经理', contactPhone: '13800000001', address: '上海市浦东新区' },
    { name: '演示供应商B', contactName: '李经理', contactPhone: '13800000002', address: '广州市天河区' },
  ];

  const result: any[] = [];
  for (const item of items) {
    const existing: any = await prisma.supplier.findFirst({ where: { name: demoName(item.name) } });
    if (existing) {
      result.push(existing);
      continue;
    }
    const supplier: any = await prisma.supplier.create({
      data: { name: demoName(item.name), contactName: item.contactName, contactPhone: item.contactPhone, address: item.address, status: 1 },
    });
    result.push(supplier);
  }
  return result;
}

async function seedProducts(categories: any[], brands: any[], suppliers: any[]) {
  const productDefs = [
    {
      name: '婴幼儿配方奶粉 1段', categoryId: categories[0].id, brandId: brands[0].id, supplierId: suppliers[0].id,
      mainImage: '/uploads/demo/product-milk.png', minPrice: 19900, maxPrice: 19900, isRecommend: 1, virtualSales: 523,
      skus: [{ skuName: '1段 0-6个月', specs: { 规格: '1段 0-6个月' }, price: 19900, originalPrice: 25900, stock: 200 }],
    },
    {
      name: '婴幼儿米粉', categoryId: categories[0].id, brandId: brands[1].id, supplierId: suppliers[0].id,
      mainImage: '/uploads/demo/product-rice.png', minPrice: 4900, maxPrice: 4900, isRecommend: 0, virtualSales: 312,
      skus: [{ skuName: '原味 200g', specs: { 规格: '原味 200g' }, price: 4900, originalPrice: 6900, stock: 300 }],
    },
    {
      name: '超柔纸尿裤 M码', categoryId: categories[1].id, brandId: brands[0].id, supplierId: suppliers[0].id,
      mainImage: '/uploads/demo/product-diaper.png', minPrice: 8900, maxPrice: 12900, isRecommend: 1, virtualSales: 1024,
      skus: [
        { skuName: 'M码 6-11kg', specs: { 尺码: 'M码 6-11kg' }, price: 8900, originalPrice: 12900, stock: 500 },
        { skuName: 'L码 9-14kg', specs: { 尺码: 'L码 9-14kg' }, price: 9900, originalPrice: 13900, stock: 400 },
        { skuName: 'XL码 12-17kg', specs: { 尺码: 'XL码 12-17kg' }, price: 12900, originalPrice: 15900, stock: 300 },
      ],
    },
    {
      name: '婴儿湿巾 80抽', categoryId: categories[2].id, brandId: brands[2].id, supplierId: suppliers[1].id,
      mainImage: '/uploads/demo/product-wipes.png', minPrice: 1500, maxPrice: 1500, isRecommend: 0, virtualSales: 856,
      skus: [{ skuName: '80抽/包', specs: { 规格: '80抽/包' }, price: 1500, originalPrice: 2500, stock: 1000 }],
    },
    {
      name: '宝宝润肤乳', categoryId: categories[2].id, brandId: brands[2].id, supplierId: suppliers[1].id,
      mainImage: '/uploads/demo/product-lotion.png', minPrice: 5900, maxPrice: 5900, isRecommend: 1, virtualSales: 423,
      skus: [{ skuName: '200ml', specs: { 规格: '200ml' }, price: 5900, originalPrice: 7900, stock: 250 }],
    },
    {
      name: '奶瓶 PPSU', categoryId: categories[3].id, brandId: brands[0].id, supplierId: suppliers[0].id,
      mainImage: '/uploads/demo/product-bottle.png', minPrice: 7900, maxPrice: 9900, isRecommend: 1, virtualSales: 678,
      skus: [
        { skuName: '160ml', specs: { 容量: '160ml' }, price: 7900, originalPrice: 9900, stock: 180 },
        { skuName: '240ml', specs: { 容量: '240ml' }, price: 9900, originalPrice: 12900, stock: 150 },
      ],
    },
    {
      name: '安抚奶嘴', categoryId: categories[3].id, brandId: brands[1].id, supplierId: suppliers[1].id,
      mainImage: '/uploads/demo/product-pacifier.png', minPrice: 2900, maxPrice: 2900, isRecommend: 0, virtualSales: 234,
      skus: [{ skuName: '0-6个月', specs: { 适用年龄: '0-6个月' }, price: 2900, originalPrice: 3900, stock: 400 }],
    },
    {
      name: '婴儿推车', categoryId: categories[4].id, brandId: brands[0].id, supplierId: suppliers[0].id,
      mainImage: '/uploads/demo/product-stroller.png', minPrice: 59900, maxPrice: 59900, isRecommend: 1, virtualSales: 89,
      skus: [{ skuName: '标准版 灰色', specs: { 颜色: '灰色' }, price: 59900, originalPrice: 89900, stock: 50 }],
    },
    {
      name: '恒温水壶', categoryId: categories[3].id, brandId: brands[2].id, supplierId: suppliers[1].id,
      mainImage: '/uploads/demo/product-kettle.png', minPrice: 29900, maxPrice: 29900, isRecommend: 0, virtualSales: 567,
      skus: [{ skuName: '1.5L 白色', specs: { 颜色: '白色', 容量: '1.5L' }, price: 29900, originalPrice: 39900, stock: 120 }],
    },
    {
      name: '宝宝洗衣液', categoryId: categories[2].id, brandId: brands[1].id, supplierId: suppliers[1].id,
      mainImage: '/uploads/demo/product-detergent.png', minPrice: 3900, maxPrice: 3900, isRecommend: 0, virtualSales: 745,
      skus: [{ skuName: '1L装', specs: { 规格: '1L装' }, price: 3900, originalPrice: 5900, stock: 600 }],
    },
  ];

  const result: any[] = [];
  for (const def of productDefs) {
    const existing: any = await prisma.product.findFirst({ where: { name: demoName(def.name), deletedAt: null } });
    if (existing) {
      result.push(existing);
      continue;
    }
    const product: any = await prisma.product.create({
      data: {
        name: demoName(def.name),
        categoryId: def.categoryId,
        brandId: def.brandId,
        supplierId: def.supplierId,
        mainImage: def.mainImage,
        images: [def.mainImage],
        description: `<p>${demoName(def.name)} - 演示商品，仅供体验展示</p>`,
        minPrice: def.minPrice,
        maxPrice: def.maxPrice,
        totalSales: 0,
        virtualSales: def.virtualSales,
        status: 1,
        sortOrder: 0,
        isRecommend: def.isRecommend,
        isPeriodPurchase: 0,
      },
    });

    for (const skuDef of def.skus) {
      await prisma.productSku.create({
        data: {
          productId: product.id,
          skuCode: `DEMO-${product.id}-${skuDef.skuName}`,
          specs: skuDef.specs,
          price: skuDef.price,
          originalPrice: skuDef.originalPrice,
          stock: skuDef.stock,
          sales: 0,
          status: 1,
        },
      });
    }
    result.push(product);
  }
  return result;
}

async function seedBanners() {
  const items = [
    { title: '新人专享', image: '/uploads/demo/banner-1.png', linkType: 1, linkValue: '', sortOrder: 1 },
    { title: '母婴好物节', image: '/uploads/demo/banner-2.png', linkType: 1, linkValue: '', sortOrder: 2 },
    { title: '纸尿裤囤货季', image: '/uploads/demo/banner-3.png', linkType: 1, linkValue: '', sortOrder: 3 },
  ];

  const result: any[] = [];
  for (const item of items) {
    const existing: any = await prisma.banner.findFirst({ where: { title: demoName(item.title) } });
    if (existing) {
      result.push(existing);
      continue;
    }
    const banner: any = await prisma.banner.create({
      data: {
        title: demoName(item.title),
        image: item.image,
        linkType: item.linkType,
        linkValue: item.linkValue,
        sortOrder: item.sortOrder,
        status: 1,
        startTime: pastDate(1),
        endTime: futureDate(365),
      },
    });
    result.push(banner);
  }
  return result;
}

async function seedHomeSections() {
  const items = [
    { type: 'banner', title: '首页轮播', config: { source: 'banner' }, sortOrder: 1 },
    { type: 'category_nav', title: '分类导航', config: { columns: 5 }, sortOrder: 2 },
    { type: 'recommend_products', title: '为你推荐', config: { count: 6 }, sortOrder: 3 },
    { type: 'new_user_coupon', title: '新人福利', config: { count: 3 }, sortOrder: 4 },
    { type: 'hot_products', title: '热销好物', config: { count: 4 }, sortOrder: 5 },
  ];

  const result: any[] = [];
  for (const item of items) {
    const existing: any = await prisma.homeSection.findFirst({ where: { type: item.type, title: demoName(item.title) } });
    if (existing) {
      result.push(existing);
      continue;
    }
    const section: any = await prisma.homeSection.create({
      data: {
        type: item.type,
        title: demoName(item.title),
        config: item.config,
        sortOrder: item.sortOrder,
        status: 1,
      },
    });
    result.push(section);
  }
  return result;
}

async function seedActivities(products: any[]) {
  const items = [
    { name: '限时折扣', type: 'discount', description: '限时折扣专区', rules: { discount: 0.9 } },
    { name: '满减专区', type: 'full_reduce', description: '满199减20', rules: { threshold: 19900, reduce: 2000 } },
    { name: '满赠专区', type: 'gift', description: '满299赠品', rules: { threshold: 29900 } },
    { name: '组合套餐', type: 'bundle', description: '超值组合', rules: { bundleDiscount: 0.85 } },
  ];

  const result: any[] = [];
  for (const item of items) {
    const existing: any = await prisma.activity.findFirst({ where: { name: demoName(item.name) } });
    if (existing) {
      result.push(existing);
      continue;
    }
    const activity: any = await prisma.activity.create({
      data: {
        name: demoName(item.name),
        type: item.type,
        description: item.description,
        rules: item.rules,
        bannerImage: `/uploads/demo/activity-${item.type}.png`,
        startTime: pastDate(7),
        endTime: futureDate(30),
        status: 1,
        sortOrder: result.length + 1,
      },
    });

    const activityProducts = products.slice(0, Math.min(5, products.length));
    for (const product of activityProducts) {
      const firstSku: any = await prisma.productSku.findFirst({ where: { productId: product.id } });
      if (!firstSku) continue;
      const existingAP: any = await prisma.activityProduct.findFirst({
        where: { activityId: activity.id, productId: product.id, skuId: firstSku.id },
      });
      if (existingAP) continue;
      await prisma.activityProduct.create({
        data: {
          activityId: activity.id,
          productId: product.id,
          skuId: firstSku.id,
          activityPrice: Math.floor(firstSku.price * 0.9),
          activityStock: 100,
          activitySales: 0,
          limitPerUser: 0,
          sortOrder: 0,
        },
      });
    }
    result.push(activity);
  }
  return result;
}

async function seedCoupons() {
  const items = [
    { name: '新人无门槛券', type: 1, value: 500, minAmount: 0, totalCount: 1000, perLimit: 1, isNewUser: 1 },
    { name: '满199减20', type: 1, value: 2000, minAmount: 19900, totalCount: 500, perLimit: 2, isNewUser: 0 },
    { name: '满399减50', type: 1, value: 5000, minAmount: 39900, totalCount: 300, perLimit: 1, isNewUser: 0 },
  ];

  const result: any[] = [];
  for (const item of items) {
    const existing: any = await prisma.coupon.findFirst({ where: { name: demoName(item.name) } });
    if (existing) {
      result.push(existing);
      continue;
    }
    const coupon: any = await prisma.coupon.create({
      data: {
        name: demoName(item.name),
        type: item.type,
        value: item.value,
        minAmount: item.minAmount,
        totalCount: item.totalCount,
        receivedCount: 0,
        usedCount: 0,
        perLimit: item.perLimit,
        startTime: pastDate(1),
        endTime: futureDate(90),
        validDays: 30,
        applicableType: 0,
        isNewUser: item.isNewUser,
        status: 1,
      },
    });
    result.push(coupon);
  }
  return result;
}

async function seedContentCategory() {
  const existing: any = await prisma.contentCategory.findFirst({ where: { name: demoName('育儿知识') } });
  if (existing) return existing;
  return prisma.contentCategory.create({
    data: { name: demoName('育儿知识'), icon: '/uploads/demo/content-cat.png', sortOrder: 1, status: 1 },
  });
}

async function seedContents(contentCategory: any) {
  const items = [
    { title: '新生儿喂养指南', summary: '新手爸妈必读的新生儿喂养知识', content: '<p>新生儿喂养是每个新手父母最关心的话题。本文将从母乳喂养、配方奶选择、喂养频率等方面为您详细介绍。</p>' },
    { title: '宝宝纸尿裤尺码怎么选', summary: '如何为宝宝选择合适的纸尿裤尺码', content: '<p>选择合适的纸尿裤尺码对宝宝的舒适度至关重要。本文将教您根据宝宝体重和月龄选择合适的尺码。</p>' },
    { title: '换季宝宝护肤注意事项', summary: '换季时节如何呵护宝宝娇嫩肌肤', content: '<p>换季时节宝宝皮肤容易出现干燥、过敏等问题。本文为您介绍换季护肤的关键要点。</p>' },
  ];

  const result: any[] = [];
  for (const item of items) {
    const existing: any = await prisma.content.findFirst({ where: { title: demoName(item.title), deletedAt: null } });
    if (existing) {
      result.push(existing);
      continue;
    }
    const content: any = await prisma.content.create({
      data: {
        categoryId: contentCategory.id,
        title: demoName(item.title),
        coverImage: `/uploads/demo/content-${result.length + 1}.png`,
        content: item.content,
        summary: item.summary,
        viewCount: Math.floor(Math.random() * 500) + 100,
        sortOrder: result.length + 1,
        status: 1,
        publishedAt: now,
      },
    });
    result.push(content);
  }
  return result;
}

async function seedSystemConfigs() {
  const configs = [
    { groupName: 'basic', configKey: 'shop_name', configValue: '禧孕母婴', valueType: 'string', description: '商城名称' },
    { groupName: 'basic', configKey: 'customer_service_phone', configValue: '', valueType: 'string', description: '客服电话' },
    { groupName: 'payment', configKey: 'payment_enabled', configValue: 'false', valueType: 'boolean', description: '支付功能是否开通' },
  ];

  const result: any[] = [];
  for (const config of configs) {
    const upserted: any = await prisma.systemConfig.upsert({
      where: { uk_group_key: { groupName: config.groupName, configKey: config.configKey } },
      update: { configValue: config.configValue },
      create: config,
    });
    result.push(upserted);
  }
  return result;
}

main()
  .catch((e) => {
    console.error('演示数据初始化失败:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
