-- Legacy cleanExpiredPoints could process the same earning more than once because it did not
-- exclude an earning that already had an `expire` ledger row. Restore every positive duplicate
-- after the first expiration for the same source_id. The migration runs once, so the balance
-- repair itself is idempotent under Prisma migration history.

CREATE TEMPORARY TABLE `_duplicate_point_expiry_restore` AS
SELECT
  duplicate_rows.`user_id` AS `user_id`,
  SUM(duplicate_rows.`points`) AS `restore_points`
FROM `points_records` duplicate_rows
INNER JOIN (
  SELECT
    `source_id`,
    MIN(`id`) AS `keep_id`
  FROM `points_records`
  WHERE `source` = 'expire'
    AND `source_id` IS NOT NULL
  GROUP BY `source_id`
  HAVING COUNT(*) > 1
) duplicated
  ON duplicated.`source_id` = duplicate_rows.`source_id`
WHERE duplicate_rows.`source` = 'expire'
  AND duplicate_rows.`id` <> duplicated.`keep_id`
  AND duplicate_rows.`points` > 0
GROUP BY duplicate_rows.`user_id`;

UPDATE `users` u
INNER JOIN `_duplicate_point_expiry_restore` repair
  ON repair.`user_id` = u.`id`
SET u.`available_points` = u.`available_points` + repair.`restore_points`;

-- This is a correction of previously owned points, not a new earning. Do not increase
-- users.total_points. The non-expiring correction lot makes the ledger and available balance
-- consistent for the hardened FIFO expiry reconstruction.
INSERT INTO `points_records` (
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
  repair.`user_id`,
  1,
  repair.`restore_points`,
  u.`available_points`,
  'expire_duplicate_restore',
  NULL,
  CONCAT('历史积分重复过期纠错，恢复', repair.`restore_points`, '积分'),
  NULL,
  NOW(3)
FROM `_duplicate_point_expiry_restore` repair
INNER JOIN `users` u ON u.`id` = repair.`user_id`
WHERE repair.`restore_points` > 0;

DROP TEMPORARY TABLE `_duplicate_point_expiry_restore`;
