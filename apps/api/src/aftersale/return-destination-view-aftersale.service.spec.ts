import { BadRequestException } from '@nestjs/common';
import { AftersaleStatus } from '@prisma/client';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { ReturnDestinationViewAftersaleService } from './return-destination-view-aftersale.service';

function baseDetail(logs: any[] = []) {
  return {
    id: 10n,
    aftersaleNo: 'AS-10',
    orderId: 1n,
    orderItemId: 20n,
    userId: 3n,
    type: 2,
    reason: '退货',
    description: null,
    images: [],
    status: AftersaleStatus.approved,
    refundAmount: 10000,
    returnLogisticsCompany: null,
    returnLogisticsNo: null,
    adminId: 8n,
    createdAt: new Date(),
    updatedAt: new Date(),
    orderItem: {
      id: 20n,
      orderId: 1n,
      productId: 30n,
      skuId: 40n,
      productName: '测试商品',
      productImage: '',
      skuName: '标准装',
      price: 10000,
      quantity: 1,
      subtotal: 10000,
    },
    order: {
      id: 1n,
      userId: 3n,
      orderNo: 'ORDER-1',
    },
    aftersaleLogs: logs,
  };
}

describe('ReturnDestinationViewAftersaleService', () => {
  let prisma: any;
  let service: ReturnDestinationViewAftersaleService;

  beforeEach(() => {
    prisma = {
      aftersaleOrder: {
        findFirst: jest.fn(),
        updateMany: jest.fn(),
      },
      aftersaleLog: { create: jest.fn() },
      $transaction: jest.fn(),
    };
    service = new ReturnDestinationViewAftersaleService(prisma, {} as any);
  });

  it('blocks return logistics when an approved legacy case has no reviewed destination', async () => {
    prisma.aftersaleOrder.findFirst.mockResolvedValue(baseDetail([]));

    await expect(service.fillReturnLogistics('3', '10', {
      returnLogisticsCompany: '顺丰',
      returnLogisticsNo: 'SF123',
    })).rejects.toThrow(BadRequestException);

    expect(prisma.aftersaleOrder.updateMany).not.toHaveBeenCalled();
  });

  it('exposes a versioned return destination snapshot as structured detail fields', async () => {
    prisma.aftersaleOrder.findFirst.mockResolvedValue(baseDetail([{
      id: 99n,
      aftersaleId: 10n,
      operatorType: 'admin',
      operatorId: 8n,
      action: 'return_destination',
      content: JSON.stringify({
        version: 1,
        receiverName: '售后仓',
        receiverPhone: '021-12345678',
        address: '上海市浦东新区测试路88号',
      }),
      createdAt: new Date(),
    }]));

    const result = await service.findUserDetail('3', '10');

    expect(result.returnReceiverName).toBe('售后仓');
    expect(result.returnReceiverPhone).toBe('021-12345678');
    expect(result.returnAddress).toBe('上海市浦东新区测试路88号');
    expect(result.aftersaleLogs[0].content).toContain('退货收件信息');
  });
});
