import 'reflect-metadata';
import { validate } from 'class-validator';
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { UpdateSupplierDto } from './dto/update-supplier.dto';
import { SupplierService } from './supplier.service';

function createPrismaMock() {
  return {
    supplier: {
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
    },
    product: {
      count: jest.fn(),
    },
  };
}

describe('SupplierService production admin contract', () => {
  it('accepts the supplier fields exposed by the admin form', async () => {
    const create = Object.assign(new CreateSupplierDto(), {
      name: '测试供应商',
      contactName: '张三',
      contactPhone: '13800138000',
      email: 'supplier@example.com',
      address: '上海市浦东新区',
      status: 0,
      remark: '测试备注',
    });
    expect(await validate(create)).toHaveLength(0);

    const update = Object.assign(new UpdateSupplierDto(), {
      contactName: '李四',
      email: 'updated@example.com',
      status: 1,
    });
    expect(await validate(update)).toHaveLength(0);
  });

  it('rejects malformed supplier email and invalid status before persistence', async () => {
    const create = Object.assign(new CreateSupplierDto(), {
      name: '测试供应商',
      email: 'not-an-email',
      status: 2,
    });
    const errors = await validate(create);
    expect(errors.map((error) => error.property)).toEqual(expect.arrayContaining(['email', 'status']));
  });

  it('persists email, contactName and explicit inactive status on create', async () => {
    const prisma = createPrismaMock();
    prisma.supplier.findFirst.mockResolvedValue(null);
    prisma.supplier.create.mockImplementation(async ({ data }: any) => ({
      id: 10n,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
      ...data,
    }));
    const service = new SupplierService(prisma as any);

    const result: any = await service.create({
      name: '供应商A',
      contactName: '联系人A',
      contactPhone: '13800138000',
      email: 'a@example.com',
      status: 0,
    });

    expect(prisma.supplier.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        name: '供应商A',
        contactName: '联系人A',
        email: 'a@example.com',
        status: 0,
      }),
    });
    expect(result.id).toBe('10');
    expect(result.email).toBe('a@example.com');
    expect(result.status).toBe(0);
  });

  it('persists email and status changes on update without renaming fields', async () => {
    const prisma = createPrismaMock();
    prisma.supplier.findFirst.mockResolvedValue({ id: 10n, name: '供应商A' });
    prisma.supplier.update.mockImplementation(async ({ data }: any) => ({
      id: 10n,
      name: '供应商A',
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
      ...data,
    }));
    const service = new SupplierService(prisma as any);

    const result: any = await service.update('10', {
      contactName: '联系人B',
      email: 'b@example.com',
      status: 1,
    });

    expect(prisma.supplier.update).toHaveBeenCalledWith({
      where: { id: 10n },
      data: expect.objectContaining({
        contactName: '联系人B',
        email: 'b@example.com',
        status: 1,
      }),
    });
    expect(result.email).toBe('b@example.com');
  });
});
