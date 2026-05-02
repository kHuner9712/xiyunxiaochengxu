# 活动报名幂等设计（MySQL 5.7 兼容方案）

> [MUYING-二开] 本文档说明活动报名场景下的幂等性现状、风险和改进建议。
> 当前为**方案文档**，未直接修改线上 SQL，后续迭代可按以下任一方案实施。

## 1. 现状分析

### 1.1 当前防重机制（应用层）

`ActivityService::ActivitySignup()` 已实现三层防重：

| 层次 | 机制 | 代码位置 |
|------|------|----------|
| 用户级 | `user_id + activity_id + status IN (0,1)` 查询，存在则拒绝 | ActivityService.php L539-548 |
| 手机号级 | `phone_hash` 查询 + 明文兜底查询，存在则拒绝 | ActivityService.php L550-568 |
| 事务锁 | `SELECT ... FOR UPDATE` 锁定活动行 + `Db::startTrans()` | ActivityService.php L514-518 |

### 1.2 存在的问题

- **无数据库级唯一约束**：纯应用层检查，极端并发下两个请求同时通过 `user_id` 检查后同时 INSERT
- **phone_hash 不是 UNIQUE**：`idx_phone_hash` 是普通索引，不能阻止插入重复 hash
- **MySQL 5.7 不支持 Partial Unique Index**（如 `WHERE is_delete_time=0`），无法直接在 MySQL 5.7 上建带条件的唯一索引

### 1.3 现有索引（来自 muying-final-migration.sql）

```sql
-- sxo_activity_signup 表当前索引（A2 段）
KEY `idx_activity` (`activity_id`),
KEY `idx_user` (`user_id`),
KEY `idx_phone_hash` (`phone_hash`),
KEY `idx_signup_code` (`signup_code`),
KEY `idx_status` (`status`),
KEY `idx_checkin` (`checkin_status`)
```

## 2. 推荐方案（三选一，按推荐度排序）

### 方案一：active_status 字段 + 复合唯一索引（推荐）

**原理**：软删除记录 `active_status` 设为 0，唯一索引约束 `(user_id, activity_id, active_status)`。

```sql
-- 1. 添加字段（默认 1=有效）
ALTER TABLE `sxo_activity_signup` ADD COLUMN `active_status` TINYINT UNSIGNED NOT NULL DEFAULT 1 COMMENT '有效状态(1有效/0无效)';

-- 2. 历史数据填充（已取消/is_delete_time>0 的设为 0）
UPDATE `sxo_activity_signup` SET `active_status` = 0
WHERE `status` = 2 OR `is_delete_time` > 0;

-- 3. 添加唯一索引
ALTER TABLE `sxo_activity_signup` ADD UNIQUE INDEX `uk_user_activity_active` (`user_id`, `activity_id`, `active_status`);
```

**业务层改动**：
- 取消报名时：`UPDATE sxo_activity_signup SET active_status=0, status=2`
- 软删除时：`UPDATE sxo_activity_signup SET active_status=0, is_delete_time=NOW()`
- 新报名 INSERT 时：`active_status=1`，利用 UK 约束自动防重

**优势**：纯 MySQL 5.7 兼容，无需 partial index，历史数据改动小
**劣势**：需修改取消报名和软删除的 SQL

### 方案二：signup_identity_key 字段（备选）

**原理**：生成一个确定性 key `MD5(CONCAT(user_id, '_', activity_id))` 存为唯一字段。

```sql
-- 1. 添加字段
ALTER TABLE `sxo_activity_signup` ADD COLUMN `signup_identity_key` CHAR(32) NOT NULL DEFAULT '' COMMENT '报名幂等键 MD5(user_id+activity_id)';

-- 2. 补充历史数据
UPDATE `sxo_activity_signup` SET `signup_identity_key` = MD5(CONCAT(user_id, '_', activity_id));

-- 3. 添加唯一索引
ALTER TABLE `sxo_activity_signup` ADD UNIQUE INDEX `uk_identity_key` (`signup_identity_key`);
```

**业务层改动**：
- 填报前先计算 identity_key，INSERT 失败时返回 `DataReturn('您已报名该活动', -1)`

**优势**：最简单，不依赖软删除状态
**劣势**：无法区分"已取消后重新报名"场景（取消后的 identity_key 已被占用）；如需支持重新报名，取消时需同时清空 identity_key

### 方案三：独立幂等表（适合复杂幂等场景）

```sql
CREATE TABLE IF NOT EXISTS `sxo_activity_signup_idempotent` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `idempotent_key` CHAR(64) NOT NULL COMMENT '幂等键(订单号/请求ID)',
  `activity_id` INT UNSIGNED NOT NULL,
  `user_id` INT UNSIGNED NOT NULL,
  `signup_id` INT UNSIGNED NOT NULL DEFAULT 0 COMMENT '关联的报名记录ID',
  `expire_time` INT UNSIGNED NOT NULL DEFAULT 0 COMMENT '过期时间(用于清理)',
  `add_time` INT UNSIGNED NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_idempotent_key` (`idempotent_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='报名幂等表';
```

**业务层改动**：与方案二类似，使用独立的幂等键。

**优势**：不影响主表结构，可以按时间定期清理
**劣势**：多一张表，增加查询复杂度

## 3. 临时加固措施（已实施）

在当前未添加数据库级幂等约束的情况下，已有的防护措施：

1. **前端防连点**：`loading` 状态阻止重复提交（UI 层）
2. **后端行锁**：`SELECT ... FOR UPDATE` 锁定活动行，事务内防止并发修改
3. **phone_hash 去重**：`idx_phone_hash` + 应用层检查

### 已知限制

- 极端并发（同一毫秒内两个请求同时进入事务检查阶段）存在**理论上的重复插入可能**
- 概率：生产环境常规 QPS 下极低，但**不是零**

## 4. 实施建议

| 阶段 | 方案 | 风险 |
|------|------|------|
| 体验版（当前） | 保持现状 + 本文档 | 低（体验版并发极低） |
| 正式版 v1.0 | 实施方案一（active_status） | 中（需回归报名/取消/删除全流程） |
| 后续大版本 | 评估后可选方案二/三 | - |

## 5. MySQL 5.7 兼容性确认

- ✅ `ALTER TABLE ... ADD UNIQUE INDEX` — MySQL 5.7 支持
- ✅ `MD5()` 函数 — MySQL 5.7 支持
- ✅ `TINYINT UNSIGNED` — MySQL 5.7 支持
- ❌ Partial Unique Index（`WHERE is_delete_time=0`）— MySQL 5.7 **不支持**，仅 8.0.13+ 支持
- ❌ `ADD COLUMN IF NOT EXISTS` — MySQL 5.7 **不支持**，需用 `information_schema` 预检

## 6. 回滚方案

如需回滚方案一的索引变更：

```sql
ALTER TABLE `sxo_activity_signup` DROP INDEX `uk_user_activity_active`;
ALTER TABLE `sxo_activity_signup` DROP COLUMN `active_status`;
```
