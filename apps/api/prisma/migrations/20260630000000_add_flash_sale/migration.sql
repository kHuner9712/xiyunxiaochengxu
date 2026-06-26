-- 限时秒杀 MVP：新增 2 张表（仅 CREATE TABLE + 索引，不触碰现有表结构）

-- 1. 秒杀活动配置
CREATE TABLE `flash_sale_activities` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(100) NOT NULL,
  `product_id` BIGINT NOT NULL,
  `sku_id` BIGINT NULL,
  `flash_price` INT NOT NULL,
  `original_price` INT NULL,
  `stock_limit` INT NOT NULL,
  `sold_count` INT NOT NULL DEFAULT 0,
  `locked_count` INT NOT NULL DEFAULT 0,
  `limit_per_user` INT NOT NULL DEFAULT 1,
  `lock_minutes` INT NOT NULL DEFAULT 15,
  `start_time` DATETIME(3) NOT NULL,
  `end_time` DATETIME(3) NOT NULL,
  `status` INT NOT NULL DEFAULT 1,
  `sort_order` INT NOT NULL DEFAULT 0,
  `description` TEXT NULL,
  `cover_image` VARCHAR(500) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  `deleted_at` DATETIME(3) NULL,
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE INDEX `idx_flash_sale_activity_product` ON `flash_sale_activities`(`product_id`);
CREATE INDEX `idx_flash_sale_activity_sku` ON `flash_sale_activities`(`sku_id`);
CREATE INDEX `idx_flash_sale_activity_status` ON `flash_sale_activities`(`status`);
CREATE INDEX `idx_flash_sale_activity_start` ON `flash_sale_activities`(`start_time`);
CREATE INDEX `idx_flash_sale_activity_end` ON `flash_sale_activities`(`end_time`);
CREATE INDEX `idx_flash_sale_activity_sort` ON `flash_sale_activities`(`sort_order`);

-- 2. 秒杀订单关联与库存锁记录
CREATE TABLE `flash_sale_orders` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `activity_id` BIGINT NOT NULL,
  `user_id` BIGINT NOT NULL,
  `order_id` BIGINT NOT NULL,
  `order_item_id` BIGINT NULL,
  `quantity` INT NOT NULL,
  `flash_price` INT NOT NULL,
  `status` VARCHAR(20) NOT NULL DEFAULT 'pending_payment',
  `lock_expire_at` DATETIME(3) NOT NULL,
  `paid_at` DATETIME(3) NULL,
  `cancelled_at` DATETIME(3) NULL,
  `expired_at` DATETIME(3) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  `deleted_at` DATETIME(3) NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `flash_sale_orders_order_id_key`(`order_id`),
  UNIQUE INDEX `uk_flash_sale_order_activity_user_order`(`activity_id`, `user_id`, `order_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE INDEX `idx_flash_sale_order_activity` ON `flash_sale_orders`(`activity_id`);
CREATE INDEX `idx_flash_sale_order_user` ON `flash_sale_orders`(`user_id`);
CREATE INDEX `idx_flash_sale_order_status` ON `flash_sale_orders`(`status`);
CREATE INDEX `idx_flash_sale_order_lock_expire` ON `flash_sale_orders`(`lock_expire_at`);
