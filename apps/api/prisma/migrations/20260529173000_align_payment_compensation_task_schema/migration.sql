ALTER TABLE `payment_compensation_tasks`
  MODIFY COLUMN `order_no` VARCHAR(64) NOT NULL,
  MODIFY COLUMN `transaction_id` VARCHAR(128) NULL,
  MODIFY COLUMN `amount` INT NULL,
  MODIFY COLUMN `reason` VARCHAR(100) NOT NULL,
  MODIFY COLUMN `status` VARCHAR(20) NOT NULL DEFAULT 'pending',
  MODIFY COLUMN `callback_payload` JSON NULL,
  MODIFY COLUMN `handled_by` VARCHAR(64) NULL,
  MODIFY COLUMN `handled_at` DATETIME NULL,
  MODIFY COLUMN `resolution` TEXT NULL,
  MODIFY COLUMN `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  MODIFY COLUMN `updated_at` DATETIME NOT NULL;

ALTER TABLE `payment_compensation_tasks`
  DROP COLUMN `retry_count`;

ALTER TABLE `payment_compensation_tasks`
  DROP INDEX `idx_order_no`,
  DROP INDEX `idx_transaction_id`,
  DROP INDEX `idx_status`,
  DROP INDEX `idx_created_at`;

ALTER TABLE `payment_compensation_tasks`
  ADD INDEX `idx_compensation_order_no`(`order_no`),
  ADD INDEX `idx_compensation_transaction_id`(`transaction_id`),
  ADD INDEX `idx_compensation_status`(`status`),
  ADD INDEX `idx_compensation_created_at`(`created_at`);
