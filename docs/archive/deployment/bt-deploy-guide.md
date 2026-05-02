# 宝塔部署实施文档

> 面向：禧孕小程序一期上线部署
> 环境：宝塔面板 + Nginx 1.28 + MySQL 5.7.44 + PHP 8.1
> 日期：2026-04-23

---

## 1. 服务器目录规划

| 目录         | 建议路径                               | 说明                            |
| ------------ | -------------------------------------- | ------------------------------- |
| 后端根目录   | `/www/wwwroot/xiyun-api`               | ShopXO 后端代码，Git clone 到此 |
| Nginx root   | `/www/wwwroot/xiyun-api`               | 指向项目根目录（不是 public/）  |
| 上传目录     | `/www/wwwroot/xiyun-api/public/upload` | 自动创建，需可写                |
| 日志目录     | `/www/wwwroot/xiyun-api/runtime/log`   | 自动创建，需可写                |
| 缓存目录     | `/www/wwwroot/xiyun-api/runtime/cache` | 自动创建，需可写                |
| 备份目录     | `/www/backup/xiyun`                    | 数据库+代码备份                 |
| uni-app 源码 | `/www/wwwroot/xiyun-uniapp`            | 仅构建时使用，不对外暴露        |

> **关键说明**：ShopXO 的入口文件 `api.php`、`adminwlmqhs.php`、`index.php` 都在项目根目录下（不在 public/ 下），它们内部 require 到 `public/` 下的对应文件。因此 Nginx root 必须指向项目根目录，不能指向 public/。

## 2. 宝塔站点创建

### 2.1 创建站点

| 配置项   | 值                                 |
| -------- | ---------------------------------- |
| 域名     | `api.xiyun.com`（替换为实际域名）  |
| 根目录   | `/www/wwwroot/xiyun-api`           |
| 运行目录 | `/`（宝塔面板设置，即项目根目录）  |
| PHP版本  | PHP-81                             |
| HTTPS    | 域名备案完成后开启，当前可暂不开启 |

### 2.2 后台入口安全

ShopXO 后台入口文件名为 `adminwlmqhs.php`（已混淆），不要改回 `admin.php`。
后台访问地址：`https://api.xiyun.com/adminwlmqhs.php`

## 3. Nginx 配置

### 3.1 伪静态配置（必须）

在宝塔「网站→伪静态」中填入：

```nginx
location / {
    if (!-e $request_filename) {
        rewrite ^(.*)$ /index.php?s=/$1 last;
    }
}
```

### 3.2 完整 Nginx 配置建议

```nginx
server {
    listen 80;
    server_name api.xiyun.com;
    root /www/wwwroot/xiyun-api;
    index index.php index.html;

    # 伪静态
    location / {
        if (!-e $request_filename) {
            rewrite ^(.*)$ /index.php?s=/$1 last;
        }
    }

    # PHP处理
    location ~ \.php$ {
        fastcgi_pass unix:/tmp/php-cgi-81.sock;
        fastcgi_index index.php;
        fastcgi_param SCRIPT_FILENAME $document_root$fastcgi_script_name;
        include fastcgi_params;
    }

    # 静态资源缓存
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 30d;
        access_log off;
    }

    # 上传大小限制
    client_max_body_size 20m;

    # 超时设置
    fastcgi_read_timeout 300;
    client_body_timeout 300;

    # 禁止访问敏感目录
    location ~* ^/(runtime|vendor|app|config|extend|route)/ {
        deny all;
    }

    # 禁止访问隐藏文件
    location ~ /\. {
        deny all;
    }

    # 日志
    access_log /www/wwwlogs/xiyun-api.log;
    error_log /www/wwwlogs/xiyun-api.error.log;
}
```

## 4. PHP 8.1 配置

### 4.1 必要扩展检查

在宝塔「软件商店→PHP-8.1→设置→安装扩展」中确认以下扩展已安装：

| 扩展      | 必须 | 说明           |
| --------- | ---- | -------------- |
| mysqli    | ✅   | MySQL 连接     |
| pdo_mysql | ✅   | PDO MySQL      |
| gd        | ✅   | 图片处理       |
| curl      | ✅   | HTTP 请求      |
| mbstring  | ✅   | 多字节字符串   |
| openssl   | ✅   | 加密/HTTPS     |
| json      | ✅   | JSON 处理      |
| fileinfo  | ✅   | 文件类型检测   |
| redis     | ⬜   | 可选，缓存加速 |
| opcache   | ✅   | 性能优化       |

### 4.2 PHP 配置调整

在宝塔「PHP-8.1→设置→配置文件」中修改：

```ini
upload_max_filesize = 20M
post_max_size = 20M
max_execution_time = 300
memory_limit = 256M

; Opcache 建议
opcache.enable = 1
opcache.memory_consumption = 128
opcache.interned_strings_buffer = 8
opcache.max_accelerated_files = 4000
opcache.validate_timestamps = 0
opcache.save_comments = 1
```

