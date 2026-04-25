# 宝塔面板 Nginx 配置示例 — 孕禧小程序后端

---

## 1. 站点基本配置

在宝塔面板 → 网站 → 添加站点：

- **域名**: `api.yunxi.example.com`（替换为实际域名）
- **根目录**: `/www/wwwroot/yunxi`（项目根目录）
- **PHP版本**: PHP-81
- **数据库**: MySQL 5.7

## 2. 网站目录设置

**关键：运行目录必须设为 /public**

宝塔面板 → 网站 → 设置 → 网站目录：

- 运行目录: `/public`（不是 `/`）

## 3. Nginx 配置

在宝塔面板 → 网站 → 设置 → 配置文件，替换为以下内容：

```nginx
server {
    listen 80;
    listen 443 ssl http2;
    server_name api.yunxi.example.com;

    # SSL 证书（宝塔面板申请 Let's Encrypt 或上传自定义证书）
    ssl_certificate    /www/server/panel/vhost/cert/api.yunxi.example.com/fullchain.pem;
    ssl_certificate_key /www/server/panel/vhost/cert/api.yunxi.example.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    # 网站根目录（指向 public）
    root /www/wwwroot/yunxi/public;
    index index.php index.html;

    # HTTP 强制跳转 HTTPS
    if ($server_port !~ 443) {
        rewrite ^(/.*)$ https://$host$1 permanent;
    }

    # ThinkPHP 伪静态规则
    location / {
        if (!-e $request_filename) {
            rewrite ^(.*)$ /index.php?s=/$1 last;
        }
    }

    # PHP-FPM 处理
    location ~ \.php$ {
        fastcgi_pass unix:/tmp/php-cgi-81.sock;
        fastcgi_index index.php;
        fastcgi_param SCRIPT_FILENAME $document_root$fastcgi_script_name;
        include fastcgi_params;
    }

    # 禁止访问敏感文件和目录
    location ~ /\. {
        deny all;
    }

    location ~ /\.env {
        deny all;
    }

    location ~ ^/runtime/ {
        deny all;
    }

    location ~ ^/config/ {
        deny all;
    }

    location ~ ^/app/ {
        deny all;
    }

    location ~ ^/extend/ {
        deny all;
    }

    location ~ ^/vendor/ {
        deny all;
    }

    location ~ ^/data/ {
        deny all;
    }

    # 禁止访问 .git 目录
    location ~ ^/\.git/ {
        deny all;
    }

    # 静态资源缓存
    location ~ .*\.(gif|jpg|jpeg|png|bmp|swf|js|css)$ {
        expires 30d;
        access_log off;
    }

    # 上传目录（允许访问图片，但禁止执行 PHP）
    location ^~ /static/upload/ {
        location ~ \.php$ {
            deny all;
        }
    }

    # 禁止访问下载目录中的非 .gitignore 文件
    location ^~ /download/ {
        location ~ \.php$ {
            deny all;
        }
    }

    # 日志
    access_log /www/wwwlogs/api.yunxi.example.com.log;
    error_log  /www/wwwlogs/api.yunxi.example.com.error.log;
}
```

## 4. PHP 配置

宝塔面板 → 软件商店 → PHP-8.1 → 设置：

### 4.1 禁用函数

确保以下函数在"禁用函数"列表中：

```
exec, shell_exec, system, passthru, popen, proc_open, putenv, dl
```

### 4.2 上传限制

```
post_max_size = 20M
upload_max_filesize = 20M
max_execution_time = 300
memory_limit = 256M
```

### 4.3 PHP 扩展

确保以下扩展已安装：

```
pdo_mysql
mysqli
openssl
mbstring
json
gd
curl
fileinfo
redis（如使用 Redis 缓存）
```

## 5. MySQL 配置

宝塔面板 → 软件商店 → MySQL 5.7 → 设置：

### 5.1 安全配置

- **禁止远程访问**: 仅允许 127.0.0.1 连接
- **root 密码**: 强密码
- **创建专用用户**: yunxi_app，仅授权 yunxi_prod 数据库

```sql
CREATE USER 'yunxi_app'@'127.0.0.1' IDENTIFIED BY '强密码';
GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, ALTER, INDEX ON yunxi_prod.* TO 'yunxi_app'@'127.0.0.1';
FLUSH PRIVILEGES;
```

### 5.2 字符集

```
character_set_server = utf8mb4
collation_server = utf8mb4_general_ci
```

## 6. 部署步骤

```bash
# 1. 克隆代码
cd /www/wwwroot
git clone https://github.com/kHuner9712/xiyun.git yunxi

# 2. 创建 .env
cd yunxi/shopxo-backend
cp .env.production.example .env
# 编辑 .env，替换所有 {{占位符}} 为实际值

# 3. 创建 config/database.php
# （项目会从 .env 读取，但需确保文件存在）

# 4. 导入数据库
mysql -u yunxi_app -p yunxi_prod < config/shopxo.sql
mysql -u yunxi_app -p yunxi_prod < ../../docs/muying-final-migration.sql

# 5. 设置权限
chown -R www:www /www/wwwroot/yunxi
chmod -R 755 /www/wwwroot/yunxi
chmod -R 777 /www/wwwroot/yunxi/runtime
chmod -R 777 /www/wwwroot/yunxi/public/static/upload

# 6. 删除安装入口
rm -f /www/wwwroot/yunxi/public/install.php

# 7. 重启 PHP-FPM
/etc/init.d/php-fpm-81 restart
```

## 7. 验证部署

```bash
# 检查 API 是否可访问
curl -I https://api.yunxi.example.com/api.php

# 检查 .env 不可访问
curl -I https://api.yunxi.example.com/.env
# 预期: 403 Forbidden 或 404 Not Found

# 检查 runtime 不可访问
curl -I https://api.yunxi.example.com/runtime/
# 预期: 403 Forbidden 或 404 Not Found

# 检查后台入口
curl -I https://api.yunxi.example.com/adminwlmqhs.php
# 预期: 200 OK（登录页面）
```

## 8. phpMyAdmin 安全提示

- **不要公网开放 phpMyAdmin**
- 如需使用，通过宝塔面板的"安全"功能限制 IP 白名单
- 或使用 SSH 隧道访问: `ssh -L 8888:127.0.0.1:8888 user@server`
- phpMyAdmin 默认端口 888，确保防火墙不开放此端口
