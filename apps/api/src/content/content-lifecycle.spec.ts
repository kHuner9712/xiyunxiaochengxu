import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ContentService } from './content.service';

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

function createMockPrisma() {
  return {
    content: {
      findMany: jest.fn() as any,
      findFirst: jest.fn() as any,
      create: jest.fn() as any,
      update: jest.fn() as any,
      count: jest.fn() as any,
    },
    contentCategory: {
      findMany: jest.fn() as any,
      findFirst: jest.fn() as any,
      create: jest.fn() as any,
      update: jest.fn() as any,
    },
    activity: {
      findMany: jest.fn() as any,
      count: jest.fn() as any,
    },
  };
}

describe('ContentService lifecycle hardening', () => {
  let prisma: ReturnType<typeof createMockPrisma>;
  let service: ContentService;

  beforeEach(() => {
    process.env.UPLOAD_PUBLIC_URL = 'https://api.example.com/uploads';
    prisma = createMockPrisma();
    service = new ContentService(prisma as any);
    jest.spyOn(service['logger'], 'log').mockImplementation(() => {});
  });

  it('does not expose draft content through the public detail method', async () => {
    prisma.content.findFirst.mockResolvedValue(null);

    await expect(service.findPublishedById('1')).rejects.toThrow(NotFoundException);
    expect(prisma.content.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 1n, status: 1, deletedAt: null },
      }),
    );
    expect(prisma.content.update).not.toHaveBeenCalled();
  });

  it('does not increment views when an administrator opens a draft', async () => {
    prisma.content.findFirst.mockResolvedValue(makeContent());

    const result = await service.findAdminById('1');

    expect(result.status).toBe(2);
    expect(prisma.content.update).not.toHaveBeenCalled();
  });

  it('increments views only for a published public detail read', async () => {
    prisma.content.findFirst.mockResolvedValue(makeContent({ status: 1, viewCount: 4 }));
    prisma.content.update.mockResolvedValue(makeContent({ status: 1, viewCount: 5 }));

    const result = await service.findPublishedById('1');

    expect(result.viewCount).toBe(5);
    expect(prisma.content.update).toHaveBeenCalledWith({
      where: { id: 1n },
      data: { viewCount: { increment: 1 } },
    });
  });

  it('rejects invalid content IDs before calling Prisma', async () => {
    await expect(service.findAdminById('NaN')).rejects.toThrow(BadRequestException);
    expect(prisma.content.findFirst).not.toHaveBeenCalled();
  });

  it('rejects clearing a video URL through a partial update', async () => {
    prisma.content.findFirst.mockResolvedValue(makeContent({
      contentType: 'video',
      content: '',
      videoUrl: '/uploads/public/video.mp4',
    }));

    await expect(service.update('1', { videoUrl: '' })).rejects.toThrow(
      '视频类型内容必须上传视频文件',
    );
    expect(prisma.content.update).not.toHaveBeenCalled();
  });

  it('rejects publishing legacy invalid article content', async () => {
    prisma.content.findFirst.mockResolvedValue(makeContent({ content: '', status: 2 }));

    await expect(service.update('1', { status: 1 })).rejects.toThrow(
      '文章类型内容必须填写正文内容',
    );
    expect(prisma.content.update).not.toHaveBeenCalled();
  });

  it('clears video-only fields when changing a video to an article', async () => {
    const existing = makeContent({
      contentType: 'video',
      content: '',
      videoUrl: '/uploads/public/video.mp4',
      videoCover: '/uploads/public/poster.jpg',
      videoDuration: 45,
    });
    prisma.content.findFirst.mockResolvedValue(existing);
    prisma.content.update.mockImplementation(({ data }: any) => ({
      ...existing,
      ...data,
      contentType: 'article',
    }));

    await service.update('1', { contentType: 'article', content: '文章正文' });

    expect(prisma.content.update).toHaveBeenCalledWith({
      where: { id: 1n },
      data: expect.objectContaining({
        contentType: 'article',
        content: '文章正文',
        videoUrl: null,
        videoCover: null,
        videoDuration: null,
      }),
    });
  });

  it('rejects changing an article to a video without a video URL', async () => {
    prisma.content.findFirst.mockResolvedValue(makeContent());

    await expect(service.update('1', { contentType: 'video' })).rejects.toThrow(
      '视频类型内容必须上传视频文件',
    );
    expect(prisma.content.update).not.toHaveBeenCalled();
  });

  it('persists an omitted video body as empty text', async () => {
    prisma.content.create.mockImplementation(({ data }: any) => makeContent({
      ...data,
      contentType: 'video',
      status: 2,
    }));

    await service.create({
      title: '测试视频',
      contentType: 'video',
      videoUrl: '/uploads/public/video.mp4',
    });

    expect(prisma.content.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        contentType: 'video',
        content: '',
        videoUrl: '/uploads/public/video.mp4',
      }),
    });
  });
});
