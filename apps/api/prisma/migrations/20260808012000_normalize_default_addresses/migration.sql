-- Normalize historical address state before the hardened transactional address service is used.
-- For a user with multiple active defaults, keep the most recently updated/highest-id default.
-- For a user with active addresses but no default, promote the most recently updated/highest-id address.

UPDATE `user_addresses` a
INNER JOIN (
  SELECT
    `user_id`,
    SUBSTRING_INDEX(
      GROUP_CONCAT(`id` ORDER BY `updated_at` DESC, `id` DESC SEPARATOR ','),
      ',',
      1
    ) AS `keep_id`
  FROM `user_addresses`
  WHERE `deleted_at` IS NULL
    AND `is_default` = 1
  GROUP BY `user_id`
  HAVING COUNT(*) > 1
) duplicated ON duplicated.`user_id` = a.`user_id`
SET a.`is_default` = CASE
  WHEN CAST(a.`id` AS CHAR) = duplicated.`keep_id` THEN 1
  ELSE 0
END
WHERE a.`deleted_at` IS NULL
  AND a.`is_default` = 1;

UPDATE `user_addresses` a
INNER JOIN (
  SELECT
    active.`user_id`,
    SUBSTRING_INDEX(
      GROUP_CONCAT(active.`id` ORDER BY active.`updated_at` DESC, active.`id` DESC SEPARATOR ','),
      ',',
      1
    ) AS `keep_id`
  FROM `user_addresses` active
  LEFT JOIN `user_addresses` defaults
    ON defaults.`user_id` = active.`user_id`
   AND defaults.`deleted_at` IS NULL
   AND defaults.`is_default` = 1
  WHERE active.`deleted_at` IS NULL
  GROUP BY active.`user_id`
  HAVING MAX(CASE WHEN defaults.`id` IS NULL THEN 0 ELSE 1 END) = 0
) missing_default ON missing_default.`user_id` = a.`user_id`
SET a.`is_default` = 1
WHERE a.`deleted_at` IS NULL
  AND CAST(a.`id` AS CHAR) = missing_default.`keep_id`;
