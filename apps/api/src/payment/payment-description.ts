export function buildWechatPaymentDescription(order: any): string {
  const items = Array.isArray(order?.orderItems) ? order.orderItems : [];
  const firstProductName = String(items[0]?.productName || '').trim();
  const totalQuantity = items.reduce((sum: number, item: any) => {
    const quantity = Number(item?.quantity || 0);
    return sum + (Number.isFinite(quantity) && quantity > 0 ? quantity : 0);
  }, 0);

  let description = firstProductName;
  if (firstProductName && totalQuantity > 1) {
    description = `${firstProductName}等${totalQuantity}件商品`;
  }
  if (!description) {
    description = `订单${String(order?.orderNo || '').trim() || '商品购买'}`;
  }
  return description.slice(0, 127);
}
