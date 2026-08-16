import { AftersaleStatus } from '@prisma/client';
import { TransitionSafeReturnDestinationAftersaleService } from './transition-safe-return-destination-aftersale.service';

function createHarness() {
  const tx: any = {
    aftersaleOrder: {
      findFirst: jest.fn(),
      updateMany: jest.fn(),
    },
    aftersaleLog: { create: jest.fn() },
    order: { updateMany: jest.fn() },
    $queryRawUnsafe: jest.fn().mockResolvedValue([{ id: 9n }]),
  };
  const prisma: any = {
    $transaction: jest.fn(async (callback: any) => callback(tx)),
  };
  const service = new TransitionSafeReturnDestinationAftersaleService(
    prisma,
    {} as any,
    undefined,
  );
  return { service, prisma, tx };
}

describe('TransitionSafeReturnDestinationAftersaleService', () => {
  it('does not let a stale user-cancel overwrite an already reviewed aftersale', async () => {
    const { service, tx } = createHarness();
    tx.aftersaleOrder.findFirst.mockResolvedValue({
      id: 1n,
      userId: 2n,
      orderId: 9n,
      status: AftersaleStatus.pending_review,
      order: { completedAt: null },
    });
    // Simulate approve/reject winning the compare-and-set before this delayed cancel reaches update.
    tx.aftersaleOrder.updateMany.mockResolvedValue({ count: 0 });

    await expect(service.cancel('2', '1')).rejects.toThrow('售后单状态已变化，请刷新后重试');
    expect(tx.aftersaleLog.create).not.toHaveBeenCalled();
    expect(tx.order.updateMany).not.toHaveBeenCalled();
  });

  it('does not let a stale admin rejection overwrite an already approved aftersale', async () => {
    const { service, tx } = createHarness();
    tx.aftersaleOrder.findFirst.mockResolvedValue({
      id: 3n,
      orderId: 10n,
      status: AftersaleStatus.pending_review,
      order: { completedAt: new Date() },
    });
    tx.aftersaleOrder.updateMany.mockResolvedValue({ count: 0 });

    await expect(service.reject('3', '8', '不同意')).rejects.toThrow('售后单状态已变化，请刷新后重试');
    expect(tx.aftersaleLog.create).not.toHaveBeenCalled();
    expect(tx.order.updateMany).not.toHaveBeenCalled();
  });

  it('does not let delayed return logistics move a refunding aftersale back to returned', async () => {
    const { service, tx } = createHarness();
    jest.spyOn(service, 'findUserDetail').mockResolvedValue({
      id: '4',
      type: 2,
      returnAddress: '上海市浦东新区测试路1号',
    } as any);
    tx.aftersaleOrder.findFirst.mockResolvedValue({ id: 4n });
    // Simulate refund transition winning after the page loaded the approved detail.
    tx.aftersaleOrder.updateMany.mockResolvedValue({ count: 0 });

    await expect(service.fillReturnLogistics('2', '4', {
      returnLogisticsCompany: '顺丰速运',
      returnLogisticsNo: 'SF1234567890',
    } as any)).rejects.toThrow('售后单状态已变化，请刷新后重试');

    expect(tx.aftersaleLog.create).not.toHaveBeenCalled();
  });
});
