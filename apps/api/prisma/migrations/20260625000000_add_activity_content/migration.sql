-- DropForeignKey
ALTER TABLE `activity_products` DROP FOREIGN KEY `activity_products_activity_id_fkey`;

-- DropForeignKey
ALTER TABLE `activity_products` DROP FOREIGN KEY `activity_products_product_id_fkey`;

-- DropForeignKey
ALTER TABLE `admin_operation_logs` DROP FOREIGN KEY `admin_operation_logs_admin_user_id_fkey`;

-- DropForeignKey
ALTER TABLE `admin_role_permissions` DROP FOREIGN KEY `admin_role_permissions_permission_id_fkey`;

-- DropForeignKey
ALTER TABLE `admin_role_permissions` DROP FOREIGN KEY `admin_role_permissions_role_id_fkey`;

-- DropForeignKey
ALTER TABLE `admin_user_roles` DROP FOREIGN KEY `admin_user_roles_admin_user_id_fkey`;

-- DropForeignKey
ALTER TABLE `admin_user_roles` DROP FOREIGN KEY `admin_user_roles_role_id_fkey`;

-- DropForeignKey
ALTER TABLE `aftersale_logs` DROP FOREIGN KEY `aftersale_logs_aftersale_id_fkey`;

-- DropForeignKey
ALTER TABLE `aftersale_orders` DROP FOREIGN KEY `aftersale_orders_order_id_fkey`;

-- DropForeignKey
ALTER TABLE `aftersale_orders` DROP FOREIGN KEY `aftersale_orders_order_item_id_fkey`;

-- DropForeignKey
ALTER TABLE `aftersale_orders` DROP FOREIGN KEY `aftersale_orders_user_id_fkey`;

-- DropForeignKey
ALTER TABLE `baby_profiles` DROP FOREIGN KEY `baby_profiles_user_id_fkey`;

-- DropForeignKey
ALTER TABLE `carts` DROP FOREIGN KEY `carts_product_id_fkey`;

-- DropForeignKey
ALTER TABLE `carts` DROP FOREIGN KEY `carts_sku_id_fkey`;

-- DropForeignKey
ALTER TABLE `carts` DROP FOREIGN KEY `carts_user_id_fkey`;

-- DropForeignKey
ALTER TABLE `order_delivery` DROP FOREIGN KEY `order_delivery_order_id_fkey`;

-- DropForeignKey
ALTER TABLE `order_items` DROP FOREIGN KEY `order_items_order_id_fkey`;

-- DropForeignKey
ALTER TABLE `order_logs` DROP FOREIGN KEY `order_logs_order_id_fkey`;

-- DropForeignKey
ALTER TABLE `order_payments` DROP FOREIGN KEY `order_payments_order_id_fkey`;

-- DropForeignKey
ALTER TABLE `order_refunds` DROP FOREIGN KEY `order_refunds_order_id_fkey`;

-- DropForeignKey
ALTER TABLE `orders` DROP FOREIGN KEY `orders_user_id_fkey`;

-- DropForeignKey
ALTER TABLE `points_records` DROP FOREIGN KEY `points_records_user_id_fkey`;

-- DropForeignKey
ALTER TABLE `product_images` DROP FOREIGN KEY `product_images_product_id_fkey`;

-- DropForeignKey
ALTER TABLE `product_skus` DROP FOREIGN KEY `product_skus_product_id_fkey`;

-- DropForeignKey
ALTER TABLE `product_stock_logs` DROP FOREIGN KEY `product_stock_logs_product_id_fkey`;

-- DropForeignKey
ALTER TABLE `product_stock_logs` DROP FOREIGN KEY `product_stock_logs_sku_id_fkey`;

-- DropForeignKey
ALTER TABLE `share_records` DROP FOREIGN KEY `fk_share_records_campaign_id`;

-- DropForeignKey
ALTER TABLE `share_records` DROP FOREIGN KEY `fk_share_records_inviter_user_id`;

-- DropForeignKey
ALTER TABLE `share_records` DROP FOREIGN KEY `share_records_user_id_fkey`;

-- DropForeignKey
ALTER TABLE `user_addresses` DROP FOREIGN KEY `user_addresses_user_id_fkey`;

-- DropForeignKey
ALTER TABLE `user_coupons` DROP FOREIGN KEY `user_coupons_user_id_fkey`;

-- DropForeignKey
ALTER TABLE `user_invite_relations` DROP FOREIGN KEY `fk_user_invite_relations_campaign`;

-- DropForeignKey
ALTER TABLE `user_invite_relations` DROP FOREIGN KEY `fk_user_invite_relations_invitee`;

-- DropForeignKey
ALTER TABLE `user_invite_relations` DROP FOREIGN KEY `fk_user_invite_relations_inviter`;

-- DropForeignKey
ALTER TABLE `user_member_records` DROP FOREIGN KEY `user_member_records_user_id_fkey`;

