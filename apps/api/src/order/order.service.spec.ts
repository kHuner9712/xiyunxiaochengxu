import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { OrderStatus } from '@prisma/client';
import { OrderService } from './order.service';
import { COUPON_STATUS, PAYMENT_STATUS } from '../common/constants/payment';

function createMockBusinessEventService() {
  return {
    emit: jest.fn(),
    emitInfo: jest.fn(),
    emitWarn: jest.fn(),
    emitError: jest.fn(),
    emitCritical: jest.fn(),
  };
}

function createMockPrisma() {
  const mockTx = {
    productSku: { findFirst: jest.fn(), update: jest.fn(), updateMany: jest.fn() },
    productStockLog: { create: jest.fn() },
    user: { findFirst: jest.fn(), update: jest.fn() },
    pointsRecord: { create: jest.fn(), findFirst: jest.fn() },
    userCoupon: { findFirst: jest.fn(), update: jest.fn(), updateMany: jest.fn() },
    order: { create: jest.fn(), update: jest.fn(), updateMany: jest.fn(), findFirst: jest.fn() },
    orderPayment: { create: jest.fn() },
    orderLog: { create: jest.fn() },
    orderDelivery: { findFirst: jest.fn(), create: jest.fn(), update: jest.fn() },
    cart: { deleteMany: jest.fn() },
    $executeRaw: jest.fn(),
  };

  return {
    userAddress: { findFirst: jest.fn() },
    productSku: { findFirst: jest.fn() },
    user: { findFirst: jest.fn() },
    userCoupon: { findFirst: jest.fn() },
    order: { findFirst: jest.fn(), findMany: jest.fn(), count: jest.fn(), update: jest.fn(), updateMany: jest.fn() },
    orderDelivery: { findFirst: jest.fn(), create: jest.fn(), update: jest.fn() },
    orderLog: { create: jest.fn() },
    cart: { deleteMany: jest.fn() },
    $transaction: jest.fn(),
    _mockTx: mockTx,
  };
}

function createService(mockPrisma?: any) {
  const prisma = mockPrisma || createMockPrisma();
  const businessEvent = createMockBusinessEventService();
  const service = new OrderService(prisma as any, businessEvent as any);
  jest.spyOn(service['logger'], 'log').mockImplementation(() => {});
  jest.spyOn(service['logger'], 'warn').mockImplementation(() => {});
  jest.spyOn(service['logger'], 'error').mockImplementation(() => {});
  return { service, mockPrisma: prisma, mockBusinessEvent: businessEvent };
}

function setupTransaction(mockPrisma: any) {
  mockPrisma.$transaction.mockImplementation(async (callback: any) => {
    return await callback(mockPrisma._mockTx);
  });
}

const ADDRESS = {
  id: BigInt(1), userId: BigInt(100), receiverName: '张三', receiverPhone: '13800138000',
  province: '北京', city: '北京', district: '朝阳区', detailAddress: 'xxx路1号', deletedAt: null,
};

const SKU = (stock = 10) => ({
  id: BigInt(200), productId: BigInt(300), specs: '红色/L', image: null, price: 9900, originalPrice: 12900,
  product: { id: BigInt(300), name: '测试商品', status: 1, supplierId: null },
  stock,
});

const USER = { id: BigInt(100), availablePoints: 5000, totalPoints: 10000, growthValue: 0 };

const USER_COUPON = {
  id: BigInt(50), userId: BigInt(100), couponId: BigInt(10), status: COUPON_STATUS.FREE,
  expireAt: new Date(Date.now() + 86400000),
  coupon: { id: BigInt(10), type: 1, value: 500, minAmount: 5000, discountLimit: null },
};

const CANCELLED_ORDER = {
  id: BigInt(1), userId: BigInt(100), status: OrderStatus.cancelled,
  orderItems: [{ id: BigInt(1), orderId: BigInt(1), skuId: BigInt(200), productId: BigInt(300), quantity: 1 }],
  pointsDeducted: 500, couponId: BigInt(50),
};

describe('OrderService.create 库存扣减', () => {
  let service: OrderService;
  let mockPrisma: any;

  beforeEach(() => {
    ({ service, mockPrisma } = createService());
  });

  it('库存不足不能下单', async () => {
    mockPrisma.userAddress.findFirst.mockResolvedValue(ADDRESS);
    mockPrisma.productSku.findFirst.mockResolvedValue(SKU(0));

    await expect(service.create('100', {
      addressId: '1', items: [{ skuId: '200', quantity: 1 }],
    })).rejects.toThrow('库存不足');
  });

  it('并发下单不会超卖（updateMany count=0 时回滚）', async () => {
    mockPrisma.userAddress.findFirst.mockResolvedValue(ADDRESS);
    mockPrisma.productSku.findFirst.mockResolvedValue(SKU(1));

    setupTransaction(mockPrisma);
    mockPrisma._mockTx.productSku.updateMany.mockResolvedValue({ count: 0 });

    await expect(service.create('100', {
      addressId: '1', items: [{ skuId: '200', quantity: 1 }],
    })).rejects.toThrow('库存不足');
  });

  it('库存充足时正常扣减', async () => {
    mockPrisma.userAddress.findFirst.mockResolvedValue(ADDRESS);
    mockPrisma.productSku.findFirst.mockResolvedValue(SKU(10));

    setupTransaction(mockPrisma);
    mockPrisma._mockTx.productSku.updateMany.mockResolvedValue({ count: 1 });
    mockPrisma._mockTx.productSku.findFirst.mockResolvedValue({ productId: BigInt(300), stock: 9 });
    mockPrisma._mockTx.productStockLog.create.mockResolvedValue({});
    mockPrisma._mockTx.order.create.mockResolvedValue({
      id: BigInt(1), orderNo: 'XY20260523001', orderItems: [],
    });
    mockPrisma._mockTx.orderPayment.create.mockResolvedValue({});
    mockPrisma.cart.deleteMany.mockResolvedValue({ count: 1 });

    await service.create('100', {
      addressId: '1', items: [{ skuId: '200', quantity: 1 }],
    });

    expect(mockPrisma._mockTx.productSku.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ stock: { gte: 1 } }),
        data: expect.objectContaining({ stock: { decrement: 1 } }),
      }),
    );
    expect(mockPrisma._mockTx.productStockLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          beforeStock: 10,
          afterStock: 9,
          quantity: 1,
        }),
      }),
    );
  });

  it('库存流水使用扣减后真实库存反推 beforeStock，保证并发日志自洽', async () => {
    mockPrisma.userAddress.findFirst.mockResolvedValue(ADDRESS);
    mockPrisma.productSku.findFirst.mockResolvedValue(SKU(10));

    setupTransaction(mockPrisma);
    mockPrisma._mockTx.productSku.updateMany.mockResolvedValue({ count: 1 });
    mockPrisma._mockTx.productSku.findFirst
      .mockResolvedValueOnce({ productId: BigInt(300), stock: 8 })
      .mockResolvedValueOnce({ productId: BigInt(300), stock: 6 });
    mockPrisma._mockTx.productStockLog.create.mockResolvedValue({});
    mockPrisma._mockTx.order.create.mockResolvedValue({
      id: BigInt(1), orderNo: 'XY20260523001', orderItems: [],
    });
    mockPrisma._mockTx.orderPayment.create.mockResolvedValue({});
    mockPrisma.cart.deleteMany.mockResolvedValue({ count: 1 });

    await service.create('100', {
      addressId: '1',
      items: [
        { skuId: '200', quantity: 2 },
        { skuId: '200', quantity: 2 },
      ],
    });

    expect(mockPrisma._mockTx.productStockLog.create).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        data: expect.objectContaining({ beforeStock: 10, afterStock: 8, quantity: 2 }),
      }),
    );
    expect(mockPrisma._mockTx.productStockLog.create).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        data: expect.objectContaining({ beforeStock: 8, afterStock: 6, quantity: 2 }),
      }),
    );
  });
});

describe('OrderService.create 优惠券锁定', () => {
  let service: OrderService;
  let mockPrisma: any;

  beforeEach(() => {
    ({ service, mockPrisma } = createService());
  });

  it('下单时使用 updateMany 原子锁券（FREE -> LOCKED）', async () => {
    mockPrisma.userAddress.findFirst.mockResolvedValue(ADDRESS);
    mockPrisma.productSku.findFirst.mockResolvedValue(SKU(10));
    mockPrisma.userCoupon.findFirst.mockResolvedValue(USER_COUPON);

    setupTransaction(mockPrisma);
    mockPrisma._mockTx.productSku.updateMany.mockResolvedValue({ count: 1 });
    mockPrisma._mockTx.productSku.findFirst.mockResolvedValue({ productId: BigInt(300), stock: 9 });
    mockPrisma._mockTx.productStockLog.create.mockResolvedValue({});
    mockPrisma._mockTx.userCoupon.updateMany.mockResolvedValue({ count: 1 });
    mockPrisma._mockTx.order.create.mockResolvedValue({
      id: BigInt(1), orderNo: 'XY20260523001', orderItems: [],
    });
    mockPrisma._mockTx.orderPayment.create.mockResolvedValue({});
    mockPrisma.cart.deleteMany.mockResolvedValue({ count: 1 });

    await service.create('100', {
      addressId: '1', couponId: '50', items: [{ skuId: '200', quantity: 1 }],
    });

    expect(mockPrisma._mockTx.userCoupon.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: BigInt(50), userId: BigInt(100), status: COUPON_STATUS.FREE }),
        data: expect.objectContaining({ status: COUPON_STATUS.LOCKED }),
      }),
    );
  });

  it('并发锁券失败时抛出异常，事务回滚', async () => {
    mockPrisma.userAddress.findFirst.mockResolvedValue(ADDRESS);
    mockPrisma.productSku.findFirst.mockResolvedValue(SKU(10));
    mockPrisma.userCoupon.findFirst.mockResolvedValue(USER_COUPON);

    setupTransaction(mockPrisma);
    mockPrisma._mockTx.productSku.updateMany.mockResolvedValue({ count: 1 });
    mockPrisma._mockTx.productSku.findFirst.mockResolvedValue({ productId: BigInt(300), stock: 9 });
    mockPrisma._mockTx.productStockLog.create.mockResolvedValue({});
    mockPrisma._mockTx.userCoupon.updateMany.mockResolvedValue({ count: 0 });
    mockPrisma._mockTx.order.create.mockResolvedValue({
      id: BigInt(1), orderNo: 'XY20260523001', orderItems: [],
    });
    mockPrisma._mockTx.orderPayment.create.mockResolvedValue({});

    await expect(service.create('100', {
      addressId: '1', couponId: '50', items: [{ skuId: '200', quantity: 1 }],
    })).rejects.toThrow('优惠券已被使用或锁定');
  });

  it('已锁定的优惠券不能使用（事务外校验）', async () => {
    mockPrisma.userAddress.findFirst.mockResolvedValue(ADDRESS);
    mockPrisma.productSku.findFirst.mockResolvedValue(SKU(10));
    mockPrisma.userCoupon.findFirst.mockResolvedValue(null);

    await expect(service.create('100', {
      addressId: '1', couponId: '50', items: [{ skuId: '200', quantity: 1 }],
    })).rejects.toThrow('优惠券不可用');
  });

  it('已使用的优惠券不能使用（事务外校验）', async () => {
    mockPrisma.userAddress.findFirst.mockResolvedValue(ADDRESS);
    mockPrisma.productSku.findFirst.mockResolvedValue(SKU(10));
    mockPrisma.userCoupon.findFirst.mockResolvedValue(null);

    await expect(service.create('100', {
      addressId: '1', couponId: '50', items: [{ skuId: '200', quantity: 1 }],
    })).rejects.toThrow('优惠券不可用');
  });
});

