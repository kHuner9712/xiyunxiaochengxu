-- 权益卡 / 超级权益卡 MVP 新增表
-- 仅新增本模块 5 张表及索引，不涉及现有表结构变更
-- 权益包配置
CREATE TABLE `benefit_packages` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `product_id` BIGINT NULL,
  `name` VARCHAR(100) NOT NULL,
  `subtitle` VARCHAR(200) NULL,
  `cover_image` VARCHAR(500) NULL,
  `description` TEXT NULL,
  `price` INT NULL,
  `valid_days` INT NULL,
  `valid_start_at` DATETIME(3) NULL,
  `valid_end_at` DATETIME(3) NULL,
  `status` INT NOT NULL DEFAULT 0,
  `sort_order` INT NOT NULL DEFAULT 0,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  `deleted_at` DATETIME(3) NULL,
  UNIQUE INDEX `benefit_packages_product_id_key` (`product_id`),
  INDEX `idx_benefit_package_status` (`status`),
  INDEX `idx_benefit_package_sort_order` (`sort_order`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 权益包单项权益
CREATE TABLE `benefit_package_items` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `package_id` BIGINT NOT NULL,
  `merchant_promotion_source_id` BIGINT NULL,
  `pickup_store_id` BIGINT NULL,
  `name` VARCHAR(100) NOT NULL,
  `item_type` VARCHAR(20) NOT NULL DEFAULT 'service',
  `description` TEXT NULL,
  `quantity` INT NOT NULL DEFAULT 1,
  `original_value` INT NULL,
  `verify_required` INT NOT NULL DEFAULT 1,
  `status` INT NOT NULL DEFAULT 1,
  `sort_order` INT NOT NULL DEFAULT 0,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  `deleted_at` DATETIME(3) NULL,
  INDEX `idx_benefit_package_item_package_id` (`package_id`),
  INDEX `idx_benefit_package_item_merchant` (`merchant_promotion_source_id`),
  INDEX `idx_benefit_package_item_store` (`pickup_store_id`),
  INDEX `idx_benefit_package_item_type` (`item_type`),
  INDEX `idx_benefit_package_item_status` (`status`),
  INDEX `idx_benefit_package_item_sort_order` (`sort_order`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 用户购买到账的权益包
CREATE TABLE `user_benefit_packages` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `user_id` BIGINT NOT NULL,
  `package_id` BIGINT NOT NULL,
  `order_id` BIGINT NOT NULL,
  `order_item_id` BIGINT NULL,
  `grant_key` VARCHAR(100) NOT NULL,
  `status` VARCHAR(20) NOT NULL DEFAULT 'active',
  `valid_from` DATETIME(3) NOT NULL,
  `valid_to` DATETIME(3) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  `deleted_at` DATETIME(3) NULL,
  UNIQUE INDEX `user_benefit_packages_grant_key_key` (`grant_key`),
  INDEX `idx_user_benefit_package_user_id` (`user_id`),
  INDEX `idx_user_benefit_package_package_id` (`package_id`),
  INDEX `idx_user_benefit_package_order_id` (`order_id`),
  INDEX `idx_user_benefit_package_status` (`status`),
  INDEX `idx_user_benefit_package_valid_to` (`valid_to`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 用户单项权益（每个核销码一条）
CREATE TABLE `user_benefit_entitlements` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `user_benefit_package_id` BIGINT NOT NULL,
  `user_id` BIGINT NOT NULL,
  `package_item_id` BIGINT NOT NULL,
  `verify_code` VARCHAR(16) NOT NULL,
  `status` VARCHAR(20) NOT NULL DEFAULT 'unused',
  `used_at` DATETIME(3) NULL,
  `verified_by_admin_id` BIGINT NULL,
  `verify_remark` VARCHAR(200) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  `deleted_at` DATETIME(3) NULL,
  UNIQUE INDEX `user_benefit_entitlements_verify_code_key` (`verify_code`),
  INDEX `idx_user_benefit_entitlement_pkg_id` (`user_benefit_package_id`),
  INDEX `idx_user_benefit_entitlement_user_id` (`user_id`),
  INDEX `idx_user_benefit_entitlement_item_id` (`package_item_id`),
  INDEX `idx_user_benefit_entitlement_status` (`status`),
  INDEX `idx_user_benefit_entitlement_used_at` (`used_at`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 权益核销日志
CREATE TABLE `user_benefit_verification_logs` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `entitlement_id` BIGINT NOT NULL,
  `user_id` BIGINT NOT NULL,
  `package_id` BIGINT NOT NULL,
  `package_item_id` BIGINT NOT NULL,
  `verify_code` VARCHAR(16) NOT NULL,
  `verifier_type` VARCHAR(20) NOT NULL DEFAULT 'admin',
  `verifier_id` BIGINT NULL,
  `action` VARCHAR(20) NOT NULL DEFAULT 'verify',
  `remark` VARCHAR(200) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `idx_benefit_verify_log_entitlement_id` (`entitlement_id`),
  INDEX `idx_benefit_verify_log_user_id` (`user_id`),
  INDEX `idx_benefit_verify_log_package_id` (`package_id`),
  INDEX `idx_benefit_verify_log_package_item_id` (`package_item_id`),
  INDEX `idx_benefit_verify_log_verify_code` (`verify_code`),
  INDEX `idx_benefit_verify_log_created_at` (`created_at`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
