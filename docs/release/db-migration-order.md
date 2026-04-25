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
  --site-dir /www/wwwroot/yunxi-api \
  --db-host 127.0.0.1 --db-port 3306 \
  --db-name yunxi --db-user yunxi --db-pass YOUR_PASSWORD
```

脚本会自动按顺序执行、检查幂等性、跳过已执行的迁移。

### 方式二：手动逐个执行

按下方顺序逐个导入 SQL 文件。

---

## 迁移执行顺序（不可调换）

| 序号 | SQL 文件 | 位置 | 用途 | 可否重复 |
|------|----------|------|------|---------|
| 1 | `shopxo.sql` | `shopxo-backend/config/shopxo.sql` | ShopXO 主库初始化（含 DROP TABLE，仅全新安装） | ❌ |
| 2 | `muying-final-migration.sql` | `docs/muying-final-migration.sql` | 孕禧核心表+补丁+索引（唯一真相源） | ❌ |
| 3 | `muying-feedback-review-migration.sql` | `docs/muying-feedback-review-migration.sql` | 反馈审核字段 | ✅ 幂等 |
| 4 | `muying-invite-reward-unify-migration.sql` | `docs/muying-invite-reward-unify-migration.sql` | 邀请奖励统一 | ✅ 幂等 |
| 5 | `muying-feature-flag-upgrade-migration.sql` | `docs/muying-feature-flag-upgrade-migration.sql` | 功能开关配置 | ✅ 幂等 |
| 6 | `muying-admin-power-migration.sql` | `docs/muying-admin-power-migration.sql` | 后台菜单权限 | ✅ 幂等 |

### 演示数据（可选，非必须）

| 文件 | 位置 | 用途 |
|------|------|------|
| `yunxi-init-config.sql` | `docs/sql/yunxi-init-config.sql` | 配置项初始化 |
| `yunxi-init-activity-demo.sql` | `docs/sql/yunxi-init-activity-demo.sql` | 活动演示数据 |
| `yunxi-init-feedback-demo.sql` | `docs/sql/yunxi-init-feedback-demo.sql` | 妈妈说反馈演示数据 |

### 已归档（不要执行，内容已合并到 muying-final-migration.sql 或已被替代）

| 文件 | 归档位置 | 废弃原因 |
|------|----------|---------|
| `muying-migration.sql` | `docs/archive/sql/` | 合并到 final A 段 |
| `muying-mvp-migration.sql` | `docs/archive/sql/` | 合并到 final C 段 |
| `muying-invite-code-migration.sql` | `docs/archive/sql/` | 合并到 final B1+C1+C2 |
| `muying-invite-idempotent-migration.sql` | `docs/archive/sql/` | 合并到 final C3 |
| `muying-enum-normalize-migration.sql` | `docs/archive/sql/` | 合并到 final C4 |
| `muying_feedback.sql` | `docs/archive/sql/` | 合并到 final A4 |
| `muying-feature-switch-migration.sql` | `docs/archive/sql/` | 被 feature-flag-upgrade 替代（24开关→5开关精简版） |
| `muying-enhancement-migration.sql` | `docs/archive/sql/` | D1-D5 增量功能，一期未启用 |
| `muying-audit-log-migration.sql` | `docs/archive/sql/` | 审计日志表，一期未启用 |
| `muying-demo-data.sql` | `docs/archive/sql/` | 旧版演示数据，已被 docs/sql/ 下新版本替代 |

---

## 手动执行命令

```bash
DB_HOST="127.0.0.1"; DB_PORT="3306"; DB_NAME="yunxi"; DB_USER="yunxi"; DB_PASS="YOUR_PASSWORD"
SITE_DIR="/www/wwwroot/yunxi-api"
MYSQL="mysql -h $DB_HOST -P $DB_PORT -u $DB_USER -p$DB_PASS $DB_NAME"

# 1. 主库（不可重复）
$MYSQL < $SITE_DIR/config/shopxo.sql

# 2. 孕禧核心表（不可重复）
$MYSQL < $SITE_DIR/../docs/muying-final-migration.sql

# 3. 反馈审核字段（幂等）
$MYSQL < $SITE_DIR/../docs/muying-feedback-review-migration.sql

# 4. 邀请奖励统一（幂等）
$MYSQL < $SITE_DIR/../docs/muying-invite-reward-unify-migration.sql

# 5. 功能开关升级（幂等）
$MYSQL < $SITE_DIR/../docs/muying-feature-flag-upgrade-migration.sql

# 6. 后台菜单权限（幂等）
$MYSQL < $SITE_DIR/../docs/muying-admin-power-migration.sql
```

---

## 验证

```bash
$MYSQL -e "SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA='${DB_NAME}' AND TABLE_NAME IN ('sxo_activity','sxo_activity_signup','sxo_invite_reward','sxo_muying_feedback','sxo_config','sxo_payment','sxo_user','sxo_power');"
$MYSQL -e "SELECT only_tag, value FROM sxo_config WHERE only_tag LIKE 'feature_%enabled';"
$MYSQL -e "SELECT id, name FROM sxo_power WHERE name='孕禧运营';"
```
