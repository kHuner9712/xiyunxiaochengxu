import { PrismaClient } from '@prisma/client';
import { ContentService } from '../src/content/content.service';

const prisma = new PrismaClient();

describe('Content lifecycle with real MySQL (integration)', () => {
  let service: ContentService;

  beforeAll(async () => {
    process.env.UPLOAD_PUBLIC_URL = 'https://api.example.com/uploads';
    await prisma.$connect();
    service = new ContentService(prisma as any);
  });

  beforeEach(async () => {
    await prisma.content.deleteMany();
  });

  afterAll(async () => {
    await prisma.content.deleteMany();
    await prisma.$disconnect();
  });

  it('persists and enforces the complete video-to-article lifecycle', async () => {
    const created = await service.create({
      title: '真实数据库视频',
      contentType: 'video',
      videoUrl: '/uploads/public/integration-video.mp4',
      status: 2,
    });

    const storedDraft = await prisma.content.findUniqueOrThrow({
      where: { id: BigInt(created.id) },
    });
    expect(storedDraft.content).toBe('');
    expect(storedDraft.status).toBe(2);
    expect(storedDraft.viewCount).toBe(0);

    await expect(service.findPublishedById(created.id)).rejects.toThrow('内容不存在或未发布');

    const adminRead = await service.findAdminById(created.id);
    expect(adminRead.status).toBe(2);
    expect((await prisma.content.findUniqueOrThrow({ where: { id: BigInt(created.id) } })).viewCount).toBe(0);

    await service.update(created.id, { status: 1 });
    const publicRead = await service.findPublishedById(created.id);
    expect(publicRead.viewCount).toBe(1);
    expect((await prisma.content.findUniqueOrThrow({ where: { id: BigInt(created.id) } })).viewCount).toBe(1);

    await expect(service.update(created.id, { videoUrl: '' })).rejects.toThrow(
      '视频类型内容必须上传视频文件',
    );
    expect((await prisma.content.findUniqueOrThrow({ where: { id: BigInt(created.id) } })).videoUrl)
      .toBe('/uploads/public/integration-video.mp4');

    await service.update(created.id, {
      contentType: 'article',
      content: '转换后的文章正文',
    });

    const article = await prisma.content.findUniqueOrThrow({
      where: { id: BigInt(created.id) },
    });
    expect(article.contentType).toBe('article');
    expect(article.content).toBe('转换后的文章正文');
    expect(article.videoUrl).toBeNull();
    expect(article.videoCover).toBeNull();
    expect(article.videoDuration).toBeNull();
  });
});
