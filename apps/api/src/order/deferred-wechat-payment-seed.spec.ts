import { PAYMENT_STATUS } from '../common/constants/payment';
import { withDeferredWechatPaymentSeed } from './pickup-safe-order.service';

describe('withDeferredWechatPaymentSeed', () => {
  it('does not persist a positive-amount CREATED WeChat row during order creation', async () => {
    const create = jest.fn().mockResolvedValue({ id: 1n });
    const tx: any = { orderPayment: { create } };
    const guarded = withDeferredWechatPaymentSeed(tx);

    const result = await guarded.orderPayment.create({
      data: {
        orderId: 42n,
        paymentNo: 'P42',
        amount: 1999,
        paymentMethod: 'wechat',
        status: PAYMENT_STATUS.CREATED,
      },
    });

    expect(create).not.toHaveBeenCalled();
    expect(result).toEqual(expect.objectContaining({
      orderId: 42n,
      amount: 1999,
      paymentMethod: 'wechat',
      status: PAYMENT_STATUS.CREATED,
    }));
  });

  it('keeps zero-pay SUCCESS payment records durable', async () => {
    const durable = { id: 2n, status: PAYMENT_STATUS.SUCCESS };
    const create = jest.fn().mockResolvedValue(durable);
    const tx: any = { orderPayment: { create } };
    const guarded = withDeferredWechatPaymentSeed(tx);
    const args = {
      data: {
        orderId: 43n,
        paymentNo: 'P43',
        amount: 0,
        paymentMethod: 'zero_pay',
        status: PAYMENT_STATUS.SUCCESS,
      },
    };

    await expect(guarded.orderPayment.create(args)).resolves.toEqual(durable);
    expect(create).toHaveBeenCalledWith(args);
  });

  it('does not suppress failed or non-WeChat payment facts', async () => {
    const create = jest.fn().mockResolvedValue({ id: 3n });
    const tx: any = { orderPayment: { create } };
    const guarded = withDeferredWechatPaymentSeed(tx);

    await guarded.orderPayment.create({
      data: {
        orderId: 44n,
        paymentNo: 'P44',
        amount: 1999,
        paymentMethod: 'wechat',
        status: PAYMENT_STATUS.FAILED,
      },
    });

    expect(create).toHaveBeenCalledTimes(1);
  });
});
