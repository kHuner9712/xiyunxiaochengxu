-- The merchant-promotion feature was added to the Prisma schema before its
-- table-creation migration was committed. A later historical migration alters
-- and renames indexes on this table, so fresh databases could not replay the
-- migration chain. Keep this migration idempotent for databases where the
-- table was already created manually or through an earlier deployment.
CREATE TABLE IF NOT EXISTS `merchant_promotion_sources` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(100) NOT NULL,
    `promotion_code` VARCHAR(64) NOT NULL,
    `contact_name` VARCHAR(50) NULL,
    `contact_phone` VARCHAR(20) NULL,
    `scene` VARCHAR(50) NULL,
    `remark` VARCHAR(500) NULL,
    `status` INTEGER NOT NULL DEFAULT 1,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `deleted_at` DATETIME(3) NULL,

    UNIQUE INDEX `uk_merchant_promotion_code`(`promotion_code`),
    INDEX `idx_merchant_promotion_status`(`status`),
    INDEX `idx_merchant_promotion_scene`(`scene`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
