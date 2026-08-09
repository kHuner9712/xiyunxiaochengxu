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

/**
 * Refund allocation basis for a multi-item order.
 *
 * - Ordinary items use their persisted subtotal.
 * - A promotional item whose persisted subtotal is already the discounted amount adds its
 *   item-level activityDiscount back so allocation is based on the pre-discount economic value.
 * - A zero-subtotal gift always has a zero cash-refund basis even when originalPrice and
 *   activityDiscount record the value of the gift. Otherwise a free gift could incorrectly
 *   consume or receive part of the customer's paid amount.
 */
function getRefundAllocationBasis(item: any): number {
  const subtotal = Math.max(0, toAmount(item?.subtotal));
  if (subtotal === 0) return 0;
  const activityDiscount = Math.max(0, toAmount(item?.activityDiscount));
  return subtotal + activityDiscount;
}

/**
 * Allocate the order's merchandise cash amount to individual order items in integer cents.
 *
 * When persisted subtotals already add up exactly to the merchandise cash paid (for example the
 * multi-item activity checkout), they are the authoritative allocation and must be reused. This
 * preserves the exact remainder-cent decision made when the order was created.
 *
 * Otherwise allocate proportionally by economic basis and distribute rounding residue using the
 * largest-remainder method. Independent Math.floor() calls are not acceptable here because their
 * totals can be one or more cents below the amount the customer actually paid.
 */
function allocateRefundCaps(orderItems: any[], nonFreightPaidAmount: number) {
  const persistedSubtotalTotal = orderItems.reduce(
    (sum, item) => sum + Math.max(0, toAmount(item?.subtotal)),
    0,
  );
  if (persistedSubtotalTotal === nonFreightPaidAmount) {
    return new Map(
      orderItems.map((item) => [
        String(item?.id),
        Math.max(0, toAmount(item?.subtotal)),
      ]),
    );
  }

  const entries = orderItems.map((item, index) => ({
    id: String(item?.id),
    index,
    cap: Math.max(0, toAmount(item?.subtotal)),
    basis: getRefundAllocationBasis(item),
    allocation: 0,
    remainder: 0,
  }));
  const totalBasis = entries.reduce((sum, entry) => sum + entry.basis, 0);
  if (totalBasis <= 0 || nonFreightPaidAmount <= 0) {
    return new Map(entries.map((entry) => [entry.id, 0]));
  }

  let allocated = 0;
  for (const entry of entries) {
    if (entry.basis <= 0 || entry.cap <= 0) continue;
    const numerator = nonFreightPaidAmount * entry.basis;
    const floor = Math.floor(numerator / totalBasis);
    entry.allocation = Math.min(entry.cap, floor);
    entry.remainder = numerator % totalBasis;
    allocated += entry.allocation;
  }

  let residue = Math.max(0, nonFreightPaidAmount - allocated);
  const candidates = entries
    .filter((entry) => entry.basis > 0 && entry.allocation < entry.cap)
    .sort((a, b) => {
      if (a.remainder !== b.remainder) return b.remainder - a.remainder;
      return a.index - b.index;
    });

  while (residue > 0 && candidates.length > 0) {
    let progressed = false;
    for (const entry of candidates) {
      if (residue <= 0) break;
      if (entry.allocation >= entry.cap) continue;
      entry.allocation += 1;
      residue -= 1;
      progressed = true;
    }
    if (!progressed) break;
  }

  return new Map(entries.map((entry) => [entry.id, entry.allocation]));
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

  const refundCapsByItem = allocateRefundCaps(orderItems, nonFreightPaidAmount);
  const maxRefundableAmount = itemIsWholeOrder
    ? payAmount
    : Math.min(itemSubtotal, refundCapsByItem.get(String(orderItem?.id)) ?? 0);

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
