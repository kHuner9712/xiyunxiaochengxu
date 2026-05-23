import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { OrderStatus } from '@prisma/client';
import { OrderService } from './order.service';
import { COUPON_STATUS } from '../common/constants/payment';

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
    pointsRecord: { create: jest.fn() },
    userCoupon: { findFirst: jest.fn(), update: jest.fn() },
    order: { create: jest.fn(), update: jest.fn(), findFirst: jest.fn() },
    orderPayment: { create: jest.fn() },
    orderLog: { create: jest.fn() },
    orderDelivery: { update: jest.fn() },
    cart: { deleteMany: jest.fn() },
  };

  return {
    userAddress: { findFirst: jest.fn() },
    productSku: { findFirst: jest.fn() },
    user: { findFirst: jest.fn() },
    userCoupon: { findFirst: jest.fn() },
    order: { findFirst: jest.fn(), findMany: jest.fn(), count: jest.fn(), update: jest.fn() },
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
    mockPrisma._mockTx.productSku.findFirst.mockResolvedValue({ productId: BigInt(300) });
    mockPrisma._mockTx.productStockLog.create.mockResolvedValue({});
    mockPrisma._mockTx.order.create.mockResolvedValue({
      id: BigInt(1), orderNo: 'XY20260523001', orderItems: [],
    });
    mockPrisma._mockTx.orderPayment.create.mockResolvedValue({});
    mockPrisma.cart.deleteMany.mockResolvedValue({ count: 1 });

    const result = await service.create('100', {
      addressId: '1', items: [{ skuId: '200', quantity: 1 }],
    });

    expect(mockPrisma._mockTx.productSku.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ stock: { gte: 1 } }),
        data: expect.objectContaining({ stock: { decrement: 1 } }),
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

  it('下单时优惠券状态应为 LOCKED', async () => {
    mockPrisma.userAddress.findFirst.mockResolvedValue(ADDRESS);
    mockPrisma.productSku.findFirst.mockResolvedValue(SKU(10));
    mockPrisma.userCoupon.findFirst.mockResolvedValue(USER_COUPON);

    setupTransaction(mockPrisma);
    mockPrisma._mockTx.productSku.updateMany.mockResolvedValue({ count: 1 });
    mockPrisma._mockTx.productSku.findFirst.mockResolvedValue({ productId: BigInt(300) });
    mockPrisma._mockTx.productStockLog.create.mockResolvedValue({});
    mockPrisma._mockTx.userCoupon.update.mockResolvedValue({});
    mockPrisma._mockTx.order.create.mockResolvedValue({
      id: BigInt(1), orderNo: 'XY20260523001', orderItems: [],
    });
    mockPrisma._mockTx.orderPayment.create.mockResolvedValue({});
    mockPrisma.cart.deleteMany.mockResolvedValue({ count: 1 });

    await service.create('100', {
      addressId: '1', couponId: '50', items: [{ skuId: '200', quantity: 1 }],
    });

    expect(mockPrisma._mockTx.userCoupon.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: COUPON_STATUS.LOCKED }),
      }),
    );
  });

  it('已锁定的优惠券不能使用', async () => {
    mockPrisma.userAddress.findFirst.mockResolvedValue(ADDRESS);
    mockPrisma.productSku.findFirst.mockResolvedValue(SKU(10));
    mockPrisma.userCoupon.findFirst.mockResolvedValue(null);

    await expect(service.create('100', {
      addressId: '1', couponId: '50', items: [{ skuId: '200', quantity: 1 }],
    })).rejects.toThrow('优惠券不可用');
  });

  it('已使用的优惠券不能使用', async () => {
    mockPrisma.userAddress.findFirst.mockResolvedValue(ADDRESS);
    mockPrisma.productSku.findFirst.mockResolvedValue(SKU(10));
    mockPrisma.userCoupon.findFirst.mockResolvedValue(null);

    await expect(service.create('100', {
      addressId: '1', couponId: '50', items: [{ skuId: '200', quantity: 1 }],
    })).rejects.toThrow('优惠券不可用');
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
    mockPrisma._mockTx.productSku.findFirst.mockResolvedValue({ productId: BigInt(300) });
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

    setupTransaction(mockPrisma);
    mockPrisma._mockTx.productSku.findFirst.mockResolvedValue({ stock: 9 });
    mockPrisma._mockTx.productSku.update.mockResolvedValue({});
    mockPrisma._mockTx.productStockLog.create.mockResolvedValue({});
    mockPrisma._mockTx.user.findFirst.mockResolvedValue(USER);
    mockPrisma._mockTx.user.update.mockResolvedValue({});
    mockPrisma._mockTx.pointsRecord.create.mockResolvedValue({});
    mockPrisma._mockTx.userCoupon.findFirst.mockResolvedValue({ status: COUPON_STATUS.LOCKED });
    mockPrisma._mockTx.userCoupon.update.mockResolvedValue({});
    mockPrisma._mockTx.order.update.mockResolvedValue(CANCELLED_ORDER);

    await service.cancel('100', '1');

    expect(mockPrisma._mockTx.productSku.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ stock: { increment: 1 }, sales: { decrement: 1 } }),
      }),
    );
  });

  it('未支付订单取消释放积分', async () => {
    mockPrisma.order.findFirst.mockResolvedValue(PENDING_ORDER);

    setupTransaction(mockPrisma);
    mockPrisma._mockTx.productSku.findFirst.mockResolvedValue({ stock: 9 });
    mockPrisma._mockTx.productSku.update.mockResolvedValue({});
    mockPrisma._mockTx.productStockLog.create.mockResolvedValue({});
    mockPrisma._mockTx.user.findFirst.mockResolvedValue(USER);
    mockPrisma._mockTx.user.update.mockResolvedValue({});
    mockPrisma._mockTx.pointsRecord.create.mockResolvedValue({});
    mockPrisma._mockTx.userCoupon.findFirst.mockResolvedValue({ status: COUPON_STATUS.LOCKED });
    mockPrisma._mockTx.userCoupon.update.mockResolvedValue({});
    mockPrisma._mockTx.order.update.mockResolvedValue(CANCELLED_ORDER);

    await service.cancel('100', '1');

    expect(mockPrisma._mockTx.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ availablePoints: { increment: 500 } }),
      }),
    );
  });

  it('未支付订单取消释放优惠券（LOCKED -> FREE）', async () => {
    mockPrisma.order.findFirst.mockResolvedValue(PENDING_ORDER);

    setupTransaction(mockPrisma);
    mockPrisma._mockTx.productSku.findFirst.mockResolvedValue({ stock: 9 });
    mockPrisma._mockTx.productSku.update.mockResolvedValue({});
    mockPrisma._mockTx.productStockLog.create.mockResolvedValue({});
    mockPrisma._mockTx.user.findFirst.mockResolvedValue(USER);
    mockPrisma._mockTx.user.update.mockResolvedValue({});
    mockPrisma._mockTx.pointsRecord.create.mockResolvedValue({});
    mockPrisma._mockTx.userCoupon.findFirst.mockResolvedValue({ status: COUPON_STATUS.LOCKED });
    mockPrisma._mockTx.userCoupon.update.mockResolvedValue({});
    mockPrisma._mockTx.order.update.mockResolvedValue(CANCELLED_ORDER);

    await service.cancel('100', '1');

    expect(mockPrisma._mockTx.userCoupon.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: COUPON_STATUS.FREE }),
      }),
    );
  });

  it('已使用优惠券不释放', async () => {
    mockPrisma.order.findFirst.mockResolvedValue(PENDING_ORDER);

    setupTransaction(mockPrisma);
    mockPrisma._mockTx.productSku.findFirst.mockResolvedValue({ stock: 9 });
    mockPrisma._mockTx.productSku.update.mockResolvedValue({});
    mockPrisma._mockTx.productStockLog.create.mockResolvedValue({});
    mockPrisma._mockTx.user.findFirst.mockResolvedValue(USER);
    mockPrisma._mockTx.user.update.mockResolvedValue({});
    mockPrisma._mockTx.pointsRecord.create.mockResolvedValue({});
    mockPrisma._mockTx.userCoupon.findFirst.mockResolvedValue({ status: COUPON_STATUS.USED });
    mockPrisma._mockTx.order.update.mockResolvedValue(CANCELLED_ORDER);

    await service.cancel('100', '1');

    expect(mockPrisma._mockTx.userCoupon.update).not.toHaveBeenCalled();
  });
});

