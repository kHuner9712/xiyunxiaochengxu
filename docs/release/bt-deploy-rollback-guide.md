# 禧孕 宝塔正式部署与回滚手册

> 适用环境：宝塔面板 9.x + Nginx 1.28.1 + PHP 8.1.x + MySQL 5.7.44  
> 目标域名：待填写（见《正式上线前人工配置清单》）  
> 最后更新：2026-04-24

---

## 一、部署前准备

### 1.1 服务器要求

| 项目 | 最低要求 | 推荐 |
|------|----------|------|
| CPU | 2 核 | 4 核 |
| 内存 | 4 GB | 8 GB |
| 硬盘 | 40 GB SSD | 100 GB SSD |
| 带宽 | 5 Mbps | 10 Mbps |
| 操作系统 | CentOS 7.9 / Ubuntu 20.04 | Ubuntu 22.04 |

### 1.2 宝塔面板安装

```bash
# Ubuntu/Debian
wget -O install.sh https://download.bt.cn/install/install-ubuntu_6.0.sh && sudo bash install.sh ed8484bec

# CentOS
yum install -y wget && wget -O install.sh http://download.bt.cn/install/install_6.0.sh && sh install.sh ed8484bec
```

### 1.3 LNMP 环境安装

在宝塔面板 → 软件商店 中安装：

| 软件 | 版本 | 说明 |
|------|------|------|
| Nginx | 1.28.1 | Web 服务器 |
| PHP | 8.1.x | FastCGI 模式 |
| MySQL | 5.7.44 | 数据库 |
| phpMyAdmin | 最新 | 数据库管理（可选） |

PHP 扩展安装（宝塔 → PHP 8.1 → 安装扩展）：

| 扩展 | 必须 | 说明 |
|------|------|------|
| pdo_mysql | ✅ | 数据库驱动 |
| mbstring | ✅ | 多字节字符串 |
| curl | ✅ | HTTP 请求 |
| gd | ✅ | 图片处理 |
| openssl | ✅ | 加密 |
| json | ✅ | JSON 处理 |
| xml | ✅ | XML 处理 |
| redis | 建议 | 缓存（可选） |
| bcmath | 建议 | 精确计算（可选） |
| fileinfo | 建议 | 文件类型检测（可选） |

---

## 二、后端部署

### 2.1 创建网站

1. 宝塔面板 → 网站 → 添加站点
2. 域名：填写正式域名
3. 根目录：`/www/wwwroot/你的域名`
4. PHP 版本：PHP-81
5. 数据库：创建 MySQL 数据库（utf8mb4_general_ci）

### 2.2 上传代码

```bash
cd /www/wwwroot/你的域名

# 方式1：Git 克隆
git clone https://github.com/kHuner9712/xiyun.git repo
cp -r repo/shopxo-backend/* .
rm -rf repo

# 方式2：宝塔文件管理器上传 ZIP
```

### 2.3 配置 .env

```bash
cp .env.production.example .env
vi .env
```

必须修改的配置：

```ini
APP_DEBUG = false

[DATABASE]
TYPE = mysql
HOSTNAME = 127.0.0.1
DATABASE = 你的数据库名
USERNAME = 你的数据库用户
PASSWORD = 你的强密码
HOSTPORT = 3306
CHARSET = utf8mb4
PREFIX = sxo_
```

### 2.4 目录权限

```bash
cd /www/wwwroot/你的域名

# 设置所有者
chown -R www:www .

# 设置基础权限（目录 755 / 文件 644）
find . -type d -exec chmod 755 {} \;
find . -type f -exec chmod 644 {} \;

# 必须可写的目录（755，不使用 777）
chmod 755 runtime/
chmod 755 public/upload/
chmod 755 public/download/
chmod 755 config/
chmod 755 public/rsakeys/

# 安全：禁止写入的目录（555 = 只读+可进入）
chmod -R 555 app/
chmod -R 555 extend/
chmod -R 555 thinkphp/

# ⚠ 绝不使用 chmod -R 777
```

