import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { ContentService } from './content.service';
import { BadRequestException } from '@nestjs/common';

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

describe('ContentService', () => {
  let service: ContentService;
  let prisma: ReturnType<typeof createMockPrisma>;

  beforeEach(() => {
    prisma = createMockPrisma();
    service = new ContentService(prisma as any);
    jest.spyOn(service['logger'], 'log').mockImplementation(() => {});
  });

  describe('findPublished - contentType filter', () => {
    it('should filter by contentType=video', async () => {
      prisma.content.findMany.mockResolvedValue([{
        id: 1n, title: '测试视频', contentType: 'video', coverImage: 'cover.jpg',
        content: 'body', summary: 'desc', videoUrl: 'http://video.mp4',
        videoCover: null, videoDuration: 120, placement: ['activity'],
        tags: ['种草'], relatedProductIds: [1, 2], relatedActivityId: null,
        isFeatured: 0, viewCount: 100, sortOrder: 0, status: 1,
        publishedAt: new Date(), categoryId: null, createdAt: new Date(), updatedAt: new Date(),
      }]);
      prisma.content.count.mockResolvedValue(1);

      const result = await service.findPublished({ contentType: 'video', page: 1, pageSize: 10, skip: 0, take: 10 } as any);

      expect(result.list).toHaveLength(1);
      expect(result.list[0].contentType).toBe('video');
      expect(result.list[0].videoUrl).toBe('http://video.mp4');
    });

    it('should filter by contentType=article', async () => {
      prisma.content.findMany.mockResolvedValue([{
        id: 2n, title: '测试文章', contentType: 'article', coverImage: 'cover.jpg',
        content: 'body', summary: 'desc', videoUrl: null,
        videoCover: null, videoDuration: null, placement: ['activity'],
        tags: null, relatedProductIds: null, relatedActivityId: null,
        isFeatured: 0, viewCount: 50, sortOrder: 0, status: 1,
        publishedAt: new Date(), categoryId: null, createdAt: new Date(), updatedAt: new Date(),
      }]);
      prisma.content.count.mockResolvedValue(1);

      const result = await service.findPublished({ contentType: 'article', page: 1, pageSize: 10, skip: 0, take: 10 } as any);

      expect(result.list).toHaveLength(1);
      expect(result.list[0].contentType).toBe('article');
    });
  });

  describe('findPublished - placement filter', () => {
    it('should filter by placement=activity', async () => {
      prisma.content.findMany.mockResolvedValue([]);
      prisma.content.count.mockResolvedValue(0);

      await service.findPublished({ placement: 'activity', page: 1, pageSize: 10, skip: 0, take: 10 } as any);

      expect(prisma.content.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            placement: { array_contains: 'activity' },
          }),
        })
      );
    });
  });

  describe('create - video validation', () => {
    it('should throw BadRequestException when creating video without videoUrl', async () => {
      await expect(
        service.create({ contentType: 'video', title: '测试', content: 'body' })
      ).rejects.toThrow(BadRequestException);
    });

    it('should create video content when videoUrl is provided', async () => {
      prisma.content.create.mockResolvedValue({
        id: 1n, title: '测试视频', contentType: 'video', videoUrl: 'http://video.mp4',
        coverImage: null, content: 'body', summary: null, videoCover: null,
        videoDuration: null, placement: null, tags: null, relatedProductIds: null,
        relatedActivityId: null, isFeatured: 0, viewCount: 0, sortOrder: 0,
        status: 2, publishedAt: null, categoryId: null, createdAt: new Date(), updatedAt: new Date(),
      });

      const result = await service.create({
        contentType: 'video', title: '测试视频', content: 'body', videoUrl: 'http://video.mp4',
      });

      expect(result.contentType).toBe('video');
      expect(result.videoUrl).toBe('http://video.mp4');
    });

    it('should create article content without videoUrl', async () => {
      prisma.content.create.mockResolvedValue({
        id: 2n, title: '测试文章', contentType: 'article', videoUrl: null,
        coverImage: null, content: 'body', summary: null, videoCover: null,
        videoDuration: null, placement: null, tags: null, relatedProductIds: null,
        relatedActivityId: null, isFeatured: 0, viewCount: 0, sortOrder: 0,
        status: 2, publishedAt: null, categoryId: null, createdAt: new Date(), updatedAt: new Date(),
      });

      const result = await service.create({
        contentType: 'article', title: '测试文章', content: 'body',
      });

      expect(result.contentType).toBe('article');
    });
  });

  describe('findActivityFeed', () => {
    it('should return mixed feed for recommend tab', async () => {
      prisma.activity.findMany.mockResolvedValue([{
        id: 1n, name: '限时折扣', type: 'flash_sale',
        bannerImage: 'banner.jpg', startTime: new Date(), endTime: new Date(),
      }]);
      prisma.content.findMany.mockResolvedValue([{
        id: 2n, title: '种草视频', contentType: 'video', coverImage: 'cover.jpg',
        summary: '好物推荐', videoUrl: 'http://video.mp4', videoCover: null,
        videoDuration: 60, tags: ['种草'], viewCount: 200, publishedAt: new Date(), isFeatured: 1,
      }]);
      prisma.content.count.mockResolvedValue(1);
      prisma.activity.count.mockResolvedValue(1);

      const result = await service.findActivityFeed('recommend', 1, 10);

      expect(result.list.length).toBeGreaterThan(0);
      const types = result.list.map((item: any) => item.type);
      expect(types).toContain('activity');
      expect(types).toContain('video');
    });

    it('should return only videos for video tab', async () => {
      prisma.content.findMany.mockResolvedValue([{
        id: 1n, title: '视频1', contentType: 'video', coverImage: 'cover.jpg',
        summary: 'desc', videoUrl: 'http://video.mp4', videoCover: null,
        videoDuration: 30, tags: null, viewCount: 10, publishedAt: new Date(), isFeatured: 0,
      }]);
      prisma.content.count.mockResolvedValue(1);

      const result = await service.findActivityFeed('video', 1, 10);

      expect(result.list).toHaveLength(1);
      expect(result.list[0].type).toBe('video');
    });

    it('should return only articles for article tab', async () => {
      prisma.content.findMany.mockResolvedValue([{
        id: 2n, title: '文章1', contentType: 'article', coverImage: 'cover.jpg',
        summary: 'desc', videoUrl: null, videoCover: null,
        videoDuration: null, tags: null, viewCount: 5, publishedAt: new Date(), isFeatured: 0,
      }]);
      prisma.content.count.mockResolvedValue(1);

      const result = await service.findActivityFeed('article', 1, 10);

      expect(result.list).toHaveLength(1);
      expect(result.list[0].type).toBe('article');
    });

    it('should return activities for discount tab', async () => {
      prisma.activity.findMany.mockResolvedValue([{
        id: 1n, name: '满减活动', type: 'full_reduction',
        bannerImage: 'banner.jpg', startTime: new Date(), endTime: new Date(),
      }]);
      prisma.activity.count.mockResolvedValue(1);

      const result = await service.findActivityFeed('discount', 1, 10);

      expect(result.list).toHaveLength(1);
      expect(result.list[0].type).toBe('activity');
    });
  });

  describe('serializeContent', () => {
    it('should convert BigInt id to string', async () => {
      prisma.content.findFirst.mockResolvedValue({
        id: 123n, title: '测试', contentType: 'article', coverImage: null,
        content: 'body', summary: null, videoUrl: null, videoCover: null,
        videoDuration: null, placement: null, tags: null, relatedProductIds: null,
        relatedActivityId: null, isFeatured: 0, viewCount: 0, sortOrder: 0,
        status: 1, publishedAt: null, categoryId: null, createdAt: new Date(), updatedAt: new Date(),
      });

      const result = await service.findById('123');
      expect(result.id).toBe('123');
    });

    it('should include all new fields', async () => {
      prisma.content.findFirst.mockResolvedValue({
        id: 1n, title: '视频内容', contentType: 'video', coverImage: 'cover.jpg',
        content: 'body', summary: '摘要', videoUrl: 'http://video.mp4',
        videoCover: 'vc.jpg', videoDuration: 120, placement: ['activity', 'home'],
        tags: ['种草', '好物'], relatedProductIds: [1, 2], relatedActivityId: 5n,
        isFeatured: 1, viewCount: 300, sortOrder: 10, status: 1,
        publishedAt: new Date(), categoryId: 1n, createdAt: new Date(), updatedAt: new Date(),
      });
      prisma.content.update.mockResolvedValue({});

      const result = await service.findById('1');

      expect(result.contentType).toBe('video');
      expect(result.videoUrl).toBe('http://video.mp4');
      expect(result.videoDuration).toBe(120);
      expect(result.placement).toEqual(['activity', 'home']);
      expect(result.tags).toEqual(['种草', '好物']);
      expect(result.relatedProductIds).toEqual([1, 2]);
      expect(result.relatedActivityId).toBe('5');
      expect(result.isFeatured).toBe(1);
    });
  });
});
