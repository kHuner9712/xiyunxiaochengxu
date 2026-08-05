import assert from 'node:assert/strict';
import { PrismaClient } from '@prisma/client';
import { ContentService } from '../src/content/content.service';

function assertSafeIntegrationDatabase() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required for the real database integration test');
  }

  let databaseName = '';
  try {
    databaseName = decodeURIComponent(new URL(databaseUrl).pathname.replace(/^\//, ''));
  } catch {
    throw new Error('DATABASE_URL is invalid');
  }

  const explicitlyAllowed = process.env.ALLOW_DESTRUCTIVE_INTEGRATION_TESTS === 'true';
  const clearlyTestDatabase = /(^|[_-])test($|[_-])/i.test(databaseName);
  if (!clearlyTestDatabase && !explicitlyAllowed) {
    throw new Error(
      `Refusing destructive integration test against database "${databaseName || '(unknown)'}". `
      + 'Use a database name containing "test" or explicitly set ALLOW_DESTRUCTIVE_INTEGRATION_TESTS=true.',
    );
  }
}

assertSafeIntegrationDatabase();
const prisma = new PrismaClient();

async function main() {
  process.env.UPLOAD_PUBLIC_URL = 'https://api.example.com/uploads';
  await prisma.$connect();
  const service = new ContentService(prisma as any);

  try {
    await prisma.content.deleteMany();

    const created = await service.create({
      title: '真实数据库视频',
      contentType: 'video',
      videoUrl: '/uploads/public/integration-video.mp4',
      status: 2,
    });

    const storedDraft = await prisma.content.findUniqueOrThrow({
      where: { id: BigInt(created.id) },
    });
    assert.equal(storedDraft.content, '', '视频正文省略时应持久化为空字符串');
    assert.equal(storedDraft.status, 2, '新内容应保持草稿状态');
    assert.equal(storedDraft.viewCount, 0, '创建草稿不应增加阅读量');

    await assert.rejects(
      () => service.findPublishedById(created.id),
      /内容不存在或未发布/,
      '公开详情不得读取草稿',
    );

    const adminRead = await service.findAdminById(created.id);
    assert.equal(adminRead.status, 2, '管理后台应能读取草稿');
    const afterAdminRead = await prisma.content.findUniqueOrThrow({
      where: { id: BigInt(created.id) },
    });
    assert.equal(afterAdminRead.viewCount, 0, '管理后台读取不得增加阅读量');

    await service.update(created.id, { status: 1 });
    const publicRead = await service.findPublishedById(created.id);
    assert.equal(publicRead.viewCount, 1, '公开详情读取应增加一次阅读量');
    const afterPublicRead = await prisma.content.findUniqueOrThrow({
      where: { id: BigInt(created.id) },
    });
    assert.equal(afterPublicRead.viewCount, 1, '阅读量增量必须真实落库');

    await assert.rejects(
      () => service.update(created.id, { videoUrl: '' }),
      /视频类型内容必须上传视频文件/,
      '部分更新不得清空视频地址',
    );
    const afterRejectedUpdate = await prisma.content.findUniqueOrThrow({
      where: { id: BigInt(created.id) },
    });
    assert.equal(
      afterRejectedUpdate.videoUrl,
      '/uploads/public/integration-video.mp4',
      '失败更新不得污染数据库',
    );

    await service.update(created.id, {
      contentType: 'article',
      content: '转换后的文章正文',
    });

    const article = await prisma.content.findUniqueOrThrow({
      where: { id: BigInt(created.id) },
    });
    assert.equal(article.contentType, 'article');
    assert.equal(article.content, '转换后的文章正文');
    assert.equal(article.videoUrl, null, '切换为文章后必须清除视频地址');
    assert.equal(article.videoCover, null, '切换为文章后必须清除视频封面');
    assert.equal(article.videoDuration, null, '切换为文章后必须清除视频时长');

    console.log('[content-lifecycle-integration] PASS');
  } finally {
    await prisma.content.deleteMany();
    await prisma.$disconnect();
  }
}

main().catch(async (error) => {
  console.error('[content-lifecycle-integration] FAIL', error);
  await prisma.$disconnect().catch(() => undefined);
  process.exitCode = 1;
});