### 2.5 初始化数据库

```bash
# 1. 导入基础表结构
mysql -u 你的用户 -p 你的数据库名 < config/shopxo.sql

# 2. 导入禧孕迁移脚本（按顺序执行）
mysql -u 你的用户 -p 你的数据库名 < docs/muying-final-migration.sql
mysql -u 你的用户 -p 你的数据库名 < docs/muying-feedback-review-migration.sql
mysql -u 你的用户 -p 你的数据库名 < docs/muying-invite-reward-unify-migration.sql
mysql -u 你的用户 -p 你的数据库名 < docs/muying-feature-flag-upgrade-migration.sql
mysql -u 你的用户 -p 你的数据库名 < docs/muying-admin-power-migration.sql
```

### 2.6 安全加固

```bash
# 1. 删除安装文件
rm -f public/install.php

# 2. 重命名后台入口（重要！）
# 将 admin.php 重命名为不易猜测的名称
mv public/admin.php public/你的秘密入口名.php

# 3. 修改入口文件中的路径引用（如果需要）
# 检查 public/你的秘密入口名.php 内容是否正确

# 4. 禁止访问敏感目录
# 在 Nginx 配置中添加（见 2.7）
```

### 2.7 Nginx 配置

宝塔面板 → 网站 → 设置 → 配置文件，替换为：

```nginx
server {
    listen 80;
    listen 443 ssl http2;
    server_name 你的域名.com;
    index index.php index.html;
    root /www/wwwroot/你的域名/public;

    # SSL 证书（宝塔面板可自动申请 Let's Encrypt）
    ssl_certificate /www/server/panel/vhost/cert/你的域名.com/fullchain.pem;
    ssl_certificate_key /www/server/panel/vhost/cert/你的域名.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    # HTTP 强制跳转 HTTPS
    if ($server_port !~ 443) {
        rewrite ^(/.*)$ https://$host$1 permanent;
    }

    # 隐藏 PHP 版本信息
    fastcgi_hide_header X-Powered-By;

    # 禁止访问敏感目录
    location ~* ^/(runtime|config|app|extend|thinkphp|vendor)/ {
        return 404;
    }

    # 禁止访问隐藏文件
    location ~ /\. {
        return 404;
    }

    # 禁止访问 SQL 文件
    location ~* \.(sql|env|example|git|gitignore)$ {
        return 404;
    }

    # ThinkPHP URL 重写
    location / {
        if (!-e $request_filename) {
            rewrite ^(.*)$ /index.php?s=$1 last;
        }
    }

    # PHP-FPM
    location ~ \.php$ {
        fastcgi_pass unix:/tmp/php-cgi-81.sock;
        fastcgi_index index.php;
        fastcgi_param SCRIPT_FILENAME $document_root$fastcgi_script_name;
        include fastcgi_params;
    }

    # 静态资源缓存
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 30d;
        add_header Cache-Control "public, no-transform";
    }

    # 上传文件大小限制
    client_max_body_size 20m;

    # 日志
    access_log /www/wwwlogs/你的域名.com.log;
    error_log /www/wwwlogs/你的域名.com.error.log;
}
```

### 2.8 Composer 安装

```bash
cd /www/wwwroot/你的域名

# 安装依赖（不使用开发依赖）
composer install --no-dev --optimize-autoloader
```

### 2.9 定时任务

宝塔面板 → 计划任务 → 添加任务：

| 任务类型 | 执行周期 | 脚本内容 |
|----------|----------|----------|
| Shell 脚本 | 每 1 分钟 | `cd /www/wwwroot/你的域名 && php think order_close` |
| Shell 脚本 | 每 5 分钟 | `cd /www/wwwroot/你的域名 && php think order_auto_confirm` |
| Shell 脚本 | 每天 0:00 | `cd /www/wwwroot/你的域名 && php think data_backup` |

---

## 三、前端构建与上传