describe('OrderService.create 优惠券并发竞态', () => {
  let service: OrderService;
  let mockPrisma: any;

  beforeEach(() => {
    ({ service, mockPrisma } = createService());
  });

  it('两个并发 create 使用同一 userCoupon，锁券失败的不创建脏订单', async () => {
    mockPrisma.userAddress.findFirst.mockResolvedValue(ADDRESS);
    mockPrisma.productSku.findFirst.mockResolvedValue(SKU(10));
    mockPrisma.userCoupon.findFirst.mockResolvedValue(USER_COUPON);

    setupTransaction(mockPrisma);
    mockPrisma._mockTx.productSku.updateMany.mockResolvedValue({ count: 1 });
    mockPrisma._mockTx.productSku.findFirst.mockResolvedValue({ productId: BigInt(300), stock: 9 });
    mockPrisma._mockTx.productStockLog.create.mockResolvedValue({});
    mockPrisma._mockTx.userCoupon.updateMany.mockResolvedValue({ count: 0 });
    mockPrisma._mockTx.order.create.mockResolvedValue({
      id: BigInt(1), orderNo: 'XY20260523001', orderItems: [],
    });
    mockPrisma._mockTx.orderPayment.create.mockResolvedValue({});

    await expect(service.create('100', {
      addressId: '1', couponId: '50', items: [{ skuId: '200', quantity: 1 }],
    })).rejects.toThrow('优惠券已被使用或锁定');

    expect(mockPrisma._mockTx.userCoupon.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: COUPON_STATUS.FREE }),
      }),
    );
  });

  it('锁券失败时不扣积分', async () => {
    mockPrisma.userAddress.findFirst.mockResolvedValue(ADDRESS);
    mockPrisma.productSku.findFirst.mockResolvedValue(SKU(10));
    mockPrisma.user.findFirst.mockResolvedValue(USER);
    mockPrisma.userCoupon.findFirst.mockResolvedValue(USER_COUPON);

    setupTransaction(mockPrisma);
    mockPrisma._mockTx.productSku.updateMany.mockResolvedValue({ count: 1 });
    mockPrisma._mockTx.productSku.findFirst.mockResolvedValue({ productId: BigInt(300), stock: 9 });
    mockPrisma._mockTx.productStockLog.create.mockResolvedValue({});
    mockPrisma._mockTx.user.findFirst.mockResolvedValue(USER);
    mockPrisma._mockTx.user.update.mockResolvedValue({});
    mockPrisma._mockTx.pointsRecord.create.mockResolvedValue({});
    mockPrisma._mockTx.userCoupon.updateMany.mockResolvedValue({ count: 0 });
    mockPrisma._mockTx.order.create.mockResolvedValue({
      id: BigInt(1), orderNo: 'XY20260523001', orderItems: [],
    });
    mockPrisma._mockTx.orderPayment.create.mockResolvedValue({});

    await expect(service.create('100', {
      addressId: '1', couponId: '50', pointsDeduct: 500, items: [{ skuId: '200', quantity: 1 }],
    })).rejects.toThrow('优惠券已被使用或锁定');
  });
});

describe('OrderService.create 积分抵扣', () => {
  let service: OrderService;
  let mockPrisma: any;

  beforeEach(() => {
    ({ service, mockPrisma } = createService());
  });

  it('积分不足时不能下单', async () => {
    mockPrisma.userAddress.findFirst.mockResolvedValue(ADDRESS);
    mockPrisma.productSku.findFirst.mockResolvedValue(SKU(10));
    mockPrisma.user.findFirst.mockResolvedValue({ ...USER, availablePoints: 10 });

    await expect(service.create('100', {
      addressId: '1', pointsDeduct: 1000, items: [{ skuId: '200', quantity: 1 }],
    })).rejects.toThrow('积分不足');
  });

  it('积分充足时正常扣减', async () => {
    mockPrisma.userAddress.findFirst.mockResolvedValue(ADDRESS);
    mockPrisma.productSku.findFirst.mockResolvedValue(SKU(10));
    mockPrisma.user.findFirst.mockResolvedValue(USER);

    setupTransaction(mockPrisma);
    mockPrisma._mockTx.productSku.updateMany.mockResolvedValue({ count: 1 });
    mockPrisma._mockTx.productSku.findFirst.mockResolvedValue({ productId: BigInt(300), stock: 9 });
    mockPrisma._mockTx.productStockLog.create.mockResolvedValue({});
    mockPrisma._mockTx.user.findFirst.mockResolvedValue(USER);
    mockPrisma._mockTx.user.update.mockResolvedValue({});
    mockPrisma._mockTx.pointsRecord.create.mockResolvedValue({});
    mockPrisma._mockTx.order.create.mockResolvedValue({
      id: BigInt(1), orderNo: 'XY20260523001', orderItems: [],
    });
    mockPrisma._mockTx.orderPayment.create.mockResolvedValue({});
    mockPrisma.cart.deleteMany.mockResolvedValue({ count: 1 });

    await service.create('100', {
      addressId: '1', pointsDeduct: 500, items: [{ skuId: '200', quantity: 1 }],
    });

    expect(mockPrisma._mockTx.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ availablePoints: { decrement: 500 } }),
      }),
    );
    expect(mockPrisma._mockTx.pointsRecord.create).toHaveBeenCalled();
  });
});

function setupCancelMocks(mockPrisma: any, claimCount: number) {
  setupTransaction(mockPrisma);
  mockPrisma._mockTx.order.updateMany.mockResolvedValue({ count: claimCount });
  mockPrisma._mockTx.productSku.findFirst.mockResolvedValue({ stock: 9 });
  mockPrisma._mockTx.productSku.update.mockResolvedValue({});
  mockPrisma._mockTx.productStockLog.create.mockResolvedValue({});
  mockPrisma._mockTx.user.findFirst.mockResolvedValue(USER);
  mockPrisma._mockTx.user.update.mockResolvedValue({});
  mockPrisma._mockTx.pointsRecord.create.mockResolvedValue({});
  mockPrisma._mockTx.userCoupon.updateMany.mockResolvedValue({ count: 1 });
  mockPrisma._mockTx.orderLog.create.mockResolvedValue({});
  mockPrisma._mockTx.order.findFirst.mockResolvedValue(CANCELLED_ORDER);
}

describe('OrderService.cancel 未支付订单释放资源', () => {
  let service: OrderService;
  let mockPrisma: any;

  const PENDING_ORDER = {
    id: BigInt(1), userId: BigInt(100), status: OrderStatus.pending_payment,
    orderItems: [{ skuId: BigInt(200), productId: BigInt(300), quantity: 1 }],
    pointsDeducted: 500, couponId: BigInt(50),
  };

  beforeEach(() => {
    ({ service, mockPrisma } = createService());
  });

  it('未支付订单取消释放库存', async () => {
    mockPrisma.order.findFirst.mockResolvedValue(PENDING_ORDER);
    setupCancelMocks(mockPrisma, 1);

    await service.cancel('100', '1');

    expect(mockPrisma._mockTx.order.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: BigInt(1), userId: BigInt(100), status: OrderStatus.pending_payment }),
        data: expect.objectContaining({ status: OrderStatus.cancelled }),
      }),
    );
    expect(mockPrisma._mockTx.productSku.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ stock: { increment: 1 } }),
      }),
    );
    expect(mockPrisma._mockTx.$executeRaw).toHaveBeenCalled();
  });

  it('未支付订单取消释放积分', async () => {
    mockPrisma.order.findFirst.mockResolvedValue(PENDING_ORDER);
    setupCancelMocks(mockPrisma, 1);

    await service.cancel('100', '1');

    expect(mockPrisma._mockTx.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ availablePoints: { increment: 500 } }),
      }),
    );
  });

  it('未支付订单取消释放优惠券（LOCKED -> FREE，清空 usedOrderId）', async () => {
    mockPrisma.order.findFirst.mockResolvedValue(PENDING_ORDER);
    setupCancelMocks(mockPrisma, 1);

    await service.cancel('100', '1');

    expect(mockPrisma._mockTx.userCoupon.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: BigInt(50), status: COUPON_STATUS.LOCKED }),
        data: expect.objectContaining({ status: COUPON_STATUS.FREE, usedOrderId: null }),
      }),
    );
  });

  it('不能取消其他用户订单，且不会释放库存/积分/优惠券', async () => {
    mockPrisma.order.findFirst.mockResolvedValue(null);

    await expect(service.cancel('999', '1')).rejects.toThrow('订单不存在');

    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  it('USED 优惠券不会被释放为 FREE', async () => {
    mockPrisma.order.findFirst.mockResolvedValue(PENDING_ORDER);
    setupCancelMocks(mockPrisma, 1);
    mockPrisma._mockTx.userCoupon.updateMany.mockResolvedValue({ count: 0 });

    await service.cancel('100', '1');

    expect(mockPrisma._mockTx.userCoupon.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: COUPON_STATUS.LOCKED }),
      }),
    );
  });
});

describe('OrderService.cancel 已支付订单不能走普通取消', () => {
  let service: OrderService;
  let mockPrisma: any;

  beforeEach(() => {
    ({ service, mockPrisma } = createService());
  });

  it('已支付订单不能取消（updateMany 抢占失败后明确报错）', async () => {
    mockPrisma.order.findFirst.mockResolvedValue({
      id: BigInt(1), userId: BigInt(100), status: OrderStatus.pending_delivery,
      orderItems: [],
    });

    setupTransaction(mockPrisma);
    mockPrisma._mockTx.order.updateMany.mockResolvedValue({ count: 0 });
    mockPrisma._mockTx.order.findFirst.mockResolvedValue({
      id: BigInt(1), userId: BigInt(100), status: OrderStatus.pending_delivery,
    });

    await expect(service.cancel('100', '1'))
      .rejects.toThrow('订单已支付或状态已变化，不能取消');
  });

  it('已发货订单不能取消', async () => {
    mockPrisma.order.findFirst.mockResolvedValue({
      id: BigInt(1), userId: BigInt(100), status: OrderStatus.delivered,
      orderItems: [],
    });

    setupTransaction(mockPrisma);
    mockPrisma._mockTx.order.updateMany.mockResolvedValue({ count: 0 });
    mockPrisma._mockTx.order.findFirst.mockResolvedValue({
      id: BigInt(1), userId: BigInt(100), status: OrderStatus.delivered,
    });

    await expect(service.cancel('100', '1'))
      .rejects.toThrow('订单已支付或状态已变化，不能取消');
  });

  it('已取消订单重复取消返回幂等结果', async () => {
    mockPrisma.order.findFirst.mockResolvedValue({
      id: BigInt(1), userId: BigInt(100), status: OrderStatus.cancelled,
      orderItems: [],
    });

    setupTransaction(mockPrisma);
    mockPrisma._mockTx.order.updateMany.mockResolvedValue({ count: 0 });
    mockPrisma._mockTx.order.findFirst.mockResolvedValue({
      id: BigInt(1), userId: BigInt(100), status: OrderStatus.cancelled,
    });

    const result = await service.cancel('100', '1');
    expect(result.status).toBe(OrderStatus.cancelled);
  });
});

