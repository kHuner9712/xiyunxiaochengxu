# 禧孕数据库迁移文件说明

## 执行顺序

| 顺序 | 文件 | 说明 | 幂等性 |
|------|------|------|--------|
| 1 | `docs/muying-final-migration.sql` | 主迁移：建表 + 字段 + 索引 + 配置 + 权限（770-782） | ✅ 可重复执行 |
| 2 | `docs/sql/muying-v1-post-migration.sql` | 后续增量：反馈type字段 + 隐私权限(790-792) + 内容合规表 + 内容合规权限(793-796) | ✅ 可重复执行 |

**必须按顺序执行。** 主迁移必须在增量迁移之前。

## 独立迁移文件（已收口到 muying-v1-post-migration.sql）

以下文件保留作为参考，但**不需要单独执行**，统一入口已包含其内容：

| 文件 | 说明 | 权限 ID |
|------|------|---------|
| `muying-feedback-type-migration.sql` | 反馈表 type 字段 | 无 |
| `muying-privacy-power-migration.sql` | 隐私数据管理权限 | 790-792 |
| `muying-content-compliance-migration.sql` | 内容合规表 | 无 |
| `muying-content-sensitive-word-power-migration.sql` | 内容合规权限 | 793-796 |

## 权限 ID 分配

| ID 范围 | 用途 | 来源 |
|---------|------|------|
| 700-769 | 禧孕运营主菜单 + 子功能 | muying-final-migration.sql |
| 770-775 | 合规中心 | muying-final-migration.sql |
| 780-782 | 敏感数据管理 | muying-final-migration.sql |
| 790-792 | 隐私数据管理 | muying-v1-post-migration.sql |
| 793-796 | 内容合规 | muying-v1-post-migration.sql |

## 初始化数据（可选）

| 文件 | 说明 |
|------|------|
| `xiyun-init-activity-demo.sql` | 活动演示数据 |
| `xiyun-init-config.sql` | 初始配置数据 |
| `xiyun-init-feedback-demo.sql` | 反馈演示数据 |

## 早期迁移文件（已废弃，仅供参考）

| 文件 | 说明 |
|------|------|
| `muying-sensitive-permission-migration.sql` | 敏感数据权限（已收入主迁移） |
| `muying-compliance-center-migration.sql` | 合规中心（已收入主迁移） |
| `muying-feature-switch-migration.sql` | 功能开关（已收入主迁移） |
| `muying-goods-compliance-migration.sql` | 商品合规（已收入主迁移） |
| `muying-privacy-security-migration.sql` | 隐私安全（已收入主迁移） |

## 幂等性保障

- `CREATE TABLE IF NOT EXISTS` — 表已存在时跳过
- `INSERT IGNORE` — 主键/唯一键冲突时跳过
- `INFORMATION_SCHEMA` 检查 — 字段/索引已存在时跳过 ALTER
- 不使用 MySQL 8 专属语法（`ADD COLUMN IF NOT EXISTS` 等）
