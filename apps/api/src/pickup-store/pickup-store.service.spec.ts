import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { PickupStoreService } from './pickup-store.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';

function createMockPrisma() {
  return {
    pickupStore: {
      findMany: jest.fn() as any,
      findFirst: jest.fn() as any,
      create: jest.fn() as any,
      update: jest.fn() as any,
      count: jest.fn() as any,
    },
    order: {
      findFirst: jest.fn() as any,
      update: jest.fn() as any,
    },
    orderLog: {
      create: jest.fn() as any,
    },
  };
}

describe('PickupStoreService', () => {
  let service: PickupStoreService;
  let prisma: ReturnType<typeof createMockPrisma>;

  beforeEach(() => {
    prisma = createMockPrisma();
    service = new PickupStoreService(prisma as any);
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

  describe('verifyPickupCode', () => {
    it('should throw NotFoundException for non-existent code', async () => {
      prisma.order.findFirst.mockResolvedValue(null);
      await expect(service.verifyPickupCode('000000', '1')).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException for non-pickup order', async () => {
      prisma.order.findFirst.mockResolvedValue({
        id: 1n, fulfillmentType: 'delivery', status: 'pending_delivery', pickupCode: '123456',
      });
      await expect(service.verifyPickupCode('123456', '1')).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException for already verified order', async () => {
      prisma.order.findFirst.mockResolvedValue({
        id: 1n, fulfillmentType: 'pickup', status: 'completed',
        pickupCode: '123456', pickedUpAt: new Date(),
      });
      await expect(service.verifyPickupCode('123456', '1')).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException for wrong status order', async () => {
      prisma.order.findFirst.mockResolvedValue({
        id: 1n, fulfillmentType: 'pickup', status: 'pending_payment',
        pickupCode: '123456', pickedUpAt: null,
      });
      await expect(service.verifyPickupCode('123456', '1')).rejects.toThrow(BadRequestException);
    });

    it('should successfully verify a pending_pickup order', async () => {
      prisma.order.findFirst.mockResolvedValue({
        id: 1n, orderNo: 'ORD202605260001', fulfillmentType: 'pickup',
        status: 'pending_pickup', pickupCode: '654321', pickedUpAt: null,
      });
      prisma.order.update.mockResolvedValue({
        id: 1n, status: 'completed', pickedUpAt: new Date(),
      });
      prisma.orderLog.create.mockResolvedValue({});

      const result = await service.verifyPickupCode('654321', '1');

      expect(result.success).toBe(true);
      expect(result.orderNo).toBe('ORD202605260001');
      expect(prisma.order.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'completed',
            pickedUpAt: expect.any(Date),
            pickupVerifiedBy: 1n,
          }),
        })
      );
      expect(prisma.orderLog.create).toHaveBeenCalled();
    });
  });
});
