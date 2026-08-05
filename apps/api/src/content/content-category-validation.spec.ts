import { BadRequestException } from '@nestjs/common';
import { ContentService } from './content.service';

function createContentRecord(overrides: Record<string, unknown> = {}) {
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

    await service.create({ title: '测试内容', content: '正文', categoryId: '42' });

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

    await service.create({ title: '未分类内容', content: '正文' });

    expect(prisma.contentCategory.findFirst).not.toHaveBeenCalled();
    expect(prisma.content.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ categoryId: null }),
    });
  });

  it('rejects a missing or disabled category before Prisma hits the foreign key', async () => {
    prisma.contentCategory.findFirst.mockResolvedValue(null);

    await expect(service.create({ title: '测试内容', content: '正文', categoryId: '999' }))
      .rejects.toEqual(new BadRequestException('内容分类不存在或已停用'));

    expect(prisma.content.create).not.toHaveBeenCalled();
  });

  it('rejects malformed category identifiers even when called outside the HTTP DTO pipeline', async () => {
    await expect(service.create({
      title: '测试内容',
      content: '正文',
      categoryId: 'not-a-number',
    })).rejects.toEqual(new BadRequestException('内容分类ID无效'));

    expect(prisma.contentCategory.findFirst).not.toHaveBeenCalled();
    expect(prisma.content.create).not.toHaveBeenCalled();
  });

  it('rejects category identifiers outside signed BIGINT range', async () => {
    await expect(service.create({
      title: '测试内容',
      content: '正文',
      categoryId: '9223372036854775808',
    })).rejects.toEqual(new BadRequestException('内容分类ID超出范围'));

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

  it('keeps an existing category even when it has since been disabled', async () => {
    const existing = createContentRecord({ categoryId: 42n });
    prisma.content.findFirst.mockResolvedValue(existing);
    prisma.content.update.mockImplementation(({ data }: any) => ({ ...existing, ...data }));

    await service.update('1', { categoryId: '42', title: '更新标题' });

    expect(prisma.contentCategory.findFirst).not.toHaveBeenCalled();
    expect(prisma.content.update).toHaveBeenCalledWith({
      where: { id: 1n },
      data: expect.objectContaining({ categoryId: 42n, title: '更新标题' }),
    });
  });
});