describe('OrderService.cancel 并发竞态保护', () => {
  let service: OrderService;
  let mockPrisma: any;

  const PENDING_ORDER = {
    id: BigInt(1), userId: BigInt(100), status: OrderStatus.pending_payment,
    orderItems: [{ skuId: BigInt(200), productId: BigInt(300), quantity: 1 }],
    pointsDeducted: 500, couponId: BigInt(50),
  };

  beforeEach(() => {
    ({ service, mockPrisma } = createService());
  });

  it('cancel 与 payment success 并发时，抢占失败不归还库存', async () => {
    mockPrisma.order.findFirst.mockResolvedValue(PENDING_ORDER);

    setupTransaction(mockPrisma);
    mockPrisma._mockTx.order.updateMany.mockResolvedValue({ count: 0 });
    mockPrisma._mockTx.order.findFirst.mockResolvedValue({
      id: BigInt(1), userId: BigInt(100), status: OrderStatus.pending_delivery,
    });

    await expect(service.cancel('100', '1'))
      .rejects.toThrow('订单已支付或状态已变化，不能取消');

    expect(mockPrisma._mockTx.productSku.update).not.toHaveBeenCalled();
    expect(mockPrisma._mockTx.user.update).not.toHaveBeenCalled();
    expect(mockPrisma._mockTx.userCoupon.updateMany).not.toHaveBeenCalled();
  });

  it('重复 cancel 抢占失败（已 cancelled）不重复归还库存/积分/优惠券', async () => {
    mockPrisma.order.findFirst.mockResolvedValue(PENDING_ORDER);

    setupTransaction(mockPrisma);
    mockPrisma._mockTx.order.updateMany.mockResolvedValue({ count: 0 });
    mockPrisma._mockTx.order.findFirst.mockResolvedValue({
      id: BigInt(1), userId: BigInt(100), status: OrderStatus.cancelled,
    });

    const result = await service.cancel('100', '1');

    expect(result.status).toBe(OrderStatus.cancelled);
    expect(mockPrisma._mockTx.productSku.update).not.toHaveBeenCalled();
    expect(mockPrisma._mockTx.user.update).not.toHaveBeenCalled();
    expect(mockPrisma._mockTx.userCoupon.updateMany).not.toHaveBeenCalled();
  });

  it('cancel 抢占成功才执行副作用', async () => {
    mockPrisma.order.findFirst.mockResolvedValue(PENDING_ORDER);
    setupCancelMocks(mockPrisma, 1);

    await service.cancel('100', '1');

    expect(mockPrisma._mockTx.order.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: OrderStatus.pending_payment }),
      }),
    );
    expect(mockPrisma._mockTx.productSku.update).toHaveBeenCalled();
    expect(mockPrisma._mockTx.user.update).toHaveBeenCalled();
    expect(mockPrisma._mockTx.orderLog.create).toHaveBeenCalled();
  });
});

describe('OrderService.adminDeliver 发货幂等与并发保护', () => {
  let service: OrderService;
  let mockPrisma: any;

  const delivery = {
    id: BigInt(10),
    orderId: BigInt(1),
    logisticsCompany: '顺丰速运',
    logisticsNo: 'SF123',
    deliveryImages: null,
    deliveredAt: new Date('2026-05-31T10:00:00Z'),
    logisticsInfo: null,
  };
  const orderView = (status: OrderStatus, orderDelivery: any = null) => ({
    id: BigInt(1),
    orderNo: 'ORDER123',
    userId: BigInt(100),
    status,
    totalAmount: 1000,
    discountAmount: 0,
    couponAmount: 0,
    activityDiscountAmount: 0,
    pointsAmount: 0,
    freightAmount: 0,
    payAmount: 1000,
    receiverName: '张三',
    receiverPhone: '13800138000',
    province: '北京',
    city: '北京',
    district: '朝阳区',
    detailAddress: '测试路1号',
    fulfillmentType: 'delivery',
    createdAt: new Date('2026-05-31T09:00:00Z'),
    deliveredAt: status === OrderStatus.delivered ? new Date('2026-05-31T10:00:00Z') : null,
    completedAt: null,
    paidAt: new Date('2026-05-31T09:30:00Z'),
    orderItems: [],
    payment: null,
    delivery: orderDelivery,
    orderLogs: [],
    user: null,
  });

  beforeEach(() => {
    ({ service, mockPrisma } = createService());
    setupTransaction(mockPrisma);
  });

  it('重复发货已 delivered 且已有 delivery 时返回幂等结果，不重复写 delivery 和日志', async () => {
    mockPrisma._mockTx.order.updateMany.mockResolvedValue({ count: 0 });
    mockPrisma._mockTx.order.findFirst.mockResolvedValue(orderView(OrderStatus.delivered, delivery));

    const result = await service.adminDeliver({
      orderId: 1,
      logisticsCompany: '顺丰速运',
      logisticsNo: 'SF123',
    });

    expect(result.status).toBe(OrderStatus.delivered);
    expect(result.logistics).toEqual(expect.objectContaining({ company: '顺丰速运', trackingNo: 'SF123' }));
    expect(mockPrisma._mockTx.orderDelivery.create).not.toHaveBeenCalled();
    expect(mockPrisma._mockTx.orderLog.create).not.toHaveBeenCalled();
  });

  it('并发发货只有一次成功写入 delivery 和发货日志', async () => {
    mockPrisma._mockTx.order.updateMany
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 0 });
    mockPrisma._mockTx.orderDelivery.findFirst.mockResolvedValue(null);
    mockPrisma._mockTx.orderDelivery.create.mockResolvedValue(delivery);
    mockPrisma._mockTx.orderLog.create.mockResolvedValue({});
    mockPrisma._mockTx.order.findFirst
      .mockResolvedValueOnce(orderView(OrderStatus.delivered, delivery))
      .mockResolvedValueOnce(orderView(OrderStatus.delivered, delivery));

    const results = await Promise.all([
      service.adminDeliver({ orderId: 1, logisticsCompany: '顺丰速运', logisticsNo: 'SF123' }),
      service.adminDeliver({ orderId: 1, logisticsCompany: '顺丰速运', logisticsNo: 'SF123' }),
    ]);

    expect(results.every((result) => result.status === OrderStatus.delivered)).toBe(true);
    expect(mockPrisma._mockTx.orderDelivery.create).toHaveBeenCalledTimes(1);
    expect(mockPrisma._mockTx.orderLog.create).toHaveBeenCalledTimes(1);
  });

  it.each([
    OrderStatus.cancelled,
    OrderStatus.completed,
    OrderStatus.aftersale,
    OrderStatus.pending_pickup,
  ])('%s 状态订单无法发货且不写 delivery', async (status) => {
    mockPrisma._mockTx.order.updateMany.mockResolvedValue({ count: 0 });
    mockPrisma._mockTx.order.findFirst.mockResolvedValue(orderView(status));

    await expect(service.adminDeliver({
      orderId: 1,
      logisticsCompany: '顺丰速运',
      logisticsNo: 'SF123',
    })).rejects.toThrow(`订单状态不允许发货: ${status}`);

    expect(mockPrisma._mockTx.orderDelivery.create).not.toHaveBeenCalled();
    expect(mockPrisma._mockTx.orderLog.create).not.toHaveBeenCalled();
  });
});

describe('OrderService.closeTimeoutOrders 超时关闭释放资源', () => {
  let service: OrderService;
  let mockPrisma: any;

  const TIMEOUT_ORDER = {
    id: BigInt(1), userId: BigInt(100), status: OrderStatus.pending_payment,
    orderItems: [{ skuId: BigInt(200), productId: BigInt(300), quantity: 1 }],
    pointsDeducted: 500, couponId: BigInt(50),
  };

  beforeEach(() => {
    ({ service, mockPrisma } = createService());
  });

  it('超时关闭释放库存、积分、优惠券', async () => {
    mockPrisma.order.findMany.mockResolvedValue([TIMEOUT_ORDER]);

    setupTransaction(mockPrisma);
    mockPrisma._mockTx.order.updateMany.mockResolvedValue({ count: 1 });
    mockPrisma._mockTx.productSku.findFirst.mockResolvedValue({ stock: 9 });
    mockPrisma._mockTx.productSku.update.mockResolvedValue({});
    mockPrisma._mockTx.productStockLog.create.mockResolvedValue({});
    mockPrisma._mockTx.user.findFirst.mockResolvedValue(USER);
    mockPrisma._mockTx.user.update.mockResolvedValue({});
    mockPrisma._mockTx.pointsRecord.create.mockResolvedValue({});
    mockPrisma._mockTx.userCoupon.updateMany.mockResolvedValue({ count: 1 });
    mockPrisma._mockTx.orderLog.create.mockResolvedValue({});

    const result = await service.closeTimeoutOrders();

    expect(result.closedCount).toBe(1);
    expect(mockPrisma._mockTx.order.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: BigInt(1), status: OrderStatus.pending_payment }),
        data: expect.objectContaining({ status: OrderStatus.cancelled }),
      }),
    );
    expect(mockPrisma._mockTx.productSku.update).toHaveBeenCalled();
    expect(mockPrisma._mockTx.user.update).toHaveBeenCalled();
    expect(mockPrisma._mockTx.userCoupon.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: BigInt(50), status: COUPON_STATUS.LOCKED }),
        data: expect.objectContaining({ status: COUPON_STATUS.FREE, usedOrderId: null }),
      }),
    );
  });

  it('无超时订单时返回 0', async () => {
    mockPrisma.order.findMany.mockResolvedValue([]);

    const result = await service.closeTimeoutOrders();

    expect(result.closedCount).toBe(0);
  });

  it('状态已变更订单必须跳过副作用', async () => {
    mockPrisma.order.findMany.mockResolvedValue([TIMEOUT_ORDER]);

    setupTransaction(mockPrisma);
    mockPrisma._mockTx.order.updateMany.mockResolvedValue({ count: 0 });

    const result = await service.closeTimeoutOrders();

    expect(result.closedCount).toBe(0);
    expect(mockPrisma._mockTx.productSku.update).not.toHaveBeenCalled();
    expect(mockPrisma._mockTx.user.update).not.toHaveBeenCalled();
    expect(mockPrisma._mockTx.userCoupon.updateMany).not.toHaveBeenCalled();
  });

  it('支付回调先于 closeTimeout 抢占时跳过副作用', async () => {
    mockPrisma.order.findMany.mockResolvedValue([TIMEOUT_ORDER]);

    setupTransaction(mockPrisma);
    mockPrisma._mockTx.order.updateMany.mockResolvedValue({ count: 0 });

    const result = await service.closeTimeoutOrders();

    expect(result.closedCount).toBe(0);
    expect(mockPrisma._mockTx.productSku.update).not.toHaveBeenCalled();
    expect(mockPrisma._mockTx.pointsRecord.create).not.toHaveBeenCalled();
  });
});

