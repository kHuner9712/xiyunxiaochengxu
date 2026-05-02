# 数据库初始化与迁移执行顺序清单

> 适用阶段：后端部署  
> 执行人：开发/运维  
> 输入物：MySQL 连接信息  
> 输出物：完整可用的数据库  
> 最后更新：2026-04-25

---

## 执行方式

### 方式一：一键脚本（推荐）

```bash
bash scripts/deploy/run-migrations.sh \
  --site-dir /www/wwwroot/xiyun-api \
  --db-host 127.0.0.1 --db-port 3306 \
  --db-name xiyun --db-user xiyun --db-pass YOUR_PASSWORD
```

脚本会自动按顺序执行、检查幂等性、跳过已执行的迁移，并在最后验证关键字段/表/配置/菜单。

### 方式二：手动逐个执行

按下方顺序逐个导入 SQL 文件。

---

## 迁移执行顺序（不可调换）

> **策略说明**：除 shopxo.sql 和 muying-final-migration.sql 外，其余迁移均为幂等迁移，部署脚本会直接执行，执行后统一验证。幂等迁移使用 INSERT IGNORE / ON DUPLICATE KEY UPDATE / CREATE TABLE IF NOT EXISTS / NOT EXISTS 防重复等机制，可安全重复执行。

| 序号 | SQL 文件 | 位置 | 用途 | 可否重复 |
|------|----------|------|------|---------|
| 1 | `shopxo.sql` | `shopxo-backend/config/shopxo.sql` | ShopXO 主库初始化（含 DROP TABLE，仅全新安装） | ❌ |
| 2 | `muying-final-migration.sql` | `docs/muying-final-migration.sql` | 禧孕核心表+补丁+索引（唯一真相源） | ❌ |
| 3 | `muying-feature-switch-migration.sql` | `docs/sql/muying-feature-switch-migration.sql` | 功能开关完整初始化（高风险默认关闭+一期核心默认开启+资质门禁） | ✅ 幂等 |
| 4 | `muying-feedback-review-migration.sql` | `docs/muying-feedback-review-migration.sql` | 反馈审核字段 | ✅ 幂等 |
| 5 | `muying-invite-reward-unify-migration.sql` | `docs/muying-invite-reward-unify-migration.sql` | 邀请奖励统一 | ✅ 幂等 |
| 6 | `muying-privacy-security-migration.sql` | `docs/sql/muying-privacy-security-migration.sql` | 隐私安全字段（phone_hash/privacy_version）+审计日志表 | ✅ 幂等 |
| 7 | `muying-goods-compliance-migration.sql` | `docs/sql/muying-goods-compliance-migration.sql` | 商品合规字段（risk_category/qualification_status） | ✅ 幂等 |
| 8 | `muying-activity-upgrade-migration.sql` | `docs/muying-activity-upgrade-migration.sql` | 活动升级（候补/签到码/分类重构） | ✅ 幂等 |
| 9 | `muying-feature-flag-upgrade-migration.sql` | `docs/muying-feature-flag-upgrade-migration.sql` | 功能开关升级补丁（补充 v2 开关） | ✅ 幂等 |
| 10 | `muying-admin-power-migration.sql` | `docs/muying-admin-power-migration.sql` | 后台菜单权限（禧孕运营 700-760） | ✅ 幂等 |
| 11 | `muying-compliance-center-migration.sql` | `docs/sql/muying-compliance-center-migration.sql` | 合规中心菜单（770-775）+合规日志表+ICP备案配置 | ✅ 幂等 |

### 依赖关系说明

- **步骤 6 必须在步骤 8 之前**：activity-upgrade 的 `is_waitlist` 字段在 `privacy_version` 之后，privacy-security 必须先执行
- **步骤 7 必须在代码访问商品风险字段前**：goods-compliance 提供 risk_category/qualification_status
- **步骤 11 必须在步骤 10 之后**：合规中心菜单依赖禧孕运营一级菜单（id=700）
- **步骤 3 是完整初始化，步骤 9 是升级补丁**：feature-switch 包含所有功能开关+资质门禁，feature-flag-upgrade 只补充 v2 扩展开关

### 演示数据（可选，非必须）

| 文件 | 位置 | 用途 |
|------|------|------|
| `xiyun-init-config.sql` | `docs/sql/xiyun-init-config.sql` | 配置项初始化 |
| `xiyun-init-activity-demo.sql` | `docs/sql/xiyun-init-activity-demo.sql` | 活动演示数据 |
| `xiyun-init-feedback-demo.sql` | `docs/sql/xiyun-init-feedback-demo.sql` | 妈妈说反馈演示数据 |

