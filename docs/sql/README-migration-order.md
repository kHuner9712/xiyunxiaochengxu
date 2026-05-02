# SQL 迁移执行顺序

> 所有 SQL 文件默认表前缀为 `sxo_`。
> ⚠️ 如果实际表前缀不同，必须全局替换后再执行。

---

## 执行顺序总览

| 顺序 | 文件 | 类型 | 必须 | 幂等 | 说明 |
|------|------|------|------|------|------|
| 1 | `docs/muying-final-migration.sql` | 基础建表+增量补丁 | ✅ 必须 | ⚠️ 部分不幂等 | 主迁移，A/B/C 三段 |
| 2 | `docs/sql/muying-feature-switch-migration.sql` | 配置初始化 | ✅ 必须 | ✅ 幂等 | 功能开关 INSERT ON DUPLICATE KEY UPDATE |
| 3 | `docs/sql/muying-compliance-center-migration.sql` | 权限菜单+建表 | ✅ 必须 | ✅ 幂等 | INSERT IGNORE + CREATE TABLE IF NOT EXISTS |
| 4 | `docs/sql/muying-sensitive-permission-migration.sql` | 权限菜单 | ✅ 必须 | ✅ 幂等 | INSERT IGNORE，依赖 #3 |
| 5 | `docs/sql/muying-privacy-power-migration.sql` | 权限菜单 | ✅ 必须 | ✅ 幂等 | INSERT IGNORE |
| 6 | `docs/sql/muying-content-sensitive-word-power-migration.sql` | 权限菜单 | ✅ 必须 | ✅ 幂等 | INSERT IGNORE |
| 7 | `docs/sql/muying-content-compliance-migration.sql` | 建表 | ✅ 必须 | ✅ 幂等 | CREATE TABLE IF NOT EXISTS |
| 8 | `docs/sql/muying-feedback-type-migration.sql` | ALTER 加字段 | ✅ 必须 | ✅ 幂等 | information_schema 检查 |
| 9 | `docs/sql/muying-activity-signup-privacy-split-migration.sql` | ALTER 加字段 | ✅ 必须 | ✅ 幂等 | information_schema 检查，默认 `sxo_` |
| 10 | `docs/sql/muying-goods-compliance-migration.sql` | ALTER 加字段 | ✅ 必须 | ✅ 幂等 | information_schema 检查 |
| 11 | `docs/sql/muying-privacy-security-migration.sql` | ALTER 加字段+建表 | ✅ 必须 | ✅ 幂等 | information_schema + CREATE TABLE IF NOT EXISTS |
| 12 | `docs/sql/muying-v1-post-migration.sql` | 统一增量入口 | ✅ 必须 | ⚠️ 部分不幂等 | 包含 P1-P4，依赖 #7 #8 |
| 13 | `docs/sql/xiyun-init-config.sql` | 配置初始化 | ✅ 必须 | ✅ 幂等 | INSERT ON DUPLICATE KEY UPDATE |
| 14 | `docs/sql/xiyun-init-activity-demo.sql` | 演示数据 | ❌ 可选 | ⚠️ 不幂等 | INSERT 无去重，重复执行会插入重复数据 |
| 15 | `docs/sql/xiyun-init-feedback-demo.sql` | 演示数据 | ❌ 可选 | ⚠️ 不幂等 | INSERT 无去重，重复执行会插入重复数据 |

---

## 依赖关系

```
muying-final-migration.sql (主迁移)
  ├── muying-feature-switch-migration.sql (无依赖，可紧接执行)
  ├── muying-compliance-center-migration.sql (无依赖，可紧接执行)
  │     └── muying-sensitive-permission-migration.sql (依赖合规中心 id=770-775)
  ├── muying-privacy-power-migration.sql (无依赖)
  ├── muying-content-sensitive-word-power-migration.sql (无依赖)
  ├── muying-content-compliance-migration.sql (无依赖)
  ├── muying-feedback-type-migration.sql (无依赖)
  ├── muying-activity-signup-privacy-split-migration.sql (无依赖)
  ├── muying-goods-compliance-migration.sql (无依赖)
  ├── muying-privacy-security-migration.sql (无依赖)
  └── muying-v1-post-migration.sql (依赖 feedback-type + content-compliance)
        └── P1 反馈表加 type 字段 → 依赖 #8
        └── P3 敏感词表+合规日志表 → 依赖 #7
        └── P2/P4 权限菜单 → INSERT IGNORE 幂等

xiyun-init-config.sql (配置初始化，在所有迁移之后)
xiyun-init-activity-demo.sql (演示数据，可选)
xiyun-init-feedback-demo.sql (演示数据，可选)
```

