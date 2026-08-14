import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { AddressService } from './address.service';

function createMockPrisma() {
  const prisma: any = {
    userAddress: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      count: jest.fn(),
    },
    businessEvent: {
      findFirst: jest.fn(),
      create: jest.fn(),
    },
    $queryRaw: jest.fn(),
  };
  prisma.$transaction = jest.fn(async (callback: any) => callback(prisma));
  return prisma;
}

function address(overrides: Record<string, any> = {}) {
  return {
    id: 1n,
    userId: 100n,
    receiverName: '李四',
    receiverPhone: '13900139000',
    province: '北京市',
    city: '北京市',
    district: '朝阳区',
    detailAddress: '建国门外大街1号',
    isDefault: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    ...overrides,
  };
}

const REQUEST_ID = '1760000000000-abcdefghijklmnopqrstuvwx';

describe('AddressService', () => {
  let service: AddressService;
  let prisma: ReturnType<typeof createMockPrisma>;

  beforeEach(() => {
    prisma = createMockPrisma();
    prisma.$queryRaw.mockResolvedValue([{ id: 100n }]);
    prisma.businessEvent.findFirst.mockResolvedValue(null);
    prisma.businessEvent.create.mockResolvedValue({ id: 99n });
    service = new AddressService(prisma as any);
    jest.spyOn(service['logger'], 'log').mockImplementation(() => {});
  });

  describe('findAll', () => {
    it('should return address with name/phone/detail/isDefault(boolean) fields', async () => {
      prisma.userAddress.findMany.mockResolvedValue([address({
        receiverName: '张三',
        receiverPhone: '13800138000',
        province: '广东省',
        city: '深圳市',
        district: '南山区',
        detailAddress: '科技园路1号',
      })]);

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
    it('should map name/phone/detail to receiverName/receiverPhone/detailAddress atomically', async () => {
      prisma.userAddress.count.mockResolvedValue(0);
      prisma.userAddress.create.mockResolvedValue(address());

      await service.create('100', {
        name: '李四',
        phone: '13900139000',
        province: '北京市',
        city: '北京市',
        district: '朝阳区',
        detail: '建国门外大街1号',
        isDefault: false,
      });

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(prisma.$queryRaw).toHaveBeenCalled();
      expect(prisma.userAddress.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            receiverName: '李四',
            receiverPhone: '13900139000',
            detailAddress: '建国门外大街1号',
            isDefault: 1,
          }),
        }),
      );
      expect(prisma.businessEvent.create).not.toHaveBeenCalled();
    });

    it('should accept receiverName/receiverPhone/detailAddress directly', async () => {
      prisma.userAddress.count.mockResolvedValue(0);
      prisma.userAddress.create.mockResolvedValue(address({
        receiverName: '王五',
        receiverPhone: '13700137000',
        province: '上海市',
        city: '上海市',
        district: '浦东新区',
        detailAddress: '陆家嘴环路1号',
      }));

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
        }),
      );
    });

    it('replays a committed create before checking the now-full address limit', async () => {
      const created = address({ id: 20n, isDefault: 0 });
      let durableEvent: any = null;
      prisma.userAddress.count.mockResolvedValueOnce(19).mockResolvedValueOnce(20);
      prisma.userAddress.create.mockResolvedValue(created);
      prisma.businessEvent.findFirst.mockImplementation(async () => durableEvent);
      prisma.businessEvent.create.mockImplementation(async ({ data }: any) => {
        durableEvent = { id: 51n, ...data };
        return durableEvent;
      });

      const request = {
        name: '弱网地址',
        phone: '13800138000',
        province: '广东省',
        city: '深圳市',
        district: '南山区',
        detail: '科技园路20号',
        isDefault: false,
        clientRequestId: REQUEST_ID,
      };

      const first = await service.create('100', request);
      prisma.userAddress.findFirst.mockResolvedValue(created);
      const retry = await service.create('100', request);

      expect(first.id).toBe('20');
      expect(retry.id).toBe('20');
      expect(prisma.userAddress.create).toHaveBeenCalledTimes(1);
      expect(prisma.userAddress.count).toHaveBeenCalledTimes(1);
      expect(prisma.businessEvent.create).toHaveBeenCalledTimes(1);
      expect(prisma.businessEvent.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          eventType: 'address_create',
          bizType: 'address:100',
          bizId: REQUEST_ID,
          payload: expect.objectContaining({ addressId: '20' }),
        }),
      });
    });

    it('fails closed when a create request id is reused with different address data', async () => {
      let durableEvent: any = null;
      prisma.userAddress.count.mockResolvedValue(0);
      prisma.userAddress.create.mockResolvedValue(address());
      prisma.businessEvent.findFirst.mockImplementation(async () => durableEvent);
      prisma.businessEvent.create.mockImplementation(async ({ data }: any) => {
        durableEvent = { id: 52n, ...data };
        return durableEvent;
      });

      const original = {
        name: '李四',
        phone: '13900139000',
        province: '北京市',
        city: '北京市',
        district: '朝阳区',
        detail: '建国门外大街1号',
        clientRequestId: REQUEST_ID,
      };
      await service.create('100', original);

      await expect(service.create('100', {
        ...original,
        detail: '被修改的地址',
      })).rejects.toThrow('地址创建请求ID已被其他操作使用');
      expect(prisma.userAddress.create).toHaveBeenCalledTimes(1);
      expect(prisma.businessEvent.create).toHaveBeenCalledTimes(1);
    });

    it('rejects a missing user before writing any address', async () => {
      prisma.$queryRaw.mockResolvedValue([]);

      await expect(service.create('100', {
        name: '测试',
        phone: '13800138000',
        province: '广东省',
        city: '深圳市',
        district: '南山区',
        detail: '测试地址',
      })).rejects.toThrow('用户不存在');

      expect(prisma.userAddress.create).not.toHaveBeenCalled();
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