describe('订单主链路', () => {
  let service: OrderService;
  let mockPrisma: any;

  beforeEach(() => {
    ({ service, mockPrisma } = createService());
  });

  it('立即购买下单 - 应成功创建订单', async () => {
    mockPrisma.userAddress.findFirst.mockResolvedValue(ADDRESS);
    mockPrisma.productSku.findFirst.mockResolvedValue(SKU(10));

    setupTransaction(mockPrisma);
    mockPrisma._mockTx.productSku.updateMany.mockResolvedValue({ count: 1 });
    mockPrisma._mockTx.productSku.findFirst.mockResolvedValue({ productId: BigInt(300), stock: 9 });
    mockPrisma._mockTx.productStockLog.create.mockResolvedValue({});
    mockPrisma._mockTx.order.create.mockResolvedValue({
      id: BigInt(1), orderNo: 'XY20260523001', orderItems: [],
    });
    mockPrisma._mockTx.orderPayment.create.mockResolvedValue({});
    mockPrisma.cart.deleteMany.mockResolvedValue({ count: 1 });

    const result = await service.create('100', {
      addressId: '1', items: [{ skuId: '200', quantity: 1 }],
    });

    expect(result.orderId).toBe('1');
    expect(result.orderNo).toBe('XY20260523001');
    expect(mockPrisma._mockTx.productSku.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ stock: { gte: 1 } }),
        data: expect.objectContaining({ stock: { decrement: 1 } }),
      }),
    );
  });

  it('使用优惠券下单 - 应正确计算优惠金额', async () => {
    mockPrisma.userAddress.findFirst.mockResolvedValue(ADDRESS);
    mockPrisma.productSku.findFirst.mockResolvedValue(SKU(10));
    mockPrisma.userCoupon.findFirst.mockResolvedValue(USER_COUPON);

    setupTransaction(mockPrisma);
    mockPrisma._mockTx.productSku.updateMany.mockResolvedValue({ count: 1 });
    mockPrisma._mockTx.productSku.findFirst.mockResolvedValue({ productId: BigInt(300), stock: 9 });
    mockPrisma._mockTx.productStockLog.create.mockResolvedValue({});
    mockPrisma._mockTx.userCoupon.updateMany.mockResolvedValue({ count: 1 });
    mockPrisma._mockTx.order.create.mockResolvedValue({
      id: BigInt(1), orderNo: 'XY20260523001', orderItems: [],
    });
    mockPrisma._mockTx.orderPayment.create.mockResolvedValue({});
    mockPrisma.cart.deleteMany.mockResolvedValue({ count: 1 });

    await service.create('100', {
      addressId: '1', couponId: '50', items: [{ skuId: '200', quantity: 1 }],
    });

    expect(mockPrisma._mockTx.order.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          couponAmount: 500,
          couponId: BigInt(50),
        }),
      }),
    );
    expect(mockPrisma._mockTx.userCoupon.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: COUPON_STATUS.FREE }),
        data: expect.objectContaining({ status: COUPON_STATUS.LOCKED }),
      }),
    );
  });

  it('使用积分下单 - 应正确计算积分抵扣', async () => {
    mockPrisma.userAddress.findFirst.mockResolvedValue(ADDRESS);
    mockPrisma.productSku.findFirst.mockResolvedValue(SKU(10));
    mockPrisma.user.findFirst.mockResolvedValue(USER);

    setupTransaction(mockPrisma);
    mockPrisma._mockTx.productSku.updateMany.mockResolvedValue({ count: 1 });
    mockPrisma._mockTx.productSku.findFirst.mockResolvedValue({ productId: BigInt(300), stock: 9 });
    mockPrisma._mockTx.productStockLog.create.mockResolvedValue({});
    mockPrisma._mockTx.user.findFirst.mockResolvedValue(USER);
    mockPrisma._mockTx.user.update.mockResolvedValue({});
    mockPrisma._mockTx.pointsRecord.create.mockResolvedValue({});
    mockPrisma._mockTx.order.create.mockResolvedValue({
      id: BigInt(1), orderNo: 'XY20260523001', orderItems: [],
    });
    mockPrisma._mockTx.orderPayment.create.mockResolvedValue({});
    mockPrisma.cart.deleteMany.mockResolvedValue({ count: 1 });

    await service.create('100', {
      addressId: '1', pointsDeduct: 500, items: [{ skuId: '200', quantity: 1 }],
    });

    expect(mockPrisma._mockTx.order.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          pointsAmount: 5,
          pointsDeducted: 500,
        }),
      }),
    );
    expect(mockPrisma._mockTx.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ availablePoints: { decrement: 500 } }),
      }),
    );
  });

  it('库存不足下单 - 应失败', async () => {
    mockPrisma.userAddress.findFirst.mockResolvedValue(ADDRESS);
    mockPrisma.productSku.findFirst.mockResolvedValue(SKU(0));

    await expect(service.create('100', {
      addressId: '1', items: [{ skuId: '200', quantity: 1 }],
    })).rejects.toThrow(BadRequestException);
  });

  it('并发下单不超卖 - updateMany条件更新', async () => {
    mockPrisma.userAddress.findFirst.mockResolvedValue(ADDRESS);
    mockPrisma.productSku.findFirst.mockResolvedValue(SKU(1));

    setupTransaction(mockPrisma);
    mockPrisma._mockTx.productSku.updateMany.mockResolvedValue({ count: 0 });

    await expect(service.create('100', {
      addressId: '1', items: [{ skuId: '200', quantity: 1 }],
    })).rejects.toThrow('库存不足，下单失败');
  });

  it('取消未支付订单 - 应释放库存、优惠券、积分', async () => {
    const ORDER_WITH_RESOURCES = {
      id: BigInt(1), userId: BigInt(100), status: OrderStatus.pending_payment,
      orderItems: [{ skuId: BigInt(200), productId: BigInt(300), quantity: 1 }],
      pointsDeducted: 500, couponId: BigInt(50),
    };

    mockPrisma.order.findFirst.mockResolvedValue(ORDER_WITH_RESOURCES);
    setupCancelMocks(mockPrisma, 1);

    await service.cancel('100', '1');

    expect(mockPrisma._mockTx.productSku.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ stock: { increment: 1 } }),
      }),
    );
    expect(mockPrisma._mockTx.$executeRaw).toHaveBeenCalled();
    expect(mockPrisma._mockTx.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ availablePoints: { increment: 500 } }),
      }),
    );
    expect(mockPrisma._mockTx.userCoupon.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: COUPON_STATUS.LOCKED }),
        data: expect.objectContaining({ status: COUPON_STATUS.FREE, usedOrderId: null }),
      }),
    );
  });

  it('订单试算 confirm - 应返回正确的金额明细', async () => {
    mockPrisma.productSku.findFirst.mockResolvedValue(SKU(10));
    mockPrisma.user.findFirst.mockResolvedValue(USER);
    mockPrisma.userCoupon.findFirst.mockResolvedValue(USER_COUPON);
    mockPrisma.userAddress.findFirst.mockResolvedValue(ADDRESS);

    const result = await service.confirm('100', {
      items: [{ skuId: '200', quantity: 1 }],
      addressId: '1',
      couponId: '50',
      pointsDeduct: 500,
    });

    expect(result.totalAmount).toBe(9900);
    expect(result.couponAmount).toBe(500);
    expect(result.pointsAmount).toBe(5);
    expect(result.freightAmount).toBe(0);
    expect(result.payAmount).toBe(9395);
  });
});

describe('OrderService.confirmReceive 确认收货', () => {
  let service: OrderService;
  let mockPrisma: any;

  const DELIVERED_ORDER = {
    id: BigInt(1), userId: BigInt(100), status: OrderStatus.delivered, payAmount: 9900,
    orderItems: [], delivery: { orderId: BigInt(1) },
  };

  const COMPLETED_ORDER = {
    id: BigInt(1), userId: BigInt(100), status: OrderStatus.completed, payAmount: 9900,
  };

  beforeEach(() => {
    ({ service, mockPrisma } = createService());
  });

  it('确认收货成功：delivered -> completed，发放积分', async () => {
    mockPrisma.order.findFirst.mockResolvedValue(DELIVERED_ORDER);

    setupTransaction(mockPrisma);
    mockPrisma._mockTx.order.updateMany.mockResolvedValue({ count: 1 });
    mockPrisma._mockTx.pointsRecord.findFirst.mockResolvedValue(null);
    mockPrisma._mockTx.user.findFirst.mockResolvedValue(USER);
    mockPrisma._mockTx.user.update.mockResolvedValue({});
    mockPrisma._mockTx.pointsRecord.create.mockResolvedValue({});
    mockPrisma._mockTx.orderDelivery.update.mockResolvedValue({});
    mockPrisma._mockTx.orderLog.create.mockResolvedValue({});
    mockPrisma._mockTx.order.findFirst.mockResolvedValue(COMPLETED_ORDER);

    await service.confirmReceive('100', '1');

    expect(mockPrisma._mockTx.order.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: BigInt(1), userId: BigInt(100), status: OrderStatus.delivered }),
        data: expect.objectContaining({ status: OrderStatus.completed }),
      }),
    );
    expect(mockPrisma._mockTx.pointsRecord.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ source: 'order_complete', sourceId: BigInt(1), points: 99 }),
      }),
    );
    expect(mockPrisma._mockTx.orderDelivery.update).toHaveBeenCalled();
  });

  it('双击确认收货：第二次抢占失败，不重复发积分', async () => {
    mockPrisma.order.findFirst.mockResolvedValue(DELIVERED_ORDER);

    setupTransaction(mockPrisma);
    mockPrisma._mockTx.order.updateMany.mockResolvedValue({ count: 0 });
    mockPrisma._mockTx.order.findFirst.mockResolvedValue(COMPLETED_ORDER);

    const result = await service.confirmReceive('100', '1');

    expect(result.status).toBe(OrderStatus.completed);
    expect(mockPrisma._mockTx.pointsRecord.create).not.toHaveBeenCalled();
    expect(mockPrisma._mockTx.user.update).not.toHaveBeenCalled();
  });

  it('非 delivered 状态不能确认收货', async () => {
    mockPrisma.order.findFirst.mockResolvedValue({
      id: BigInt(1), userId: BigInt(100), status: OrderStatus.pending_payment, payAmount: 9900,
    });

    setupTransaction(mockPrisma);
    mockPrisma._mockTx.order.updateMany.mockResolvedValue({ count: 0 });
    mockPrisma._mockTx.order.findFirst.mockResolvedValue({
      id: BigInt(1), userId: BigInt(100), status: OrderStatus.pending_payment,
    });

    await expect(service.confirmReceive('100', '1'))
      .rejects.toThrow('订单状态不允许确认收货');
  });

  it('积分记录已存在时不重复发放', async () => {
    mockPrisma.order.findFirst.mockResolvedValue(DELIVERED_ORDER);

    setupTransaction(mockPrisma);
    mockPrisma._mockTx.order.updateMany.mockResolvedValue({ count: 1 });
    mockPrisma._mockTx.pointsRecord.findFirst.mockResolvedValue({ id: BigInt(999), source: 'order_complete', sourceId: BigInt(1) });
    mockPrisma._mockTx.orderDelivery.update.mockResolvedValue({});
    mockPrisma._mockTx.orderLog.create.mockResolvedValue({});
    mockPrisma._mockTx.order.findFirst.mockResolvedValue(COMPLETED_ORDER);

    await service.confirmReceive('100', '1');

    expect(mockPrisma._mockTx.pointsRecord.create).not.toHaveBeenCalled();
    expect(mockPrisma._mockTx.user.update).not.toHaveBeenCalled();
  });
});

