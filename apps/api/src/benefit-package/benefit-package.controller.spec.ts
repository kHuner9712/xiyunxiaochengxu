import { WeappBenefitPackageController } from './benefit-package.controller';

describe('WeappBenefitPackageController owned-card entitlement scope', () => {
  function createController(options?: { rows?: Array<{ id: bigint }>; total?: number }) {
    const rows = options?.rows ?? [{ id: 201n }, { id: 202n }];
    const total = options?.total ?? rows.length;
    const service = {
      findEntitlements: jest.fn(),
      findEntitlementForUser: jest.fn(async (userId: string, id: string) => ({
        id,
        userId,
        verifyCode: `CODE-${id}`,
      })),
    } as any;
    const prisma = {
      userBenefitEntitlement: {
        findMany: jest.fn(async () => rows),
        count: jest.fn(async () => total),
      },
    } as any;
    return {
      controller: new WeappBenefitPackageController(service, prisma),
      service,
      prisma,
    };
  }

  it('scopes one card to the current user and concrete UserBenefitPackage id', async () => {
    const { controller, service, prisma } = createController();

    const result: any = await controller.myEntitlements('7', {
      page: 1,
      pageSize: 20,
      packageId: '101',
    } as any);

    expect(prisma.userBenefitEntitlement.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          userId: 7n,
          userBenefitPackageId: 101n,
          deletedAt: null,
        }),
      }),
    );
    expect(service.findEntitlements).not.toHaveBeenCalled();
    expect(service.findEntitlementForUser).toHaveBeenCalledTimes(2);
    expect(result.list.map((row: any) => row.id)).toEqual(['201', '202']);
  });

  it('does not expose another user card when its id is supplied', async () => {
    const { controller, service, prisma } = createController({ rows: [], total: 0 });

    const result: any = await controller.myEntitlements('7', {
      page: 1,
      pageSize: 20,
      packageId: '999',
    } as any);

    expect(prisma.userBenefitEntitlement.count).toHaveBeenCalledWith({
      where: expect.objectContaining({
        userId: 7n,
        userBenefitPackageId: 999n,
      }),
    });
    expect(service.findEntitlementForUser).not.toHaveBeenCalled();
    expect(result.list).toEqual([]);
    expect(result.total).toBe(0);
  });

  it('keeps the unscoped all-entitlements view on the existing service path', async () => {
    const { controller, service, prisma } = createController();
    service.findEntitlements.mockResolvedValue({ list: [], total: 0, page: 1, pageSize: 20 });

    await controller.myEntitlements('7', { page: 1, pageSize: 20 } as any);

    expect(service.findEntitlements).toHaveBeenCalledWith({ page: 1, pageSize: 20, userId: '7' });
    expect(prisma.userBenefitEntitlement.findMany).not.toHaveBeenCalled();
  });
});
