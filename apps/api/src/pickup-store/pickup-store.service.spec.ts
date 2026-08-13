import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { PickupStoreService } from './pickup-store.service';
import { NotFoundException } from '@nestjs/common';

function createMockPrisma() {
  const prisma: any = {
    pickupStore: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    },
    order: {
      count: jest.fn(),
    },
    $queryRaw: jest.fn(),
  };
  prisma.$transaction = jest.fn(async (callback: any) => callback(prisma));
  return prisma;
}

describe('PickupStoreService', () => {
  let service: PickupStoreService;
  let prisma: ReturnType<typeof createMockPrisma>;
  let orderService: { completePickupOrderByCode: any };

  beforeEach(() => {
    prisma = createMockPrisma();
    orderService = {
      completePickupOrderByCode: jest.fn(),
    };
    service = new PickupStoreService(prisma as any, orderService as any);
    jest.spyOn(service['logger'], 'log').mockImplementation(() => {});
  });

  describe('findPublished', () => {
    it('should return only enabled stores', async () => {
      prisma.pickupStore.findMany.mockResolvedValue([{
        id: 1n, name: '南山店', contactPhone: '0755-12345678',
        province: '广东省', city: '深圳市', district: '南山区',
        address: '科技园路1号', latitude: null, longitude: null,
        businessHours: '9:00-18:00', pickupNotice: null,
        status: 1, sortOrder: 0, createdAt: new Date(), updatedAt: new Date(),
      }]);
      prisma.pickupStore.count.mockResolvedValue(1);

      const result = await service.findPublished(1, 10);
      expect(result.list).toHaveLength(1);
      expect(result.list[0].name).toBe('南山店');
      expect(result.list[0].fullAddress).toBe('广东省深圳市南山区科技园路1号');
    });
  });

  describe('findById', () => {
    it('should throw NotFoundException for non-existent store', async () => {
      prisma.pickupStore.findFirst.mockResolvedValue(null);
      await expect(service.findById('999')).rejects.toThrow(NotFoundException);
    });
  });

  describe('create', () => {
    it('should create a pickup store', async () => {
      prisma.pickupStore.create.mockResolvedValue({
        id: 1n, name: '福田店', contactPhone: '0755-87654321',
        province: '广东省', city: '深圳市', district: '福田区',
        address: '深南大道1号', latitude: null, longitude: null,
        businessHours: '10:00-20:00', pickupNotice: null,
        status: 1, sortOrder: 0, createdAt: new Date(), updatedAt: new Date(),
      });

      const result = await service.create({
        name: '福田店', contactPhone: '0755-87654321',
        province: '广东省', city: '深圳市', district: '福田区',
        address: '深南大道1号', businessHours: '10:00-20:00',
      });

      expect(result.name).toBe('福田店');
    });
  });

  describe('delete', () => {
    it('fails closed when the pickup store vanished before the row lock', async () => {
      prisma.$queryRaw.mockResolvedValue([]);

      await expect(service.delete('1')).rejects.toThrow(NotFoundException);
      expect(prisma.order.count).not.toHaveBeenCalled();
      expect(prisma.pickupStore.update).not.toHaveBeenCalled();
    });

    it('blocks deletion while active pickup orders remain behind the same row lock', async () => {
      prisma.$queryRaw.mockResolvedValue([{ id: 1n }]);
      prisma.order.count.mockResolvedValue(1);

      await expect(service.delete('1')).rejects.toThrow('该自提点仍有未完成订单，请先停用并处理完成后再删除');
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(prisma.pickupStore.update).not.toHaveBeenCalled();
    });

    it('soft deletes only after the locked active-order check returns zero', async () => {
      prisma.$queryRaw.mockResolvedValue([{ id: 1n }]);
      prisma.order.count.mockResolvedValue(0);
      prisma.pickupStore.update.mockResolvedValue({
        id: 1n, name: '福田店', contactPhone: '0755-87654321',
        province: '广东省', city: '深圳市', district: '福田区',
        address: '深南大道1号', latitude: null, longitude: null,
        businessHours: '10:00-20:00', pickupNotice: null,
        status: 0, sortOrder: 0, createdAt: new Date(), updatedAt: new Date(),
      });

      const result = await service.delete('1');

      expect(prisma.order.count).toHaveBeenCalledWith({
        where: {
          pickupStoreId: 1n,
          status: { in: ['pending_payment', 'paid', 'pending_pickup', 'aftersale'] },
        },
      });
      expect(prisma.pickupStore.update).toHaveBeenCalledWith({
        where: { id: 1n },
        data: { status: 0, deletedAt: expect.any(Date) },
      });
      expect(result.status).toBe(0);
    });
  });

  describe('verifyPickupCode', () => {
    it('should throw NotFoundException for non-existent code', async () => {
      orderService.completePickupOrderByCode.mockRejectedValue(new NotFoundException('自提码不存在'));
      await expect(service.verifyPickupCode('000000', '1')).rejects.toThrow(NotFoundException);
    });

    it('should successfully verify a pending_pickup order', async () => {
      orderService.completePickupOrderByCode.mockResolvedValue({
        success: true,
        orderId: '1',
        orderNo: 'ORD202605260001',
        pickedUpAt: new Date(),
      });

      const result = await service.verifyPickupCode('654321', '1');

      expect(result.success).toBe(true);
      expect(result.orderNo).toBe('ORD202605260001');
      expect(orderService.completePickupOrderByCode).toHaveBeenCalledWith('654321', '1');
    });

    it('should forward duplicate verify error from order service', async () => {
      orderService.completePickupOrderByCode.mockRejectedValue(new Error('该订单已核销或订单状态已变化'));
      await expect(service.verifyPickupCode('654321', '1')).rejects.toThrow('该订单已核销或订单状态已变化');
    });
  });
});
