import { AftersaleStatus, OrderStatus, PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import * as zlib from 'zlib';

const prisma = new PrismaClient();

const DEMO_TAG = '[Demo]';
const DEMO_TEST_TAG = '[测试]';
const DEMO_SKU_PREFIX = 'DEMO-SKU';
const DEMO_NOTICE = '仅供演示测试，不作为真实售卖商品';
const DEMO_CERT = 'DEMO-CERT-NOT-FOR-PRODUCTION';
const now = new Date();

const futureDate = (days: number) => new Date(now.getTime() + days * 86400000);
const pastDate = (days: number) => new Date(now.getTime() - days * 86400000);
const demoName = (name: string) => `${DEMO_TAG} ${name}`;
const demoPath = (name: string) => `/uploads/demo/${name}.png`;

type ProductDef = {
  key: string;
  name: string;
  category: string;
  brand: string;
  supplier: string;
  image: string;
  price: number;
  originalPrice: number;
  virtualSales: number;
  isRecommend?: number;
  ageMin?: number;
  ageMax?: number;
  specs: Record<string, string>[];
  compliance: 'infant_formula' | 'food' | 'normal';
};

function assertNonProduction() {
  if ((process.env.NODE_ENV || '').toLowerCase() === 'production') {
    console.error('ERROR: Demo seed 禁止在 NODE_ENV=production 环境执行。请确认 DATABASE_URL 指向开发/测试库。');
    process.exit(1);
  }
}

function crc32(buf: Buffer) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return (~c) >>> 0;
}

function pngChunk(type: string, data: Buffer) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const name = Buffer.from(type);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([name, data])), 0);
  return Buffer.concat([len, name, data, crc]);
}

const font: Record<string, string[]> = {
  D: ['11110', '10001', '10001', '10001', '10001', '10001', '11110'],
  E: ['11111', '10000', '10000', '11110', '10000', '10000', '11111'],
  M: ['10001', '11011', '10101', '10101', '10001', '10001', '10001'],
  O: ['01110', '10001', '10001', '10001', '10001', '10001', '01110'],
};

