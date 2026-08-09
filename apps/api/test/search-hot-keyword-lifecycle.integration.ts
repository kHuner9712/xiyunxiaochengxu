import assert from 'node:assert/strict';
import { PrismaClient } from '@prisma/client';
import { RedisService } from '../src/common/redis/redis.service';
import { AdminHomeDecorController } from '../src/home/admin-home-decor.controller';
import { SearchService } from '../src/search/search.service';

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
const Redis = require('ioredis');
const redisClient = new Redis({
  host: process.env.REDIS_HOST || '127.0.0.1',
  port: Number(process.env.REDIS_PORT || 6379),
  db: Number(process.env.REDIS_DB || 0),
  ...(process.env.REDIS_PASSWORD ? { password: process.env.REDIS_PASSWORD } : {}),
});
const redisService = new RedisService(redisClient);
const HOT_CACHE_KEY = 'search:hot_keywords';

async function main() {
  await prisma.$connect();
  const suffix = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const manualOld = `人工旧热词_${suffix}`;
  const manualNew = `人工新热词_${suffix}`;
  const overlap = `人工自然重叠_${suffix}`;
  const organic = `自然热词_${suffix}`;
  const createdKeywords: string[] = [];
  const originalHomeDecor = await prisma.systemConfig.findFirst({
    where: { groupName: 'home_decor', configKey: 'config' },
  });

  try {
    await redisService.del(HOT_CACHE_KEY);
    await prisma.systemConfig.upsert({
      where: { uk_group_key: { groupName: 'home_decor', configKey: 'config' } },
      update: {
        configValue: JSON.stringify({ hotKeywords: [manualOld, overlap], navIcons: [], announcement: '' }),
        valueType: 'json',
      },
      create: {
        groupName: 'home_decor',
        configKey: 'config',
        configValue: JSON.stringify({ hotKeywords: [manualOld, overlap], navIcons: [], announcement: '' }),
        valueType: 'json',
        description: 'integration hot keyword config',
      },
    });

    for (const [keyword, searchCount] of [[overlap, 2_000_000], [organic, 1_900_000]] as const) {
      await prisma.searchKeyword.create({
        data: { keyword, searchCount, status: 1 },
      });
      createdKeywords.push(keyword);
    }

    const searchService = new SearchService(prisma as any, redisService);
    const homeDecorController = new AdminHomeDecorController(prisma as any, redisService);

    const first = await searchService.getHotKeywords();
    assert.equal(first[0], manualOld, '人工热词必须优先于自然搜索统计');
    assert.equal(first[1], overlap, '第二个人工热词必须保持配置顺序');
    assert.ok(first.includes(organic), '自然搜索热词必须在人工热词之后补位');
    assert.equal(first.filter((item) => item === overlap).length, 1, '人工/自然重叠热词必须去重');
    assert.ok(await redisService.get(HOT_CACHE_KEY), '首次读取后必须写入热词缓存');

    await homeDecorController.updateConfig({
      hotKeywords: [manualNew, overlap],
      navIcons: [],
      announcement: '',
    } as any);
    assert.equal(await redisService.get(HOT_CACHE_KEY), null, '后台保存首页装修后必须立即失效搜索热词缓存');

    const afterAdminUpdate = await searchService.getHotKeywords();
    assert.equal(afterAdminUpdate[0], manualNew, '后台修改人工热词后下一次搜索热词请求必须立即生效');
    assert.ok(!afterAdminUpdate.includes(manualOld), '旧人工热词不得继续从过期缓存返回');
    assert.ok(afterAdminUpdate.includes(organic), '人工热词更新后自然热词仍应补位');

    await redisService.set(HOT_CACHE_KEY, '{broken-json', 3600);
    const afterCorruptCache = await searchService.getHotKeywords();
    assert.equal(afterCorruptCache[0], manualNew, '坏 Redis JSON 必须自愈并从数据库重建人工热词');
    assert.ok(afterCorruptCache.includes(organic), '坏 Redis JSON 自愈后仍应包含自然热词');
    assert.doesNotThrow(() => JSON.parse(String(redisClient.status ? '[]' : '[]')));

    console.log('[search-hot-keyword-lifecycle-integration] PASS');
  } finally {
    await redisService.del(HOT_CACHE_KEY).catch(() => undefined);
    if (createdKeywords.length > 0) {
      await prisma.searchKeyword.deleteMany({ where: { keyword: { in: createdKeywords } } });
    }
    if (originalHomeDecor) {
      await prisma.systemConfig.update({
        where: { id: originalHomeDecor.id },
        data: {
          configValue: originalHomeDecor.configValue,
          valueType: originalHomeDecor.valueType,
          description: originalHomeDecor.description,
        },
      });
    } else {
      await prisma.systemConfig.deleteMany({
        where: { groupName: 'home_decor', configKey: 'config' },
      });
    }
    await prisma.$disconnect();
    await redisClient.quit().catch(() => redisClient.disconnect());
  }
}

main().catch(async (error) => {
  console.error('[search-hot-keyword-lifecycle-integration] FAIL', error);
  await redisService.del(HOT_CACHE_KEY).catch(() => undefined);
  await prisma.$disconnect().catch(() => undefined);
  await redisClient.quit().catch(() => redisClient.disconnect());
  process.exitCode = 1;
});
