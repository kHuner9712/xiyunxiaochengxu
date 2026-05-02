# MySQL 5.7.44 部署说明

> 面向：禧孕小程序正式环境
> 标准环境：宝塔面板 + Nginx 1.28.1 + PHP 8.1.x + MySQL 5.7.44
> 日期：2026-04-23

---

## 1. 版本确认

```bash
mysql -V
# 预期输出: mysql  Ver 14.14 Distrib 5.7.44, for Linux (x86_64)
```

如果版本不是 5.7.44，在宝塔「软件商店→MySQL」中切换版本。

---

## 2. 字符集与排序规则

### 2.1 统一标准

| 配置项 | 标准值 | 说明 |
|--------|--------|------|
| 服务器字符集 | `utf8mb4` | 支持 4 字节 Unicode（含 emoji） |
| 服务器排序规则 | `utf8mb4_general_ci` | 性能优于 `unicode_ci`，项目统一 |
| 客户端字符集 | `utf8mb4` | PHP/PDO 连接时设置 |
| 数据库字符集 | `utf8mb4` | 建库时指定 |
| 表字符集 | `utf8mb4` | 建表时指定 |

### 2.2 禁止使用的排序规则

| 排序规则 | 原因 |
|---------|------|
| `utf8mb4_0900_ai_ci` | MySQL 8.0 专属，5.7 不识别 |
| `utf8mb4_unicode_ci` | 与 `general_ci` 排序结果不同，混用会导致索引/查询异常 |
| `utf8_general_ci` | 3 字节 utf8，不支持 emoji |

### 2.3 验证

```sql
-- 服务器级
SHOW VARIABLES LIKE 'character_set_server';
SHOW VARIABLES LIKE 'collation_server';
-- 预期: utf8mb4 / utf8mb4_general_ci

-- 数据库级
SELECT DEFAULT_CHARACTER_SET_NAME, DEFAULT_COLLATION_NAME
FROM information_schema.SCHEMATA
WHERE SCHEMA_NAME = 'shopxo_dev';
-- 预期: utf8mb4 / utf8mb4_general_ci

-- 表级
SELECT TABLE_NAME, TABLE_COLLATION
FROM information_schema.TABLES
WHERE TABLE_SCHEMA = 'shopxo_dev'
AND TABLE_COLLATION IS NOT NULL
AND TABLE_COLLATION != 'utf8mb4_general_ci';
-- 预期: 0 行（无异常排序规则的表）
```

---

## 3. 索引长度限制

### 3.1 MySQL 5.7 InnoDB 索引键长度规则

| innodb_large_prefix | ROW_FORMAT | 最大索引键长度 |
|---------------------|------------|--------------|
| OFF | COMPACT / REDUNDANT | 767 字节 |
| ON | DYNAMIC / COMPRESSED | 3072 字节 |

MySQL 5.7.7+ 默认 `innodb_large_prefix=ON`，`innodb_file_format=Barracuda`。

### 3.2 本项目索引审计

所有索引均在 767 字节安全线内（utf8mb4 每字符 4 字节）：

| 表 | 索引名 | 索引列 | 字节数 |
|---|--------|--------|--------|
| sxo_user | uk_invite_code | char(8) | 32 |
| sxo_invite_reward | uk_inviter_invitee_event | int+int+char(30) | 128 |
| sxo_muying_user_tag | uk_name | char(30) | 120 |
| sxo_muying_user_tag_rel | uk_user_tag | int+int | 8 |
| sxo_muying_stat_snapshot | uk_date_metric | date+char(60) | 243 |
| sxo_activity | idx_category | char(30) | 120 |
| sxo_activity | idx_stage | char(30) | 120 |
| sxo_activity_signup | idx_activity | int | 4 |
| sxo_activity_signup | idx_user | int | 4 |

### 3.3 新增索引规范

后续新增索引时，需确保索引键总长度 ≤ 767 字节（utf8mb4 下 varchar(191) = 764 字节）。如需对更长字段建索引，必须指定前缀长度：

```sql
-- 正确：对 varchar(500) 使用前缀索引
KEY idx_selling_point (selling_point(191))

-- 错误：直接对 varchar(500) 建索引（2000 字节 > 767 字节）
KEY idx_selling_point (selling_point)
```

---

## 4. Strict Mode 注意事项

### 4.1 MySQL 5.7 默认 SQL Mode

