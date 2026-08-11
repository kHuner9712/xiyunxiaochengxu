import { ProductionAdminService } from './production-admin.service';

describe('ProductionAdminService session invalidation', () => {
  it('revokes all sessions after an administrator status change', async () => {
    const tx: any = {
      $queryRaw: jest.fn().mockResolvedValue([{ id: 7n }]),
      adminUser: {
        findFirst: jest.fn().mockResolvedValue({
          id: 7n,
          status: 1,
          deletedAt: null,
          adminUserRoles: [],
        }),
        update: jest.fn().mockResolvedValue({ id: 7n, status: 0 }),
        count: jest.fn().mockResolvedValue(1),
      },
    };
    const prisma: any = {
      $transaction: jest.fn((callback: any) => callback(tx)),
    };
    const redis: any = {
      delByPattern: jest.fn().mockResolvedValue(2),
    };
    const service = new ProductionAdminService(prisma, redis);

    const result = await service.updateStatus('7', 0);

    expect(result).toEqual({ id: '7', status: 0 });
    expect(redis.delByPattern).toHaveBeenCalledWith('admin_refresh_token:7:*');
  });
});