> `validate_timestamps = 0` 生产环境关闭时间戳校验以提升性能，更新代码后需手动重启 PHP 或清 Opcache。

## 5. MySQL 5.7.44 配置

### 5.1 安装与版本确认

宝塔「软件商店」安装 MySQL 5.7（宝塔默认提供 5.7.x 最新补丁版本，即 5.7.44）。

```bash
mysql -V
# 预期: mysql  Ver 14.14 Distrib 5.7.44 ...
```

### 5.2 字符集/排序规则

```sql
-- 检查数据库字符集
SHOW CREATE DATABASE shopxo_dev;
-- 应为 utf8mb4 / utf8mb4_general_ci
```

如需修改：

```sql
ALTER DATABASE shopxo_dev CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;
```

> **重要**：项目统一使用 `utf8mb4_general_ci`，不要使用 `utf8mb4_unicode_ci`（排序规则不一致会导致索引/查询行为差异）。也不要使用 `utf8mb4_0900_ai_ci`（MySQL 8.0 专属）。

### 5.3 MySQL 5.7 关键参数配置

在宝塔「软件商店→MySQL 5.7→设置→配置文件」中确认以下参数：

```ini
[mysqld]
# 字符集（必须）
character-set-server = utf8mb4
collation-server = utf8mb4_general_ci

# SQL 模式（推荐，与宝塔默认一致）
sql_mode = STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_AUTO_CREATE_USER,NO_ENGINE_SUBSTITUTION

# InnoDB 大索引前缀（MySQL 5.7.7+ 默认 ON，确认未关闭）
innodb_large_prefix = ON

# 文件格式（MySQL 5.7.7+ 默认 Barracuda，确认未改回 Antelope）
innodb_file_format = Barracuda

# 每表独立表空间（默认 ON）
innodb_file_per_table = ON

# 缓冲池大小（建议物理内存的 50%-70%）
innodb_buffer_pool_size = 256M

# 最大连接数
max_connections = 200

# 时区（与 PHP 保持一致）
default-time-zone = '+08:00'
```

> **innodb_large_prefix 说明**：MySQL 5.7 默认启用，允许 InnoDB 索引键长度达 3072 字节（需配合 ROW_FORMAT=DYNAMIC 或 COMPRESSED）。如果关闭此选项，索引键长度限制为 767 字节，可能导致部分索引创建失败。本项目所有索引均在 767 字节以内，但建议保持默认开启。

### 5.4 Strict Mode 注意事项

MySQL 5.7 默认启用严格模式（`STRICT_TRANS_TABLES`），与 MySQL 5.6 的宽松模式有差异：

| 行为                 | 宽松模式（5.6） | 严格模式（5.7 默认）         |
| -------------------- | --------------- | ---------------------------- |
| 插入超出字段长度的值 | 截断并警告      | 报错拒绝                     |
| 日期 `0000-00-00`    | 允许            | 报错（需 `NO_ZERO_IN_DATE`） |
| NOT NULL 字段未赋值  | 使用类型默认值  | 报错拒绝                     |

本项目所有建表 SQL 已适配严格模式：

- 所有字段均显式声明 `NOT NULL DEFAULT ...`
- 时间字段使用 `int unsigned` 存储时间戳，不使用 `datetime`/`timestamp` 类型
- 不依赖 `0000-00-00` 等非法日期

### 5.5 时间字段策略

本项目时间字段统一使用 `int unsigned NOT NULL DEFAULT 0` 存储 UNIX 时间戳，不使用 MySQL 原生 `datetime`/`timestamp` 类型。原因：

1. 避免 MySQL 5.7 的 `NO_ZERO_IN_DATE` / `NO_ZERO_DATE` 兼容问题
2. 避免 `timestamp` 的 2038 年溢出问题
3. 与 ShopXO 框架保持一致（ShopXO 全部使用 `int` 存储时间）

### 5.6 索引长度限制

MySQL 5.7 InnoDB 索引键长度限制：

| 配置                                                       | 最大索引键长度 |
| ---------------------------------------------------------- | -------------- |
| `innodb_large_prefix=OFF` + `ROW_FORMAT=COMPACT/REDUNDANT` | 767 字节       |
| `innodb_large_prefix=ON` + `ROW_FORMAT=DYNAMIC/COMPRESSED` | 3072 字节      |

本项目所有索引长度审计结果（utf8mb4 下每字符 4 字节）：