describe('OrderService.cancel 已支付订单不能走普通取消', () => {
  let service: OrderService;
  let mockPrisma: any;

  beforeEach(() => {
    ({ service, mockPrisma } = createService());
  });

  it('已支付订单不能取消', async () => {
    mockPrisma.order.findFirst.mockResolvedValue({
      id: BigInt(1), userId: BigInt(100), status: OrderStatus.pending_delivery,
      orderItems: [],
    });

    await expect(service.cancel('100', '1'))
      .rejects.toThrow();
  });

  it('已发货订单不能取消', async () => {
    mockPrisma.order.findFirst.mockResolvedValue({
      id: BigInt(1), userId: BigInt(100), status: OrderStatus.delivered,
      orderItems: [],
    });

    await expect(service.cancel('100', '1'))
      .rejects.toThrow();
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
    mockPrisma._mockTx.productSku.findFirst.mockResolvedValue({ stock: 9 });
    mockPrisma._mockTx.productSku.update.mockResolvedValue({});
    mockPrisma._mockTx.productStockLog.create.mockResolvedValue({});
    mockPrisma._mockTx.user.findFirst.mockResolvedValue(USER);
    mockPrisma._mockTx.user.update.mockResolvedValue({});
    mockPrisma._mockTx.pointsRecord.create.mockResolvedValue({});
    mockPrisma._mockTx.userCoupon.findFirst.mockResolvedValue({ status: COUPON_STATUS.LOCKED });
    mockPrisma._mockTx.userCoupon.update.mockResolvedValue({});
    mockPrisma._mockTx.order.update.mockResolvedValue(CANCELLED_ORDER);

    const result = await service.closeTimeoutOrders();

    expect(result.closedCount).toBe(1);
    expect(mockPrisma._mockTx.productSku.update).toHaveBeenCalled();
    expect(mockPrisma._mockTx.user.update).toHaveBeenCalled();
    expect(mockPrisma._mockTx.userCoupon.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: COUPON_STATUS.FREE }),
      }),
    );
  });

  it('无超时订单时返回 0', async () => {
    mockPrisma.order.findMany.mockResolvedValue([]);

    const result = await service.closeTimeoutOrders();

    expect(result.closedCount).toBe(0);
  });
});
