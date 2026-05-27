import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { AdminOrderController } from './order.controller';

function createMockOrderService() {
  return {
    exportOrders: jest.fn(),
  };
}

function createMockResponse() {
  const headers: Record<string, string> = {};
  return {
    headers,
    statusCode: 0,
    body: '',
    setHeader: jest.fn((key: string, value: string) => {
      headers[key] = value;
    }),
    status: jest.fn(function (this: any, code: number) {
      this.statusCode = code;
      return this;
    }),
    send: jest.fn(function (this: any, payload: string) {
      this.body = payload;
      return this;
    }),
  };
}

describe('AdminOrderController.export CSV 导出', () => {
  let controller: AdminOrderController;
  let mockOrderService: any;

  beforeEach(() => {
    mockOrderService = createMockOrderService();
    controller = new AdminOrderController(mockOrderService);
  });

  it('返回 text/csv content-type 且包含 UTF-8 BOM', async () => {
    mockOrderService.exportOrders.mockResolvedValue([
      {
        orderNo: 'XY202605280001',
        userNickname: '测试用户',
        userPhone: '13800138000',
        status: 'pending_delivery',
        fulfillmentType: 'delivery',
        itemCount: 1,
        itemDetails: '奶粉（段位:1段）x1',
        totalAmount: 1000,
        discountAmount: 0,
        couponAmount: 0,
        activityDiscountAmount: 0,
        freightAmount: 0,
        pointsAmount: 0,
        payAmount: 1000,
        consignee: '张三',
        consigneePhone: '13800138000',
        address: '山东省临沂市兰山区',
        createdAt: new Date('2026-05-28T10:00:00.000Z'),
        paidAt: null,
      },
    ]);
    const res = createMockResponse();

    await controller.export({} as any, res as any);

    expect(res.headers['Content-Type']).toBe('text/csv; charset=utf-8');
    expect(res.headers['Content-Disposition']).toContain('.csv');
    expect(res.statusCode).toBe(200);
    expect(res.body.startsWith('\uFEFF')).toBe(true);
  });

  it('以 = 开头的字段会被 CSV 注入防护', async () => {
    mockOrderService.exportOrders.mockResolvedValue([
      {
        orderNo: '=2+3',
        userNickname: '=@HACK',
        userPhone: '+8613800138000',
        status: 'pending_delivery',
        fulfillmentType: 'delivery',
        itemCount: 1,
        itemDetails: '-危险商品x1',
        totalAmount: 1000,
        discountAmount: 0,
        couponAmount: 0,
        activityDiscountAmount: 0,
        freightAmount: 0,
        pointsAmount: 0,
        payAmount: 1000,
        consignee: '张三',
        consigneePhone: '13800138000',
        address: '山东省临沂市兰山区',
        createdAt: new Date('2026-05-28T10:00:00.000Z'),
        paidAt: null,
      },
    ]);
    const res = createMockResponse();

    await controller.export({} as any, res as any);

    expect(res.body).toContain("\"'=2+3\"");
    expect(res.body).toContain("\"'=@HACK\"");
    expect(res.body).toContain("\"'+8613800138000\"");
    expect(res.body).toContain("\"'-危险商品x1\"");
  });
});