| 表                       | 索引                                        | 最大列长度 | 索引键字节数 | 安全 |
| ------------------------ | ------------------------------------------- | ---------- | ------------ | ---- |
| sxo_user                 | uk_invite_code (char(8))                    | 32B        | 32B          | ✅   |
| sxo_invite_reward        | uk_inviter_invitee_event (2×int + char(30)) | 120B       | 128B         | ✅   |
| sxo_muying_user_tag      | uk_name (char(30))                          | 120B       | 120B         | ✅   |
| sxo_muying_user_tag_rel  | uk_user_tag (2×int)                         | 4B         | 8B           | ✅   |
| sxo_muying_stat_snapshot | uk_date_metric (date + char(60))            | 240B       | 243B         | ✅   |

所有索引均在 767 字节安全线内，即使 `innodb_large_prefix=OFF` 也能正常创建。

### 5.7 宝塔 MySQL 5.7 导入步骤

```bash
# 1. 创建数据库（宝塔面板「数据库→添加数据库」）
#    数据库名: shopxo_dev
#    字符集: utf8mb4
#    排序规则: utf8mb4_general_ci

# 2. 导入核心建表
mysql -u root -p shopxo_dev < /www/wwwroot/xiyun-api/config/shopxo.sql

# 3. 导入母婴迁移（按 sql-runbook.md 顺序）
mysql -u root -p shopxo_dev < /www/wwwroot/xiyun-api/docs/muying-final-migration.sql
mysql -u root -p shopxo_dev < /www/wwwroot/xiyun-api/docs/muying-audit-log-migration.sql
mysql -u root -p shopxo_dev < /www/wwwroot/xiyun-api/docs/muying-feature-switch-migration.sql
mysql -u root -p shopxo_dev < /www/wwwroot/xiyun-api/docs/muying-enhancement-migration.sql

# 4. 验证
mysql -u root -p shopxo_dev < /www/wwwroot/xiyun-api/scripts/preflight/check-db.sql
```

> **注意**：如果从 MySQL 8.0 迁移到 5.7，必须重新导出数据（使用 `mysqldump --compatible=mysql56` 或在 5.7 环境下重新执行建表 SQL），不能直接导入 8.0 的 dump 文件。

### 5.8 备份策略

宝塔「计划任务→添加任务」：

- 任务类型：备份数据库
- 执行周期：每天凌晨 3:00
- 备份到：/www/backup/database
- 保留份数：7

### 5.3 迁移执行顺序

见 `sql-runbook.md`

## 6. 宝塔计划任务

### 6.1 ShopXO 内置定时任务

| 任务         | Cron            | URL                                                         |
| ------------ | --------------- | ----------------------------------------------------------- |
| 订单自动关闭 | _/5 _ \* \* \*  | `curl http://127.0.0.1/api.php?s=crontab/orderclose`        |
| 订单自动收货 | 0 2 \* \* \*    | `curl http://127.0.0.1/api.php?s=crontab/ordersuccess`      |
| 支付日志关闭 | _/10 _ \* \* \* | `curl http://127.0.0.1/api.php?s=crontab/paylogorderclose`  |
| 商品赠送积分 | 0 3 \* \* \*    | `curl http://127.0.0.1/api.php?s=crontab/goodsgiveintegral` |

### 6.2 仪表盘快照生成

| 任务     | Cron         | URL                                                                  |
| -------- | ------------ | -------------------------------------------------------------------- |
| 每日快照 | 0 1 \* \* \* | `curl http://127.0.0.1/adminwlmqhs.php?s=dashboard/generatesnapshot` |

> 注意：Crontab 控制器无鉴权，必须通过 127.0.0.1 内网调用，不要暴露到公网。

## 7. 缓存与权限

### 7.1 需要可写的目录

```bash
chmod -R 755 /www/wwwroot/xiyun-api/runtime
chmod -R 755 /www/wwwroot/xiyun-api/public/upload
chown -R www:www /www/wwwroot/xiyun-api/runtime
chown -R www:www /www/wwwroot/xiyun-api/public/upload
```

### 7.2 上线后需清理的缓存

1. 宝塔「PHP-8.1→重载配置」清 Opcache
2. 后台「系统→系统管理→缓存管理→清空全部缓存」
3. 删除 `runtime/cache/` 下所有文件
4. 删除 `runtime/temp/` 下所有文件

## 8. 回滚方案

### 8.1 代码回滚

```bash
cd /www/wwwroot/xiyun-api
git log --oneline -5          # 查看最近5次提交
git checkout <commit-hash>    # 回滚到指定版本
# 清缓存
rm -rf runtime/cache/*
rm -rf runtime/temp/*
# 重载PHP
/etc/init.d/php-fpm-81 reload
```

### 8.2 数据库回滚

每个 SQL 迁移文件末尾都有回滚 SQL（注释形式），手动执行即可。

```bash
# 从备份恢复（最安全）
mysql -u root -p shopxo_dev < /www/backup/database/shopxo_dev_20260422.sql
```

### 8.3 配置回滚

- `.env` 文件修改前先备份：`cp .env .env.bak`
- 后台配置在数据库 `sxo_config` 表中，数据库恢复时一并恢复
