# 数据库迁移执行手册

> 面向：禧孕小程序一期上线
> 前置条件：MySQL 5.7.44，字符集 utf8mb4，排序规则 utf8mb4_general_ci，表前缀 sxo_

---

## SQL 文件清单

| # | 文件 | 类型 | 必须执行 | 允许重复执行 | 前置条件 |
|---|------|------|---------|-------------|---------|
| 1 | `shopxo-backend/config/shopxo.sql` | ShopXO 核心建表 | ✅ | ❌ 仅首次 | 空数据库 |
| 2 | `docs/muying-final-migration.sql` | 母婴基础迁移 | ✅ | ✅ 幂等 | #1 已执行 |
| 3 | `docs/muying-audit-log-migration.sql` | 审计日志表 | ✅ | ✅ 幂等 | #1 已执行 |
| 4 | `docs/muying-feature-switch-migration.sql` | 功能开关配置 | ✅ | ✅ 幂等 | #1 已执行 |
| 5 | `docs/muying-enhancement-migration.sql` | 增强功能迁移 | ✅ | ✅ 幂等 | #2 #3 #4 已执行 |
| 6 | `docs/muying-feedback-review-migration.sql` | 反馈审核流迁移 | ✅ | ✅ 幂等 | #2 已执行 |
| 7 | `docs/muying-invite-reward-unify-migration.sql` | 邀请奖励统一迁移 | ✅ | ✅ 幂等 | #2 已执行 |
| 8 | `docs/muying-feature-flag-upgrade-migration.sql` | 功能开关升级迁移 | ✅ | ✅ 幂等 | #4 已执行 |
| 9 | `docs/muying-demo-data.sql` | 演示数据 | ⬜ 条件执行 | ❌ | #2 #6 已执行 |

> 已废弃文件（不要执行）：`shopxo-backend/sql/muying_feedback.sql`

---

## 推荐执行顺序

### 步骤 1：ShopXO 核心建表（仅首次部署）

```bash
mysql -u root -p shopxo_dev < /www/wwwroot/xiyun-api/config/shopxo.sql
```

**验证**：
```sql
SHOW TABLES LIKE 'sxo_%';
-- 应显示 100+ 张表
```

**回滚**：删除整个数据库重建。

### 步骤 2：母婴基础迁移

```bash
mysql -u root -p shopxo_dev < /www/wwwroot/xiyun-api/docs/muying-final-migration.sql
```

**幂等性说明**：
- A段建表使用 `CREATE TABLE IF NOT EXISTS`
- B段补字段使用 `information_schema.COLUMNS` 条件判断
- C段索引/约束使用条件判断
- 可安全重复执行

**验证**：
```sql
-- 确认4张新表存在
SHOW TABLES LIKE 'sxo_activity%';
SHOW TABLES LIKE 'sxo_invite%';
-- 确认user表有新字段
DESCRIBE sxo_user;
-- 应包含 current_stage, due_date, baby_birthday, invite_code
```

**回滚**：
```sql
DROP TABLE IF EXISTS sxo_activity, sxo_activity_signup, sxo_invite_reward;
ALTER TABLE sxo_user DROP COLUMN current_stage, DROP COLUMN due_date, DROP COLUMN baby_birthday, DROP COLUMN invite_code;
ALTER TABLE sxo_goods DROP COLUMN stage, DROP COLUMN selling_point;
```

### 步骤 3：审计日志表

```bash
mysql -u root -p shopxo_dev < /www/wwwroot/xiyun-api/docs/muying-audit-log-migration.sql
```

**验证**：
```sql
SHOW TABLES LIKE 'sxo_muying_audit_log';
SELECT COUNT(*) FROM sxo_muying_audit_log;
```

**回滚**：
```sql
DROP TABLE IF EXISTS sxo_muying_audit_log;
```

### 步骤 4：功能开关配置

```bash
mysql -u root -p shopxo_dev < /www/wwwroot/xiyun-api/docs/muying-feature-switch-migration.sql
```

