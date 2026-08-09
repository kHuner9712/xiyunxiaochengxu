import { calculateOrderItemRefundCap } from './refund-amount';

describe('calculateOrderItemRefundCap promotional multi-item allocation', () => {
  it('does not let a free gift dilute or receive the paid item refund', () => {
    const paidItem = {
      id: 11n,
      subtotal: 10000,
      activityDiscount: 0,
      originalPrice: 10000,
      quantity: 1,
    };
    const giftItem = {
      id: 12n,
      subtotal: 0,
      activityDiscount: 3000,
      originalPrice: 3000,
      quantity: 1,
    };
    const order = {
      totalAmount: 13000,
      activityDiscountAmount: 3000,
      freightAmount: 0,
      payAmount: 10000,
      orderItems: [paidItem, giftItem],
      aftersaleOrders: [],
      orderRefunds: [],
    };

    expect(calculateOrderItemRefundCap(order, paidItem).maxRefundableAmount).toBe(10000);
    expect(calculateOrderItemRefundCap(order, giftItem).maxRefundableAmount).toBe(0);
  });

  it('allocates bundle paid amount by pre-discount economic value without double discounting', () => {
    const firstItem = {
      id: 21n,
      subtotal: 6000,
      activityDiscount: 4000,
      originalPrice: 10000,
      quantity: 1,
    };
    const secondItem = {
      id: 22n,
      subtotal: 3000,
      activityDiscount: 2000,
      originalPrice: 5000,
      quantity: 1,
    };
    const order = {
      totalAmount: 15000,
      activityDiscountAmount: 6000,
      freightAmount: 0,
      payAmount: 9000,
      orderItems: [firstItem, secondItem],
      aftersaleOrders: [],
      orderRefunds: [],
    };

    expect(calculateOrderItemRefundCap(order, firstItem).maxRefundableAmount).toBe(6000);
    expect(calculateOrderItemRefundCap(order, secondItem).maxRefundableAmount).toBe(3000);
  });

  it('still caps remaining refund by prior successful or in-flight refunds', () => {
    const item = { id: 31n, subtotal: 5000, activityDiscount: 0, quantity: 1 };
    const order = {
      totalAmount: 5000,
      freightAmount: 0,
      payAmount: 5000,
      orderItems: [item],
      aftersaleOrders: [{ id: 41n, orderItemId: 31n }],
      orderRefunds: [{ aftersaleId: 41n, status: 'success', refundAmount: 1200 }],
    };

    const result = calculateOrderItemRefundCap(order, item);
    expect(result.maxRefundableAmount).toBe(5000);
    expect(result.refundedAmountForItem).toBe(1200);
    expect(result.remainingAmount).toBe(3800);
  });
});
