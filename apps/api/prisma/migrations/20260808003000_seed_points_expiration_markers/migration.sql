-- The legacy expiry cleaner could process the same expired earning repeatedly because it did
-- not persist which earning row had already been handled. We cannot reliably reconstruct
-- whether every pre-upgrade earning was already deducted, so conservatively mark all earnings
-- that were already expired at migration time as historical/handled. This prevents a deployment
-- from unexpectedly deducting old balances again. New expirations are handled exactly once by
-- an `expire` points record whose source_id points to the original earning row.

INSERT IGNORE INTO `points_records` (
  `user_id`,
  `type`,
  `points`,
  `balance`,
  `source`,
  `source_id`,
  `description`,
  `expire_at`,
  `created_at`
)
SELECT
  r.`user_id`,
  3,
  0,
  NULL,
  'expire_marker',
  r.`id`,
  '升级前已到期积分记录保护标记，防止重复过期扣减',
  NULL,
  NOW(3)
FROM `points_records` r
WHERE r.`type` = 1
  AND r.`expire_at` IS NOT NULL
  AND r.`expire_at` <= NOW(3)
  AND NOT EXISTS (
    SELECT 1
    FROM `points_records` marker
    WHERE marker.`source` IN ('expire', 'expire_marker')
      AND marker.`source_id` = r.`id`
  );