function makePng(width: number, height: number, palette: number[][]) {
  const raw = Buffer.alloc((width * 4 + 1) * height);
  const [a, b, c, d] = palette;

  const setPixel = (x: number, y: number, color: number[]) => {
    if (x < 0 || y < 0 || x >= width || y >= height) return;
    const row = y * (width * 4 + 1);
    const idx = row + 1 + x * 4;
    raw[idx] = color[0];
    raw[idx + 1] = color[1];
    raw[idx + 2] = color[2];
    raw[idx + 3] = 255;
  };

  for (let y = 0; y < height; y++) {
    const row = y * (width * 4 + 1);
    raw[row] = 0;
    for (let x = 0; x < width; x++) {
      const t = (x / Math.max(1, width - 1) + y / Math.max(1, height - 1)) / 2;
      const cx = x - width * 0.78;
      const cy = y - height * 0.22;
      const glow = Math.max(0, 1 - Math.sqrt(cx * cx + cy * cy) / (width * 0.48));
      const idx = row + 1 + x * 4;
      for (let i = 0; i < 3; i++) {
        let value = a[i] * (1 - t) + b[i] * t;
        value = value * (1 - glow * 0.36) + c[i] * glow * 0.36;
        raw[idx + i] = Math.round(value);
      }
      raw[idx + 3] = 255;
    }
  }

  const badgeX = Math.round(width * 0.06);
  const badgeY = Math.round(height * 0.08);
  const badgeW = Math.min(138, Math.round(width * 0.38));
  const badgeH = Math.min(54, Math.round(height * 0.2));
  for (let y = badgeY; y < badgeY + badgeH; y++) {
    for (let x = badgeX; x < badgeX + badgeW; x++) setPixel(x, y, [255, 255, 255]);
  }
  const scale = Math.max(3, Math.floor(badgeH / 13));
  let cursorX = badgeX + 12;
  const textY = badgeY + Math.floor((badgeH - 7 * scale) / 2);
  for (const ch of 'DEMO') {
    const rows = font[ch];
    for (let y = 0; y < rows.length; y++) {
      for (let x = 0; x < rows[y].length; x++) {
        if (rows[y][x] !== '1') continue;
        for (let sy = 0; sy < scale; sy++) {
          for (let sx = 0; sx < scale; sx++) setPixel(cursorX + x * scale + sx, textY + y * scale + sy, d);
        }
      }
    }
    cursorX += 6 * scale;
  }

  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 6;

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk('IHDR', header),
    pngChunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

function ensureDemoAssets(): void {
  const srcDir = path.resolve(process.cwd(), 'prisma', 'demo-assets');
  const destDir = path.resolve(process.cwd(), 'uploads', 'demo');
  fs.mkdirSync(srcDir, { recursive: true });
  fs.mkdirSync(destDir, { recursive: true });

  const assetNames = new Set<string>([
    'banner-new-mom',
    'banner-baby-festival',
    'banner-diaper-season',
    'banner-care-special',
    'brand-xiyun',
    'brand-demo-baby',
    'brand-sage-care',
    'brand-peach-home',
    'category-milk',
    'category-diaper',
    'category-care',
    'category-feeding',
    'category-maternity',
    'category-clothes',
    'category-toy',
    'category-travel',
    'activity-new-user',
    'activity-flash',
    'activity-199',
    'activity-399',
    'activity-diaper',
    'activity-care',
    'content-1',
    'content-2',
    'content-3',
    'demo-cert',
    'default-avatar',
    'default-baby',
  ]);
  for (const product of productDefs) {
    assetNames.add(product.image);
    assetNames.add(`${product.image}-detail`);
  }

  const palettes = [
    [[255, 252, 247], [255, 238, 231], [242, 118, 120], [214, 83, 92]],
    [[255, 253, 248], [239, 247, 239], [151, 181, 163], [87, 135, 111]],
    [[255, 252, 247], [255, 244, 228], [251, 177, 140], [214, 83, 92]],
  ];

  let index = 0;
  for (const name of assetNames) {
    const size = name.startsWith('banner') || name.startsWith('activity') ? [750, 360] : [420, 420];
    const sourcePath = path.join(srcDir, `${name}.png`);
    const destPath = path.join(destDir, `${name}.png`);
    const png = makePng(size[0], size[1], palettes[index % palettes.length]);
    fs.writeFileSync(sourcePath, png);
    fs.copyFileSync(sourcePath, destPath);
    index++;
  }
  console.log(`Demo 图片物料已生成并复制: ${assetNames.size} 个 -> ${destDir}`);
}

const categoryDefs = [
  { key: 'milk', name: '奶粉辅食', icon: 'category-milk', children: ['配方奶粉', '米粉果泥', '营养面点'] },
  { key: 'diaper', name: '纸尿裤', icon: 'category-diaper', children: ['纸尿裤', '拉拉裤', '夜用护理'] },
  { key: 'care', name: '洗护清洁', icon: 'category-care', children: ['湿巾棉柔巾', '宝宝护肤', '洗衣清洁'] },
  { key: 'feeding', name: '喂养用品', icon: 'category-feeding', children: ['奶瓶奶嘴', '水壶餐具', '辅食工具'] },
  { key: 'maternity', name: '孕产用品', icon: 'category-maternity', children: ['待产护理', '产后护理', '哺乳用品'] },
  { key: 'clothes', name: '童装童鞋', icon: 'category-clothes', children: ['婴儿服饰', '童鞋袜帽'] },
  { key: 'toy', name: '玩具早教', icon: 'category-toy', children: ['安抚玩具', '布书早教', '牙胶摇铃'] },
  { key: 'travel', name: '出行寝居', icon: 'category-travel', children: ['婴儿推车', '安全座椅', '寝居用品'] },
];

const brandDefs = [
  { key: 'xiyun', name: '禧孕测试严选', logo: 'brand-xiyun' },
  { key: 'demo-baby', name: 'Demo Baby Lab', logo: 'brand-demo-baby' },
  { key: 'sage-care', name: 'Sage Care Demo', logo: 'brand-sage-care' },
  { key: 'peach-home', name: 'Peach Home Demo', logo: 'brand-peach-home' },
];

const supplierDefs = [
  { key: 'linyi', name: '临沂 Demo 母婴供应商', phone: '13800000001' },
  { key: 'warehouse', name: 'Demo 华东测试仓', phone: '13800000002' },
  { key: 'content', name: 'Demo 内容与物料供应商', phone: '13800000003' },
];

const productDefs: ProductDef[] = [
  { key: 'formula-1', name: '婴幼儿配方奶粉 1段', category: '配方奶粉', brand: 'xiyun', supplier: 'linyi', image: 'product-formula-1', price: 19900, originalPrice: 25900, virtualSales: 526, isRecommend: 1, ageMin: 0, ageMax: 6, compliance: 'infant_formula', specs: [{ 段位: '1段', 规格: '800g' }] },
  { key: 'formula-2', name: '婴幼儿配方奶粉 2段', category: '配方奶粉', brand: 'xiyun', supplier: 'linyi', image: 'product-formula-2', price: 20900, originalPrice: 26900, virtualSales: 438, isRecommend: 1, ageMin: 6, ageMax: 12, compliance: 'infant_formula', specs: [{ 段位: '2段', 规格: '800g' }] },
  { key: 'formula-3', name: '婴幼儿配方奶粉 3段', category: '配方奶粉', brand: 'demo-baby', supplier: 'linyi', image: 'product-formula-3', price: 21900, originalPrice: 28900, virtualSales: 392, ageMin: 12, ageMax: 36, compliance: 'infant_formula', specs: [{ 段位: '3段', 规格: '800g' }] },
  { key: 'rice-cereal', name: '高铁米粉', category: '米粉果泥', brand: 'sage-care', supplier: 'warehouse', image: 'product-rice-cereal', price: 4900, originalPrice: 6900, virtualSales: 376, isRecommend: 1, ageMin: 6, ageMax: 24, compliance: 'food', specs: [{ 口味: '原味', 规格: '200g' }, { 口味: '苹果味', 规格: '200g' }] },
  { key: 'fruit-puree', name: '宝宝果泥', category: '米粉果泥', brand: 'sage-care', supplier: 'warehouse', image: 'product-fruit-puree', price: 3900, originalPrice: 5900, virtualSales: 288, ageMin: 6, ageMax: 24, compliance: 'food', specs: [{ 口味: '苹果梨', 规格: '100g*4' }] },
  { key: 'baby-noodle', name: '宝宝营养面', category: '营养面点', brand: 'peach-home', supplier: 'warehouse', image: 'product-baby-noodle', price: 5900, originalPrice: 7900, virtualSales: 221, ageMin: 8, ageMax: 36, compliance: 'food', specs: [{ 口味: '南瓜', 规格: '240g' }] },
  { key: 'diaper-s', name: '云柔纸尿裤 S码', category: '纸尿裤', brand: 'xiyun', supplier: 'linyi', image: 'product-diaper-s', price: 7900, originalPrice: 10900, virtualSales: 924, isRecommend: 1, ageMin: 0, ageMax: 4, compliance: 'normal', specs: [{ 尺码: 'S', 片数: '68片' }] },
  { key: 'diaper-m', name: '云柔纸尿裤 M码', category: '纸尿裤', brand: 'xiyun', supplier: 'linyi', image: 'product-diaper-m', price: 8900, originalPrice: 12900, virtualSales: 1208, isRecommend: 1, ageMin: 3, ageMax: 8, compliance: 'normal', specs: [{ 尺码: 'M', 片数: '60片' }] },
  { key: 'diaper-l', name: '云柔纸尿裤 L码', category: '纸尿裤', brand: 'xiyun', supplier: 'linyi', image: 'product-diaper-l', price: 9900, originalPrice: 13900, virtualSales: 1044, ageMin: 6, ageMax: 14, compliance: 'normal', specs: [{ 尺码: 'L', 片数: '54片' }] },
  { key: 'diaper-xl', name: '云柔纸尿裤 XL码', category: '纸尿裤', brand: 'xiyun', supplier: 'linyi', image: 'product-diaper-xl', price: 11900, originalPrice: 15900, virtualSales: 832, ageMin: 10, ageMax: 24, compliance: 'normal', specs: [{ 尺码: 'XL', 片数: '46片' }] },
  { key: 'pull-up', name: '成长拉拉裤', category: '拉拉裤', brand: 'demo-baby', supplier: 'warehouse', image: 'product-pull-up', price: 10900, originalPrice: 14900, virtualSales: 712, compliance: 'normal', specs: [{ 尺码: 'L', 片数: '44片' }, { 尺码: 'XL', 片数: '40片' }] },
  { key: 'night-diaper', name: '夜用纸尿裤', category: '夜用护理', brand: 'demo-baby', supplier: 'warehouse', image: 'product-night-diaper', price: 12900, originalPrice: 16900, virtualSales: 516, compliance: 'normal', specs: [{ 尺码: 'L', 片数: '36片' }] },
  { key: 'wipes', name: '婴儿湿巾', category: '湿巾棉柔巾', brand: 'sage-care', supplier: 'warehouse', image: 'product-wipes', price: 1590, originalPrice: 2590, virtualSales: 1326, compliance: 'normal', specs: [{ 规格: '80抽*3包' }] },
  { key: 'lotion', name: '宝宝润肤乳', category: '宝宝护肤', brand: 'sage-care', supplier: 'warehouse', image: 'product-lotion', price: 5900, originalPrice: 7900, virtualSales: 423, isRecommend: 1, compliance: 'normal', specs: [{ 容量: '200ml' }] },
  { key: 'body-wash', name: '宝宝沐浴露', category: '宝宝护肤', brand: 'sage-care', supplier: 'warehouse', image: 'product-body-wash', price: 6900, originalPrice: 8900, virtualSales: 318, compliance: 'normal', specs: [{ 容量: '300ml' }] },
  { key: 'detergent', name: '宝宝洗衣液', category: '洗衣清洁', brand: 'peach-home', supplier: 'warehouse', image: 'product-detergent', price: 3900, originalPrice: 5900, virtualSales: 745, compliance: 'normal', specs: [{ 规格: '1L' }] },
  { key: 'bottle', name: 'PPSU 奶瓶', category: '奶瓶奶嘴', brand: 'xiyun', supplier: 'linyi', image: 'product-bottle', price: 7900, originalPrice: 9900, virtualSales: 678, isRecommend: 1, compliance: 'normal', specs: [{ 容量: '160ml', 颜色: '奶油白' }, { 容量: '240ml', 颜色: '蜜桃粉' }] },
  { key: 'pacifier', name: '安抚奶嘴', category: '奶瓶奶嘴', brand: 'demo-baby', supplier: 'warehouse', image: 'product-pacifier', price: 2900, originalPrice: 3900, virtualSales: 234, compliance: 'normal', specs: [{ 适用月龄: '0-6个月' }, { 适用月龄: '6-18个月' }] },
  { key: 'kettle', name: '恒温水壶', category: '水壶餐具', brand: 'peach-home', supplier: 'warehouse', image: 'product-kettle', price: 29900, originalPrice: 39900, virtualSales: 567, compliance: 'normal', specs: [{ 容量: '1.5L', 颜色: '象牙白' }] },
  { key: 'bowl-spoon', name: '辅食碗勺', category: '辅食工具', brand: 'peach-home', supplier: 'warehouse', image: 'product-bowl-spoon', price: 6900, originalPrice: 9900, virtualSales: 264, compliance: 'normal', specs: [{ 颜色: '鼠尾草绿' }] },
  { key: 'maternity-bag', name: '孕妇待产包', category: '待产护理', brand: 'xiyun', supplier: 'linyi', image: 'product-maternity-bag', price: 19900, originalPrice: 25900, virtualSales: 186, compliance: 'normal', specs: [{ 规格: '18件套' }] },
  { key: 'maternity-pad', name: '产褥垫', category: '产后护理', brand: 'sage-care', supplier: 'warehouse', image: 'product-maternity-pad', price: 4900, originalPrice: 6900, virtualSales: 278, compliance: 'normal', specs: [{ 规格: '60*90cm 10片' }] },
  { key: 'nursing-pillow', name: '哺乳枕', category: '哺乳用品', brand: 'peach-home', supplier: 'warehouse', image: 'product-nursing-pillow', price: 12900, originalPrice: 16900, virtualSales: 96, compliance: 'normal', specs: [{ 颜色: '奶油白' }] },
  { key: 'onesie', name: '宝宝连体衣', category: '婴儿服饰', brand: 'demo-baby', supplier: 'linyi', image: 'product-onesie', price: 7900, originalPrice: 10900, virtualSales: 386, compliance: 'normal', specs: [{ 尺码: '66cm', 颜色: '柔粉' }, { 尺码: '73cm', 颜色: '象牙白' }] },
  { key: 'soft-shoes', name: '宝宝软底鞋', category: '童鞋袜帽', brand: 'demo-baby', supplier: 'linyi', image: 'product-soft-shoes', price: 6900, originalPrice: 9900, virtualSales: 255, compliance: 'normal', specs: [{ 尺码: '12码', 颜色: '奶茶色' }] },
  { key: 'doll', name: '安抚玩偶', category: '安抚玩具', brand: 'peach-home', supplier: 'content', image: 'product-doll', price: 5900, originalPrice: 7900, virtualSales: 418, compliance: 'normal', specs: [{ 款式: '小熊' }] },
  { key: 'cloth-book', name: '早教布书', category: '布书早教', brand: 'peach-home', supplier: 'content', image: 'product-cloth-book', price: 4900, originalPrice: 6900, virtualSales: 307, compliance: 'normal', specs: [{ 主题: '动物认知' }] },
  { key: 'teether', name: '宝宝牙胶', category: '牙胶摇铃', brand: 'sage-care', supplier: 'content', image: 'product-teether', price: 3900, originalPrice: 5900, virtualSales: 292, compliance: 'normal', specs: [{ 款式: '小云朵' }] },
  { key: 'stroller', name: '婴儿推车', category: '婴儿推车', brand: 'xiyun', supplier: 'linyi', image: 'product-stroller', price: 59900, originalPrice: 89900, virtualSales: 89, isRecommend: 1, compliance: 'normal', specs: [{ 颜色: '雾灰', 版本: '标准版' }] },
  { key: 'car-seat', name: '儿童安全座椅', category: '安全座椅', brand: 'xiyun', supplier: 'linyi', image: 'product-car-seat', price: 69900, originalPrice: 99900, virtualSales: 72, compliance: 'normal', specs: [{ 颜色: '深棕灰', 组别: '0-4岁' }] },
  { key: 'bedding', name: '婴儿床品', category: '寝居用品', brand: 'peach-home', supplier: 'warehouse', image: 'product-bedding', price: 18900, originalPrice: 25900, virtualSales: 145, compliance: 'normal', specs: [{ 规格: '三件套', 颜色: '奶油白' }] },
];

async function main() {
  assertNonProduction();
  console.log('开始 Demo 数据初始化...');
  ensureDemoAssets();

  const categories = await seedCategories();
  const brands = await seedBrands();
  const suppliers = await seedSuppliers();
  const products = await seedProducts(categories, brands, suppliers);
  const activities = await seedActivities(products);
  const banners = await seedBanners(products, activities);
  const coupons = await seedCoupons(categories, products);
  const homeSections = await seedHomeSections();
  const contentCategory = await seedContentCategory();
  const contents = await seedContents(contentCategory);
  const systemConfigs = await seedSystemConfigs();
  const users = await seedUsers();
  const orders = await seedOrders(users, products);
  const aftersales = await seedAftersales(users, orders);

  console.log('Demo 数据初始化完成');
  console.log(`  一级/二级分类: ${Object.keys(categories).length}`);
  console.log(`  品牌: ${Object.keys(brands).length}`);
  console.log(`  供应商: ${Object.keys(suppliers).length}`);
  console.log(`  商品: ${products.length}`);
  console.log(`  Banner: ${banners.length}`);
  console.log(`  首页模块: ${homeSections.length}`);
  console.log(`  活动: ${activities.length}`);
  console.log(`  优惠券: ${coupons.length}`);
  console.log(`  内容: ${contents.length}`);
  console.log(`  系统配置: ${systemConfigs.length}`);
  console.log(`  用户: ${users.length}`);
  console.log(`  订单: ${orders.length}`);
  console.log(`  售后: ${aftersales.length}`);
}

async function seedCategories() {
  const result: Record<string, any> = {};
  for (const [index, parent] of categoryDefs.entries()) {
    const parentName = demoName(parent.name);
    const existingParent = await prisma.productCategory.findFirst({ where: { name: parentName } });
    const parentData = {
      parentId: 0n,
      name: parentName,
      icon: demoPath(parent.icon),
      complianceConfig: {
        demo: true,
        notice: `${DEMO_TAG} 类目配置，仅供测试展示`,
        requiredComplianceFields: [],
      },
      sortOrder: index + 1,
      isShow: 1,
      deletedAt: null,
    };
    const savedParent = existingParent
      ? await prisma.productCategory.update({ where: { id: existingParent.id }, data: parentData })
      : await prisma.productCategory.create({ data: parentData });
    result[parent.name] = savedParent;

    for (const [childIndex, childNameRaw] of parent.children.entries()) {
      const childName = demoName(childNameRaw);
      const existingChild = await prisma.productCategory.findFirst({ where: { name: childName } });
      const childData = {
        parentId: savedParent.id,
        name: childName,
        icon: demoPath(parent.icon),
        complianceConfig: {
          demo: true,
          notice: `${DEMO_TAG} ${childNameRaw} 合规配置仅供测试展示`,
          isFood: ['配方奶粉', '米粉果泥', '营养面点'].includes(childNameRaw),
          isInfantFormula: childNameRaw === '配方奶粉',
          requiresCertImages: ['配方奶粉', '米粉果泥', '营养面点'].includes(childNameRaw),
          requiredComplianceFields: [],
        },
        sortOrder: (index + 1) * 10 + childIndex,
        isShow: 1,
        deletedAt: null,
      };
      result[childNameRaw] = existingChild
        ? await prisma.productCategory.update({ where: { id: existingChild.id }, data: childData })
        : await prisma.productCategory.create({ data: childData });
    }
  }
  return result;
}

async function seedBrands() {
  const result: Record<string, any> = {};
  for (const [index, item] of brandDefs.entries()) {
    const name = demoName(item.name);
    const existing = await prisma.brand.findFirst({ where: { name } });
    const data = {
      name,
      logo: demoPath(item.logo),
      description: `${DEMO_TAG} 演示品牌，仅用于后台和小程序测试，不代表真实品牌授权。`,
      sortOrder: index + 1,
      status: 1,
      deletedAt: null,
    };
    result[item.key] = existing
      ? await prisma.brand.update({ where: { id: existing.id }, data })
      : await prisma.brand.create({ data });
  }
  return result;
}

async function seedSuppliers() {
  const result: Record<string, any> = {};
  for (const [index, item] of supplierDefs.entries()) {
    const name = demoName(item.name);
    const existing = await prisma.supplier.findFirst({ where: { name } });
    const data = {
      name,
      contactName: `${DEMO_TEST_TAG} 运营专员`,
      contactPhone: item.phone,
      address: '山东省临沂市兰山区 Demo测试地址',
      businessLicense: DEMO_CERT,
      cooperationStartDate: pastDate(60),
      settlementType: 1,
      remark: `${DEMO_TAG} 供应商资料仅供测试展示，不作为真实合作信息。`,
      status: 1,
      deletedAt: null,
      updatedAt: new Date(),
    };
    result[item.key] = existing
      ? await prisma.supplier.update({ where: { id: existing.id }, data })
      : await prisma.supplier.create({ data: { ...data, createdAt: pastDate(30 - index) } });
  }
  return result;
}

function complianceFor(type: ProductDef['compliance']) {
  if (type === 'infant_formula') {
    return {
      isRegulated: true,
      isFood: true,
      isInfantFormula: true,
      productionLicenseNo: `${DEMO_TAG} 仅供测试展示`,
      foodBusinessCertNo: `${DEMO_TAG} 仅供测试展示`,
      infantFormulaRegNo: DEMO_CERT,
      manufacturer: `${DEMO_TAG} 测试展示厂家`,
      shelfLife: `${DEMO_TAG} 仅供测试展示`,
      storageCondition: `${DEMO_TAG} 阴凉干燥处，测试文案`,
      certImages: [demoPath('demo-cert')],
      demoNotice: DEMO_NOTICE,
    };
  }
  if (type === 'food') {
    return {
      isRegulated: true,
      isFood: true,
      isInfantFormula: false,
      productionLicenseNo: `${DEMO_TAG} 仅供测试展示`,
      foodBusinessCertNo: `${DEMO_TAG} 仅供测试展示`,
      manufacturer: `${DEMO_TAG} 测试展示厂家`,
      shelfLife: `${DEMO_TAG} 仅供测试展示`,
      storageCondition: `${DEMO_TAG} 阴凉干燥处，测试文案`,
      certImages: [demoPath('demo-cert')],
      demoNotice: DEMO_NOTICE,
    };
  }
  return {
    isRegulated: false,
    demoCertNo: DEMO_CERT,
    demoNotice: DEMO_NOTICE,
  };
}

function productDescription(def: ProductDef) {
  return `
    <section>
      <h2>${demoName(def.name)}</h2>
      <p><strong>${DEMO_NOTICE}</strong></p>
      <p>${DEMO_TAG} 当前商品用于微信开发者工具、真机预览、管理后台流程测试。</p>
      <p>${DEMO_TAG} 价格、库存、销量、合规信息均为测试数据，不构成真实售卖承诺。</p>
    </section>
  `;
}

async function seedProducts(categories: Record<string, any>, brands: Record<string, any>, suppliers: Record<string, any>) {
  const products: any[] = [];
  for (const [index, def] of productDefs.entries()) {
    const name = demoName(def.name);
    const mainImage = demoPath(def.image);
    const images = [mainImage, demoPath(`${def.image}-detail`)];
    const skuPrices = def.specs.map((_, skuIndex) => def.price + skuIndex * 1000);
    const existing = await prisma.product.findFirst({ where: { name } });
    const data = {
      name,
      categoryId: categories[def.category].id,
      brandId: brands[def.brand].id,
      supplierId: suppliers[def.supplier].id,
      mainImage,
      images,
      description: productDescription(def),
      attributes: {
        demo: true,
        detailContent: productDescription(def),
        sellingPoints: ['自营正品', '售后无忧', '极速发货'],
        compliance: complianceFor(def.compliance),
      },
      servicePromise: ['自营正品', '极速发货', '贴心售后', '合规资料'],
      minPrice: Math.min(...skuPrices),
      maxPrice: Math.max(...skuPrices),
      totalSales: 0,
      virtualSales: def.virtualSales,
      status: 1,
      sortOrder: index + 1,
      isRecommend: def.isRecommend ?? (index % 4 === 0 ? 1 : 0),
      recommendAgeMin: def.ageMin ?? null,
      recommendAgeMax: def.ageMax ?? null,
      isPeriodPurchase: 0,
      deletedAt: null,
    };
    const product = existing
      ? await prisma.product.update({ where: { id: existing.id }, data })
      : await prisma.product.create({ data });

    await prisma.productImage.deleteMany({ where: { productId: product.id } });
    await prisma.productImage.createMany({
      data: images.map((imageUrl, sortOrder) => ({ productId: product.id, imageUrl, sortOrder })),
    });

    for (const [skuIndex, specs] of def.specs.entries()) {
      const skuCode = `${DEMO_SKU_PREFIX}-${def.key.toUpperCase()}-${skuIndex + 1}`;
      const existingSku = await prisma.productSku.findFirst({ where: { skuCode } });
      const skuData = {
        productId: product.id,
        skuCode,
        specs,
        price: def.price + skuIndex * 1000,
        originalPrice: def.originalPrice + skuIndex * 1000,
        costPrice: Math.floor((def.price + skuIndex * 1000) * 0.68),
        stock: 120 + index * 7 + skuIndex * 20,
        sales: 0,
        image: mainImage,
        weight: 500 + index * 10,
        barcode: `DEMO-BARCODE-${def.key.toUpperCase()}-${skuIndex + 1}`,
        status: 1,
      };
      if (existingSku) {
        await prisma.productSku.update({ where: { id: existingSku.id }, data: skuData });
      } else {
        await prisma.productSku.create({ data: skuData });
      }
    }

    products.push(await prisma.product.findFirstOrThrow({ where: { id: product.id }, include: { skus: true } }));
  }
  return products;
}

async function seedActivities(products: any[]) {
  const activityDefs = [
    { name: '新人专享礼包', type: 'new_user', image: 'activity-new-user', rule: { benefit: 'new_user_coupon', limitPerUser: 1 } },
    { name: '限时秒杀', type: 'flash_sale', image: 'activity-flash', rule: { discount: 0.82, limitPerUser: 2 } },
    { name: '满199减20', type: 'full_reduce', image: 'activity-199', rule: { threshold: 19900, reduce: 2000 } },
    { name: '满399减50', type: 'full_reduce', image: 'activity-399', rule: { threshold: 39900, reduce: 5000 } },
    { name: '纸尿裤囤货季', type: 'diaper_season', image: 'activity-diaper', rule: { category: 'diaper', discount: 0.88 } },
    { name: '洗护清洁专场', type: 'care_special', image: 'activity-care', rule: { category: 'care', discount: 0.9 } },
  ];

  const result: any[] = [];
  for (const [index, item] of activityDefs.entries()) {
    const name = demoName(item.name);
    const existing = await prisma.activity.findFirst({ where: { name } });
    const data = {
      name,
      type: item.type,
      description: `${DEMO_TAG} ${item.name}：活动规则仅用于测试展示，不代表真实营销承诺。`,
      rules: { demo: true, notice: DEMO_NOTICE, ...item.rule },
      bannerImage: demoPath(item.image),
      startTime: pastDate(3),
      endTime: futureDate(30 + index * 3),
      status: 2,
      sortOrder: index + 1,
    };
    const activity = existing
      ? await prisma.activity.update({ where: { id: existing.id }, data })
      : await prisma.activity.create({ data });

    const relatedProducts = products.slice(index * 3, index * 3 + 6).length
      ? products.slice(index * 3, index * 3 + 6)
      : products.slice(0, 6);
    for (const [sortOrder, product] of relatedProducts.entries()) {
      const sku = product.skus?.[0] || await prisma.productSku.findFirst({ where: { productId: product.id, status: 1 } });
      if (!sku) continue;
      const existingAp = await prisma.activityProduct.findFirst({
        where: { activityId: activity.id, productId: product.id, skuId: sku.id },
      });
      const apData = {
        activityId: activity.id,
        productId: product.id,
        skuId: sku.id,
        activityPrice: Math.floor(sku.price * 0.88),
        activityStock: 80,
        activitySales: 0,
        limitPerUser: index === 1 ? 2 : 0,
        sortOrder,
      };
      if (existingAp) await prisma.activityProduct.update({ where: { id: existingAp.id }, data: apData });
      else await prisma.activityProduct.create({ data: apData });
    }
    result.push(activity);
  }
  return result;
}

async function seedBanners(products: any[], activities: any[]) {
  const items = [
    { title: '新人妈妈安心选', image: 'banner-new-mom', linkType: 2, linkValue: activities[0]?.id?.toString() || '' },
    { title: '母婴好物节', image: 'banner-baby-festival', linkType: 2, linkValue: activities[1]?.id?.toString() || '' },
    { title: '纸尿裤囤货季', image: 'banner-diaper-season', linkType: 2, linkValue: activities[4]?.id?.toString() || '' },
    { title: '宝宝洗护专场', image: 'banner-care-special', linkType: 1, linkValue: products.find((p) => p.name.includes('宝宝沐浴露'))?.id?.toString() || products[0]?.id?.toString() || '' },
  ];
  const result: any[] = [];
  for (const [index, item] of items.entries()) {
    const title = demoName(item.title);
    const existing = await prisma.banner.findFirst({ where: { title } });
    const data = {
      title,
      image: demoPath(item.image),
      linkType: item.linkType,
      linkValue: item.linkValue,
      sortOrder: index + 1,
      status: 1,
      startTime: pastDate(1),
      endTime: futureDate(365),
    };
    result.push(existing
      ? await prisma.banner.update({ where: { id: existing.id }, data })
      : await prisma.banner.create({ data }));
  }
  return result;
}

async function seedCoupons(categories: Record<string, any>, products: any[]) {
  const items = [
    { name: '新人无门槛5元券', type: 3, value: 500, minAmount: 0, totalCount: 1000, perLimit: 1, isNewUser: 1, applicableType: 0, applicableIds: [] },
    { name: '满99减10', type: 1, value: 1000, minAmount: 9900, totalCount: 800, perLimit: 2, isNewUser: 0, applicableType: 0, applicableIds: [] },
    { name: '满199减20', type: 1, value: 2000, minAmount: 19900, totalCount: 600, perLimit: 2, isNewUser: 0, applicableType: 0, applicableIds: [] },
    { name: '满399减50', type: 1, value: 5000, minAmount: 39900, totalCount: 300, perLimit: 1, isNewUser: 0, applicableType: 0, applicableIds: [] },
    { name: '奶粉辅食专享券', type: 1, value: 3000, minAmount: 19900, totalCount: 300, perLimit: 1, isNewUser: 0, applicableType: 2, applicableIds: [Number(categories['配方奶粉'].id), Number(categories['米粉果泥'].id)] },
    { name: '纸尿裤专享券', type: 1, value: 2500, minAmount: 15900, totalCount: 300, perLimit: 1, isNewUser: 0, applicableType: 3, applicableIds: products.filter((p) => p.name.includes('纸尿裤') || p.name.includes('拉拉裤')).slice(0, 4).map((p) => Number(p.id)) },
  ];
  const result: any[] = [];
  for (const item of items) {
    const name = demoName(item.name);
    const existing = await prisma.coupon.findFirst({ where: { name } });
    const data = {
      name,
      type: item.type,
      value: item.value,
      minAmount: item.minAmount,
      discountLimit: null,
      totalCount: item.totalCount,
      receivedCount: 0,
      usedCount: 0,
      perLimit: item.perLimit,
      startTime: pastDate(1),
      endTime: futureDate(120),
      validDays: 30,
      applicableType: item.applicableType,
      applicableIds: item.applicableIds,
      memberLevelId: null,
      isNewUser: item.isNewUser,
      status: 1,
    };
    result.push(existing
      ? await prisma.coupon.update({ where: { id: existing.id }, data })
      : await prisma.coupon.create({ data }));
  }
  return result;
}

async function seedHomeSections() {
  const announcements = [
    `${DEMO_TAG} 全场满199减20，测试活动中`,
    `${DEMO_TAG} 新人可领取母婴专享券`,
    `${DEMO_TAG} 今日下单预计48小时内发货`,
    `${DEMO_TAG} 自营商品支持售后流程测试`,
    `${DEMO_TAG} 食品/奶粉类商品合规信息仅为测试展示`,
  ];
  const items = [
    { type: 'banner', title: '首页轮播', config: { source: 'banner', demo: true }, sortOrder: 1 },
    { type: 'category_nav', title: '分类导航', config: { columns: 4, demo: true }, sortOrder: 2 },
    { type: 'announcement', title: '公告通知', config: { announcement: announcements[0], announcements, demo: true }, sortOrder: 3 },
    { type: 'trust', title: '信任心智', config: { items: ['自营正品', '极速发货', '贴心售后', '合规展示'], demo: true }, sortOrder: 4 },
    { type: 'new_user_coupon', title: '新人福利', config: { count: 3, demo: true }, sortOrder: 5 },
    { type: 'activity', title: '限时活动', config: { count: 6, demo: true }, sortOrder: 6 },
    { type: 'hot_products', title: '热销好物', config: { count: 8, demo: true }, sortOrder: 7 },
    { type: 'guess_products', title: '猜你喜欢', config: { count: 10, demo: true }, sortOrder: 8 },
    { type: 'content', title: '育儿知识', config: { placement: 'activity', demo: true }, sortOrder: 9 },
  ];
  const result: any[] = [];
  for (const item of items) {
    const title = demoName(item.title);
    const existing = await prisma.homeSection.findFirst({ where: { type: item.type, title } });
    const data = { type: item.type, title, config: item.config, sortOrder: item.sortOrder, status: 1 };
    result.push(existing
      ? await prisma.homeSection.update({ where: { id: existing.id }, data })
      : await prisma.homeSection.create({ data }));
  }
  return result;
}

async function seedContentCategory() {
  const name = demoName('育儿知识');
  const existing = await prisma.contentCategory.findFirst({ where: { name } });
  const data = { name, icon: demoPath('content-1'), sortOrder: 1, status: 1 };
  return existing
    ? prisma.contentCategory.update({ where: { id: existing.id }, data })
    : prisma.contentCategory.create({ data });
}

async function seedContents(contentCategory: any) {
  const items = [
    { title: '新生儿喂养测试指南', type: 'article', image: 'content-1', summary: '新手爸妈喂养流程测试内容' },
    { title: '纸尿裤尺码选择测试文章', type: 'article', image: 'content-2', summary: '尺码、月龄和体重展示测试内容' },
    { title: '宝宝换季洗护测试视频', type: 'video', image: 'content-3', summary: '视频卡片展示测试内容' },
  ];
  const result: any[] = [];
  for (const [index, item] of items.entries()) {
    const title = demoName(item.title);
    const existing = await prisma.content.findFirst({ where: { title, deletedAt: null } });
    const data = {
      categoryId: contentCategory.id,
      title,
      contentType: item.type,
      coverImage: demoPath(item.image),
      content: `<p>${DEMO_TAG} ${item.summary}。${DEMO_NOTICE}</p>`,
      summary: `${DEMO_TAG} ${item.summary}`,
      videoUrl: item.type === 'video' ? 'https://example.com/demo-video-not-for-production.mp4' : null,
      videoCover: item.type === 'video' ? demoPath(item.image) : null,
      videoDuration: item.type === 'video' ? 96 : null,
      placement: ['activity', 'home'],
      tags: [DEMO_TAG, '育儿知识'],
      relatedProductIds: [],
      relatedActivityId: null,
      isFeatured: index === 0 ? 1 : 0,
      viewCount: 100 + index * 68,
      sortOrder: index + 1,
      status: 1,
      publishedAt: pastDate(index + 1),
      deletedAt: null,
    };
    result.push(existing
      ? await prisma.content.update({ where: { id: existing.id }, data })
      : await prisma.content.create({ data }));
  }
  return result;
}

async function seedSystemConfigs() {
  const homeDecorConfig = {
    hotKeywords: ['[Demo] 奶粉', '[Demo] 纸尿裤', '[Demo] 洗护'],
    announcement: `${DEMO_TAG} 全场满199减20，测试活动中`,
    announcements: [
      `${DEMO_TAG} 全场满199减20，测试活动中`,
      `${DEMO_TAG} 新人可领取母婴专享券`,
      `${DEMO_TAG} 今日下单预计48小时内发货`,
      `${DEMO_TAG} 自营商品支持售后流程测试`,
      `${DEMO_TAG} 食品/奶粉类商品合规信息仅为测试展示`,
    ],
    navIcons: [
      { icon: demoPath('category-milk'), name: `${DEMO_TAG} 新人福利`, linkValue: 'gift', linkUrl: '/pages/coupon/center', sort: 1 },
      { icon: demoPath('activity-flash'), name: `${DEMO_TAG} 限时活动`, linkValue: 'discount', linkUrl: '/pages/activity/index', sort: 2 },
      { icon: demoPath('category-care'), name: `${DEMO_TAG} 积分测试`, linkValue: 'points', linkUrl: '/pages/points/index', sort: 3 },
      { icon: demoPath('brand-xiyun'), name: `${DEMO_TAG} 会员专区`, linkValue: 'member', linkUrl: '/pages/member/index', sort: 4 },
    ],
    demo: true,
  };
  const configs = [
    { groupName: 'home_decor', configKey: 'config', configValue: JSON.stringify(homeDecorConfig), valueType: 'json', description: `${DEMO_TAG} 首页装修配置` },
    { groupName: 'demo_basic', configKey: 'shop_name', configValue: `${DEMO_TAG} 禧孕优选测试商城`, valueType: 'string', description: `${DEMO_TAG} 测试商城名称` },
    { groupName: 'demo_basic', configKey: 'return_address', configValue: '山东省临沂市兰山区 Demo测试退货地址', valueType: 'string', description: `${DEMO_TAG} 测试退货地址` },
  ];
  const result: any[] = [];
  for (const config of configs) {
    result.push(await prisma.systemConfig.upsert({
      where: { uk_group_key: { groupName: config.groupName, configKey: config.configKey } },
      update: { configValue: config.configValue, valueType: config.valueType, description: config.description },
      create: config,
    }));
  }
  return result;
}

async function seedUsers() {
  const users = [
    { openid: 'demo_openid_mom_001', phone: '13800000001', nickname: `${DEMO_TAG} 测试妈妈A` },
    { openid: 'demo_openid_mom_002', phone: '13800000002', nickname: `${DEMO_TAG} 测试妈妈B` },
    { openid: 'demo_openid_mom_003', phone: '13800000003', nickname: `${DEMO_TAG} 测试妈妈C` },
  ];
  const result: any[] = [];
  for (const [index, item] of users.entries()) {
    const existing = await prisma.user.findFirst({ where: { openid: item.openid } });
    const data = {
      openid: item.openid,
      phone: item.phone,
      nickname: item.nickname,
      avatarUrl: demoPath('default-avatar'),
      gender: 0,
      growthValue: 100 + index * 20,
      totalPoints: 500 + index * 100,
      availablePoints: 300 + index * 80,
      lastLoginAt: pastDate(index + 1),
      status: 1,
      deletedAt: null,
    };
    const user = existing
      ? await prisma.user.update({ where: { id: existing.id }, data })
      : await prisma.user.create({ data });

    await prisma.userProfile.upsert({
      where: { userId: user.id },
      update: { realName: `${DEMO_TEST_TAG} 用户${index + 1}`, source: 'demo_seed', babyCount: 1 },
      create: { userId: user.id, realName: `${DEMO_TEST_TAG} 用户${index + 1}`, source: 'demo_seed', babyCount: 1 },
    });
    const existingAddress = await prisma.userAddress.findFirst({ where: { userId: user.id, receiverPhone: item.phone } });
    const addressData = {
      userId: user.id,
      receiverName: `${DEMO_TEST_TAG} 收货人${index + 1}`,
      receiverPhone: item.phone,
      province: '山东省',
      city: '临沂市',
      district: '兰山区',
      detailAddress: `Demo测试地址 ${index + 1} 号，仅供演示`,
      isDefault: 1,
      deletedAt: null,
    };
    if (existingAddress) await prisma.userAddress.update({ where: { id: existingAddress.id }, data: addressData });
    else await prisma.userAddress.create({ data: addressData });

    const existingBaby = await prisma.babyProfile.findFirst({ where: { userId: user.id, nickname: `${DEMO_TAG} 宝宝${index + 1}` } });
    const babyData = {
      userId: user.id,
      nickname: `${DEMO_TAG} 宝宝${index + 1}`,
      gender: index % 2,
      birthday: pastDate(180 + index * 60),
      currentMonthAge: 6 + index * 2,
      avatarUrl: demoPath('default-baby'),
      isDefault: 1,
      deletedAt: null,
    };
    if (existingBaby) await prisma.babyProfile.update({ where: { id: existingBaby.id }, data: babyData });
    else await prisma.babyProfile.create({ data: babyData });

    result.push(user);
  }
  return result;
}

async function seedOrders(users: any[], products: any[]) {
  const firstSku = (product: any) => product.skus?.[0];
  const orderDefs = [
    { no: 'DEMO-ORDER-PENDING-PAY', user: users[0], product: products[0], status: OrderStatus.pending_payment, paid: false },
    { no: 'DEMO-ORDER-PAID-SHIP', user: users[0], product: products[7], status: OrderStatus.pending_delivery, paid: true },
    { no: 'DEMO-ORDER-DELIVERED', user: users[1], product: products[12], status: OrderStatus.delivered, paid: true, delivered: true },
    { no: 'DEMO-ORDER-COMPLETED', user: users[1], product: products[16], status: OrderStatus.completed, paid: true, delivered: true, completed: true },
    { no: 'DEMO-ORDER-CANCELLED', user: users[2], product: products[20], status: OrderStatus.cancelled, paid: false, cancelled: true },
    { no: 'DEMO-ORDER-AFTERSALE', user: users[2], product: products[4], status: OrderStatus.aftersale, paid: true, delivered: true },
  ];
  const result: any[] = [];
  for (const [index, def] of orderDefs.entries()) {
    const sku = firstSku(def.product);
    const totalAmount = sku.price * 1;
    const payAmount = def.paid ? totalAmount : totalAmount + 800;
    const baseData = {
      orderNo: def.no,
      userId: def.user.id,
      status: def.status,
      totalAmount,
      discountAmount: 0,
      freightAmount: def.paid ? 0 : 800,
      pointsAmount: 0,
      payAmount,
      pointsDeducted: 0,
      couponId: null,
      couponAmount: 0,
      activityDiscountAmount: 0,
      receiverName: `${DEMO_TEST_TAG} 收货人`,
      receiverPhone: def.user.phone || '13800000000',
      province: '山东省',
      city: '临沂市',
      district: '兰山区',
      detailAddress: `Demo测试订单地址 ${index + 1} 号`,
      remark: `${DEMO_TAG} 后台订单流程测试`,
      adminRemark: `${DEMO_TAG} 管理后台备注测试`,
      paidAt: def.paid ? pastDate(2) : null,
      deliveredAt: def.delivered ? pastDate(1) : null,
      completedAt: def.completed ? now : null,
      cancelledAt: def.cancelled ? pastDate(1) : null,
      cancelReason: def.cancelled ? `${DEMO_TAG} 测试取消原因` : null,
      autoCloseAt: def.paid ? null : futureDate(1),
      autoCompleteAt: def.delivered && !def.completed ? futureDate(7) : null,
      source: 'demo_seed',
      fulfillmentType: 'delivery',
    };
    const existing = await prisma.order.findFirst({ where: { orderNo: def.no } });
    const order = existing
      ? await prisma.order.update({ where: { id: existing.id }, data: baseData })
      : await prisma.order.create({ data: baseData });

    let item = await prisma.orderItem.findFirst({ where: { orderId: order.id } });
    const itemData = {
      orderId: order.id,
      productId: def.product.id,
      skuId: sku.id,
      productName: def.product.name,
      skuSpecs: sku.specs,
      productImage: sku.image || def.product.mainImage,
      price: sku.price,
      originalPrice: sku.originalPrice,
      quantity: 1,
      subtotal: sku.price,
      activityId: null,
      activityType: null,
      activityDiscount: 0,
      supplierId: def.product.supplierId,
    };
    item = item ? await prisma.orderItem.update({ where: { id: item.id }, data: itemData }) : await prisma.orderItem.create({ data: itemData });

    await prisma.orderPayment.upsert({
      where: { orderId: order.id },
      update: {
        paymentNo: `DEMO-PAY-${def.no.replace('DEMO-ORDER-', '')}`,
        transactionId: def.paid ? `DEMO-TX-${def.no.replace('DEMO-ORDER-', '')}` : null,
        amount: payAmount,
        paymentMethod: 'demo_wechat',
        status: def.paid ? 2 : 1,
        paidAt: def.paid ? pastDate(2) : null,
        rawResponse: { demo: true, notice: DEMO_NOTICE },
      },
      create: {
        orderId: order.id,
        paymentNo: `DEMO-PAY-${def.no.replace('DEMO-ORDER-', '')}`,
        transactionId: def.paid ? `DEMO-TX-${def.no.replace('DEMO-ORDER-', '')}` : null,
        amount: payAmount,
        paymentMethod: 'demo_wechat',
        status: def.paid ? 2 : 1,
        paidAt: def.paid ? pastDate(2) : null,
        rawResponse: { demo: true, notice: DEMO_NOTICE },
      },
    });

    if (def.delivered) {
      await prisma.orderDelivery.upsert({
        where: { orderId: order.id },
        update: {
          logisticsCompany: `${DEMO_TAG} 测试物流`,
          logisticsNo: `DEMO-LOGISTICS-${index + 1}`,
          deliveredAt: pastDate(1),
          receivedAt: def.completed ? now : null,
          logisticsInfo: [{ time: now.toISOString(), text: `${DEMO_TAG} 测试物流轨迹` }],
        },
        create: {
          orderId: order.id,
          logisticsCompany: `${DEMO_TAG} 测试物流`,
          logisticsNo: `DEMO-LOGISTICS-${index + 1}`,
          deliveredAt: pastDate(1),
          receivedAt: def.completed ? now : null,
          logisticsInfo: [{ time: now.toISOString(), text: `${DEMO_TAG} 测试物流轨迹` }],
        },
      });
    }

    const existingLog = await prisma.orderLog.findFirst({ where: { orderId: order.id, action: 'demo_seed' } });
    if (!existingLog) {
      await prisma.orderLog.create({
        data: { orderId: order.id, operatorType: 'system', action: 'demo_seed', content: `${DEMO_TAG} Demo 订单初始化` },
      });
    }
    result.push({ ...order, item });
  }
  return result;
}

async function seedAftersales(users: any[], orders: any[]) {
  const defs = [
    { no: 'DEMO-AFTERSALE-PENDING', user: users[2], order: orders.find((o) => o.orderNo === 'DEMO-ORDER-AFTERSALE'), status: AftersaleStatus.pending_review, refund: false },
    { no: 'DEMO-AFTERSALE-REFUNDED', user: users[1], order: orders.find((o) => o.orderNo === 'DEMO-ORDER-COMPLETED'), status: AftersaleStatus.refunded, refund: true },
  ];
  const result: any[] = [];
  for (const def of defs) {
    if (!def.order?.item) continue;
    const existing = await prisma.aftersaleOrder.findFirst({ where: { aftersaleNo: def.no } });
    const data = {
      aftersaleNo: def.no,
      orderId: def.order.id,
      orderItemId: def.order.item.id,
      userId: def.user.id,
      type: 1,
      reason: `${DEMO_TAG} 售后原因测试`,
      description: `${DEMO_TAG} 售后流程测试，不触发真实退款。`,
      images: [demoPath('demo-cert')],
      status: def.status,
      refundAmount: def.order.item.subtotal,
      rejectReason: null,
      returnLogisticsCompany: def.refund ? `${DEMO_TAG} 测试退货物流` : null,
      returnLogisticsNo: def.refund ? 'DEMO-RETURN-001' : null,
      adminId: null,
      reviewedAt: def.status !== AftersaleStatus.pending_review ? pastDate(1) : null,
      refundedAt: def.refund ? now : null,
      activeOrderItemId: def.status === AftersaleStatus.pending_review ? def.order.item.id : null,
    };
    const aftersale = existing
      ? await prisma.aftersaleOrder.update({ where: { id: existing.id }, data })
      : await prisma.aftersaleOrder.create({ data });

    const existingLog = await prisma.aftersaleLog.findFirst({ where: { aftersaleId: aftersale.id, action: 'demo_seed' } });
    if (!existingLog) {
      await prisma.aftersaleLog.create({
        data: { aftersaleId: aftersale.id, operatorType: 'system', action: 'demo_seed', content: `${DEMO_TAG} Demo 售后初始化` },
      });
    }

    if (def.refund) {
      const payment = await prisma.orderPayment.findFirst({ where: { orderId: def.order.id } });
      const refundNo = `DEMO-REFUND-${def.order.orderNo.replace('DEMO-ORDER-', '')}`;
      const existingRefund = await prisma.orderRefund.findFirst({ where: { refundNo } });
      const refundData = {
        refundNo,
        orderId: def.order.id,
        aftersaleId: aftersale.id,
        paymentId: payment?.id || null,
        outTradeNo: payment?.paymentNo || `DEMO-PAY-${def.order.orderNo}`,
        transactionId: payment?.transactionId || null,
        outRefundNo: `DEMO-OUT-REFUND-${def.order.orderNo.replace('DEMO-ORDER-', '')}`,
        refundId: 'DEMO-WX-REFUND-NOT-CREATED',
        refundAmount: def.order.item.subtotal,
        totalAmount: def.order.totalAmount,
        status: 'success',
        reason: `${DEMO_TAG} 退款记录测试`,
        rawRequest: { demo: true },
        rawResponse: { demo: true, notice: '未触发真实微信退款' },
        notifiedAt: now,
      };
      if (existingRefund) await prisma.orderRefund.update({ where: { id: existingRefund.id }, data: refundData });
      else await prisma.orderRefund.create({ data: refundData });
    }
    result.push(aftersale);
  }
  return result;
}

main()
  .catch((e) => {
    console.error('Demo 数据初始化失败:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