-- DropForeignKey
ALTER TABLE `user_profiles` DROP FOREIGN KEY `user_profiles_user_id_fkey`;

-- AlterTable
ALTER TABLE `merchant_promotion_sources` ALTER COLUMN `updated_at` DROP DEFAULT;

-- AlterTable
ALTER TABLE `order_payments` MODIFY `payment_method` VARCHAR(20) NULL DEFAULT 'wechat';

-- AlterTable
ALTER TABLE `orders` MODIFY `source` VARCHAR(20) NULL DEFAULT 'miniprogram',
    MODIFY `picked_up_at` DATETIME(3) NULL;

-- AlterTable
ALTER TABLE `payment_compensation_tasks` MODIFY `handled_at` DATETIME(3) NULL,
    MODIFY `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    MODIFY `updated_at` DATETIME(3) NOT NULL;

-- AlterTable
ALTER TABLE `pickup_stores` MODIFY `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    MODIFY `updated_at` DATETIME(3) NOT NULL,
    MODIFY `deleted_at` DATETIME(3) NULL;

-- AlterTable
ALTER TABLE `share_campaigns` MODIFY `start_time` DATETIME(3) NOT NULL,
    MODIFY `end_time` DATETIME(3) NOT NULL;

-- AlterTable
ALTER TABLE `system_configs` MODIFY `value_type` VARCHAR(20) NULL DEFAULT 'string';

