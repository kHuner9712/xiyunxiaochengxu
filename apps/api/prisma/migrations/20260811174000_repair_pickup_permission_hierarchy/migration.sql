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

INSERT INTO `admin_permissions`
  (`parent_id`, `name`, `code`, `type`, `sort_order`, `created_at`, `updated_at`)
SELECT
  @pickup_permission_id, '自提点管理', 'pickup:store', 2, 1, NOW(), NOW()
WHERE @pickup_permission_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM `admin_permissions` WHERE `code` = 'pickup:store'
  );

INSERT INTO `admin_permissions`
  (`parent_id`, `name`, `code`, `type`, `sort_order`, `created_at`, `updated_at`)
SELECT
  @pickup_permission_id, '自提核销', 'pickup:verify', 2, 2, NOW(), NOW()
WHERE @pickup_permission_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM `admin_permissions` WHERE `code` = 'pickup:verify'
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

-- super_admin is defined as full access. If an older database was missing either child row, grant
-- the repaired parent and children explicitly so the persisted role assignment matches that model.
INSERT IGNORE INTO `admin_role_permissions` (`role_id`, `permission_id`)
SELECT super_role.`id`, permission.`id`
FROM `admin_roles` super_role
JOIN `admin_permissions` permission
  ON permission.`code` IN ('pickup', 'pickup:store', 'pickup:verify')
WHERE super_role.`code` = 'super_admin';

-- The earlier default-role migration intentionally seeded an operator only when every required
-- permission already existed. On databases affected by the missing `pickup` parent that condition
-- was false, leaving a zero-permission operator role. Repair only that unambiguous empty-role case;
-- any role with existing/manual permissions remains untouched.
INSERT IGNORE INTO `admin_role_permissions` (`role_id`, `permission_id`)
SELECT r.`id`, p.`id`
FROM `admin_roles` r
JOIN `admin_permissions` p ON p.`code` IN (
  'dashboard',
  'product', 'product:list', 'product:create', 'product:edit', 'product:delete', 'product:publish', 'product:stock', 'product:category', 'product:brand',
  'supplier', 'supplier:list', 'supplier:create', 'supplier:edit', 'supplier:delete',
  'order', 'order:list', 'order:detail', 'order:deliver', 'order:remark', 'order:cancel', 'order:aftersale', 'order:aftersale:review',
  'pickup', 'pickup:store', 'pickup:verify',
  'marketing', 'marketing:coupon', 'marketing:activity', 'marketing:banner', 'marketing:recommendation', 'marketing:decor',
  'share', 'share:campaign', 'share:record', 'share:invite',
  'content', 'content:list', 'content:edit',
  'statistics', 'statistics:index'
)
WHERE r.`code` = 'operator'
  AND NOT EXISTS (
    SELECT 1 FROM `admin_role_permissions` existing WHERE existing.`role_id` = r.`id`
  )
  AND (
    SELECT COUNT(*) FROM `admin_permissions` required_permissions
    WHERE required_permissions.`code` IN (
      'dashboard',
      'product', 'product:list', 'product:create', 'product:edit', 'product:delete', 'product:publish', 'product:stock', 'product:category', 'product:brand',
      'supplier', 'supplier:list', 'supplier:create', 'supplier:edit', 'supplier:delete',
      'order', 'order:list', 'order:detail', 'order:deliver', 'order:remark', 'order:cancel', 'order:aftersale', 'order:aftersale:review',
      'pickup', 'pickup:store', 'pickup:verify',
      'marketing', 'marketing:coupon', 'marketing:activity', 'marketing:banner', 'marketing:recommendation', 'marketing:decor',
      'share', 'share:campaign', 'share:record', 'share:invite',
      'content', 'content:list', 'content:edit',
      'statistics', 'statistics:index'
    )
  ) = 41;
