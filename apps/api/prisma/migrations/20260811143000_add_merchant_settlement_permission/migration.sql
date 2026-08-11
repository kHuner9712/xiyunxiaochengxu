-- Separate financial settlement authority from generic marketing activity permissions.
-- Existing production databases already have seeded roles/permissions; fresh databases run
-- migrations before seed, so this migration also supports the parent/role rows being absent.

INSERT INTO `admin_permissions` (
  `parent_id`, `name`, `code`, `type`, `sort_order`, `created_at`, `updated_at`
)
SELECT
  COALESCE((SELECT `id` FROM `admin_permissions` WHERE `code` = 'order' LIMIT 1), 0),
  '商户结算',
  'order:merchant-settlement',
  2,
  12,
  CURRENT_TIMESTAMP(3),
  CURRENT_TIMESTAMP(3)
WHERE NOT EXISTS (
  SELECT 1 FROM `admin_permissions` WHERE `code` = 'order:merchant-settlement'
);

UPDATE `admin_permissions`
SET
  `parent_id` = COALESCE(
    (SELECT parent_row.`id` FROM (
      SELECT `id` FROM `admin_permissions` WHERE `code` = 'order' LIMIT 1
    ) AS parent_row),
    `parent_id`
  ),
  `name` = '商户结算',
  `type` = 2,
  `sort_order` = 12,
  `updated_at` = CURRENT_TIMESTAMP(3)
WHERE `code` = 'order:merchant-settlement';

INSERT IGNORE INTO `admin_role_permissions` (`role_id`, `permission_id`)
SELECT r.`id`, p.`id`
FROM `admin_roles` r
JOIN `admin_permissions` p ON p.`code` = 'order:merchant-settlement'
WHERE r.`code` = 'finance';