---

## 幂等性说明

### ✅ 可安全重复执行

| 文件 | 幂等策略 |
|------|----------|
| muying-feature-switch-migration.sql | `INSERT ... ON DUPLICATE KEY UPDATE` |
| muying-compliance-center-migration.sql | `INSERT IGNORE` + `CREATE TABLE IF NOT EXISTS` |
| muying-sensitive-permission-migration.sql | `INSERT IGNORE` |
| muying-privacy-power-migration.sql | `INSERT IGNORE` |
| muying-content-sensitive-word-power-migration.sql | `INSERT IGNORE` |
| muying-content-compliance-migration.sql | `CREATE TABLE IF NOT EXISTS` |
| muying-feedback-type-migration.sql | `information_schema` 检查字段/索引是否存在 |
| muying-activity-signup-privacy-split-migration.sql | `information_schema` 检查字段是否存在 |
| muying-goods-compliance-migration.sql | `information_schema` 检查字段/索引是否存在 |
| muying-privacy-security-migration.sql | `information_schema` 检查字段是否存在 + `CREATE TABLE IF NOT EXISTS` |
| xiyun-init-config.sql | `INSERT ... ON DUPLICATE KEY UPDATE` |

### ⚠️ 不可重复执行（或部分不幂等）

| 文件 | 不幂等原因 |
|------|-----------|
| muying-final-migration.sql | C 段部分 SQL 不可重复执行：唯一索引只能加一次、C4 枚举修复会修改已有数据 |
| muying-v1-post-migration.sql | P1 ALTER 部分幂等，但 P2/P4 INSERT IGNORE 幂等；整体建议只执行一次 |
| xiyun-init-activity-demo.sql | `INSERT INTO` 无去重，重复执行会产生重复活动数据 |
| xiyun-init-feedback-demo.sql | `INSERT INTO` 无去重，重复执行会产生重复反馈数据 |

---

## 表前缀替换指南

⚠️ **所有 SQL 文件默认使用 `sxo_` 前缀。如果实际表前缀不同，必须替换后再执行。**

### 确认实际前缀

```sql
SHOW TABLES LIKE '%_config';
-- 如果输出 sxo_config → 前缀为 sxo_（默认，无需替换）
-- 如果输出 tp_config  → 前缀为 tp_（需要替换）
```

### 替换命令

```bash
# 替换单个文件（以前缀 tp_ 为例）
sed -i 's/`sxo_/`tp_/g' docs/sql/muying-activity-signup-privacy-split-migration.sql

# 批量替换所有 SQL 文件
find docs/sql/ -name '*.sql' -exec sed -i 's/`sxo_/`tp_/g' {} +
find docs/ -maxdepth 1 -name '*.sql' -exec sed -i 's/`sxo_/`tp_/g' {} +
```

### 特别强调

**`muying-activity-signup-privacy-split-migration.sql`** 默认前缀为 `sxo_`，包含以下语句：

```sql
ALTER TABLE `sxo_activity_signup` ADD COLUMN ...
```

如果实际前缀不是 `sxo_`，必须将 `sxo_activity_signup` 替换为 `<PREFIX>activity_signup`，否则执行会报错 `Table doesn't exist`。

---

## 全新环境 vs 已有环境

### 全新环境（从零部署）

执行顺序 1-15 全部执行。

### 已有 ShopXO 环境（升级）

1. 先执行 #1 的 B 段和 C 段（跳过 A 段已存在的表）
2. 再执行 #2-#13
3. #14-#15 按需执行

### 已执行过部分迁移的环境

1. 确认已执行过哪些迁移（检查 `sxo_config` 中是否有 `feature_xxx_enabled` 配置项）
2. 幂等文件可安全重新执行
3. 不幂等文件（#1 C 段、#12、#14、#15）需人工判断是否跳过
