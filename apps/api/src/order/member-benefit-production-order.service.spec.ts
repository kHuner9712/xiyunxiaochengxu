import { MemberBenefitProductionOrderService } from './member-benefit-production-order.service';

function memberLevels() {
  return [
    { id: 1n, name: '普通会员', minGrowthValue: 0, maxGrowthValue: 99, discountRate: 100, pointsRate: 15, sortOrder: 1, status: 1 },
    { id: 2n, name: '银卡会员', minGrowthValue: 100, maxGrowthValue: null, discountRate: 90, pointsRate: 15, sortOrder: 2, status: 1 },
  ];
}

function createService() {
  const txOrderCreate = jest.fn(async (args: any) => ({ id: 99n, ...args.data }));
  const prisma: any = {
    user: {
      findFirst: jest.fn(async () => ({
        id: 7n,
        growthValue: 150,
        availablePoints: 0,
        totalPoints: 0,
        memberLevelId: 2n,
      })),
    },
    memberLevel: { findMany: jest.fn(async () => memberLevels()) },
    productSku: {
      findMany: jest.fn(async () => [{ id: 11n, productId: 21n, product: { categoryId: 31n } }]),
      findFirst: jest.fn(async () => ({
        id: 11n,
        productId: 21n,
        price: 10000,
        originalPrice: 10000,
        stock: 10,
        specs: {},
        image: '',
        product: {
          id: 21n,
          name: '会员价测试商品',
          status: 1,
          mainImage: '',
          supplierId: null,
        },
      })),
    },
    pickupStore: {
      findFirst: jest.fn(async () => ({
        id: 41n,
        status: 1,
        deletedAt: null,
        name: '测试自提点',
        province: '上海市',
        city: '上海市',
        district: '浦东新区',
        address: '测试路1号',
        contactPhone: '021-12345678',
        businessHours: '09:00-18:00',
        pickupNotice: '',
      })),
    },
    order: { create: txOrderCreate },
    $transaction: jest.fn(async (callback: any) => callback({
      order: { create: txOrderCreate },
    })),
  };

  const service = new MemberBenefitProductionOrderService(
    prisma,
    { emitWarn: jest.fn() } as any,
    {} as any,
    {} as any,
    {} as any,
    { setNX: jest.fn(), releaseLockWithLua: jest.fn() } as any,
    undefined,
  );
  return { service, prisma, txOrderCreate };
}

describe('MemberBenefitProductionOrderService', () => {
  it('普通订单预览应用当前会员9折价且不把会员价当促销活动价', async () => {
    const { service } = createService();

    const result: any = await service.confirm('7', {
      items: [{ skuId: '11', quantity: 1 }],
      fulfillmentType: 'pickup',
      pickupStoreId: '41',
      pointsDeduct: 0,
    } as any);

    expect(result.totalAmount).toBe(10000);
    expect(result.discountAmount).toBe(1000);
    expect(result.activityDiscountAmount).toBe(0);
    expect(result.payAmount).toBe(9000);
  });

  it('优惠券已覆盖的金额不会再次计入积分抵扣上限', () => {
    const { service } = createService();
    const context = { userId: 7n, discountRate: 90, couponAmount: 0 };

    expect(() => (service as any).memberPricing.run(context, () => {
      const runtime = service as any;
      expect(runtime.calculateCouponAmount({ type: 1, value: 8000 }, 10000)).toBe(8000);
      runtime.calculatePointsDeduction(10000, 10000, 2000);
    })).toThrow('积分抵扣超过订单可用上限');

    const safeDeduction = (service as any).memberPricing.run(
      { userId: 7n, discountRate: 90, couponAmount: 0 },
      () => {
        const runtime = service as any;
        runtime.calculateCouponAmount({ type: 1, value: 8000 }, 10000);
        return runtime.calculatePointsDeduction(10000, 10000, 200);
      },
    );
    expect(safeDeduction.pointsDeducted).toBe(200);
    expect(safeDeduction.pointsAmount).toBe(200);
  });

  it('事务内创建订单时持久化会员优惠，而不是只修改前端预览金额', async () => {
    const { service, prisma, txOrderCreate } = createService();
    const context = { userId: 7n, discountRate: 90, couponAmount: 0 };

    await (service as any).memberPricing.run(context, () =>
      prisma.$transaction((tx: any) => tx.order.create({
        data: {
          userId: 7n,
          totalAmount: 10000,
          discountAmount: 0,
          payAmount: 9000,
        },
      })),
    );

    expect(txOrderCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        totalAmount: 10000,
        discountAmount: 1000,
        payAmount: 9000,
      }),
    });
  });

  it('完成订单按当前会员1.5倍发积分，但成长值仍按基础实付值升级', async () => {
    const { service } = createService();
    const userUpdate = jest.fn(async () => ({}));
    const memberRecordCreate = jest.fn(async () => ({}));
    const pointsCreate = jest.fn(async () => ({}));
    const tx: any = {
      orderRefund: { aggregate: jest.fn(async () => ({ _sum: { refundAmount: 0 } })) },
      pointsRecord: {
        findFirst: jest.fn(async () => null),
        create: pointsCreate,
      },
      user: {
        findFirst: jest.fn(async () => ({
          availablePoints: 20,
          growthValue: 95,
          memberLevelId: 1n,
        })),
        update: userUpdate,
      },
      memberLevel: { findMany: jest.fn(async () => memberLevels()) },
      userMemberRecord: { create: memberRecordCreate },
    };

    const earned = await (service as any).rewardCompletedOrder(tx, {
      id: 88n,
      orderNo: 'XY-MEMBER-1',
      userId: 7n,
      payAmount: 1000,
    }, 'order_complete');

    expect(earned).toBe(15);
    expect(userUpdate).toHaveBeenCalledWith({
      where: { id: 7n },
      data: {
        availablePoints: { increment: 15 },
        totalPoints: { increment: 15 },
        growthValue: { increment: 10 },
      },
    });
    expect(userUpdate).toHaveBeenCalledWith({
      where: { id: 7n },
      data: { memberLevelId: 2n },
    });
    expect(memberRecordCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ userId: 7n, oldLevelId: 1n, newLevelId: 2n }),
    });
    expect(pointsCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ points: 15, balance: 35, source: 'order_complete', sourceId: 88n }),
    });
  });
});
