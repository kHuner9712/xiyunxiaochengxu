-- AlterTable: add new columns to share_records
ALTER TABLE `share_records` ADD COLUMN `campaign_id` BIGINT NULL;
ALTER TABLE `share_records` ADD COLUMN `inviter_user_id` BIGINT NULL;
ALTER TABLE `share_records` ADD COLUMN `share_scene` VARCHAR(30) NULL;
ALTER TABLE `share_records` ADD COLUMN `share_path` VARCHAR(500) NULL;
ALTER TABLE `share_records` ADD COLUMN `scene_code` VARCHAR(32) NULL;
ALTER TABLE `share_records` ADD COLUMN `click_count` INT NOT NULL DEFAULT 0;
ALTER TABLE `share_records` ADD COLUMN `register_count` INT NOT NULL DEFAULT 0;
ALTER TABLE `share_records` ADD COLUMN `order_count` INT NOT NULL DEFAULT 0;
ALTER TABLE `share_records` ADD COLUMN `paid_order_amount` INT NOT NULL DEFAULT 0;

-- CreateTable: share_campaigns
CREATE TABLE `share_campaigns` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(100) NOT NULL,
    `type` VARCHAR(30) NOT NULL,
    `reward_type` VARCHAR(20) NOT NULL,
    `inviter_reward_config` JSON NULL,
    `invitee_reward_config` JSON NULL,
    `start_time` DATETIME NOT NULL,
    `end_time` DATETIME NOT NULL,
    `status` INT NOT NULL DEFAULT 1,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
);

-- CreateTable: user_invite_relations
CREATE TABLE `user_invite_relations` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `inviter_user_id` BIGINT NOT NULL,
    `invitee_user_id` BIGINT NOT NULL,
    `source_share_record_id` BIGINT NULL,
    `source_campaign_id` BIGINT NULL,
    `first_visit_at` DATETIME(3) NULL,
    `registered_at` DATETIME(3) NULL,
    `first_paid_order_id` BIGINT NULL,
    `first_paid_at` DATETIME(3) NULL,
    `status` INT NOT NULL DEFAULT 1,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `uk_invitee_user_id`(`invitee_user_id`),
    INDEX `idx_inviter_user_id`(`inviter_user_id`),
    INDEX `idx_source_campaign_id`(`source_campaign_id`),
    PRIMARY KEY (`id`)
);

-- CreateIndex
CREATE INDEX `idx_campaign_id` ON `share_records`(`campaign_id`);
CREATE INDEX `idx_scene_code` ON `share_records`(`scene_code`);
CREATE INDEX `idx_status` ON `share_campaigns`(`status`);
CREATE INDEX `idx_type` ON `share_campaigns`(`type`);

-- AddForeignKey
ALTER TABLE `share_records` ADD CONSTRAINT `fk_share_records_campaign_id` FOREIGN KEY (`campaign_id`) REFERENCES `share_campaigns`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `share_records` ADD CONSTRAINT `fk_share_records_inviter_user_id` FOREIGN KEY (`inviter_user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `user_invite_relations` ADD CONSTRAINT `fk_user_invite_relations_inviter` FOREIGN KEY (`inviter_user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `user_invite_relations` ADD CONSTRAINT `fk_user_invite_relations_invitee` FOREIGN KEY (`invitee_user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `user_invite_relations` ADD CONSTRAINT `fk_user_invite_relations_campaign` FOREIGN KEY (`source_campaign_id`) REFERENCES `share_campaigns`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