```
STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_AUTO_CREATE_USER,NO_ENGINE_SUBSTITUTION
```

### 4.2 与 MySQL 5.6 / 8.0 的差异

| 差异点 | MySQL 5.6 | MySQL 5.7 | MySQL 8.0 |
|--------|-----------|-----------|-----------|
| 默认严格模式 | 否 | 是 | 是 |
| `NO_AUTO_CREATE_USER` | 可选 | 默认包含 | 已移除 |
| `ONLY_FULL_GROUP_BY` | 可选 | 默认包含 | 默认包含 |
| 整数显示宽度 `INT(11)` | 正常 | 正常（废弃警告） | 正常（废弃警告） |

### 4.3 本项目适配情况

- ✅ 所有字段均声明 `NOT NULL DEFAULT ...`，不会因严格模式报错
- ✅ 时间字段使用 `int unsigned`，不使用 `datetime`/`timestamp`
- ✅ 不依赖 `0000-00-00` 等非法日期
- ✅ 不使用 `NO_AUTO_CREATE_USER`（MySQL 8.0 已移除，但 5.7 包含不影响）

---

## 5. 时间字段与默认值策略

### 5.1 统一规范

| 场景 | 字段类型 | 默认值 | 说明 |
|------|---------|--------|------|
| 创建时间 | `int unsigned NOT NULL DEFAULT 0` | PHP 写入 `time()` | UNIX 时间戳 |
| 更新时间 | `int unsigned NOT NULL DEFAULT 0` | PHP 写入 `time()` | UNIX 时间戳 |
| 业务时间（如预产期） | `int unsigned NOT NULL DEFAULT 0` | PHP 写入 | UNIX 时间戳 |
| 统计日期 | `date NOT NULL` | PHP 写入 | 仅 `sxo_muying_stat_snapshot` |

### 5.2 禁止使用的写法

```sql
-- ❌ MySQL 8.0 表达式默认值（5.7 不支持）
`created_at` datetime DEFAULT (CURRENT_TIMESTAMP)
`updated_at` datetime DEFAULT (CURRENT_TIMESTAMP) ON UPDATE CURRENT_TIMESTAMP

-- ❌ timestamp 默认值（5.7 支持但 2038 溢出）
`add_time` timestamp DEFAULT CURRENT_TIMESTAMP

-- ❌ 非法日期默认值
`date_field` date DEFAULT '0000-00-00'
```

---

## 6. 宝塔 MySQL 5.7 导入步骤

### 6.1 全新部署

```bash
# 1. 宝塔面板创建数据库
#    数据库名: shopxo_dev
#    字符集: utf8mb4
#    排序规则: utf8mb4_general_ci
#    用户名: shopxo_dev（自动创建）
#    密码: 自动生成（记录到 .env）

# 2. 导入 ShopXO 核心建表
mysql -u shopxo_dev -p shopxo_dev < /www/wwwroot/xiyun-api/config/shopxo.sql

# 3. 导入母婴迁移（严格按顺序）
mysql -u shopxo_dev -p shopxo_dev < /www/wwwroot/xiyun-api/docs/muying-final-migration.sql
mysql -u shopxo_dev -p shopxo_dev < /www/wwwroot/xiyun-api/docs/muying-audit-log-migration.sql
mysql -u shopxo_dev -p shopxo_dev < /www/wwwroot/xiyun-api/docs/muying-feature-switch-migration.sql
mysql -u shopxo_dev -p shopxo_dev < /www/wwwroot/xiyun-api/docs/muying-enhancement-migration.sql

# 4. 可选：演示数据（仅开发/测试环境）
mysql -u shopxo_dev -p shopxo_dev < /www/wwwroot/xiyun-api/docs/muying-demo-data.sql

# 5. 可选：初始化配置和演示数据
mysql -u shopxo_dev -p shopxo_dev < /www/wwwroot/xiyun-api/docs/sql/xiyun-init-config.sql
mysql -u shopxo_dev -p shopxo_dev < /www/wwwroot/xiyun-api/docs/sql/xiyun-init-activity-demo.sql
mysql -u shopxo_dev -p shopxo_dev < /www/wwwroot/xiyun-api/docs/sql/xiyun-init-feedback-demo.sql

# 6. 验证
mysql -u shopxo_dev -p shopxo_dev < /www/wwwroot/xiyun-api/scripts/preflight/check-db.sql
```

