-- Backfill the repository's default operator/cs/finance roles only when the role has no
-- permissions at all. Existing/manual role customizations are intentionally preserved.
-- Fresh databases may not have seed-created permission rows yet when migrations run; the
-- post-seed helper handles that case.

INSERT INTO `admin_role_permissions` (`role_id`, `permission_id`)
SELECT r.`id`, p.`id`
FROM `admin_roles` r
JOIN `admin_permissions` p ON p.`code` IN (
  'dashboard',
  'product', 'product:list', 'product:create', 'product:edit', 'product:delete', 'product:publish', 'product:stock', 'product:category', 'product:brand',
  'supplier', 'supplier:list', 'supplier:create', 'supplier:edit', 'supplier:delete',
  'order', 'order:list', 'order:detail', 'order:deliver', 'order:remark', 'order:cancel', 'order:aftersale', 'order:aftersale:review', 'pickup:store', 'pickup:verify',
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
      'order', 'order:list', 'order:detail', 'order:deliver', 'order:remark', 'order:cancel', 'order:aftersale', 'order:aftersale:review', 'pickup:store', 'pickup:verify',
      'marketing', 'marketing:coupon', 'marketing:activity', 'marketing:banner', 'marketing:recommendation', 'marketing:decor',
      'share', 'share:campaign', 'share:record', 'share:invite',
      'content', 'content:list', 'content:edit',
      'statistics', 'statistics:index'
    )
  ) = 40;

INSERT INTO `admin_role_permissions` (`role_id`, `permission_id`)
SELECT r.`id`, p.`id`
FROM `admin_roles` r
JOIN `admin_permissions` p ON p.`code` IN (
  'dashboard',
  'order', 'order:list', 'order:detail', 'order:remark', 'order:aftersale', 'order:aftersale:review',
  'user', 'user:list', 'user:detail'
)
WHERE r.`code` = 'cs'
  AND NOT EXISTS (
    SELECT 1 FROM `admin_role_permissions` existing WHERE existing.`role_id` = r.`id`
  )
  AND (
    SELECT COUNT(*) FROM `admin_permissions` required_permissions
    WHERE required_permissions.`code` IN (
      'dashboard',
      'order', 'order:list', 'order:detail', 'order:remark', 'order:aftersale', 'order:aftersale:review',
      'user', 'user:list', 'user:detail'
    )
  ) = 10;

INSERT INTO `admin_role_permissions` (`role_id`, `permission_id`)
SELECT r.`id`, p.`id`
FROM `admin_roles` r
JOIN `admin_permissions` p ON p.`code` IN (
  'dashboard',
  'order', 'order:list', 'order:detail', 'order:aftersale', 'order:aftersale:refund', 'order:export',
  'statistics', 'statistics:index'
)
WHERE r.`code` = 'finance'
  AND NOT EXISTS (
    SELECT 1 FROM `admin_role_permissions` existing WHERE existing.`role_id` = r.`id`
  )
  AND (
    SELECT COUNT(*) FROM `admin_permissions` required_permissions
    WHERE required_permissions.`code` IN (
      'dashboard',
      'order', 'order:list', 'order:detail', 'order:aftersale', 'order:aftersale:refund', 'order:export',
      'statistics', 'statistics:index'
    )
  ) = 9;
