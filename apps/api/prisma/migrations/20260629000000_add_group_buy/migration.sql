-- 本地拼团 / 团购 MVP 新增表
-- 仅新增本模块 3 张表及索引，不涉及现有表结构变更

-- 拼团活动配置
CREATE TABLE `group_buy_activities` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(100) NOT NULL,
  `product_id` BIGINT NOT NULL,
  `sku_id` BIGINT NULL,
  `group_price` INT NOT NULL,
  `original_price` INT NULL,
  `group_size` INT NOT NULL,
  `group_expire_hours` INT NOT NULL DEFAULT 24,
  `stock_limit` INT NULL,
  `sold_count` INT NOT NULL DEFAULT 0,
  `limit_per_user` INT NOT NULL DEFAULT 0,
  `start_time` DATETIME(3) NOT NULL,
  `end_time` DATETIME(3) NOT NULL,
  `status` INT NOT NULL DEFAULT 1,
  `sort_order` INT NOT NULL DEFAULT 0,
  `description` TEXT NULL,
  `cover_image` VARCHAR(500) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  `deleted_at` DATETIME(3) NULL,
  INDEX `idx_group_buy_activity_product` (`product_id`),
  INDEX `idx_group_buy_activity_sku` (`sku_id`),
  INDEX `idx_group_buy_activity_status` (`status`),
  INDEX `idx_group_buy_activity_start` (`start_time`),
  INDEX `idx_group_buy_activity_end` (`end_time`),
  INDEX `idx_group_buy_activity_sort` (`sort_order`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 拼团团单
CREATE TABLE `group_buy_groups` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `activity_id` BIGINT NOT NULL,
  `leader_user_id` BIGINT NOT NULL,
  `status` VARCHAR(20) NOT NULL DEFAULT 'forming',
  `group_no` VARCHAR(32) NOT NULL,
  `current_count` INT NOT NULL DEFAULT 0,
  `target_count` INT NOT NULL,
  `expires_at` DATETIME(3) NOT NULL,
  `success_at` DATETIME(3) NULL,
  `failed_at` DATETIME(3) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  `deleted_at` DATETIME(3) NULL,
  UNIQUE INDEX `group_buy_groups_group_no_key` (`group_no`),
  INDEX `idx_group_buy_group_activity` (`activity_id`),
  INDEX `idx_group_buy_group_leader` (`leader_user_id`),
  INDEX `idx_group_buy_group_status` (`status`),
  INDEX `idx_group_buy_group_expires` (`expires_at`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 拼团成员
CREATE TABLE `group_buy_members` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `group_id` BIGINT NOT NULL,
  `activity_id` BIGINT NOT NULL,
  `user_id` BIGINT NOT NULL,
  `order_id` BIGINT NOT NULL,
  `order_item_id` BIGINT NULL,
  `role` VARCHAR(20) NOT NULL,
  `status` VARCHAR(20) NOT NULL DEFAULT 'pending_payment',
  `paid_at` DATETIME(3) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  `deleted_at` DATETIME(3) NULL,
  UNIQUE INDEX `group_buy_members_order_id_key` (`order_id`),
  UNIQUE INDEX `uk_group_buy_member_group_user` (`group_id`, `user_id`),
  INDEX `idx_group_buy_member_group` (`group_id`),
  INDEX `idx_group_buy_member_activity` (`activity_id`),
  INDEX `idx_group_buy_member_user` (`user_id`),
  INDEX `idx_group_buy_member_status` (`status`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