### 3.1 配置环境变量

```bash
cd shopxo-uniapp

# 创建生产环境配置
cp .env.production.example .env.production
vi .env.production
```

必须修改：

```ini
UNI_APP_REQUEST_URL=https://你的域名.com/
UNI_APP_STATIC_URL=https://你的域名.com/
UNI_APP_WX_APPID=你的微信小程序AppID
VUE_APP_UNI_APP_REQUEST_URL=https://你的域名.com/
VUE_APP_UNI_APP_STATIC_URL=https://你的域名.com/
VUE_APP_UNI_APP_WX_APPID=你的微信小程序AppID
```

### 3.2 填写 AppID

```bash
# 修改 manifest.json 中 mp-weixin.appid
# 修改 project.config.json 中 appid
```

### 3.3 编译

使用 HBuilderX：
1. 发行 → 小程序-微信
2. 环境变量选择 production
3. 编译完成后在 `unpackage/dist/dev/mp-weixin` 目录

### 3.4 上传

1. 打开微信开发者工具
2. 导入编译后的目录
3. 填写版本号和备注
4. 点击上传

---

## 四、回滚步骤

### 4.1 代码回滚

```bash
cd /www/wwwroot/你的域名

# 查看最近提交
git log --oneline -10

# 回滚到指定版本
git checkout <commit-hash> .

# 重新安装依赖
composer install --no-dev --optimize-autoloader

# 清除缓存
php think clear
rm -rf runtime/cache/*
```

### 4.2 数据库回滚

```bash
# 1. 恢复最近的数据库备份
mysql -u 你的用户 -p 你的数据库名 < /www/backup/database/你的数据库名_YYYYMMDD.sql

# 2. 如果只回滚特定迁移，手动执行反向 SQL
# 例如：删除新增的权限菜单
# DELETE FROM sxo_power WHERE id >= 700 AND id <= 751;
# DELETE FROM sxo_role_power WHERE power_id >= 700 AND power_id <= 751;
```

### 4.3 Nginx 配置回滚

```bash
# 宝塔面板 → 网站 → 设置 → 配置文件
# 恢复之前的配置或使用宝塔默认配置
nginx -t && nginx -s reload
```

### 4.4 小程序版本回滚

1. 登录 [mp.weixin.qq.com](https://mp.weixin.qq.com)
2. 版本管理 → 开发版本
3. 选择上一个版本 → 选为体验版
4. 重新提交审核

---

## 五、日常运维

### 5.1 数据库备份

宝塔面板 → 计划任务 → 添加备份：

| 任务类型 | 执行周期 | 保留份数 |
|----------|----------|----------|
| 备份数据库 | 每天 2:00 | 7 份 |
| 备份网站 | 每周日 3:00 | 4 份 |

### 5.2 日志监控

```bash
# 查看错误日志
tail -f /www/wwwroot/你的域名/runtime/log/$(date +%Y%m)/$(date +%d).log

# 查看 Nginx 错误日志
tail -f /www/wwwlogs/你的域名.com.error.log

# 查看 PHP 错误日志
tail -f /www/server/php/81/var/log/php-fpm.log
```

### 5.3 缓存清理

```bash
cd /www/wwwroot/你的域名
php think clear
rm -rf runtime/cache/*
rm -rf runtime/temp/*
```

### 5.4 安全检查清单

| 检查项 | 命令/操作 | 频率 |
|--------|-----------|------|
| APP_DEBUG 状态 | `grep APP_DEBUG .env` | 每次部署后 |
| install.php 是否存在 | `ls public/install.php` | 每次部署后 |
| 后台入口文件名 | `ls public/admin.php` 应不存在 | 每次部署后 |
| 磁盘空间 | `df -h` | 每周 |
| SSL 证书到期 | 宝塔面板 → SSL | 每月 |
| 数据库备份 | 检查备份目录 | 每周 |
| 错误日志异常 | `tail runtime/log/` | 每天 |