-- CreateTable
CREATE TABLE `activity_contents` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `title` VARCHAR(200) NOT NULL,
    `subtitle` VARCHAR(200) NULL,
    `type` VARCHAR(20) NOT NULL DEFAULT 'article',
    `cover_image` VARCHAR(500) NULL,
    `summary` VARCHAR(500) NULL,
    `content` TEXT NULL,
    `video_url` VARCHAR(500) NULL,
    `linked_product_id` BIGINT NULL,
    `status` INTEGER NOT NULL DEFAULT 0,
    `sort_order` INTEGER NOT NULL DEFAULT 0,
    `view_count` INTEGER NOT NULL DEFAULT 0,
    `starts_at` DATETIME(3) NULL,
    `ends_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` DATETIME(3) NULL,

    INDEX `idx_activity_content_status`(`status`),
    INDEX `idx_activity_content_type`(`type`),
    INDEX `idx_activity_content_sort_order`(`sort_order`),
    INDEX `idx_activity_content_linked_product_id`(`linked_product_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `user_profiles` ADD CONSTRAINT `user_profiles_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `user_addresses` ADD CONSTRAINT `user_addresses_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `baby_profiles` ADD CONSTRAINT `baby_profiles_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `user_member_records` ADD CONSTRAINT `user_member_records_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `points_records` ADD CONSTRAINT `points_records_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `product_skus` ADD CONSTRAINT `product_skus_product_id_fkey` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `product_images` ADD CONSTRAINT `product_images_product_id_fkey` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `product_stock_logs` ADD CONSTRAINT `product_stock_logs_product_id_fkey` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `product_stock_logs` ADD CONSTRAINT `product_stock_logs_sku_id_fkey` FOREIGN KEY (`sku_id`) REFERENCES `product_skus`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `carts` ADD CONSTRAINT `carts_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `carts` ADD CONSTRAINT `carts_product_id_fkey` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `carts` ADD CONSTRAINT `carts_sku_id_fkey` FOREIGN KEY (`sku_id`) REFERENCES `product_skus`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `orders` ADD CONSTRAINT `orders_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `orders` ADD CONSTRAINT `orders_pickup_store_id_fkey` FOREIGN KEY (`pickup_store_id`) REFERENCES `pickup_stores`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `order_items` ADD CONSTRAINT `order_items_order_id_fkey` FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `order_payments` ADD CONSTRAINT `order_payments_order_id_fkey` FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `order_delivery` ADD CONSTRAINT `order_delivery_order_id_fkey` FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `order_logs` ADD CONSTRAINT `order_logs_order_id_fkey` FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `user_coupons` ADD CONSTRAINT `user_coupons_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `activity_products` ADD CONSTRAINT `activity_products_activity_id_fkey` FOREIGN KEY (`activity_id`) REFERENCES `activities`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `activity_products` ADD CONSTRAINT `activity_products_product_id_fkey` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `share_records` ADD CONSTRAINT `share_records_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `share_records` ADD CONSTRAINT `share_records_campaign_id_fkey` FOREIGN KEY (`campaign_id`) REFERENCES `share_campaigns`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `share_records` ADD CONSTRAINT `share_records_inviter_user_id_fkey` FOREIGN KEY (`inviter_user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `user_invite_relations` ADD CONSTRAINT `user_invite_relations_inviter_user_id_fkey` FOREIGN KEY (`inviter_user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `user_invite_relations` ADD CONSTRAINT `user_invite_relations_invitee_user_id_fkey` FOREIGN KEY (`invitee_user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `user_invite_relations` ADD CONSTRAINT `user_invite_relations_source_campaign_id_fkey` FOREIGN KEY (`source_campaign_id`) REFERENCES `share_campaigns`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `aftersale_orders` ADD CONSTRAINT `aftersale_orders_order_id_fkey` FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `aftersale_orders` ADD CONSTRAINT `aftersale_orders_order_item_id_fkey` FOREIGN KEY (`order_item_id`) REFERENCES `order_items`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `aftersale_orders` ADD CONSTRAINT `aftersale_orders_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `aftersale_logs` ADD CONSTRAINT `aftersale_logs_aftersale_id_fkey` FOREIGN KEY (`aftersale_id`) REFERENCES `aftersale_orders`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `order_refunds` ADD CONSTRAINT `order_refunds_order_id_fkey` FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `admin_role_permissions` ADD CONSTRAINT `admin_role_permissions_role_id_fkey` FOREIGN KEY (`role_id`) REFERENCES `admin_roles`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `admin_role_permissions` ADD CONSTRAINT `admin_role_permissions_permission_id_fkey` FOREIGN KEY (`permission_id`) REFERENCES `admin_permissions`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `admin_user_roles` ADD CONSTRAINT `admin_user_roles_admin_user_id_fkey` FOREIGN KEY (`admin_user_id`) REFERENCES `admin_users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `admin_user_roles` ADD CONSTRAINT `admin_user_roles_role_id_fkey` FOREIGN KEY (`role_id`) REFERENCES `admin_roles`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `admin_operation_logs` ADD CONSTRAINT `admin_operation_logs_admin_user_id_fkey` FOREIGN KEY (`admin_user_id`) REFERENCES `admin_users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- RenameIndex
ALTER TABLE `admin_permissions` RENAME INDEX `uk_code` TO `admin_permissions_code_key`;

-- RenameIndex
ALTER TABLE `admin_role_permissions` RENAME INDEX `uk_role_permission` TO `admin_role_permissions_role_id_permission_id_key`;

-- RenameIndex
ALTER TABLE `admin_roles` RENAME INDEX `uk_code` TO `admin_roles_code_key`;

-- RenameIndex
ALTER TABLE `admin_user_roles` RENAME INDEX `uk_admin_role` TO `admin_user_roles_admin_user_id_role_id_key`;

-- RenameIndex
ALTER TABLE `admin_users` RENAME INDEX `uk_username` TO `admin_users_username_key`;

-- RenameIndex
ALTER TABLE `aftersale_orders` RENAME INDEX `uk_aftersale_active_order_item_id` TO `aftersale_orders_active_order_item_id_key`;

-- RenameIndex
ALTER TABLE `aftersale_orders` RENAME INDEX `uk_aftersale_no` TO `aftersale_orders_aftersale_no_key`;

-- RenameIndex
ALTER TABLE `carts` RENAME INDEX `uk_user_sku` TO `carts_user_id_sku_id_key`;

-- RenameIndex
ALTER TABLE `merchant_promotion_sources` RENAME INDEX `uk_merchant_promotion_code` TO `merchant_promotion_sources_promotion_code_key`;

-- RenameIndex
ALTER TABLE `order_payments` RENAME INDEX `idx_transaction_id` TO `order_payments_transaction_id_key`;

-- RenameIndex
ALTER TABLE `order_payments` RENAME INDEX `uk_payment_no` TO `order_payments_payment_no_key`;

-- RenameIndex
ALTER TABLE `order_refunds` RENAME INDEX `uk_out_refund_no` TO `order_refunds_out_refund_no_key`;

-- RenameIndex
ALTER TABLE `order_refunds` RENAME INDEX `uk_refund_no` TO `order_refunds_refund_no_key`;

-- RenameIndex
ALTER TABLE `orders` RENAME INDEX `uk_order_no` TO `orders_order_no_key`;

-- RenameIndex
ALTER TABLE `orders` RENAME INDEX `uk_pickup_code` TO `orders_pickup_code_key`;

-- RenameIndex
ALTER TABLE `payment_compensation_tasks` RENAME INDEX `uk_compensation_order_reason_tx` TO `payment_compensation_tasks_order_no_reason_transaction_id_key`;

-- RenameIndex
ALTER TABLE `points_records` RENAME INDEX `idx_points_records_source_source_id` TO `points_records_source_source_id_key`;

-- RenameIndex
ALTER TABLE `product_skus` RENAME INDEX `idx_sku_code` TO `product_skus_sku_code_key`;

-- RenameIndex
ALTER TABLE `search_keywords` RENAME INDEX `uk_keyword` TO `search_keywords_keyword_key`;

-- RenameIndex
ALTER TABLE `system_configs` RENAME INDEX `uk_group_key` TO `system_configs_group_name_config_key_key`;

-- RenameIndex
ALTER TABLE `user_invite_relations` RENAME INDEX `uk_invitee_user_id` TO `user_invite_relations_invitee_user_id_key`;

-- RenameIndex
ALTER TABLE `users` RENAME INDEX `idx_openid` TO `users_openid_key`;

