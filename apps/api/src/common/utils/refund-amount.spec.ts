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

  it('reuses persisted bundle subtotals so remainder cents are fully refundable', () => {
    const firstItem = {
      id: 23n,
      subtotal: 18461,
      activityDiscount: 1539,
      originalPrice: 10000,
      quantity: 2,
    };
    const secondItem = {
      id: 24n,
      subtotal: 5539,
      activityDiscount: 461,
      originalPrice: 3000,
      quantity: 2,
    };
    const order = {
      totalAmount: 26000,
      activityDiscountAmount: 2000,
      freightAmount: 0,
      payAmount: 24000,
      orderItems: [firstItem, secondItem],
      aftersaleOrders: [],
      orderRefunds: [],
    };

    const firstCap = calculateOrderItemRefundCap(order, firstItem).maxRefundableAmount;
    const secondCap = calculateOrderItemRefundCap(order, secondItem).maxRefundableAmount;
    expect(firstCap).toBe(18461);
    expect(secondCap).toBe(5539);
    expect(firstCap + secondCap).toBe(24000);
  });

  it('distributes order-level discount rounding residue instead of losing cents', () => {
    const firstItem = { id: 25n, subtotal: 10000, activityDiscount: 0, quantity: 1 };
    const secondItem = { id: 26n, subtotal: 5000, activityDiscount: 0, quantity: 1 };
    const order = {
      totalAmount: 15000,
      couponAmount: 1,
      freightAmount: 0,
      payAmount: 14999,
      orderItems: [firstItem, secondItem],
      aftersaleOrders: [],
      orderRefunds: [],
    };

    const firstCap = calculateOrderItemRefundCap(order, firstItem).maxRefundableAmount;
    const secondCap = calculateOrderItemRefundCap(order, secondItem).maxRefundableAmount;
    expect(firstCap + secondCap).toBe(14999);
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
