-- MySQL 不支持 PostgreSQL 风格 partial unique index (WHERE ...)
-- 改用 active_order_item_id 字段实现"同一 order_item 只能有一个未终态售后单"约束
-- 非终态售后单设置 active_order_item_id = order_item_id，终态时置 NULL
-- 通过唯一索引保证同一 order_item_id 最多只有一条未终态售后单

ALTER TABLE aftersale_orders ADD COLUMN active_order_item_id BIGINT NULL;

-- 回填已有非终态售后单的 active_order_item_id
UPDATE aftersale_orders
SET active_order_item_id = order_item_id
WHERE status IN ('pending_review', 'approved', 'returned', 'pending_refund');

CREATE UNIQUE INDEX uk_aftersale_active_order_item_id ON aftersale_orders (active_order_item_id);
