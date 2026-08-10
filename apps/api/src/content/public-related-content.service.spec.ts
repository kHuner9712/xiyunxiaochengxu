import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { PublicRelatedContentService } from './public-related-content.service';

function createMockPrisma() {
  return {
    content: {
      findFirst: jest.fn() as any,
      update: jest.fn() as any,
    },
    product: {
      findMany: jest.fn() as any,
    },
    activity: {
      findFirst: jest.fn() as any,
    },
  };
}

describe('PublicRelatedContentService', () => {
  let prisma: ReturnType<typeof createMockPrisma>;
  let service: PublicRelatedContentService;

  beforeEach(() => {
    process.env.UPLOAD_PUBLIC_URL = 'https://api.example.com';
    prisma = createMockPrisma();
    prisma.content.update.mockResolvedValue({});
    service = new PublicRelatedContentService(prisma as any);
  });

  it('resolves configured relations using only currently public products and activity', async () => {
    const now = new Date();
    prisma.content.findFirst.mockResolvedValue({
      id: 1n,
      categoryId: null,
      category: null,
      title: '育儿文章',
      contentType: 'article',
      coverImage: null,
      content: '<p>正文</p>',
      summary: '摘要',
      videoUrl: null,
      videoCover: null,
      videoDuration: null,
      placement: ['home'],
      tags: [],
      relatedProductIds: ['2', '3'],
      relatedActivityId: 4n,
      isFeatured: 0,
      viewCount: 10,
      sortOrder: 0,
      status: 1,
      publishedAt: now,
      createdAt: now,
      updatedAt: now,
    });
    prisma.product.findMany.mockResolvedValue([
      { id: 2n, name: '仍在售商品', mainImage: '/uploads/public/p.jpg', minPrice: 9900 },
    ]);
    prisma.activity.findFirst.mockResolvedValue({
      id: 4n,
      name: '进行中的活动',
      bannerImage: '/uploads/public/a.jpg',
      type: '1',
      startTime: new Date(now.getTime() - 1000),
      endTime: new Date(now.getTime() + 60_000),
    });

    const result = await service.findPublishedById('1');

    expect(prisma.product.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        id: { in: [2n, 3n] },
        deletedAt: null,
        status: 1,
      },
    }));
    expect(prisma.activity.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        id: 4n,
        status: 1,
        startTime: { lte: expect.any(Date) },
        endTime: { gte: expect.any(Date) },
      }),
    }));
    expect(result.relatedProducts).toEqual([
      expect.objectContaining({ id: '2', name: '仍在售商品', price: 9900 }),
    ]);
    expect(result.relatedActivity).toEqual(expect.objectContaining({
      id: '4',
      name: '进行中的活动',
    }));
  });

  it('does not expose a stale related activity when it is no longer publicly available', async () => {
    const now = new Date();
    prisma.content.findFirst.mockResolvedValue({
      id: 1n,
      categoryId: null,
      category: null,
      title: '育儿文章',
      contentType: 'article',
      coverImage: null,
      content: '<p>正文</p>',
      summary: null,
      videoUrl: null,
      videoCover: null,
      videoDuration: null,
      placement: null,
      tags: null,
      relatedProductIds: [],
      relatedActivityId: 9n,
      isFeatured: 0,
      viewCount: 0,
      sortOrder: 0,
      status: 1,
      publishedAt: now,
      createdAt: now,
      updatedAt: now,
    });
    prisma.activity.findFirst.mockResolvedValue(null);

    const result = await service.findPublishedById('1');

    expect(result.relatedProducts).toEqual([]);
    expect(result.relatedActivity).toBeNull();
  });
});
