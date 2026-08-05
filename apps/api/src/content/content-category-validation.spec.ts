import { BadRequestException } from '@nestjs/common';
import { ContentService } from './content.service';

function createContentRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: 1n,
    categoryId: null,
    title: '测试内容',
    contentType: 'article',
    coverImage: null,
    content: null,
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
    createdAt: new Date('2026-08-05T00:00:00.000Z'),
    updatedAt: new Date('2026-08-05T00:00:00.000Z'),
    ...overrides,
  };
}

describe('ContentService content category validation', () => {
  const prisma = {
    contentCategory: {
      findFirst: jest.fn(),
    },
    content: {
      create: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
  } as any;

  let service: ContentService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ContentService(prisma);
  });

  it('persists an active category selected from the database', async () => {
    prisma.contentCategory.findFirst.mockResolvedValue({ id: 42n });
    prisma.content.create.mockResolvedValue(createContentRecord({ categoryId: 42n }));

    await service.create({ title: '测试内容', categoryId: '42' });

    expect(prisma.contentCategory.findFirst).toHaveBeenCalledWith({
      where: { id: 42n, status: 1 },
      select: { id: true },
    });
    expect(prisma.content.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ categoryId: 42n }),
    });
  });

  it('allows content without a category', async () => {
    prisma.content.create.mockResolvedValue(createContentRecord());

    await service.create({ title: '未分类内容' });

    expect(prisma.contentCategory.findFirst).not.toHaveBeenCalled();
    expect(prisma.content.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ categoryId: null }),
    });
  });

  it('rejects a missing or disabled category before Prisma hits the foreign key', async () => {
    prisma.contentCategory.findFirst.mockResolvedValue(null);

    await expect(service.create({ title: '测试内容', categoryId: 999 }))
      .rejects.toEqual(new BadRequestException('内容分类不存在或已停用'));

    expect(prisma.content.create).not.toHaveBeenCalled();
  });

  it('rejects malformed category identifiers', async () => {
    await expect(service.create({ title: '测试内容', categoryId: 'not-a-number' }))
      .rejects.toEqual(new BadRequestException('内容分类参数无效'));

    expect(prisma.contentCategory.findFirst).not.toHaveBeenCalled();
    expect(prisma.content.create).not.toHaveBeenCalled();
  });

  it('validates category changes while updating content', async () => {
    prisma.content.findFirst.mockResolvedValue(createContentRecord());
    prisma.contentCategory.findFirst.mockResolvedValue(null);

    await expect(service.update('1', { categoryId: '404' }))
      .rejects.toEqual(new BadRequestException('内容分类不存在或已停用'));

    expect(prisma.content.update).not.toHaveBeenCalled();
  });
});
