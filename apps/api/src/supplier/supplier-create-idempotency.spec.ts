import 'reflect-metadata';
import { Prisma } from '@prisma/client';
import { validate } from 'class-validator';
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { SupplierService } from './supplier.service';

const REQUEST_ID = '1760000000000000001';

function supplier(overrides: Record<string, any> = {}) {
  return {
    id: 10n,
    name: '供应商A',
    contactName: '联系人A',
    contactPhone: '13800138000',
    email: 'a@example.com',
    address: null,
    businessLicense: null,
    cooperationStartDate: null,
    settlementType: null,
    remark: null,
    status: 1,
    createdAt: new Date('2026-08-14T00:00:00.000Z'),
    updatedAt: new Date('2026-08-14T00:00:00.000Z'),
    deletedAt: null,
    ...overrides,
  };
}

function createPrismaMock() {
  let event: any = null;
  const prisma: any = {
    supplier: {
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    product: { count: jest.fn() },
    businessEvent: {
      findFirst: jest.fn(async () => event),
      create: jest.fn(async ({ data }: any) => {
        event = { id: 90n, ...data };
        return event;
      }),
    },
    $queryRaw: jest.fn(),
  };
  prisma.$transaction = jest.fn(async (callback: any) => callback(prisma));
  return prisma;
}

describe('SupplierService create/delete durability', () => {
  it('accepts the rolling-upgrade supplier create request id format', async () => {
    const dto = Object.assign(new CreateSupplierDto(), {
      name: '供应商A',
      clientRequestId: REQUEST_ID,
    });
    expect(await validate(dto)).toHaveLength(0);

    const invalid = Object.assign(new CreateSupplierDto(), {
      name: '供应商A',
      clientRequestId: 'bad-id',
    });
    expect((await validate(invalid)).map((error) => error.property)).toContain('clientRequestId');
  });

  it('replays a committed create request and only inserts the supplier once', async () => {
    const prisma = createPrismaMock();
    const created = supplier();
    prisma.supplier.findFirst.mockImplementation(async ({ where }: any) => {
      if (where.id) return created;
      return null;
    });
    prisma.supplier.create.mockResolvedValue(created);
    const service = new SupplierService(prisma as any);
    jest.spyOn(service['logger'], 'log').mockImplementation(() => {});

    const input = {
      name: '供应商A',
      contactName: '联系人A',
      contactPhone: '13800138000',
      email: 'a@example.com',
      clientRequestId: REQUEST_ID,
    };
    const first: any = await service.create(input);
    const retry: any = await service.create(input);

    expect(first.id).toBe('10');
    expect(retry.id).toBe('10');
    expect(prisma.supplier.create).toHaveBeenCalledTimes(1);
    expect(prisma.businessEvent.create).toHaveBeenCalledTimes(1);
    expect(prisma.businessEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        eventType: 'supplier_create',
        bizType: 'supplier',
        bizId: REQUEST_ID,
        payload: expect.objectContaining({ supplierId: '10' }),
      }),
    });
    expect(prisma.$transaction).toHaveBeenCalledWith(
      expect.any(Function),
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  });

  it('fails closed when the same request id is reused with different supplier data', async () => {
    const prisma = createPrismaMock();
    const created = supplier();
    prisma.supplier.findFirst.mockImplementation(async ({ where }: any) => {
      if (where.id) return created;
      return null;
    });
    prisma.supplier.create.mockResolvedValue(created);
    const service = new SupplierService(prisma as any);
    jest.spyOn(service['logger'], 'log').mockImplementation(() => {});

    await service.create({ name: '供应商A', clientRequestId: REQUEST_ID });

    await expect(service.create({
      name: '供应商B',
      clientRequestId: REQUEST_ID,
    })).rejects.toThrow('供应商创建请求ID已被其他操作使用');
    expect(prisma.supplier.create).toHaveBeenCalledTimes(1);
  });

  it('retries a serializable transaction conflict instead of allowing duplicate creates', async () => {
    const prisma = createPrismaMock();
    const created = supplier();
    prisma.supplier.findFirst.mockResolvedValue(null);
    prisma.supplier.create.mockResolvedValue(created);
    const normalTransaction = prisma.$transaction.getMockImplementation();
    prisma.$transaction
      .mockRejectedValueOnce(Object.assign(new Error('write conflict'), { code: 'P2034' }))
      .mockImplementation(normalTransaction!);
    const service = new SupplierService(prisma as any);
    jest.spyOn(service['logger'], 'log').mockImplementation(() => {});

    const result: any = await service.create({ name: '供应商A' });

    expect(result.id).toBe('10');
    expect(prisma.$transaction).toHaveBeenCalledTimes(2);
    expect(prisma.supplier.create).toHaveBeenCalledTimes(1);
  });

  it('replays success when the same supplier was already soft-deleted', async () => {
    const prisma = createPrismaMock();
    const deleted = supplier({ deletedAt: new Date('2026-08-14T01:00:00.000Z') });
    prisma.$queryRaw.mockResolvedValue([{ id: 10n }]);
    prisma.supplier.findFirst.mockResolvedValue(deleted);
    const service = new SupplierService(prisma as any);
    jest.spyOn(service['logger'], 'log').mockImplementation(() => {});

    const result: any = await service.delete('10');

    expect(result.id).toBe('10');
    expect(prisma.product.count).not.toHaveBeenCalled();
    expect(prisma.supplier.update).not.toHaveBeenCalled();
  });

  it('keeps unknown supplier ids fail-closed on delete', async () => {
    const prisma = createPrismaMock();
    prisma.$queryRaw.mockResolvedValue([]);
    const service = new SupplierService(prisma as any);

    await expect(service.delete('999')).rejects.toThrow('供应商不存在');
    expect(prisma.supplier.update).not.toHaveBeenCalled();
  });
});