describe('OrderService.autoCompleteOrders 自动完成', () => {
  let service: OrderService;
  let mockPrisma: any;

  const AUTO_COMPLETE_ORDER = {
    id: BigInt(1), userId: BigInt(100), status: OrderStatus.delivered, payAmount: 9900,
    orderItems: [], autoCompleteAt: new Date(Date.now() - 1000),
  };

  beforeEach(() => {
    ({ service, mockPrisma } = createService());
  });

  it('自动完成成功：delivered -> completed，发放积分', async () => {
    mockPrisma.order.findMany.mockResolvedValue([AUTO_COMPLETE_ORDER]);

    setupTransaction(mockPrisma);
    mockPrisma._mockTx.order.updateMany.mockResolvedValue({ count: 1 });
    mockPrisma._mockTx.pointsRecord.findFirst.mockResolvedValue(null);
    mockPrisma._mockTx.user.findFirst.mockResolvedValue(USER);
    mockPrisma._mockTx.user.update.mockResolvedValue({});
    mockPrisma._mockTx.pointsRecord.create.mockResolvedValue({});
    mockPrisma._mockTx.orderLog.create.mockResolvedValue({});

    const result = await service.autoCompleteOrders();

    expect(result.completedCount).toBe(1);
    expect(mockPrisma._mockTx.order.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: BigInt(1), status: OrderStatus.delivered }),
        data: expect.objectContaining({ status: OrderStatus.completed }),
      }),
    );
    expect(mockPrisma._mockTx.pointsRecord.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ source: 'order_auto_complete', sourceId: BigInt(1) }),
      }),
    );
  });

  it('confirmReceive 先完成时，autoComplete 抢占失败跳过', async () => {
    mockPrisma.order.findMany.mockResolvedValue([AUTO_COMPLETE_ORDER]);

    setupTransaction(mockPrisma);
    mockPrisma._mockTx.order.updateMany.mockResolvedValue({ count: 0 });

    const result = await service.autoCompleteOrders();

    expect(result.completedCount).toBe(0);
    expect(mockPrisma._mockTx.pointsRecord.create).not.toHaveBeenCalled();
    expect(mockPrisma._mockTx.user.update).not.toHaveBeenCalled();
  });

  it('积分记录已存在时不重复发放', async () => {
    mockPrisma.order.findMany.mockResolvedValue([AUTO_COMPLETE_ORDER]);

    setupTransaction(mockPrisma);
    mockPrisma._mockTx.order.updateMany.mockResolvedValue({ count: 1 });
    mockPrisma._mockTx.pointsRecord.findFirst.mockResolvedValue({ id: BigInt(999), source: 'order_auto_complete', sourceId: BigInt(1) });
    mockPrisma._mockTx.orderLog.create.mockResolvedValue({});

    const result = await service.autoCompleteOrders();

    expect(result.completedCount).toBe(1);
    expect(mockPrisma._mockTx.pointsRecord.create).not.toHaveBeenCalled();
    expect(mockPrisma._mockTx.user.update).not.toHaveBeenCalled();
  });

  it('无待完成订单时返回 0', async () => {
    mockPrisma.order.findMany.mockResolvedValue([]);

    const result = await service.autoCompleteOrders();

    expect(result.completedCount).toBe(0);
  });
});

describe('接口契约：createOrder 返回 orderId/orderNo', () => {
  let service: OrderService;
  let mockPrisma: any;

  beforeEach(() => {
    ({ service, mockPrisma } = createService());
  });

  it('create 返回支付判断字段，且不返回完整 order 对象', async () => {
    mockPrisma.userAddress.findFirst.mockResolvedValue(ADDRESS);
    mockPrisma.productSku.findFirst.mockResolvedValue(SKU(10));

    setupTransaction(mockPrisma);
    mockPrisma._mockTx.productSku.updateMany.mockResolvedValue({ count: 1 });
    mockPrisma._mockTx.productSku.findFirst.mockResolvedValue({ productId: BigInt(300), stock: 9 });
    mockPrisma._mockTx.productStockLog.create.mockResolvedValue({});
    mockPrisma._mockTx.order.create.mockResolvedValue({
      id: BigInt(42), orderNo: 'XY20260523001', status: OrderStatus.pending_payment, orderItems: [],
    });
    mockPrisma._mockTx.orderPayment.create.mockResolvedValue({});
    mockPrisma.cart.deleteMany.mockResolvedValue({ count: 1 });

    const result = await service.create('100', {
      addressId: '1', items: [{ skuId: '200', quantity: 1 }],
    });

    expect(result).toHaveProperty('orderId', '42');
    expect(result).toHaveProperty('orderNo', 'XY20260523001');
    expect(result.payAmount).toBeGreaterThan(0);
    expect(result).toHaveProperty('isZeroPay', false);
    expect(result).toHaveProperty('status', OrderStatus.pending_payment);
    expect(result).toHaveProperty('fulfillmentType', 'delivery');
    expect(result).not.toHaveProperty('orderItems');
    expect(result).not.toHaveProperty('userId');
  });
});

describe('接口契约：订单列表/详情字段映射', () => {
  let service: OrderService;
  let mockPrisma: any;

  const ORDER_WITH_ITEMS = {
    id: BigInt(1), orderNo: 'XY20260523001', status: OrderStatus.pending_payment,
    totalAmount: 9900, discountAmount: 0, couponAmount: 0, activityDiscountAmount: 0,
    pointsAmount: 0, freightAmount: 0, payAmount: 9900,
    receiverName: '张三', receiverPhone: '13800138000',
    province: '北京', city: '北京', district: '朝阳区', detailAddress: 'xxx路1号',
    remark: null, couponId: null,
    createdAt: new Date('2026-05-23T10:00:00Z'), paidAt: null, shippedAt: null, deliveredAt: null, completedAt: null,
    orderItems: [{
      id: BigInt(10), orderId: BigInt(1), productId: BigInt(300), skuId: BigInt(200),
      productName: '测试商品', skuSpecs: '红色/L', productImage: 'img.jpg',
      price: 9900, originalPrice: 12900, quantity: 1, subtotal: 9900,
      activityId: null, supplierId: null,
    }],
    payment: null, delivery: null, orderLogs: [], user: null,
  };

  beforeEach(() => {
    ({ service, mockPrisma } = createService());
  });

  it('findByUser 返回 list[0].items（不是 orderItems）', async () => {
    mockPrisma.order.findMany.mockResolvedValue([ORDER_WITH_ITEMS]);
    mockPrisma.order.count.mockResolvedValue(1);

    const result = await service.findByUser('100', { skip: 0, take: 10, page: 1, pageSize: 10 });

    expect(result.list[0]).toHaveProperty('items');
    expect(result.list[0]).not.toHaveProperty('orderItems');
    expect(result.list[0].items[0]).toHaveProperty('skuName', '红色/L');
    expect(result.list[0].items[0]).toHaveProperty('productName', '测试商品');
  });

  it('findById 返回 items/addressName/addressPhone/addressDetail/createTime', async () => {
    mockPrisma.order.findFirst.mockResolvedValue(ORDER_WITH_ITEMS);

    const result = await service.findById('100', '1');

    expect(result).toHaveProperty('items');
    expect(result).toHaveProperty('addressName', '张三');
    expect(result).toHaveProperty('addressPhone', '13800138000');
    expect(result).toHaveProperty('addressDetail');
    expect(result).toHaveProperty('createTime');
    expect(result).not.toHaveProperty('orderItems');
    expect(result).not.toHaveProperty('receiverName');
  });

  it('findById 使用 deliveredAt 输出 deliveryTime/shipTime，并读取 logisticsInfo 数组', async () => {
    const deliveredAt = new Date('2026-05-23T11:00:00Z');
    mockPrisma.order.findFirst.mockResolvedValue({
      ...ORDER_WITH_ITEMS,
      status: OrderStatus.delivered,
      deliveredAt,
      delivery: {
        id: BigInt(20),
        orderId: BigInt(1),
        logisticsCompany: '顺丰速运',
        logisticsNo: 'SF123',
        logisticsInfo: [{ time: '2026-05-23 18:00:00', content: '已签收' }],
      },
    });

    const result = await service.findById('100', '1');

    expect(result.deliveryTime).toBe(new Date(deliveredAt).toLocaleString('zh-CN'));
    expect(result.shipTime).toBe(new Date(deliveredAt).toLocaleString('zh-CN'));
    expect(result.logistics).toEqual(expect.objectContaining({
      company: '顺丰速运',
      trackingNo: 'SF123',
      traces: [{ time: '2026-05-23 18:00:00', content: '已签收' }],
    }));
  });

  it('findById 安全兼容 logisticsInfo JSON 字符串、空值和非法字符串', async () => {
    const logisticsInfoCases = [
      { input: JSON.stringify({ traces: [{ time: 't1', content: '运输中' }] }), expected: [{ time: 't1', content: '运输中' }] },
      { input: JSON.stringify([{ time: 't2', content: '派送中' }]), expected: [{ time: 't2', content: '派送中' }] },
      { input: null, expected: [] },
      { input: '{bad-json', expected: [] },
    ];

    for (const item of logisticsInfoCases) {
      mockPrisma.order.findFirst.mockResolvedValue({
        ...ORDER_WITH_ITEMS,
        delivery: {
          id: BigInt(20),
          orderId: BigInt(1),
          logisticsCompany: '顺丰速运',
          logisticsNo: 'SF123',
          logisticsInfo: item.input,
        },
      });

      await expect(service.findById('100', '1')).resolves.toEqual(
        expect.objectContaining({
          logistics: expect.objectContaining({ traces: item.expected }),
        }),
      );
    }
  });

  it('findAllAdmin 也返回 items 而非 orderItems', async () => {
    mockPrisma.order.findMany.mockResolvedValue([ORDER_WITH_ITEMS]);
    mockPrisma.order.count.mockResolvedValue(1);

    const result = await service.findAllAdmin({ skip: 0, take: 10, page: 1, pageSize: 10 });

    expect(result.list[0]).toHaveProperty('items');
    expect(result.list[0]).not.toHaveProperty('orderItems');
  });
});