### 6.2 从 MySQL 8.0 迁移到 5.7

**不能直接导入 MySQL 8.0 的 dump 文件！** 必须按以下步骤操作：

```bash
# 方案 A：在 5.7 环境下重新执行建表 SQL（推荐）
# 1. 在 5.7 上创建空数据库
# 2. 按上述"全新部署"步骤执行所有 SQL
# 3. 从 8.0 导出纯数据（不含 DDL），使用 --no-create-info --complete-insert
mysqldump -h <8.0-host> -u root -p --no-create-info --complete-insert \
  --compatible=mysql56 shopxo_dev > data_only.sql
# 4. 导入纯数据
mysql -u shopxo_dev -p shopxo_dev < data_only.sql

# 方案 B：从 8.0 导出兼容格式
mysqldump -h <8.0-host> -u root -p --compatible=mysql56 \
  --skip-add-drop-table shopxo_dev > compatible_dump.sql
# 然后手动检查 compatible_dump.sql 中是否有 8.0 专属语法
```

---

## 7. MySQL 5.7 vs 8.0 差异速查

| 特性 | MySQL 5.7 | MySQL 8.0 | 本项目是否使用 |
|------|-----------|-----------|--------------|
| 窗口函数 (ROW_NUMBER, RANK) | ❌ | ✅ | ❌ 未使用 |
| CTE (WITH ... AS) | ❌ | ✅ | ❌ 未使用 |
| JSON_TABLE | ❌ | ✅ | ❌ 未使用 |
| 函数索引 | ❌ | ✅ | ❌ 未使用 |
| 表达式默认值 DEFAULT() | ❌ | ✅ | ❌ 未使用 |
| 隐藏列 invisible | ❌ | ✅ | ❌ 未使用 |
| CHECK 约束强制 | ❌ | ✅ | ❌ 未使用 |
| utf8mb4_0900_ai_ci | ❌ | ✅ | ❌ 未使用 |
| ADD COLUMN IF NOT EXISTS | ❌ | ✅ | ❌ 已规避（用 information_schema） |
| 降序索引 DESC | 语法接受但不生效 | 真正支持 | ❌ 未使用 |
| LATERAL 派生表 | ❌ | ✅ | ❌ 未使用 |
| VALUES() 在 ON DUPLICATE KEY 中 | ✅ | ✅（8.0.20 废弃） | ✅ 使用中，5.7 兼容 |

---

## 8. 常见问题

### Q1: 导入 shopxo.sql 报 `Unknown collation: 'utf8mb4_0900_ai_ci'`

**原因**：SQL 文件包含 MySQL 8.0 专属排序规则。
**解决**：本项目已统一使用 `utf8mb4_general_ci`，如果遇到此错误，说明使用了错误的 SQL 文件版本。

### Q2: 导入报 `Index column size too large. The maximum column size is 767 bytes.`

**原因**：`innodb_large_prefix=OFF` 或 `ROW_FORMAT=COMPACT`。
**解决**：
```sql
-- 检查当前设置
SHOW VARIABLES LIKE 'innodb_large_prefix';
SHOW VARIABLES LIKE 'innodb_file_format';

-- 如果 large_prefix=OFF，在 my.cnf 中添加
innodb_large_prefix = ON
innodb_file_format = Barracuda
innodb_file_per_table = ON

-- 重启 MySQL 后重新导入
```

### Q3: `ONLY_FULL_GROUP_BY` 导致查询报错

**原因**：MySQL 5.7 默认启用，SELECT 中的非聚合列必须出现在 GROUP BY 中。
**解决**：本项目使用 ThinkPHP ORM 的 `group()` 方法，生成的 SQL 均符合规范。如果自定义 SQL 报错，需修正 GROUP BY 子句。

### Q4: `NO_AUTO_CREATE_USER` 在 MySQL 8.0 报错

**原因**：MySQL 8.0 已移除此模式。
**解决**：本项目标准环境为 MySQL 5.7.44，此模式正常工作。如果需要在 8.0 上临时运行，需从 sql_mode 中移除 `NO_AUTO_CREATE_USER`。

### Q5: Docker 环境如何使用 MySQL 5.7.44

```bash
# docker-compose.yml 已更新为 mysql:5.7.44
# 重建容器
docker compose down -v
docker compose up -d

# 等待 MySQL 初始化完成
docker compose logs -f mysql
# 看到 "ready for connections" 后即可使用
```
