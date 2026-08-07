-- Quarantine historical promotion activities that cannot be executed by the current checkout contract.
-- Do not delete records: operators can repair the configuration and explicitly re-enable them later.

UPDATE `group_buy_activities` AS a
LEFT JOIN `product_skus` AS s ON s.`id` = a.`sku_id`
LEFT JOIN `products` AS p ON p.`id` = a.`product_id`
SET a.`status` = 0
WHERE a.`deleted_at` IS NULL
  AND a.`status` = 1
  AND (
    a.`sku_id` IS NULL
    OR s.`id` IS NULL
    OR s.`status` <> 1
    OR s.`product_id` <> a.`product_id`
    OR p.`id` IS NULL
    OR p.`status` <> 1
    OR COALESCE(p.`fulfillment_type`, 'delivery') NOT IN ('delivery', 'pickup')
    OR a.`group_price` > s.`price`
  );

UPDATE `flash_sale_activities` AS a
LEFT JOIN `product_skus` AS s ON s.`id` = a.`sku_id`
LEFT JOIN `products` AS p ON p.`id` = a.`product_id`
SET a.`status` = 0
WHERE a.`deleted_at` IS NULL
  AND a.`status` = 1
  AND (
    a.`sku_id` IS NULL
    OR s.`id` IS NULL
    OR s.`status` <> 1
    OR s.`product_id` <> a.`product_id`
    OR p.`id` IS NULL
    OR p.`status` <> 1
    OR COALESCE(p.`fulfillment_type`, 'delivery') NOT IN ('delivery', 'pickup')
    OR a.`flash_price` > s.`price`
  );