describe('接口契约：售后申请 orderItemId 必传', () => {
  it('DTO orderItemId 为空字符串时校验不通过', async () => {
    const { CreateAftersaleDto } = await import('../aftersale/dto/create-aftersale.dto');
    const dto = new CreateAftersaleDto();
    dto.orderItemId = '';
    dto.type = 1;
    dto.reason = '不想要了';

    const { validate } = await import('class-validator');
    const errors = await validate(dto);
    const orderItemIdErrors = errors.filter(e => e.property === 'orderItemId');
    expect(orderItemIdErrors.length).toBeGreaterThan(0);
  });

  it('DTO type=3 换货时校验不通过', async () => {
    const { CreateAftersaleDto } = await import('../aftersale/dto/create-aftersale.dto');
    const dto = new CreateAftersaleDto();
    dto.orderItemId = '10';
    dto.type = 3;
    dto.reason = '不想要了';

    const { validate } = await import('class-validator');
    const errors = await validate(dto);
    const typeErrors = errors.filter(e => e.property === 'type');
    expect(typeErrors.length).toBeGreaterThan(0);
  });
});

describe('接口契约：后台订单日期筛选', () => {
  let service: OrderService;
  let mockPrisma: any;

  beforeEach(() => {
    ({ service, mockPrisma } = createService());
  });

  it('findAllAdmin 传 startDate/endDate 字符串可正常查询', async () => {
    mockPrisma.order.findMany.mockResolvedValue([]);
    mockPrisma.order.count.mockResolvedValue(0);

    await service.findAllAdmin({ skip: 0, take: 10, page: 1, pageSize: 10, startDate: '2026-05-01', endDate: '2026-05-31' });

    expect(mockPrisma.order.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          createdAt: expect.objectContaining({
            gte: expect.any(Date),
            lte: expect.any(Date),
          }),
        }),
      }),
    );
  });
});

describe('接口契约：后台订单 fulfillmentType 筛选', () => {
  let service: OrderService;
  let mockPrisma: any;

  beforeEach(() => {
    ({ service, mockPrisma } = createService());
  });

  it('findAllAdmin 支持 fulfillmentType 筛选', async () => {
    mockPrisma.order.findMany.mockResolvedValue([]);
    mockPrisma.order.count.mockResolvedValue(0);

    await service.findAllAdmin({
      skip: 0,
      take: 10,
      page: 1,
      pageSize: 10,
      fulfillmentType: 'pickup',
    });

    expect(mockPrisma.order.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          fulfillmentType: 'pickup',
        }),
      }),
    );
  });

  it('findDeliveryList 支持 fulfillmentType + 时间筛选', async () => {
    mockPrisma.order.findMany.mockResolvedValue([]);
    mockPrisma.order.count.mockResolvedValue(0);

    await service.findDeliveryList({
      skip: 0,
      take: 10,
      page: 1,
      pageSize: 10,
      fulfillmentType: 'delivery',
      startDate: '2026-05-01',
      endDate: '2026-05-31',
    });

    expect(mockPrisma.order.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: OrderStatus.pending_delivery,
          fulfillmentType: 'delivery',
          createdAt: expect.objectContaining({
            gte: expect.any(Date),
            lte: expect.any(Date),
          }),
        }),
      }),
    );
  });

  it('exportOrders 支持 fulfillmentType 筛选并返回导出字段', async () => {
    mockPrisma.order.findMany.mockResolvedValue([
      {
        orderNo: 'XY202605270001',
        status: OrderStatus.pending_delivery,
        fulfillmentType: 'delivery',
        totalAmount: 1000,
        discountAmount: 100,
        freightAmount: 10,
        pointsAmount: 5,
        payAmount: 905,
        receiverName: '张三',
        receiverPhone: '13800138000',
        province: '山东省',
        city: '临沂市',
        district: '兰山区',
        detailAddress: '测试路1号',
        createdAt: new Date('2026-05-27T10:00:00.000Z'),
        paidAt: new Date('2026-05-27T10:05:00.000Z'),
        orderItems: [
          { productName: '奶粉', skuSpecs: '1段', quantity: 2 },
        ],
        user: { nickname: '测试用户', phone: '13800138000' },
      },
    ]);

    const rows = await service.exportOrders({
      skip: 0,
      take: 10,
      page: 1,
      pageSize: 10,
      fulfillmentType: 'delivery',
    });

    expect(mockPrisma.order.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          fulfillmentType: 'delivery',
        }),
      }),
    );
    expect(rows[0]).toEqual(
      expect.objectContaining({
        orderNo: 'XY202605270001',
        userNickname: '测试用户',
        itemCount: 2,
        itemDetails: expect.stringContaining('奶粉'),
      }),
    );
  });

  it('exportOrders 当 skuSpecs 为对象时，商品明细可读', async () => {
    mockPrisma.order.findMany.mockResolvedValue([
      {
        orderNo: 'XY202605280001',
        status: OrderStatus.pending_delivery,
        fulfillmentType: 'delivery',
        totalAmount: 1000,
        discountAmount: 0,
        freightAmount: 10,
        pointsAmount: 0,
        payAmount: 1010,
        receiverName: '李四',
        receiverPhone: '13900139000',
        province: '山东省',
        city: '临沂市',
        district: '兰山区',
        detailAddress: '测试路2号',
        createdAt: new Date('2026-05-28T10:00:00.000Z'),
        paidAt: null,
        orderItems: [
          { productName: '营养米粉', skuSpecs: { 规格: '500g', 阶段: '6个月+' }, quantity: 2 },
        ],
        user: { nickname: '测试用户2', phone: '13900139000' },
      },
    ]);

    const rows = await service.exportOrders({
      skip: 0,
      take: 10,
      page: 1,
      pageSize: 10,
      fulfillmentType: 'delivery',
    });

    expect(rows[0].itemDetails).toContain('营养米粉（规格：500g / 阶段：6个月+）x2');
  });
});

