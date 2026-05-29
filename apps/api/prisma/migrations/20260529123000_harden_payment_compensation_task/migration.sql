ALTER TABLE `payment_compensation_tasks`
  MODIFY COLUMN `order_no` VARCHAR(64) NOT NULL,
  MODIFY COLUMN `transaction_id` VARCHAR(128) NULL,
  MODIFY COLUMN `resolution` TEXT NULL;

ALTER TABLE `payment_compensation_tasks`
  ADD CONSTRAINT `uk_compensation_order_reason_tx`
  UNIQUE (`order_no`, `reason`, `transaction_id`);
