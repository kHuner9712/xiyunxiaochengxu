import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { ContentModule } from '../src/content/content.module';
import { PrismaService } from '../src/common/prisma/prisma.service';

function makeContent(overrides: Record<string, unknown> = {}) {
  return {
    id: 1n,
    categoryId: null,
    title: '测试内容',
    contentType: 'article',
    coverImage: null,
    content: '正文',
    summary: null,
    videoUrl: null,
    videoCover: null,
    videoDuration: null,
    placement: null,
    tags: null,
    relatedProductIds: null,
    relatedActivityId: null,
    isFeatured: 0,
    viewCount: 0,
    sortOrder: 0,
    status: 2,
    publishedAt: null,
    createdAt: new Date('2026-08-01T00:00:00Z'),
    updatedAt: new Date('2026-08-01T00:00:00Z'),
    deletedAt: null,
    ...overrides,
  };
}

describe('Content lifecycle HTTP contract (e2e)', () => {
  let app: INestApplication;

  const mockPrisma = {
    content: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    },
    contentCategory: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    activity: {
      findMany: jest.fn(),
      count: jest.fn(),
    },
  };

  beforeAll(async () => {
    process.env.UPLOAD_PUBLIC_URL = 'https://api.example.com/uploads';
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [ContentModule],
    })
      .overrideProvider(PrismaService)
      .useValue(mockPrisma)
      .compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
      transformOptions: { enableImplicitConversion: true },
    }));
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns 404 for a draft through the public detail route', async () => {
    mockPrisma.content.findFirst.mockResolvedValue(null);

    const response = await request(app.getHttpServer()).get('/api/weapp/content/1');

    expect(response.status).toBe(404);
    expect(mockPrisma.content.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 1n, status: 1, deletedAt: null } }),
    );
    expect(mockPrisma.content.update).not.toHaveBeenCalled();
  });

  it('returns a draft to the admin route without increasing views', async () => {
    mockPrisma.content.findFirst.mockResolvedValue(makeContent());

    const response = await request(app.getHttpServer()).get('/api/admin/content/1');

    expect(response.status).toBe(200);
    expect(response.body.status).toBe(2);
    expect(mockPrisma.content.update).not.toHaveBeenCalled();
  });

  it('rejects clearing the video URL through a partial HTTP update', async () => {
    mockPrisma.content.findFirst.mockResolvedValue(makeContent({
      contentType: 'video',
      content: '',
      videoUrl: '/uploads/public/video.mp4',
    }));

    const response = await request(app.getHttpServer())
      .put('/api/admin/content/1')
      .send({ videoUrl: '' });

    expect(response.status).toBe(400);
    expect(response.body.message).toContain('视频类型内容必须上传视频文件');
    expect(mockPrisma.content.update).not.toHaveBeenCalled();
  });

  it('uses UpdateContentDto at runtime and rejects unknown fields', async () => {
    mockPrisma.content.findFirst.mockResolvedValue(makeContent());

    const response = await request(app.getHttpServer())
      .put('/api/admin/content/1')
      .send({ unexpectedField: true });

    expect(response.status).toBe(400);
    expect(mockPrisma.content.update).not.toHaveBeenCalled();
  });

  it('clears video-only fields when changing to an article', async () => {
    const existing = makeContent({
      contentType: 'video',
      content: '',
      videoUrl: '/uploads/public/video.mp4',
      videoCover: '/uploads/public/poster.jpg',
      videoDuration: 30,
    });
    mockPrisma.content.findFirst.mockResolvedValue(existing);
    mockPrisma.content.update.mockImplementation(({ data }: any) => ({ ...existing, ...data }));

    const response = await request(app.getHttpServer())
      .put('/api/admin/content/1')
      .send({ contentType: 'article', content: '文章正文' });

    expect(response.status).toBe(200);
    expect(mockPrisma.content.update).toHaveBeenCalledWith({
      where: { id: 1n },
      data: expect.objectContaining({
        videoUrl: null,
        videoCover: null,
        videoDuration: null,
      }),
    });
  });
});
