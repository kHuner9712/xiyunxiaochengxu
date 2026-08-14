import { DurableContentMutationService } from './durable-content-mutation.service';

const REQUEST_ID = '1760000000000000001';

function content(overrides: Record<string, any> = {}) {
  return {
    id: 10n,
    categoryId: null,
    title: '测试文章',
    contentType: 'article',
    coverImage: null,
    content: '正文',
    summary: null,
    videoUrl: null,
    videoCover: null,
    videoDuration: null,
    placement: null,
    tags: null,
    relatedProductIds: ['9007199254740993'],
    relatedActivityId: null,
    isFeatured: 0,
    viewCount: 0,
    sortOrder: 0,
    status: 2,
    publishedAt: null,
    createdAt: new Date('2026-08-14T00:00:00.000Z'),
    updatedAt: new Date('2026-08-14T00:00:00.000Z'),
    deletedAt: null as Date | null,
    ...overrides,
  };
}

function createHarness() {
  let event: any = null;
  const current = content();
  const tx: any = {
    businessEvent: {
      findFirst: jest.fn(async () => event),
      create: jest.fn(async ({ data }: any) => {
        event = { id: 90n, ...data };
        return event;
      }),
    },
    contentCategory: {
      findFirst: jest.fn().mockResolvedValue({ id: 2n }),
    },
    content: {
      create: jest.fn(async ({ data }: any) => Object.assign(current, data)),
      findFirst: jest.fn(async () => current),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
  };
  const prisma: any = {
    $transaction: jest.fn(async (callback: any) => callback(tx)),
    content: tx.content,
    contentCategory: tx.contentCategory,
  };
  const service = new DurableContentMutationService(prisma);
  jest.spyOn(service['mutationLogger'], 'log').mockImplementation(() => {});
  return { service, prisma, tx, current };
}

describe('DurableContentMutationService', () => {
  afterEach(() => jest.restoreAllMocks());

  it('replays one logical create and keeps bigint related product ids as strings', async () => {
    const { service, prisma, tx } = createHarness();
    const input = {
      title: '测试文章',
      contentType: 'article',
      content: '正文',
      categoryId: '2',
      relatedProductIds: ['9007199254740993'],
      clientRequestId: REQUEST_ID,
    };

    const first: any = await service.create(input);
    const retry: any = await service.create(input);

    expect(first.id).toBe('10');
    expect(retry.id).toBe('10');
    expect(first.relatedProductIds).toEqual(['9007199254740993']);
    expect(tx.content.create).toHaveBeenCalledTimes(1);
    expect(tx.content.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        categoryId: 2n,
        relatedProductIds: ['9007199254740993'],
      }),
    });
    expect(tx.businessEvent.create).toHaveBeenCalledTimes(1);
    expect(tx.businessEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        eventType: 'content_create',
        bizType: 'content',
        bizId: REQUEST_ID,
        payload: expect.objectContaining({ contentId: '10' }),
      }),
    });
    expect(prisma.$transaction).toHaveBeenCalledWith(
      expect.any(Function),
      { isolationLevel: 'Serializable' },
    );
  });

  it('fails closed when the same create request id is reused with changed content', async () => {
    const { service, tx } = createHarness();

    await service.create({
      title: '测试文章',
      contentType: 'article',
      content: '正文',
      clientRequestId: REQUEST_ID,
    });

    await expect(service.create({
      title: '已经改名',
      contentType: 'article',
      content: '正文',
      clientRequestId: REQUEST_ID,
    })).rejects.toThrow('内容创建请求ID已被其他操作使用');
    expect(tx.content.create).toHaveBeenCalledTimes(1);
  });

  it('rejects related product ids above signed BIGINT even when they are 19 digits', async () => {
    const { service, prisma } = createHarness();

    await expect(service.create({
      title: '超范围关联',
      contentType: 'article',
      content: '正文',
      relatedProductIds: ['9999999999999999999'],
      clientRequestId: REQUEST_ID,
    })).rejects.toThrow('关联商品ID超出范围');
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('replays success for an already soft-deleted content record without writing again', async () => {
    const { service, tx, current } = createHarness();
    current.deletedAt = new Date('2026-08-14T01:00:00.000Z');

    const result: any = await service.delete('10');

    expect(result.id).toBe('10');
    expect(tx.content.updateMany).not.toHaveBeenCalled();
  });

  it('keeps unknown content ids fail-closed on delete', async () => {
    const { service, tx } = createHarness();
    tx.content.findFirst.mockResolvedValueOnce(null);

    await expect(service.delete('999')).rejects.toThrow('内容不存在');
    expect(tx.content.updateMany).not.toHaveBeenCalled();
  });
});
