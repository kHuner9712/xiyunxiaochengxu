ALTER TABLE `product_categories`
  ADD COLUMN `compliance_config` JSON NULL;

CREATE TABLE `payment_compensation_tasks` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `order_no` VARCHAR(32) NOT NULL,
  `transaction_id` VARCHAR(64) NULL,
  `amount` INT NULL,
  `status` VARCHAR(20) NOT NULL DEFAULT 'pending',
  `reason` VARCHAR(100) NOT NULL,
  `callback_payload` JSON NULL,
  `retry_count` INT NOT NULL DEFAULT 0,
  `handled_by` VARCHAR(64) NULL,
  `handled_at` DATETIME(3) NULL,
  `resolution` VARCHAR(500) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  INDEX `idx_order_no`(`order_no`),
  INDEX `idx_status`(`status`),
  INDEX `idx_created_at`(`created_at`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
