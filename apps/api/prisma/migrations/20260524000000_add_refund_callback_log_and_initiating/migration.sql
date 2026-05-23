CREATE TABLE `refund_callback_logs` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `out_refund_no` VARCHAR(64) NOT NULL,
  `raw_body` JSON,
  `decrypted_data` JSON,
  `headers` JSON,
  `status` VARCHAR(20) NOT NULL DEFAULT 'orphan',
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,

  PRIMARY KEY (`id`),
  INDEX `idx_out_refund_no` (`out_refund_no`),
  INDEX `idx_status` (`status`),
  INDEX `idx_created_at` (`created_at`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `order_refunds` MODIFY `status` VARCHAR(20) NOT NULL DEFAULT 'initiating';