### 已归档（不要执行，内容已合并到 muying-final-migration.sql 或已被替代）

| 文件 | 归档位置 | 废弃原因 |
|------|----------|---------|
| `muying-migration.sql` | `docs/archive/sql/` | 合并到 final A 段 |
| `muying-mvp-migration.sql` | `docs/archive/sql/` | 合并到 final C 段 |
| `muying-invite-code-migration.sql` | `docs/archive/sql/` | 合并到 final B1+C1+C2 |
| `muying-invite-idempotent-migration.sql` | `docs/archive/sql/` | 合并到 final C3 |
| `muying-enum-normalize-migration.sql` | `docs/archive/sql/` | 合并到 final C4 |
| `muying_feedback.sql` | `docs/archive/sql/` | 合并到 final A4 |
| `muying-feature-switch-migration.sql`（旧版24开关） | `docs/archive/sql/` | 被当前 5 开关精简版替代 |
| `muying-enhancement-migration.sql` | `docs/archive/sql/` | D1-D5 增量功能，一期未启用 |
| `muying-audit-log-migration.sql` | `docs/archive/sql/` | 审计日志表，已合并到 privacy-security |
| `muying-demo-data.sql` | `docs/archive/sql/` | 旧版演示数据，已被 docs/sql/ 下新版本替代 |

---

## 手动执行命令

```bash
DB_HOST="127.0.0.1"; DB_PORT="3306"; DB_NAME="xiyun"; DB_USER="xiyun"; DB_PASS="YOUR_PASSWORD"
SITE_DIR="/www/wwwroot/xiyun-api"
MYSQL="mysql -h $DB_HOST -P $DB_PORT -u $DB_USER -p$DB_PASS $DB_NAME"

# 1. 主库（不可重复）
$MYSQL < $SITE_DIR/config/shopxo.sql

# 2. 禧孕核心表（不可重复）
$MYSQL < $SITE_DIR/../docs/muying-final-migration.sql

# 3. 功能开关完整初始化（幂等）
$MYSQL < $SITE_DIR/../docs/sql/muying-feature-switch-migration.sql

# 4. 反馈审核字段（幂等）
$MYSQL < $SITE_DIR/../docs/muying-feedback-review-migration.sql

# 5. 邀请奖励统一（幂等）
$MYSQL < $SITE_DIR/../docs/muying-invite-reward-unify-migration.sql

# 6. 隐私安全字段+审计日志（幂等）
$MYSQL < $SITE_DIR/../docs/sql/muying-privacy-security-migration.sql

# 7. 商品合规字段（幂等）
$MYSQL < $SITE_DIR/../docs/sql/muying-goods-compliance-migration.sql

# 8. 活动升级（幂等）
$MYSQL < $SITE_DIR/../docs/muying-activity-upgrade-migration.sql

# 9. 功能开关升级补丁（幂等）
$MYSQL < $SITE_DIR/../docs/muying-feature-flag-upgrade-migration.sql

# 10. 后台菜单权限（幂等）
$MYSQL < $SITE_DIR/../docs/muying-admin-power-migration.sql

# 11. 合规中心菜单+日志（幂等）
$MYSQL < $SITE_DIR/../docs/sql/muying-compliance-center-migration.sql
```

---

## 验证

```bash
# 字段验证
$MYSQL -e "SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA='${DB_NAME}' AND TABLE_NAME='sxo_activity' AND COLUMN_NAME IN ('activity_type','waitlist_count');"
$MYSQL -e "SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA='${DB_NAME}' AND TABLE_NAME='sxo_activity_signup' AND COLUMN_NAME IN ('phone_hash','privacy_version','is_waitlist','signup_code');"
$MYSQL -e "SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA='${DB_NAME}' AND TABLE_NAME='sxo_goods' AND COLUMN_NAME IN ('risk_category','qualification_status');"

# 表验证
$MYSQL -e "SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA='${DB_NAME}' AND TABLE_NAME IN ('sxo_muying_audit_log','sxo_muying_compliance_log');"

# 配置项验证
$MYSQL -e "SELECT only_tag, value FROM sxo_config WHERE only_tag LIKE 'feature_%enabled' ORDER BY only_tag;"
$MYSQL -e "SELECT only_tag, value FROM sxo_config WHERE only_tag LIKE 'qualification_%' ORDER BY only_tag;"

# 菜单验证
$MYSQL -e "SELECT id, pid, name, control FROM sxo_power WHERE id IN (700,760,770) ORDER BY id;"

# 一键 Schema 就绪检查
bash scripts/preflight/check-db-schema-readiness.sh --env /www/wwwroot/xiyun-api/.env
```
