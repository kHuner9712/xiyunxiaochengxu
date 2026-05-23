CREATE TABLE `business_events` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `event_type` VARCHAR(50) NOT NULL,
  `biz_type` VARCHAR(30) NOT NULL,
  `biz_id` VARCHAR(64) NULL,
  `level` VARCHAR(20) NOT NULL DEFAULT 'info',
  `message` TEXT NOT NULL,
  `payload` JSON NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  INDEX `idx_event_type` (`event_type`),
  INDEX `idx_biz_type` (`biz_type`),
  INDEX `idx_level` (`level`),
  INDEX `idx_created_at` (`created_at`),

  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
