import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { AddressService } from './address.service';

function createMockPrisma() {
  return {
    userAddress: {
      findMany: jest.fn() as any,
      findFirst: jest.fn() as any,
      create: jest.fn() as any,
      update: jest.fn() as any,
      updateMany: jest.fn() as any,
      count: jest.fn() as any,
    },
  };
}

describe('AddressService', () => {
  let service: AddressService;
  let prisma: ReturnType<typeof createMockPrisma>;

  beforeEach(() => {
    prisma = createMockPrisma();
    service = new AddressService(prisma as any);
    jest.spyOn(service['logger'], 'log').mockImplementation(() => {});
  });

  describe('findAll', () => {
    it('should return address with name/phone/detail/isDefault(boolean) fields', async () => {
      prisma.userAddress.findMany.mockResolvedValue([{
        id: 1n,
        userId: 100n,
        receiverName: '张三',
        receiverPhone: '13800138000',
        province: '广东省',
        city: '深圳市',
        district: '南山区',
        detailAddress: '科技园路1号',
        isDefault: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      }]);

      const result = await service.findAll('100');
      const addr = result[0];

      expect(addr.name).toBe('张三');
      expect(addr.phone).toBe('13800138000');
      expect(addr.detail).toBe('科技园路1号');
      expect(addr.isDefault).toBe(true);
      expect(addr.receiverName).toBe('张三');
      expect(addr.receiverPhone).toBe('13800138000');
      expect(addr.detailAddress).toBe('科技园路1号');
      expect(addr.fullAddress).toBe('广东省深圳市南山区科技园路1号');
    });
  });

  describe('create', () => {
    it('should map name/phone/detail to receiverName/receiverPhone/detailAddress', async () => {
      prisma.userAddress.count.mockResolvedValue(0);
      prisma.userAddress.create.mockResolvedValue({
        id: 1n,
        userId: 100n,
        receiverName: '李四',
        receiverPhone: '13900139000',
        province: '北京市',
        city: '北京市',
        district: '朝阳区',
        detailAddress: '建国门外大街1号',
        isDefault: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await service.create('100', {
        name: '李四',
        phone: '13900139000',
        province: '北京市',
        city: '北京市',
        district: '朝阳区',
        detail: '建国门外大街1号',
        isDefault: false,
      });

      expect(prisma.userAddress.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            receiverName: '李四',
            receiverPhone: '13900139000',
            detailAddress: '建国门外大街1号',
          }),
        })
      );
    });

    it('should accept receiverName/receiverPhone/detailAddress directly', async () => {
      prisma.userAddress.count.mockResolvedValue(0);
      prisma.userAddress.create.mockResolvedValue({
        id: 1n,
        userId: 100n,
        receiverName: '王五',
        receiverPhone: '13700137000',
        province: '上海市',
        city: '上海市',
        district: '浦东新区',
        detailAddress: '陆家嘴环路1号',
        isDefault: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await service.create('100', {
        receiverName: '王五',
        receiverPhone: '13700137000',
        province: '上海市',
        city: '上海市',
        district: '浦东新区',
        detailAddress: '陆家嘴环路1号',
        isDefault: 1,
      });

      expect(prisma.userAddress.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            receiverName: '王五',
            receiverPhone: '13700137000',
            detailAddress: '陆家嘴环路1号',
          }),
        })
      );
    });
  });

  describe('ownership guard', () => {
    it('findById scopes lookup by current user id', async () => {
      prisma.userAddress.findFirst.mockResolvedValue(null);

      await expect(service.findById('100', '9')).rejects.toThrow('地址不存在');

      expect(prisma.userAddress.findFirst).toHaveBeenCalledWith({
        where: { id: 9n, userId: 100n, deletedAt: null },
      });
    });

    it('update refuses an address owned by another user before writing', async () => {
      prisma.userAddress.findFirst.mockResolvedValue(null);

      await expect(service.update('100', '9', { name: '越权' })).rejects.toThrow('地址不存在');

      expect(prisma.userAddress.update).not.toHaveBeenCalled();
    });

    it('delete refuses an address owned by another user before soft deletion', async () => {
      prisma.userAddress.findFirst.mockResolvedValue(null);

      await expect(service.delete('100', '9')).rejects.toThrow('地址不存在');

      expect(prisma.userAddress.update).not.toHaveBeenCalled();
    });
  });
});
