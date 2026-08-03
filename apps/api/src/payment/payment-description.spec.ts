import { buildWechatPaymentDescription } from './payment-description';

describe('buildWechatPaymentDescription', () => {
  it('使用真实商品名称和件数生成微信支付描述', () => {
    expect(buildWechatPaymentDescription({
      orderNo: 'O202608030001',
      orderItems: [
        { productName: '婴儿纸尿裤', quantity: 2 },
        { productName: '婴儿湿巾', quantity: 1 },
      ],
    })).toBe('婴儿纸尿裤等3件商品');
  });

  it('没有商品明细时保留安全兜底且限制长度', () => {
    const value = buildWechatPaymentDescription({ orderNo: 'X'.repeat(200), orderItems: [] });
    expect(value.startsWith('订单')).toBe(true);
    expect(value.length).toBeLessThanOrEqual(127);
  });
});
