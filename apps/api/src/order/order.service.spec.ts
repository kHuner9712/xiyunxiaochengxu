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
    pointsRecord: { create: jest.fn(), findFirst: jest.fn() },
    userCoupon: { findFirst: jest.fn(), update: jest.fn(), updateMany: jest.fn() },
    order: { create: jest.fn(), update: jest.fn(), updateMany: jest.fn(), findFirst: jest.fn() },
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
    order: { findFirst: jest.fn(), findMany: jest.fn(), count: jest.fn(), update: jest.fn(), updateMany: jest.fn() },
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

  it('下单时使用 updateMany 原子锁券（FREE -> LOCKED）', async () => {
    mockPrisma.userAddress.findFirst.mockResolvedValue(ADDRESS);
    mockPrisma.productSku.findFirst.mockResolvedValue(SKU(10));
    mockPrisma.userCoupon.findFirst.mockResolvedValue(USER_COUPON);

    setupTransaction(mockPrisma);
    mockPrisma._mockTx.productSku.updateMany.mockResolvedValue({ count: 1 });
    mockPrisma._mockTx.productSku.findFirst.mockResolvedValue({ productId: BigInt(300) });
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
    mockPrisma._mockTx.productSku.findFirst.mockResolvedValue({ productId: BigInt(300) });
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
    mockPrisma._mockTx.productSku.findFirst.mockResolvedValue({ productId: BigInt(300) });
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
    mockPrisma._mockTx.productSku.findFirst.mockResolvedValue({ productId: BigInt(300) });
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
        data: expect.objectContaining({ stock: { increment: 1 }, sales: { decrement: 1 } }),
      }),
    );
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

    expect(result.id).toBe('1');
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
    mockPrisma._mockTx.productSku.findFirst.mockResolvedValue({ productId: BigInt(300) });
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
        data: expect.objectContaining({ stock: { increment: 1 }, sales: { decrement: 1 } }),
      }),
    );
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

    const result = await service.confirmReceive('100', '1');

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