describe('OrderService.create 0元订单', () => {
  let service: OrderService;
  let mockPrisma: any;

  const PICKUP_STORE = {
    id: BigInt(500), name: '测试自提点', province: '北京', city: '北京', district: '朝阳区',
    address: 'xxx路2号', contactPhone: '010-12345678', status: 1, deletedAt: null,
  };

  const ZERO_PAY_COUPON = {
    id: BigInt(50), userId: BigInt(100), couponId: BigInt(10), status: COUPON_STATUS.FREE,
    expireAt: new Date(Date.now() + 86400000),
    coupon: { id: BigInt(10), type: 1, value: 9900, minAmount: 0, discountLimit: null },
  };

  const SKU_CHEAP = (stock = 10) => ({
    id: BigInt(201), productId: BigInt(300), specs: '蓝色/M', image: null, price: 9900, originalPrice: 12900,
    product: { id: BigInt(300), name: '便宜商品', status: 1, supplierId: null },
    stock,
  });

  beforeEach(() => {
    ({ service, mockPrisma } = createService());
  });

  it('0元快递订单：状态为 pending_delivery，paidAt 已写入，autoCloseAt 为 null', async () => {
    mockPrisma.userAddress.findFirst.mockResolvedValue(ADDRESS);
    mockPrisma.productSku.findFirst.mockResolvedValue(SKU_CHEAP(10));
    mockPrisma.userCoupon.findFirst.mockResolvedValue(ZERO_PAY_COUPON);

    setupTransaction(mockPrisma);
    mockPrisma._mockTx.productSku.updateMany.mockResolvedValue({ count: 1 });
    mockPrisma._mockTx.productSku.findFirst.mockResolvedValue({ productId: BigInt(300), stock: 9 });
    mockPrisma._mockTx.productStockLog.create.mockResolvedValue({});
    mockPrisma._mockTx.userCoupon.updateMany.mockResolvedValue({ count: 1 });
    mockPrisma._mockTx.order.create.mockResolvedValue({
      id: BigInt(1), orderNo: 'XY20260523001', status: OrderStatus.pending_delivery, orderItems: [],
    });
    mockPrisma._mockTx.userCoupon.update.mockResolvedValue({});
    mockPrisma._mockTx.orderPayment.create.mockResolvedValue({});
    mockPrisma._mockTx.orderLog.create.mockResolvedValue({});
    mockPrisma.cart.deleteMany.mockResolvedValue({ count: 1 });

    const result = await service.create('100', {
      addressId: '1',
      couponId: '50',
      items: [{ skuId: '201', quantity: 1 }],
    });

    const createCall = mockPrisma._mockTx.order.create.mock.calls[0][0];
    expect(createCall.data.status).toBe(OrderStatus.pending_delivery);
    expect(createCall.data.paidAt).toBeInstanceOf(Date);
    expect(createCall.data.autoCloseAt).toBeUndefined();
    expect(result).toEqual(expect.objectContaining({
      orderId: '1',
      orderNo: 'XY20260523001',
      payAmount: 0,
      isZeroPay: true,
      status: OrderStatus.pending_delivery,
      fulfillmentType: 'delivery',
    }));
  });

  it('0元自提订单：状态为 pending_pickup 且有 pickupCode', async () => {
    mockPrisma.pickupStore = { findFirst: jest.fn() };
    mockPrisma.pickupStore.findFirst.mockResolvedValue(PICKUP_STORE);
    mockPrisma.productSku.findFirst.mockResolvedValue(SKU_CHEAP(10));
    mockPrisma.userCoupon.findFirst.mockResolvedValue(ZERO_PAY_COUPON);

    setupTransaction(mockPrisma);
    mockPrisma._mockTx.productSku.updateMany.mockResolvedValue({ count: 1 });
    mockPrisma._mockTx.productSku.findFirst.mockResolvedValue({ productId: BigInt(300), stock: 9 });
    mockPrisma._mockTx.productStockLog.create.mockResolvedValue({});
    mockPrisma._mockTx.userCoupon.updateMany.mockResolvedValue({ count: 1 });
    mockPrisma._mockTx.order.create.mockResolvedValue({
      id: BigInt(1), orderNo: 'XY20260523002', status: OrderStatus.pending_pickup, orderItems: [],
    });
    mockPrisma._mockTx.userCoupon.update.mockResolvedValue({});
    mockPrisma._mockTx.orderPayment.create.mockResolvedValue({});
    mockPrisma._mockTx.orderLog.create.mockResolvedValue({});
    mockPrisma.cart.deleteMany.mockResolvedValue({ count: 1 });

    jest.spyOn(service, 'generatePickupCode' as any).mockResolvedValue('12345678');
    mockPrisma._mockTx.order.updateMany.mockResolvedValue({ count: 1 });

    const result = await service.create('100', {
      fulfillmentType: 'pickup',
      pickupStoreId: '500',
      couponId: '50',
      items: [{ skuId: '201', quantity: 1 }],
    });

    const createCall = mockPrisma._mockTx.order.create.mock.calls[0][0];
    expect(createCall.data.status).toBe(OrderStatus.pending_pickup);
    expect(createCall.data.pickupCode).toBeUndefined();
    expect(createCall.data.paidAt).toBeInstanceOf(Date);
    expect(createCall.data.autoCloseAt).toBeUndefined();
    expect(mockPrisma._mockTx.order.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: BigInt(1), pickupCode: null },
        data: { pickupCode: '12345678' },
      }),
    );
    expect(result).toEqual(expect.objectContaining({
      orderId: '1',
      orderNo: 'XY20260523002',
      payAmount: 0,
      isZeroPay: true,
      status: OrderStatus.pending_pickup,
      fulfillmentType: 'pickup',
    }));
  });

  it('0元订单 OrderPayment 为 SUCCESS 状态，paymentMethod=zero_pay，amount=0', async () => {
    mockPrisma.userAddress.findFirst.mockResolvedValue(ADDRESS);
    mockPrisma.productSku.findFirst.mockResolvedValue(SKU_CHEAP(10));
    mockPrisma.userCoupon.findFirst.mockResolvedValue(ZERO_PAY_COUPON);

    setupTransaction(mockPrisma);
    mockPrisma._mockTx.productSku.updateMany.mockResolvedValue({ count: 1 });
    mockPrisma._mockTx.productSku.findFirst.mockResolvedValue({ productId: BigInt(300), stock: 9 });
    mockPrisma._mockTx.productStockLog.create.mockResolvedValue({});
    mockPrisma._mockTx.userCoupon.updateMany.mockResolvedValue({ count: 1 });
    mockPrisma._mockTx.order.create.mockResolvedValue({
      id: BigInt(1), orderNo: 'XY20260523003', orderItems: [],
    });
    mockPrisma._mockTx.userCoupon.update.mockResolvedValue({});
    mockPrisma._mockTx.orderPayment.create.mockResolvedValue({});
    mockPrisma._mockTx.orderLog.create.mockResolvedValue({});
    mockPrisma.cart.deleteMany.mockResolvedValue({ count: 1 });

    await service.create('100', {
      addressId: '1',
      couponId: '50',
      items: [{ skuId: '201', quantity: 1 }],
    });

    expect(mockPrisma._mockTx.orderPayment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          paymentMethod: 'zero_pay',
          status: PAYMENT_STATUS.SUCCESS,
          amount: 0,
          paidAt: expect.any(Date),
        }),
      }),
    );
  });

  it('0元订单日志 action=pay_zero_amount', async () => {
    mockPrisma.userAddress.findFirst.mockResolvedValue(ADDRESS);
    mockPrisma.productSku.findFirst.mockResolvedValue(SKU_CHEAP(10));
    mockPrisma.userCoupon.findFirst.mockResolvedValue(ZERO_PAY_COUPON);

    setupTransaction(mockPrisma);
    mockPrisma._mockTx.productSku.updateMany.mockResolvedValue({ count: 1 });
    mockPrisma._mockTx.productSku.findFirst.mockResolvedValue({ productId: BigInt(300), stock: 9 });
    mockPrisma._mockTx.productStockLog.create.mockResolvedValue({});
    mockPrisma._mockTx.userCoupon.updateMany.mockResolvedValue({ count: 1 });
    mockPrisma._mockTx.order.create.mockResolvedValue({
      id: BigInt(1), orderNo: 'XY20260523004', orderItems: [],
    });
    mockPrisma._mockTx.userCoupon.update.mockResolvedValue({});
    mockPrisma._mockTx.orderPayment.create.mockResolvedValue({});
    mockPrisma._mockTx.orderLog.create.mockResolvedValue({});
    mockPrisma.cart.deleteMany.mockResolvedValue({ count: 1 });

    await service.create('100', {
      addressId: '1',
      couponId: '50',
      items: [{ skuId: '201', quantity: 1 }],
    });

    expect(mockPrisma._mockTx.orderLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'pay_zero_amount',
          content: '0元订单自动支付成功',
        }),
      }),
    );
  });

  it('0元订单优惠券从 LOCKED 变为 USED', async () => {
    mockPrisma.userAddress.findFirst.mockResolvedValue(ADDRESS);
    mockPrisma.productSku.findFirst.mockResolvedValue(SKU_CHEAP(10));
    mockPrisma.userCoupon.findFirst.mockResolvedValue(ZERO_PAY_COUPON);

    setupTransaction(mockPrisma);
    mockPrisma._mockTx.productSku.updateMany.mockResolvedValue({ count: 1 });
    mockPrisma._mockTx.productSku.findFirst.mockResolvedValue({ productId: BigInt(300), stock: 9 });
    mockPrisma._mockTx.productStockLog.create.mockResolvedValue({});
    mockPrisma._mockTx.userCoupon.updateMany.mockResolvedValue({ count: 1 });
    mockPrisma._mockTx.order.create.mockResolvedValue({
      id: BigInt(1), orderNo: 'XY20260523005', orderItems: [],
    });
    mockPrisma._mockTx.userCoupon.update.mockResolvedValue({});
    mockPrisma._mockTx.orderPayment.create.mockResolvedValue({});
    mockPrisma._mockTx.orderLog.create.mockResolvedValue({});
    mockPrisma.cart.deleteMany.mockResolvedValue({ count: 1 });

    await service.create('100', {
      addressId: '1',
      couponId: '50',
      items: [{ skuId: '201', quantity: 1 }],
    });

    const couponUpdateCalls = mockPrisma._mockTx.userCoupon.update.mock.calls;
    const usedCall = couponUpdateCalls.find((call: any) =>
      call[0].data.status === COUPON_STATUS.USED
    );
    expect(usedCall).toBeDefined();
    expect(usedCall[0].data.usedAt).toBeInstanceOf(Date);
  });

  it('0元订单积分抵扣记录正确', async () => {
    mockPrisma.userAddress.findFirst.mockResolvedValue(ADDRESS);
    mockPrisma.productSku.findFirst.mockResolvedValue(SKU_CHEAP(10));
    mockPrisma.user.findFirst.mockResolvedValue(USER);
    mockPrisma.userCoupon.findFirst.mockResolvedValue(ZERO_PAY_COUPON);

    setupTransaction(mockPrisma);
    mockPrisma._mockTx.productSku.updateMany.mockResolvedValue({ count: 1 });
    mockPrisma._mockTx.productSku.findFirst.mockResolvedValue({ productId: BigInt(300), stock: 9 });
    mockPrisma._mockTx.productStockLog.create.mockResolvedValue({});
    mockPrisma._mockTx.user.findFirst.mockResolvedValue(USER);
    mockPrisma._mockTx.user.update.mockResolvedValue({});
    mockPrisma._mockTx.pointsRecord.create.mockResolvedValue({});
    mockPrisma._mockTx.userCoupon.updateMany.mockResolvedValue({ count: 1 });
    mockPrisma._mockTx.order.create.mockResolvedValue({
      id: BigInt(1), orderNo: 'XY20260523006', orderItems: [],
    });
    mockPrisma._mockTx.userCoupon.update.mockResolvedValue({});
    mockPrisma._mockTx.orderPayment.create.mockResolvedValue({});
    mockPrisma._mockTx.orderLog.create.mockResolvedValue({});
    mockPrisma.cart.deleteMany.mockResolvedValue({ count: 1 });

    await service.create('100', {
      addressId: '1',
      couponId: '50',
      pointsDeduct: 100,
      items: [{ skuId: '201', quantity: 1 }],
    });

    expect(mockPrisma._mockTx.pointsRecord.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          source: 'order_deduct',
          type: 2,
        }),
      }),
    );
  });

  it('非0元订单仍为 pending_payment 且有 autoCloseAt', async () => {
    mockPrisma.userAddress.findFirst.mockResolvedValue(ADDRESS);
    mockPrisma.productSku.findFirst.mockResolvedValue(SKU(10));

    setupTransaction(mockPrisma);
    mockPrisma._mockTx.productSku.updateMany.mockResolvedValue({ count: 1 });
    mockPrisma._mockTx.productSku.findFirst.mockResolvedValue({ productId: BigInt(300), stock: 9 });
    mockPrisma._mockTx.productStockLog.create.mockResolvedValue({});
    mockPrisma._mockTx.order.create.mockResolvedValue({
      id: BigInt(1), orderNo: 'XY20260523007', orderItems: [],
    });
    mockPrisma._mockTx.orderPayment.create.mockResolvedValue({});
    mockPrisma.cart.deleteMany.mockResolvedValue({ count: 1 });

    await service.create('100', {
      addressId: '1',
      items: [{ skuId: '200', quantity: 1 }],
    });

    const createCall = mockPrisma._mockTx.order.create.mock.calls[0][0];
    expect(createCall.data.status).toBe(OrderStatus.pending_payment);
    expect(createCall.data.autoCloseAt).toBeInstanceOf(Date);
    expect(createCall.data.paidAt).toBeUndefined();

    expect(mockPrisma._mockTx.orderPayment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          paymentMethod: 'wechat',
          status: PAYMENT_STATUS.CREATED,
        }),
      }),
    );
  });
});

describe('OrderService.confirm isZeroPay', () => {
  let service: OrderService;
  let mockPrisma: any;

  beforeEach(() => {
    ({ service, mockPrisma } = createService());
  });

  it('confirm 返回 isZeroPay: true 当 payAmount === 0', async () => {
    const SKU_CHEAP = {
      id: BigInt(201), productId: BigInt(300), specs: '蓝色/M', image: null, price: 9900, originalPrice: 12900,
      product: { id: BigInt(300), name: '便宜商品', status: 1, supplierId: null },
      stock: 10,
    };
    const ZERO_PAY_COUPON = {
      id: BigInt(50), userId: BigInt(100), couponId: BigInt(10), status: COUPON_STATUS.FREE,
      expireAt: new Date(Date.now() + 86400000),
      coupon: { id: BigInt(10), type: 1, value: 9900, minAmount: 0, discountLimit: null },
    };
    mockPrisma.productSku.findFirst.mockResolvedValue(SKU_CHEAP);
    mockPrisma.userCoupon.findFirst.mockResolvedValue(ZERO_PAY_COUPON);

    const result = await service.confirm('100', {
      items: [{ skuId: '201', quantity: 1 }],
      couponId: '50',
      addressId: '1',
    });

    expect(result.isZeroPay).toBe(true);
    expect(result.payAmount).toBe(0);
  });

  it('confirm 返回 isZeroPay: false 当 payAmount > 0', async () => {
    mockPrisma.productSku.findFirst.mockResolvedValue(SKU(10));

    const result = await service.confirm('100', {
      items: [{ skuId: '200', quantity: 1 }],
      addressId: '1',
    });

    expect(result.isZeroPay).toBe(false);
    expect(result.payAmount).toBeGreaterThan(0);
  });
});

