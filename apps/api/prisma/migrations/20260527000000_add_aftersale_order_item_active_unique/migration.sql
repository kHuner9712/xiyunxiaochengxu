CREATE UNIQUE INDEX IF NOT EXISTS idx_aftersale_orders_order_item_active ON aftersale_orders (order_item_id)
  WHERE status IN ('pending_review', 'approved', 'returned', 'pending_refund');
