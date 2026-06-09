const COUNTED_REFUND_STATUSES = new Set(['initiating', 'pending', 'processing', 'success']);

function toAmount(value: unknown): number {
  const amount = Number(value ?? 0);
  return Number.isFinite(amount) ? amount : 0;
}

function sameId(a: unknown, b: unknown): boolean {
  if (a === undefined || a === null || b === undefined || b === null) return false;
  return String(a) === String(b);
}

function getOrderItems(order: any, orderItem: any): any[] {
  const items = Array.isArray(order?.orderItems) && order.orderItems.length > 0
    ? order.orderItems
    : [orderItem];
  return items.filter(Boolean);
}

export function calculateOrderItemRefundCap(order: any, orderItem: any, currentAftersaleId?: bigint | string) {
  const orderItems = getOrderItems(order, orderItem);
  const totalAmount = Math.max(
    0,
    toAmount(order?.totalAmount) || orderItems.reduce((sum, item) => sum + toAmount(item.subtotal), 0),
  );
  const freightAmount = Math.max(0, toAmount(order?.freightAmount));
  const discountAmount = Math.max(0, toAmount(order?.discountAmount));
  const couponAmount = Math.max(0, toAmount(order?.couponAmount));
  const pointsAmount = Math.max(0, toAmount(order?.pointsAmount));
  const activityDiscountAmount = Math.max(0, toAmount(order?.activityDiscountAmount));
  const fallbackPayAmount = Math.max(
    0,
    totalAmount - discountAmount - couponAmount - pointsAmount - activityDiscountAmount + freightAmount,
  );
  const payAmount = Math.max(0, toAmount(order?.payAmount) || fallbackPayAmount);
  const nonFreightPaidAmount = Math.max(0, payAmount - freightAmount);
  const itemSubtotal = Math.max(0, toAmount(orderItem?.subtotal));
  const itemIsWholeOrder = orderItems.length === 1 && sameId(orderItems[0]?.id, orderItem?.id);

  const maxRefundableAmount = itemIsWholeOrder
    ? payAmount
    : Math.min(itemSubtotal, totalAmount > 0 ? Math.floor(nonFreightPaidAmount * itemSubtotal / totalAmount) : 0);

  const aftersalesById = new Map<string, any>(
    (Array.isArray(order?.aftersaleOrders) ? order.aftersaleOrders : [])
      .map((aftersale: any): [string, any] => [String(aftersale.id), aftersale]),
  );
  const countedRefunds = (Array.isArray(order?.orderRefunds) ? order.orderRefunds : [])
    .filter((refund: any) => COUNTED_REFUND_STATUSES.has(String(refund.status)));

  const refundedAmountForOrder = countedRefunds
    .filter((refund: any) => !currentAftersaleId || !sameId(refund.aftersaleId, currentAftersaleId))
    .reduce((sum: number, refund: any) => sum + toAmount(refund.refundAmount), 0);

  const refundedAmountForItem = countedRefunds.reduce((sum: number, refund: any) => {
    if (currentAftersaleId && sameId(refund.aftersaleId, currentAftersaleId)) return sum;
    const aftersale = refund.aftersaleId ? aftersalesById.get(String(refund.aftersaleId)) : null;
    if (!aftersale || !sameId(aftersale.orderItemId, orderItem?.id)) return sum;
    return sum + toAmount(refund.refundAmount);
  }, 0);

  const remainingByItem = Math.max(0, maxRefundableAmount - refundedAmountForItem);
  const remainingByOrder = Math.max(0, payAmount - refundedAmountForOrder);

  return {
    maxRefundableAmount,
    refundedAmountForItem,
    refundedAmountForOrder,
    remainingAmount: Math.min(remainingByItem, remainingByOrder),
    includesFreight: itemIsWholeOrder && freightAmount > 0,
  };
}
