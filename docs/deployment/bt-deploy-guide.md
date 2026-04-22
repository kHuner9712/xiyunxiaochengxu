# 宝塔部署实施文档（开发版）

> 面向：孕禧小程序一期上线部署
> 环境：宝塔面板 + Nginx 1.28 + MySQL 5.7 + PHP 8.1
> 日期：2026-04-22

---

## 1. 服务器目录规划

| 目录         | 建议路径                               | 说明                            |
| ------------ | -------------------------------------- | ------------------------------- |
| 后端根目录   | `/www/wwwroot/yunxi-api`               | ShopXO 后端代码，Git clone 到此 |
| Nginx root   | `/www/wwwroot/yunxi-api`               | 指向项目根目录（不是 public/）  |
| 上传目录     | `/www/wwwroot/yunxi-api/public/upload` | 自动创建，需可写                |
| 日志目录     | `/www/wwwroot/yunxi-api/runtime/log`   | 自动创建，需可写                |
| 缓存目录     | `/www/wwwroot/yunxi-api/runtime/cache` | 自动创建，需可写                |
| 备份目录     | `/www/backup/yunxi`                    | 数据库+代码备份                 |
| uni-app 源码 | `/www/wwwroot/yunxi-uniapp`            | 仅构建时使用，不对外暴露        |

> **关键说明**：ShopXO 的入口文件 `api.php`、`adminwlmqhs.php`、`index.php` 都在项目根目录下（不在 public/ 下），它们内部 require 到 `public/` 下的对应文件。因此 Nginx root 必须指向项目根目录，不能指向 public/。

## 2. 宝塔站点创建

### 2.1 创建站点

| 配置项   | 值                                 |
| -------- | ---------------------------------- |
| 域名     | `api.yunxi.com`（替换为实际域名）  |
| 根目录   | `/www/wwwroot/yunxi-api`           |
| 运行目录 | `/`（宝塔面板设置，即项目根目录）  |
| PHP版本  | PHP-81                             |
| HTTPS    | 域名备案完成后开启，当前可暂不开启 |

### 2.2 后台入口安全

ShopXO 后台入口文件名为 `adminwlmqhs.php`（已混淆），不要改回 `admin.php`。
后台访问地址：`https://api.yunxi.com/adminwlmqhs.php`

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
    server_name api.yunxi.com;
    root /www/wwwroot/yunxi-api;
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
    access_log /www/wwwlogs/yunxi-api.log;
    error_log /www/wwwlogs/yunxi-api.error.log;
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

## 5. MySQL 建议

### 5.1 字符集/排序规则

```sql
-- 检查数据库字符集
SHOW CREATE DATABASE shopxo_dev;
-- 应为 utf8mb4 / utf8mb4_general_ci
```

如需修改：

```sql
ALTER DATABASE shopxo_dev CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;
```

### 5.2 备份策略

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
chmod -R 755 /www/wwwroot/yunxi-api/runtime
chmod -R 755 /www/wwwroot/yunxi-api/public/upload
chown -R www:www /www/wwwroot/yunxi-api/runtime
chown -R www:www /www/wwwroot/yunxi-api/public/upload
```

### 7.2 上线后需清理的缓存

1. 宝塔「PHP-8.1→重载配置」清 Opcache
2. 后台「系统→系统管理→缓存管理→清空全部缓存」
3. 删除 `runtime/cache/` 下所有文件
4. 删除 `runtime/temp/` 下所有文件

## 8. 回滚方案

### 8.1 代码回滚

```bash
cd /www/wwwroot/yunxi-api
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
