-- AlterTable
ALTER TABLE `contents` ADD COLUMN `content_type` VARCHAR(20) NOT NULL DEFAULT 'article';
ALTER TABLE `contents` ADD COLUMN `video_url` VARCHAR(500) NULL;
ALTER TABLE `contents` ADD COLUMN `video_cover` VARCHAR(500) NULL;
ALTER TABLE `contents` ADD COLUMN `video_duration` INT NULL;
ALTER TABLE `contents` ADD COLUMN `placement` JSON NULL;
ALTER TABLE `contents` ADD COLUMN `tags` JSON NULL;
ALTER TABLE `contents` ADD COLUMN `related_product_ids` JSON NULL;
ALTER TABLE `contents` ADD COLUMN `related_activity_id` BIGINT NULL;
ALTER TABLE `contents` ADD COLUMN `is_featured` INT NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX `idx_content_type` ON `contents`(`content_type`);
CREATE INDEX `idx_is_featured` ON `contents`(`is_featured`);
