import { NotFoundException } from '@nestjs/common';
import { DurableAdminBenefitPackageService } from './durable-admin-benefit-package.service';
import { VersionedBenefitPackageService } from './versioned-benefit-package.service';

describe('DurableAdminBenefitPackageService', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  function setup() {
    const tx = {
      businessEvent: {
        findFirst: jest.fn(),
        create: jest.fn(),
      },
      benefitPackage: {
        create: jest.fn(),
        findFirst: jest.fn(),
        updateMany: jest.fn(),
      },
    } as any;
    const prisma = {
      $transaction: jest.fn(async (callback: any) => callback(tx)),
      benefitPackage: {
        findUnique: jest.fn(),
      },
    } as any;
    const service = new DurableAdminBenefitPackageService(prisma, {} as any);
    jest.spyOn(service, 'findById').mockImplementation(async (id: string) => ({ id }) as any);
    return { service, prisma, tx };
  }

  it('replays the first create result for the same request id without inserting another package', async () => {
    const { service, tx } = setup();
    tx.businessEvent.findFirst.mockResolvedValueOnce(null);
    tx.benefitPackage.create.mockResolvedValueOnce({ id: 101n });

    const input = { name: '宝宝成长权益卡', status: 0, clientRequestId: '9001' };
    await expect(service.create(input)).resolves.toEqual({ id: '101' });

    const eventPayload = tx.businessEvent.create.mock.calls[0][0].data.payload;
    tx.businessEvent.findFirst.mockResolvedValueOnce({ payload: eventPayload });
    tx.benefitPackage.findFirst.mockResolvedValueOnce({ id: 101n });

    await expect(service.create({ ...input })).resolves.toEqual({ id: '101' });
    expect(tx.benefitPackage.create).toHaveBeenCalledTimes(1);
    expect(tx.businessEvent.create).toHaveBeenCalledTimes(1);
  });

  it('rejects payload changes that reuse an already handled create request id', async () => {
    const { service, tx } = setup();
    tx.businessEvent.findFirst.mockResolvedValueOnce(null);
    tx.benefitPackage.create.mockResolvedValueOnce({ id: 102n });

    const input = { name: '原权益卡', clientRequestId: '9002' };
    await service.create(input);
    const eventPayload = tx.businessEvent.create.mock.calls[0][0].data.payload;

    tx.businessEvent.findFirst.mockResolvedValueOnce({ payload: eventPayload });
    await expect(service.create({ ...input, name: '被篡改的权益卡' })).rejects.toThrow(
      '权益包创建请求ID已被其他操作使用',
    );
    expect(tx.benefitPackage.create).toHaveBeenCalledTimes(1);
  });

  it('treats an already-soft-deleted package as a successful delete replay but keeps unknown ids as 404', async () => {
    const { service, prisma } = setup();
    const parentDelete = jest.spyOn(VersionedBenefitPackageService.prototype, 'delete');

    parentDelete.mockRejectedValueOnce(new NotFoundException('权益包不存在'));
    prisma.benefitPackage.findUnique.mockResolvedValueOnce({ deletedAt: new Date() });
    await expect(service.delete('103')).resolves.toEqual({ id: '103' });

    parentDelete.mockRejectedValueOnce(new NotFoundException('权益包不存在'));
    prisma.benefitPackage.findUnique.mockResolvedValueOnce(null);
    await expect(service.delete('104')).rejects.toBeInstanceOf(NotFoundException);
  });
});
