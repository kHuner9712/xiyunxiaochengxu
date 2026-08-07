-- Seed durable reconciliation tasks for refunds that already reached SUCCESS before
-- refund-success side effects became explicitly recoverable.
-- The existing unique key (order_no, reason, transaction_id) makes this migration idempotent
-- across environments that may already contain a task created by runtime callback handling.

INSERT IGNORE INTO `payment_compensation_tasks` (
  `order_no`,
  `transaction_id`,
  `amount`,
  `reason`,
  `status`,
  `callback_payload`,
  `created_at`,
  `updated_at`
)
SELECT
  o.`order_no`,
  r.`out_refund_no`,
  r.`refund_amount`,
  'refund_success_side_effects',
  'pending',
  JSON_OBJECT(
    'refundId', CAST(r.`id` AS CHAR),
    'outRefundNo', r.`out_refund_no`,
    'seededByMigration', TRUE
  ),
  NOW(3),
  NOW(3)
FROM `order_refunds` r
INNER JOIN `orders` o ON o.`id` = r.`order_id`
WHERE r.`status` = 'success';