**验证**：
```sql
SELECT count(*) FROM sxo_config WHERE only_tag LIKE 'feature_%';
-- 应返回 24
SELECT count(*) FROM sxo_power WHERE control = 'featureswitch';
-- 应返回 1+
```

**回滚**：
```sql
DELETE FROM sxo_config WHERE only_tag LIKE 'feature_%';
DELETE FROM sxo_power WHERE control = 'featureswitch';
```

### 步骤 5：增强功能迁移

```bash
mysql -u root -p shopxo_dev < /www/wwwroot/xiyun-api/docs/muying-enhancement-migration.sql
```

**验证**：
```sql
-- 确认新表
SHOW TABLES LIKE 'sxo_muying_user_tag%';
SHOW TABLES LIKE 'sxo_muying_stat_snapshot';
-- 确认配置项
SELECT count(*) FROM sxo_config WHERE only_tag LIKE 'muying_%';
-- 应返回 10+
-- 确认菜单
SELECT id,name,control FROM sxo_power WHERE control IN ('usertag','inviteconfig','dashboard');
-- 应返回 3 个顶级菜单
-- 确认唯一索引
SHOW INDEX FROM sxo_muying_stat_snapshot WHERE Key_name = 'uk_date_metric';
```

**回滚**：
```sql
DROP TABLE IF EXISTS sxo_muying_user_tag, sxo_muying_user_tag_rel, sxo_muying_stat_snapshot;
ALTER TABLE sxo_user DROP COLUMN admin_remark;
ALTER TABLE sxo_activity DROP COLUMN organizer, DROP COLUMN organizer_phone, DROP COLUMN signup_status;
DELETE FROM sxo_config WHERE only_tag LIKE 'muying_%';
DELETE FROM sxo_power WHERE control IN ('usertag', 'inviteconfig', 'dashboard');
```

### 步骤 6：反馈审核流迁移

```bash
mysql -u root -p shopxo_dev < /www/wwwroot/xiyun-api/docs/muying-feedback-review-migration.sql
```

**说明**：为 `sxo_muying_feedback` 表增加审核字段（review_status / review_remark / review_admin_id / review_time），将"提交即展示"改为"审核后展示"。已有数据会自动标记审核状态。

**验证**：
```sql
DESCRIBE sxo_muying_feedback;
-- 应包含 review_status, review_remark, review_admin_id, review_time
SHOW INDEX FROM sxo_muying_feedback WHERE Key_name = 'idx_review_status';
-- 应返回 1 行
SELECT review_status, COUNT(*) FROM sxo_muying_feedback WHERE is_delete_time=0 GROUP BY review_status;
-- 已有数据应标记为 approved 或 rejected
```

**回滚**：
```sql
ALTER TABLE sxo_muying_feedback DROP COLUMN review_status, DROP COLUMN review_remark, DROP COLUMN review_admin_id, DROP COLUMN review_time;
ALTER TABLE sxo_muying_feedback DROP INDEX idx_review_status;
```

### 步骤 7：演示数据（可选）

```bash
mysql -u root -p shopxo_dev < /www/wwwroot/xiyun-api/docs/muying-demo-data.sql
```

> 仅开发/测试环境使用，生产环境不要执行。

**验证**：
```sql
SELECT count(*) FROM sxo_activity;
-- 应返回 6
SELECT count(*) FROM sxo_activity_signup;
-- 应返回 5
```

**回滚**：
```sql
TRUNCATE sxo_activity;
TRUNCATE sxo_activity_signup;
TRUNCATE sxo_invite_reward;
```

---

## 执行失败处理

| 错误类型 | 原因 | 处理 |
|---------|------|------|
| `Table already exists` | 重复执行建表语句 | 安全忽略，IF NOT EXISTS 已处理 |
| `Duplicate entry` | 重复插入配置项 | 检查 ON DUPLICATE KEY UPDATE 是否生效 |
| `Column already exists` | 重复补字段 | 安全忽略，条件判断已处理 |
| `Unknown column` | 步骤顺序错误 | 确认前置步骤已执行 |
| `Access denied` | 数据库权限不足 | 检查用户权限 |