describe('generatePickupCode', () => {
  let service: OrderService;
  let mockPrisma: any;

  beforeEach(() => {
    const { service: s, mockPrisma: p } = createService();
    service = s;
    mockPrisma = p;
  });

  it('生成 8 位数字自提码', async () => {
    mockPrisma.order.findFirst.mockResolvedValue(null);
    const code = await service.generatePickupCode();
    expect(code).toMatch(/^\d{8}$/);
  });

  it('findFirst 返回 null 时直接返回码', async () => {
    mockPrisma.order.findFirst.mockResolvedValue(null);
    const code = await service.generatePickupCode();
    expect(code).toBeDefined();
    expect(mockPrisma.order.findFirst).toHaveBeenCalledTimes(1);
  });

  it('碰撞时重试直到成功', async () => {
    mockPrisma.order.findFirst
      .mockResolvedValueOnce({ id: BigInt(1) })
      .mockResolvedValueOnce({ id: BigInt(2) })
      .mockResolvedValueOnce(null);
    const code = await service.generatePickupCode();
    expect(code).toMatch(/^\d{8}$/);
    expect(mockPrisma.order.findFirst).toHaveBeenCalledTimes(3);
  });

  it('超过最大重试次数抛出 InternalServerErrorException', async () => {
    mockPrisma.order.findFirst.mockResolvedValue({ id: BigInt(1) });
    await expect(service.generatePickupCode(3)).rejects.toThrow(InternalServerErrorException);
    await expect(service.generatePickupCode(3)).rejects.toThrow('自提码生成失败，请重试');
    expect(mockPrisma.order.findFirst).toHaveBeenCalledTimes(6);
  });

  it('默认最大重试次数为 5', async () => {
    mockPrisma.order.findFirst.mockResolvedValue({ id: BigInt(1) });
    await expect(service.generatePickupCode()).rejects.toThrow(InternalServerErrorException);
    expect(mockPrisma.order.findFirst).toHaveBeenCalledTimes(5);
  });

  it('0 元自提订单路径通过 assignUniquePickupCode 生成自提码', async () => {
    const PICKUP_STORE = {
      id: BigInt(500), name: '测试自提点', province: '北京', city: '北京', district: '朝阳区',
      address: 'xxx路2号', contactPhone: '010-12345678', status: 1, deletedAt: null,
    };
    const ZERO_PAY_COUPON = {
      id: BigInt(50), userId: BigInt(100), couponId: BigInt(10), status: COUPON_STATUS.FREE,
      expireAt: new Date(Date.now() + 86400000),
      coupon: { id: BigInt(10), type: 1, value: 9900, minAmount: 0, discountLimit: null },
    };
    const SKU_CHEAP = (stock = 10) => ({
      id: BigInt(201), productId: BigInt(300), specs: '蓝色/M', image: null, price: 9900, originalPrice: 12900,
      product: { id: BigInt(300), name: '便宜商品', status: 1, supplierId: null },
      stock,
    });

    mockPrisma.pickupStore = { findFirst: jest.fn() };
    mockPrisma.pickupStore.findFirst.mockResolvedValue(PICKUP_STORE);
    mockPrisma.productSku.findFirst.mockResolvedValue(SKU_CHEAP(10));
    mockPrisma.userCoupon.findFirst.mockResolvedValue(ZERO_PAY_COUPON);

    setupTransaction(mockPrisma);
    mockPrisma._mockTx.productSku.updateMany.mockResolvedValue({ count: 1 });
    mockPrisma._mockTx.productSku.findFirst.mockResolvedValue({ productId: BigInt(300), stock: 9 });
    mockPrisma._mockTx.productStockLog.create.mockResolvedValue({});
    mockPrisma._mockTx.userCoupon.updateMany.mockResolvedValue({ count: 1 });
    mockPrisma._mockTx.order.create.mockResolvedValue({
      id: BigInt(1), orderNo: 'XY20260523002', orderItems: [],
    });
    mockPrisma._mockTx.userCoupon.update.mockResolvedValue({});
    mockPrisma._mockTx.orderPayment.create.mockResolvedValue({});
    mockPrisma._mockTx.orderLog.create.mockResolvedValue({});
    mockPrisma.cart.deleteMany.mockResolvedValue({ count: 1 });

    mockPrisma.order.findFirst.mockResolvedValue(null);
    mockPrisma._mockTx.order.updateMany.mockResolvedValue({ count: 1 });

    await service.create('100', {
      fulfillmentType: 'pickup',
      pickupStoreId: '500',
      couponId: '50',
      items: [{ skuId: '201', quantity: 1 }],
    });

    const createCall = mockPrisma._mockTx.order.create.mock.calls[0][0];
    expect(createCall.data.status).toBe(OrderStatus.pending_pickup);
    expect(createCall.data.pickupCode).toBeUndefined();
    expect(createCall.data.paidAt).toBeInstanceOf(Date);
    expect(mockPrisma._mockTx.order.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: BigInt(1), pickupCode: null },
        data: expect.objectContaining({ pickupCode: expect.stringMatching(/^\d{8}$/) }),
      }),
    );
  });
});

describe('assignUniquePickupCode', () => {
  let service: OrderService;
  let mockPrisma: any;

  beforeEach(() => {
    const { service: s, mockPrisma: p } = createService();
    service = s;
    mockPrisma = p;
  });

  it('正常写入自提码并返回', async () => {
    mockPrisma.order.findFirst.mockResolvedValue(null);
    const updateMany = jest.fn<any>().mockResolvedValue({ count: 1 });
    const tx: any = { order: { updateMany } };
    const code = await service.assignUniquePickupCode(tx, BigInt(1));
    expect(code).toMatch(/^\d{8}$/);
    expect(updateMany).toHaveBeenCalledTimes(1);
    expect(updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: BigInt(1), pickupCode: null },
        data: { pickupCode: code },
      }),
    );
  });

  it('P2002 冲突时自动重试直到成功', async () => {
    mockPrisma.order.findFirst.mockResolvedValue(null);
    const p2002Error: any = Object.assign(new Error('Unique constraint failed'), {
      code: 'P2002',
      meta: { target: ['pickupCode'] },
    });
    const updateMany = jest.fn<any>();
    updateMany.mockRejectedValueOnce(p2002Error).mockResolvedValueOnce({ count: 1 });
    const tx: any = { order: { updateMany } };
    const code = await service.assignUniquePickupCode(tx, BigInt(1));
    expect(code).toMatch(/^\d{8}$/);
    expect(updateMany).toHaveBeenCalledTimes(2);
  });

  it('非 pickupCode 的 P2002 不重试，直接抛出', async () => {
    mockPrisma.order.findFirst.mockResolvedValue(null);
    const otherP2002: any = Object.assign(new Error('Unique constraint failed'), {
      code: 'P2002',
      meta: { target: ['orderNo'] },
    });
    const updateMany = jest.fn<any>().mockRejectedValue(otherP2002);
    const tx: any = { order: { updateMany } };
    await expect(service.assignUniquePickupCode(tx, BigInt(1), 3)).rejects.toThrow('Unique constraint failed');
    expect(updateMany).toHaveBeenCalledTimes(1);
  });

  it('非 P2002 错误不重试，直接抛出', async () => {
    mockPrisma.order.findFirst.mockResolvedValue(null);
    const updateMany = jest.fn<any>().mockRejectedValue(new Error('Connection lost'));
    const tx: any = { order: { updateMany } };
    await expect(service.assignUniquePickupCode(tx, BigInt(1), 3)).rejects.toThrow('Connection lost');
    expect(updateMany).toHaveBeenCalledTimes(1);
  });

  it('超过最大重试次数抛出 InternalServerErrorException', async () => {
    mockPrisma.order.findFirst.mockResolvedValue(null);
    const p2002Error: any = Object.assign(new Error('Unique constraint failed'), {
      code: 'P2002',
      meta: { target: ['pickupCode'] },
    });
    const updateMany = jest.fn<any>().mockRejectedValue(p2002Error);
    const tx: any = { order: { updateMany } };
    await expect(service.assignUniquePickupCode(tx, BigInt(1), 3)).rejects.toThrow(InternalServerErrorException);
    await expect(service.assignUniquePickupCode(tx, BigInt(1), 3)).rejects.toThrow('自提码写入失败，请重试');
    expect(updateMany).toHaveBeenCalledTimes(6);
  });

  it('updateMany count=0 时查询并返回已有 pickupCode', async () => {
    const updateMany = jest.fn<any>().mockResolvedValue({ count: 0 });
    const findUnique = jest.fn<any>().mockResolvedValue({ pickupCode: '87654321' });
    const tx: any = { order: { updateMany, findUnique } };
    const code = await service.assignUniquePickupCode(tx, BigInt(1));
    expect(code).toBe('87654321');
    expect(findUnique).toHaveBeenCalledWith({ where: { id: BigInt(1) }, select: { pickupCode: true } });
  });

  it('updateMany count=0 且查询 pickupCode 为空时继续重试', async () => {
    const updateMany = jest.fn<any>().mockResolvedValue({ count: 0 });
    const findUnique = jest.fn<any>().mockResolvedValue({ pickupCode: null });
    const tx: any = { order: { updateMany, findUnique } };
    await expect(service.assignUniquePickupCode(tx, BigInt(1), 2)).rejects.toThrow(InternalServerErrorException);
    expect(updateMany).toHaveBeenCalledTimes(2);
  });
});

describe('单号生成函数', () => {
  it('generatePaymentNo 格式为 PAY + 时间 + hex', async () => {
    const { generatePaymentNo } = await import('@baby-mall/shared');
    const no = generatePaymentNo();
    expect(no).toMatch(/^PAY\d{14}[0-9a-f]{6}$/);
  });

  it('generateRefundNo 格式为 REFUND + 时间 + hex', async () => {
    const { generateRefundNo } = await import('@baby-mall/shared');
    const no = generateRefundNo();
    expect(no).toMatch(/^REFUND\d{14}[0-9a-f]{6}$/);
  });

  it('generateOrderNo 格式为 XY + 时间 + hex', async () => {
    const { generateOrderNo } = await import('@baby-mall/shared');
    const no = generateOrderNo();
    expect(no).toMatch(/^XY\d{14}[0-9a-f]{6}$/);
  });

  it('generatePaymentNo 连续生成不重复', async () => {
    const { generatePaymentNo } = await import('@baby-mall/shared');
    const set = new Set<string>();
    for (let i = 0; i < 50; i++) {
      set.add(generatePaymentNo());
    }
    expect(set.size).toBe(50);
  });
});
