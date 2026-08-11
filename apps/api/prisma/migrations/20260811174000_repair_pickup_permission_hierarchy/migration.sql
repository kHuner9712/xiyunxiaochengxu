-- Align the persisted permission tree with the Admin router.
-- The /pickup-store parent route requires `pickup`, while the two pages require
-- `pickup:store` / `pickup:verify`. Older seeds created only the child permissions and attached
-- them to `order`, so roles could own the child capability but still be unable to enter the menu.

INSERT INTO `admin_permissions`
  (`parent_id`, `name`, `code`, `type`, `sort_order`, `created_at`, `updated_at`)
SELECT
  0, '自提管理', 'pickup', 1, 10, NOW(), NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM `admin_permissions` WHERE `code` = 'pickup'
);

UPDATE `admin_permissions`
SET
  `parent_id` = 0,
  `name` = '自提管理',
  `type` = 1,
  `sort_order` = 10,
  `updated_at` = NOW()
WHERE `code` = 'pickup';

SET @pickup_permission_id := (
  SELECT `id` FROM `admin_permissions` WHERE `code` = 'pickup' LIMIT 1
);

UPDATE `admin_permissions`
SET
  `parent_id` = @pickup_permission_id,
  `name` = CASE
    WHEN `code` = 'pickup:store' THEN '自提点管理'
    WHEN `code` = 'pickup:verify' THEN '自提核销'
    ELSE `name`
  END,
  `type` = 2,
  `sort_order` = CASE
    WHEN `code` = 'pickup:store' THEN 1
    WHEN `code` = 'pickup:verify' THEN 2
    ELSE `sort_order`
  END,
  `updated_at` = NOW()
WHERE `code` IN ('pickup:store', 'pickup:verify');

-- Preserve custom-role intent: only roles that already possess a pickup child capability inherit
-- the now-required parent menu permission. This does not grant pickup access to unrelated roles.
INSERT IGNORE INTO `admin_role_permissions` (`role_id`, `permission_id`)
SELECT DISTINCT existing.`role_id`, @pickup_permission_id
FROM `admin_role_permissions` existing
JOIN `admin_permissions` child
  ON child.`id` = existing.`permission_id`
WHERE child.`code` IN ('pickup:store', 'pickup:verify')
  AND @pickup_permission_id IS NOT NULL;
