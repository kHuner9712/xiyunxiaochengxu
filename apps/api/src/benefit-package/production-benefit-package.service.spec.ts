import { ProductionBenefitPackageService } from './production-benefit-package.service';

describe('ProductionBenefitPackageService', () => {
  function createService() {
    const tx: any = {
      $queryRaw: jest.fn().mockResolvedValue([{ id: 100n }]),
      userBenefitPackage: {
        findUnique: jest.fn().mockResolvedValue({ id: 100n, status: 'active' }),
      },
      benefitPackageItem: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      userBenefitEntitlement: {
        count: jest.fn().mockResolvedValue(0),
        create: jest.fn().mockResolvedValue({ id: 1n }),
      },
    };
    const prisma: any = {
      order: {
        findUnique: jest.fn(),
      },
      aftersaleOrder: {
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn(),
      },
      benefitPackage: {
        findFirst: jest.fn(),
      },
      benefitPackageItem: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      userBenefitPackage: {
        findUnique: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
        updateMany: jest.fn(),
      },
      userBenefitEntitlement: {
        count: jest.fn().mockResolvedValue(0),
        findFirst: jest.fn(),
        updateMany: jest.fn(),
      },
      orderRefund: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      $transaction: jest.fn(async (callback: any) => callback(tx)),
    };
    const merchantSettlementService: any = {
      generateServiceCommission: jest.fn(),
    };
    const service = new ProductionBenefitPackageService(prisma, merchantSettlementService);
    return { service, prisma, tx };
  }

  it('never re-grants benefits for an order item that already reached refunded', async () => {
    const { service, prisma } = createService();
    prisma.order.findUnique.mockResolvedValue({
      id: 42n,
      orderItems: [{ id: 11n, productId: 5n, quantity: 1 }],
    });
    prisma.aftersaleOrder.findMany.mockResolvedValue([{ orderItemId: 11n }]);
    const grantOnePackage = jest.spyOn(service as any, 'grantOnePackage');

    await service.reconcileOrderBenefits(42n, 8n);

    expect(grantOnePackage).not.toHaveBeenCalled();
    expect(prisma.benefitPackage.findFirst).not.toHaveBeenCalled();
  });

  it('repairs only the missing entitlement count in a partially granted package', async () => {
    const { service, prisma, tx } = createService();
    prisma.order.findUnique.mockResolvedValue({
      id: 43n,
      orderItems: [{ id: 12n, productId: 6n, quantity: 1 }],
    });
    prisma.benefitPackage.findFirst.mockResolvedValue({
      id: 7n,
      productId: 6n,
      validDays: 30,
      validEndAt: null,
    });
    prisma.userBenefitPackage.findUnique.mockResolvedValue({ id: 100n });
    prisma.benefitPackageItem.findMany.mockResolvedValue([{ id: 501n, quantity: 2 }]);
    prisma.userBenefitEntitlement.count.mockResolvedValue(2);
    tx.benefitPackageItem.findMany.mockResolvedValue([{ id: 501n, quantity: 2 }]);
    tx.userBenefitEntitlement.count.mockResolvedValue(1);
    const grantOnePackage = jest
      .spyOn(service as any, 'grantOnePackage')
      .mockResolvedValue(undefined);

    await service.reconcileOrderBenefits(43n, 9n);

    expect(grantOnePackage).toHaveBeenCalledTimes(1);
    expect(tx.userBenefitEntitlement.create).toHaveBeenCalledTimes(1);
    expect(tx.userBenefitEntitlement.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userBenefitPackageId: 100n,
        userId: 9n,
        packageItemId: 501n,
        status: 'unused',
      }),
    });
  });
});
