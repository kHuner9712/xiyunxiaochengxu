CREATE TABLE `users` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `openid` VARCHAR(64) NOT NULL,
    `union_id` VARCHAR(64) NULL,
    `phone` VARCHAR(20) NULL,
    `nickname` VARCHAR(50) NULL,
    `avatar_url` VARCHAR(500) NULL,
    `gender` INT NOT NULL DEFAULT 0,
    `member_level_id` BIGINT NULL,
    `growth_value` INT NOT NULL DEFAULT 0,
    `total_points` INT NOT NULL DEFAULT 0,
    `available_points` INT NOT NULL DEFAULT 0,
    `last_login_at` DATETIME(3) NULL,
    `status` INT NOT NULL DEFAULT 1,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` DATETIME(3) NULL,

    INDEX `idx_phone`(`phone`),
    INDEX `idx_member_level_id`(`member_level_id`),
    UNIQUE INDEX `idx_openid`(`openid`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `user_profiles` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `user_id` BIGINT NOT NULL,
    `real_name` VARCHAR(50) NULL,
    `birthday` DATE NULL,
    `baby_count` INT NOT NULL DEFAULT 0,
    `source` VARCHAR(20) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `user_profiles_user_id_key`(`user_id`),
    INDEX `idx_user_id`(`user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `user_addresses` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `user_id` BIGINT NOT NULL,
    `receiver_name` VARCHAR(50) NOT NULL,
    `receiver_phone` VARCHAR(20) NOT NULL,
    `province` VARCHAR(20) NOT NULL,
    `city` VARCHAR(20) NOT NULL,
    `district` VARCHAR(20) NOT NULL,
    `detail_address` VARCHAR(200) NOT NULL,
    `is_default` INT NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` DATETIME(3) NULL,

    INDEX `idx_user_id`(`user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `baby_profiles` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `user_id` BIGINT NOT NULL,
    `nickname` VARCHAR(50) NULL,
    `gender` INT NOT NULL DEFAULT 0,
    `birthday` DATE NOT NULL,
    `current_month_age` INT NULL,
    `avatar_url` VARCHAR(500) NULL,
    `is_default` INT NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` DATETIME(3) NULL,

    INDEX `idx_user_id`(`user_id`),
    INDEX `idx_birthday`(`birthday`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `member_levels` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(20) NOT NULL,
    `icon` VARCHAR(500) NULL,
    `min_growth_value` INT NOT NULL,
    `max_growth_value` INT NULL,
    `discount_rate` INT NULL,
    `points_rate` INT NOT NULL DEFAULT 10,
    `benefits` TEXT NULL,
    `sort_order` INT NOT NULL DEFAULT 0,
    `status` INT NOT NULL DEFAULT 1,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `user_member_records` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `user_id` BIGINT NOT NULL,
    `old_level_id` BIGINT NULL,
    `new_level_id` BIGINT NOT NULL,
    `change_reason` VARCHAR(200) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `idx_user_id`(`user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `points_records` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `user_id` BIGINT NOT NULL,
    `type` INT NOT NULL,
    `points` INT NOT NULL,
    `balance` INT NULL,
    `source` VARCHAR(30) NOT NULL,
    `source_id` BIGINT NULL,
    `description` VARCHAR(200) NULL,
    `expire_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `idx_user_id`(`user_id`),
    INDEX `idx_type`(`type`),
    INDEX `idx_source`(`source`),
    INDEX `idx_expire_at`(`expire_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `suppliers` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(100) NOT NULL,
    `contact_name` VARCHAR(50) NULL,
    `contact_phone` VARCHAR(20) NULL,
    `address` VARCHAR(300) NULL,
    `business_license` VARCHAR(500) NULL,
    `cooperation_start_date` DATE NULL,
    `settlement_type` INT NULL,
    `remark` TEXT NULL,
    `status` INT NOT NULL DEFAULT 1,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` DATETIME(3) NULL,

    INDEX `idx_name`(`name`),
    INDEX `idx_status`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `brands` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(50) NOT NULL,
    `logo` VARCHAR(500) NULL,
    `description` TEXT NULL,
    `sort_order` INT NOT NULL DEFAULT 0,
    `status` INT NOT NULL DEFAULT 1,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` DATETIME(3) NULL,

    INDEX `idx_name`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `product_categories` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `parent_id` BIGINT NOT NULL DEFAULT 0,
    `name` VARCHAR(50) NOT NULL,
    `icon` VARCHAR(500) NULL,
    `sort_order` INT NOT NULL DEFAULT 0,
    `is_show` INT NOT NULL DEFAULT 1,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` DATETIME(3) NULL,

    INDEX `idx_parent_id`(`parent_id`),
    INDEX `idx_sort_order`(`sort_order`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `products` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(200) NOT NULL,
    `category_id` BIGINT NOT NULL,
    `brand_id` BIGINT NULL,
    `supplier_id` BIGINT NULL,
    `main_image` VARCHAR(500) NULL,
    `images` JSON NULL,
    `description` TEXT NULL,
    `attributes` JSON NULL,
    `service_promise` JSON NULL,
    `min_price` INT NULL,
    `max_price` INT NULL,
    `total_sales` INT NOT NULL DEFAULT 0,
    `virtual_sales` INT NOT NULL DEFAULT 0,
    `status` INT NOT NULL DEFAULT 3,
    `sort_order` INT NOT NULL DEFAULT 0,
    `is_recommend` INT NOT NULL DEFAULT 0,
    `recommend_age_min` INT NULL,
    `recommend_age_max` INT NULL,
    `is_period_purchase` INT NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` DATETIME(3) NULL,

    INDEX `idx_category_id`(`category_id`),
    INDEX `idx_brand_id`(`brand_id`),
    INDEX `idx_supplier_id`(`supplier_id`),
    INDEX `idx_status`(`status`),
    INDEX `idx_sort_order`(`sort_order`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `product_skus` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `product_id` BIGINT NOT NULL,
    `sku_code` VARCHAR(50) NULL,
    `specs` JSON NULL,
    `price` INT NOT NULL,
    `original_price` INT NULL,
    `cost_price` INT NULL,
    `stock` INT NOT NULL DEFAULT 0,
    `sales` INT NOT NULL DEFAULT 0,
    `image` VARCHAR(500) NULL,
    `weight` INT NULL,
    `barcode` VARCHAR(50) NULL,
    `status` INT NOT NULL DEFAULT 1,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `idx_sku_code`(`sku_code`),
    INDEX `idx_product_id`(`product_id`),
    INDEX `idx_status`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `product_images` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `product_id` BIGINT NOT NULL,
    `image_url` VARCHAR(500) NOT NULL,
    `sort_order` INT NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `idx_product_id`(`product_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `product_attributes` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `category_id` BIGINT NULL,
    `name` VARCHAR(50) NOT NULL,
    `type` INT NULL,
    `values` JSON NULL,
    `sort_order` INT NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `idx_category_id`(`category_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `product_stock_logs` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `product_id` BIGINT NOT NULL,
    `sku_id` BIGINT NOT NULL,
    `type` INT NOT NULL,
    `quantity` INT NOT NULL,
    `before_stock` INT NULL,
    `after_stock` INT NULL,
    `reason` VARCHAR(200) NULL,
    `operator_id` BIGINT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `idx_product_id`(`product_id`),
    INDEX `idx_sku_id`(`sku_id`),
    INDEX `idx_type`(`type`),
    INDEX `idx_created_at`(`created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `carts` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `user_id` BIGINT NOT NULL,
    `product_id` BIGINT NOT NULL,
    `sku_id` BIGINT NOT NULL,
    `quantity` INT NOT NULL DEFAULT 1,
    `is_selected` INT NOT NULL DEFAULT 1,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `idx_user_id`(`user_id`),
    UNIQUE INDEX `uk_user_sku`(`user_id`, `sku_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `orders` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `order_no` VARCHAR(32) NOT NULL,
    `user_id` BIGINT NOT NULL,
    `status` ENUM('pending_payment', 'paid', 'pending_delivery', 'delivered', 'completed', 'cancelled', 'aftersale') NOT NULL DEFAULT 'pending_payment',
    `total_amount` INT NOT NULL,
    `discount_amount` INT NOT NULL DEFAULT 0,
    `freight_amount` INT NOT NULL DEFAULT 0,
    `points_amount` INT NOT NULL DEFAULT 0,
    `pay_amount` INT NULL,
    `points_deducted` INT NOT NULL DEFAULT 0,
    `coupon_id` BIGINT NULL,
    `coupon_amount` INT NOT NULL DEFAULT 0,
    `activity_discount_amount` INT NOT NULL DEFAULT 0,
    `receiver_name` VARCHAR(50) NOT NULL,
    `receiver_phone` VARCHAR(20) NOT NULL,
    `province` VARCHAR(20) NULL,
    `city` VARCHAR(20) NULL,
    `district` VARCHAR(20) NULL,
    `detail_address` VARCHAR(200) NULL,
    `remark` VARCHAR(200) NULL,
    `admin_remark` VARCHAR(200) NULL,
    `paid_at` DATETIME(3) NULL,
    `delivered_at` DATETIME(3) NULL,
    `completed_at` DATETIME(3) NULL,
    `cancelled_at` DATETIME(3) NULL,
    `cancel_reason` VARCHAR(200) NULL,
    `auto_close_at` DATETIME(3) NULL,
    `auto_complete_at` DATETIME(3) NULL,
    `source` VARCHAR(20) NOT NULL DEFAULT 'miniprogram',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `uk_order_no`(`order_no`),
    INDEX `idx_user_id`(`user_id`),
    INDEX `idx_status`(`status`),
    INDEX `idx_created_at`(`created_at`),
    INDEX `idx_paid_at`(`paid_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `order_items` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `order_id` BIGINT NOT NULL,
    `product_id` BIGINT NOT NULL,
    `sku_id` BIGINT NOT NULL,
    `product_name` VARCHAR(200) NOT NULL,
    `sku_specs` JSON NULL,
    `product_image` VARCHAR(500) NULL,
    `price` INT NOT NULL,
    `original_price` INT NULL,
    `quantity` INT NOT NULL,
    `subtotal` INT NOT NULL,
    `activity_id` BIGINT NULL,
    `activity_type` VARCHAR(20) NULL,
    `activity_discount` INT NOT NULL DEFAULT 0,
    `supplier_id` BIGINT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `idx_order_id`(`order_id`),
    INDEX `idx_product_id`(`product_id`),
    INDEX `idx_supplier_id`(`supplier_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `order_payments` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `order_id` BIGINT NOT NULL,
    `payment_no` VARCHAR(64) NULL,
    `transaction_id` VARCHAR(64) NULL,
    `amount` INT NOT NULL,
    `payment_method` VARCHAR(20) NOT NULL DEFAULT 'wechat',
    `status` INT NOT NULL DEFAULT 1,
    `paid_at` DATETIME(3) NULL,
    `raw_response` JSON NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `uk_payment_no`(`payment_no`),
    UNIQUE INDEX `idx_transaction_id`(`transaction_id`),
    UNIQUE INDEX `order_payments_order_id_key`(`order_id`),
    INDEX `idx_order_id`(`order_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `order_delivery` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `order_id` BIGINT NOT NULL,
    `logistics_company` VARCHAR(50) NULL,
    `logistics_no` VARCHAR(50) NULL,
    `delivery_images` JSON NULL,
    `delivered_at` DATETIME(3) NULL,
    `received_at` DATETIME(3) NULL,
    `logistics_info` JSON NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `order_delivery_order_id_key`(`order_id`),
    INDEX `idx_order_id`(`order_id`),
    INDEX `idx_logistics_no`(`logistics_no`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `order_logs` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `order_id` BIGINT NOT NULL,
    `operator_type` VARCHAR(10) NULL,
    `operator_id` BIGINT NULL,
    `action` VARCHAR(30) NOT NULL,
    `content` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `idx_order_id`(`order_id`),
    INDEX `idx_created_at`(`created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `coupons` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(50) NOT NULL,
    `type` INT NOT NULL,
    `value` INT NOT NULL,
    `min_amount` INT NOT NULL DEFAULT 0,
    `discount_limit` INT NULL,
    `total_count` INT NOT NULL DEFAULT 0,
    `received_count` INT NOT NULL DEFAULT 0,
    `used_count` INT NOT NULL DEFAULT 0,
    `per_limit` INT NOT NULL DEFAULT 1,
    `start_time` DATETIME(3) NOT NULL,
    `end_time` DATETIME(3) NOT NULL,
    `valid_days` INT NOT NULL DEFAULT 0,
    `applicable_type` INT NOT NULL DEFAULT 1,
    `applicable_ids` JSON NULL,
    `member_level_id` BIGINT NULL,
    `is_new_user` INT NOT NULL DEFAULT 0,
    `status` INT NOT NULL DEFAULT 1,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `idx_type`(`type`),
    INDEX `idx_status`(`status`),
    INDEX `idx_start_time`(`start_time`),
    INDEX `idx_end_time`(`end_time`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `user_coupons` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `user_id` BIGINT NOT NULL,
    `coupon_id` BIGINT NOT NULL,
    `status` INT NOT NULL DEFAULT 1,
    `used_order_id` BIGINT NULL,
    `used_at` DATETIME(3) NULL,
    `expire_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `idx_user_id`(`user_id`),
    INDEX `idx_coupon_id`(`coupon_id`),
    INDEX `idx_status`(`status`),
    INDEX `idx_expire_at`(`expire_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `activities` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(100) NOT NULL,
    `type` VARCHAR(20) NOT NULL,
    `description` TEXT NULL,
    `rules` JSON NULL,
    `banner_image` VARCHAR(500) NULL,
    `start_time` DATETIME(3) NOT NULL,
    `end_time` DATETIME(3) NOT NULL,
    `status` INT NOT NULL DEFAULT 1,
    `sort_order` INT NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `idx_type`(`type`),
    INDEX `idx_status`(`status`),
    INDEX `idx_start_time`(`start_time`),
    INDEX `idx_end_time`(`end_time`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `activity_products` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `activity_id` BIGINT NOT NULL,
    `product_id` BIGINT NOT NULL,
    `sku_id` BIGINT NULL,
    `activity_price` INT NULL,
    `activity_stock` INT NULL,
    `activity_sales` INT NOT NULL DEFAULT 0,
    `limit_per_user` INT NOT NULL DEFAULT 0,
    `sort_order` INT NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `idx_activity_id`(`activity_id`),
    INDEX `idx_product_id`(`product_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `promotion_rules` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(100) NOT NULL,
    `type` VARCHAR(20) NOT NULL,
    `conditions` JSON NULL,
    `gift_product_id` BIGINT NULL,
    `gift_sku_id` BIGINT NULL,
    `gift_stock` INT NULL,
    `start_time` DATETIME(3) NULL,
    `end_time` DATETIME(3) NULL,
    `status` INT NOT NULL DEFAULT 1,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `banners` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `title` VARCHAR(100) NULL,
    `image` VARCHAR(500) NOT NULL,
    `link_type` INT NULL,
    `link_value` VARCHAR(200) NULL,
    `sort_order` INT NOT NULL DEFAULT 0,
    `status` INT NOT NULL DEFAULT 1,
    `start_time` DATETIME(3) NULL,
    `end_time` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `idx_sort_order`(`sort_order`),
    INDEX `idx_status`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `home_sections` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `type` VARCHAR(20) NOT NULL,
    `title` VARCHAR(50) NULL,
    `config` JSON NULL,
    `sort_order` INT NOT NULL DEFAULT 0,
    `status` INT NOT NULL DEFAULT 1,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `idx_sort_order`(`sort_order`),
    INDEX `idx_status`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `share_records` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `user_id` BIGINT NOT NULL,
    `share_type` VARCHAR(20) NOT NULL,
    `share_id` BIGINT NULL,
    `share_channel` VARCHAR(20) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `idx_user_id`(`user_id`),
    INDEX `idx_share_type`(`share_type`),
    INDEX `idx_share_id`(`share_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `aftersale_orders` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `aftersale_no` VARCHAR(32) NOT NULL,
    `order_id` BIGINT NOT NULL,
    `order_item_id` BIGINT NOT NULL,
    `user_id` BIGINT NOT NULL,
    `type` INT NOT NULL,
    `reason` VARCHAR(200) NOT NULL,
    `description` TEXT NULL,
    `images` JSON NULL,
    `status` ENUM('pending_review', 'approved', 'rejected', 'returned', 'refunded', 'closed') NOT NULL DEFAULT 'pending_review',
    `refund_amount` INT NULL,
    `reject_reason` VARCHAR(200) NULL,
    `return_logistics_company` VARCHAR(50) NULL,
    `return_logistics_no` VARCHAR(50) NULL,
    `admin_id` BIGINT NULL,
    `reviewed_at` DATETIME(3) NULL,
    `refunded_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `uk_aftersale_no`(`aftersale_no`),
    INDEX `idx_order_id`(`order_id`),
    INDEX `idx_user_id`(`user_id`),
    INDEX `idx_status`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `aftersale_logs` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `aftersale_id` BIGINT NOT NULL,
    `operator_type` VARCHAR(10) NULL,
    `operator_id` BIGINT NULL,
    `action` VARCHAR(30) NOT NULL,
    `content` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `idx_aftersale_id`(`aftersale_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `content_categories` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(50) NOT NULL,
    `icon` VARCHAR(500) NULL,
    `sort_order` INT NOT NULL DEFAULT 0,
    `status` INT NOT NULL DEFAULT 1,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `contents` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `category_id` BIGINT NULL,
    `title` VARCHAR(200) NOT NULL,
    `cover_image` VARCHAR(500) NULL,
    `content` TEXT NOT NULL,
    `summary` VARCHAR(500) NULL,
    `view_count` INT NOT NULL DEFAULT 0,
    `sort_order` INT NOT NULL DEFAULT 0,
    `status` INT NOT NULL DEFAULT 2,
    `published_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` DATETIME(3) NULL,

    INDEX `idx_category_id`(`category_id`),
    INDEX `idx_status`(`status`),
    INDEX `idx_published_at`(`published_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `admin_users` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `username` VARCHAR(50) NOT NULL,
    `password` VARCHAR(200) NOT NULL,
    `real_name` VARCHAR(50) NULL,
    `avatar` VARCHAR(500) NULL,
    `phone` VARCHAR(20) NULL,
    `status` INT NOT NULL DEFAULT 1,
    `last_login_at` DATETIME(3) NULL,
    `last_login_ip` VARCHAR(50) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` DATETIME(3) NULL,

    UNIQUE INDEX `uk_username`(`username`),
    INDEX `idx_phone`(`phone`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `admin_roles` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(50) NOT NULL,
    `code` VARCHAR(50) NOT NULL,
    `description` VARCHAR(200) NULL,
    `status` INT NOT NULL DEFAULT 1,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `uk_code`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `admin_permissions` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `parent_id` BIGINT NOT NULL DEFAULT 0,
    `name` VARCHAR(50) NOT NULL,
    `code` VARCHAR(50) NOT NULL,
    `type` INT NOT NULL DEFAULT 1,
    `sort_order` INT NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `uk_code`(`code`),
    INDEX `idx_parent_id`(`parent_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `admin_role_permissions` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `role_id` BIGINT NOT NULL,
    `permission_id` BIGINT NOT NULL,

    INDEX `idx_role_id`(`role_id`),
    INDEX `idx_permission_id`(`permission_id`),
    UNIQUE INDEX `uk_role_permission`(`role_id`, `permission_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `admin_user_roles` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `admin_user_id` BIGINT NOT NULL,
    `role_id` BIGINT NOT NULL,

    INDEX `idx_admin_user_id`(`admin_user_id`),
    INDEX `idx_role_id`(`role_id`),
    UNIQUE INDEX `uk_admin_role`(`admin_user_id`, `role_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `admin_operation_logs` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `admin_user_id` BIGINT NOT NULL,
    `module` VARCHAR(30) NULL,
    `action` VARCHAR(30) NULL,
    `target_type` VARCHAR(30) NULL,
    `target_id` BIGINT NULL,
    `content` TEXT NULL,
    `ip` VARCHAR(50) NULL,
    `user_agent` VARCHAR(500) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `idx_admin_user_id`(`admin_user_id`),
    INDEX `idx_module`(`module`),
    INDEX `idx_created_at`(`created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `file_assets` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `file_name` VARCHAR(200) NULL,
    `original_name` VARCHAR(200) NULL,
    `file_path` VARCHAR(500) NOT NULL,
    `file_size` BIGINT NULL,
    `file_type` VARCHAR(20) NULL,
    `mime_type` VARCHAR(50) NULL,
    `storage_type` INT NOT NULL DEFAULT 1,
    `bucket` VARCHAR(100) NULL,
    `url` VARCHAR(500) NULL,
    `group_name` VARCHAR(50) NULL,
    `uploader_id` BIGINT NULL,
    `uploader_type` VARCHAR(10) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `idx_file_type`(`file_type`),
    INDEX `idx_group_name`(`group_name`),
    INDEX `idx_uploader_id`(`uploader_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `system_configs` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `group_name` VARCHAR(30) NOT NULL,
    `config_key` VARCHAR(50) NOT NULL,
    `config_value` TEXT NULL,
    `value_type` VARCHAR(20) NOT NULL DEFAULT 'string',
    `description` VARCHAR(200) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `uk_group_key`(`group_name`, `config_key`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `search_keywords` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `keyword` VARCHAR(100) NOT NULL,
    `search_count` INT NOT NULL DEFAULT 0,
    `status` INT NOT NULL DEFAULT 1,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `uk_keyword`(`keyword`),
    INDEX `idx_search_count`(`search_count`),
    INDEX `idx_status`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `users` ADD CONSTRAINT `users_member_level_id_fkey` FOREIGN KEY (`member_level_id`) REFERENCES `member_levels`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `user_profiles` ADD CONSTRAINT `user_profiles_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `user_addresses` ADD CONSTRAINT `user_addresses_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `baby_profiles` ADD CONSTRAINT `baby_profiles_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `user_member_records` ADD CONSTRAINT `user_member_records_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `user_member_records` ADD CONSTRAINT `user_member_records_new_level_id_fkey` FOREIGN KEY (`new_level_id`) REFERENCES `member_levels`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `points_records` ADD CONSTRAINT `points_records_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `products` ADD CONSTRAINT `products_category_id_fkey` FOREIGN KEY (`category_id`) REFERENCES `product_categories`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `products` ADD CONSTRAINT `products_brand_id_fkey` FOREIGN KEY (`brand_id`) REFERENCES `brands`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `products` ADD CONSTRAINT `products_supplier_id_fkey` FOREIGN KEY (`supplier_id`) REFERENCES `suppliers`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `product_skus` ADD CONSTRAINT `product_skus_product_id_fkey` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `product_images` ADD CONSTRAINT `product_images_product_id_fkey` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `product_attributes` ADD CONSTRAINT `product_attributes_category_id_fkey` FOREIGN KEY (`category_id`) REFERENCES `product_categories`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `product_stock_logs` ADD CONSTRAINT `product_stock_logs_product_id_fkey` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `product_stock_logs` ADD CONSTRAINT `product_stock_logs_sku_id_fkey` FOREIGN KEY (`sku_id`) REFERENCES `product_skus`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `carts` ADD CONSTRAINT `carts_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `carts` ADD CONSTRAINT `carts_product_id_fkey` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `carts` ADD CONSTRAINT `carts_sku_id_fkey` FOREIGN KEY (`sku_id`) REFERENCES `product_skus`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `orders` ADD CONSTRAINT `orders_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `order_items` ADD CONSTRAINT `order_items_order_id_fkey` FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `order_items` ADD CONSTRAINT `order_items_product_id_fkey` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `order_items` ADD CONSTRAINT `order_items_sku_id_fkey` FOREIGN KEY (`sku_id`) REFERENCES `product_skus`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `order_payments` ADD CONSTRAINT `order_payments_order_id_fkey` FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `order_delivery` ADD CONSTRAINT `order_delivery_order_id_fkey` FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `order_logs` ADD CONSTRAINT `order_logs_order_id_fkey` FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `user_coupons` ADD CONSTRAINT `user_coupons_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `user_coupons` ADD CONSTRAINT `user_coupons_coupon_id_fkey` FOREIGN KEY (`coupon_id`) REFERENCES `coupons`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `activity_products` ADD CONSTRAINT `activity_products_activity_id_fkey` FOREIGN KEY (`activity_id`) REFERENCES `activities`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `activity_products` ADD CONSTRAINT `activity_products_product_id_fkey` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `activity_products` ADD CONSTRAINT `activity_products_sku_id_fkey` FOREIGN KEY (`sku_id`) REFERENCES `product_skus`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `share_records` ADD CONSTRAINT `share_records_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `aftersale_orders` ADD CONSTRAINT `aftersale_orders_order_id_fkey` FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `aftersale_orders` ADD CONSTRAINT `aftersale_orders_order_item_id_fkey` FOREIGN KEY (`order_item_id`) REFERENCES `order_items`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `aftersale_orders` ADD CONSTRAINT `aftersale_orders_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `aftersale_logs` ADD CONSTRAINT `aftersale_logs_aftersale_id_fkey` FOREIGN KEY (`aftersale_id`) REFERENCES `aftersale_orders`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `contents` ADD CONSTRAINT `contents_category_id_fkey` FOREIGN KEY (`category_id`) REFERENCES `content_categories`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `admin_user_roles` ADD CONSTRAINT `admin_user_roles_admin_user_id_fkey` FOREIGN KEY (`admin_user_id`) REFERENCES `admin_users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `admin_user_roles` ADD CONSTRAINT `admin_user_roles_role_id_fkey` FOREIGN KEY (`role_id`) REFERENCES `admin_roles`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `admin_role_permissions` ADD CONSTRAINT `admin_role_permissions_role_id_fkey` FOREIGN KEY (`role_id`) REFERENCES `admin_roles`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `admin_role_permissions` ADD CONSTRAINT `admin_role_permissions_permission_id_fkey` FOREIGN KEY (`permission_id`) REFERENCES `admin_permissions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `admin_operation_logs` ADD CONSTRAINT `admin_operation_logs_admin_user_id_fkey` FOREIGN KEY (`admin_user_id`) REFERENCES `admin_users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
