# 禧孕小程序 — 宝塔面板生产部署指南

> 适用环境：Nginx 1.28.1 / MySQL 5.7.44 / PHP 8.1.32 / phpMyAdmin 5.2 / 宝塔面板
>
> ⚠️ 本文档仅提供部署步骤和安全配置说明，不包含任何真实密码、密钥或域名。

---

## 一、部署前检查清单

| # | 检查项 | 要求 |
|---|--------|------|
| 1 | 域名备案 | 已通过管局审核，可正常解析 |
| 2 | SSL 证书 | 已申请（Let's Encrypt 或商业证书） |
| 3 | 正式 AppID | 已在微信公众平台申请，非测试号 |
| 4 | 服务器防火墙 | 仅开放 80/443，关闭 3306/888 等端口 |
| 5 | 宝塔面板 | 已安装，面板端口已改为非默认值 |

---

## 二、宝塔面板基础配置

### 2.1 安装软件

- **Nginx**：1.28.x
- **MySQL**：5.7（⚠️ 不要使用 8.0，SQL 迁移脚本基于 5.7 测试）
- **PHP**：8.1（⚠️ 不要使用 7.x 或 8.2+，未经兼容测试）
- **phpMyAdmin**：5.2

### 2.2 PHP 配置

宝塔 → 软件商店 → PHP 8.1 → 设置：

1. **禁用函数**：删除 `putenv`、`proc_open`、`pcntl_signal`、`pcntl_alarm`（ThinkPHP 队列需要），保留禁用：
   - `exec`、`shell_exec`、`system`、`passthru`、`popen`
   - `pcntl_exec`、`pcntl_fork`、`pcntl_waitpid`

2. **上传限制**：
   - `post_max_size = 20M`
   - `upload_max_filesize = 20M`
   - `max_execution_time = 300`

3. **OPcache**：生产环境建议开启

### 2.3 MySQL 安全配置

1. **创建独立数据库用户**（不要使用 root）：
   ```sql
   CREATE DATABASE xiyun_prod CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;
   CREATE USER 'xiyun_app'@'127.0.0.1' IDENTIFIED BY '强密码（≥16位，含大小写+数字+特殊字符）';
   GRANT ALL PRIVILEGES ON xiyun_prod.* TO 'xiyun_app'@'127.0.0.1';
   FLUSH PRIVILEGES;
   ```

2. **禁止公网访问 3306**：
   - 宝塔 → 安全 → 防火墙 → 确认 3306 端口未开放
   - MySQL 配置 `bind-address = 127.0.0.1`

3. **phpMyAdmin 安全**：
   - ⚠️ 不建议公网开放 phpMyAdmin
   - 如必须使用，宝塔 → 安全 → 限制访问 IP 为你的办公 IP
   - 或通过 SSH 隧道访问：`ssh -L 8888:127.0.0.1:888 root@服务器IP`

---

## 三、网站部署

### 3.1 创建站点

宝塔 → 网站 → 添加站点：

- **域名**：你的 API 域名（如 api.xiyun.com）
- **根目录**：`/www/wwwroot/xiyun-api/shopxo-backend`
- **运行目录**：`/public`（⚠️ 不是根目录！这是 ThinkPHP 要求）
- **PHP 版本**：PHP-81
- **数据库**：选择已创建的 xiyun_prod

### 3.2 伪静态配置

宝塔 → 网站 → 伪静态 → 选择 `thinkphp`：

```nginx
location / {
    if (!-e $request_filename) {
        rewrite ^(.*)$ /index.php?s=/$1 last;
    }
}
```

### 3.3 Nginx 安全规则

宝塔 → 网站 → 配置文件，在 `server { }` 块内添加以下规则：

```nginx
# 禁止访问 .env / .git 等敏感文件
location ~ /\.(env|git) {
    deny all;
}

# 禁止访问隐藏文件
location ~ /\. {
    deny all;
}

# 禁止访问 runtime 目录（日志/缓存）
location ~* ^/runtime/ {
    deny all;
}

# 禁止访问 vendor 目录（PHP 依赖）
location ~* ^/vendor/ {
    deny all;
}

# 禁止访问 app 目录（应用源码）
location ~* ^/app/ {
    deny all;
}

# 禁止访问 config 目录（配置文件）
location ~* ^/config/ {
    deny all;
}

# 禁止访问 SQL 文件
location ~* \.sql$ {
    deny all;
}

# 禁止访问 composer 文件
location ~ /composer\.(json|lock) {
    deny all;
}

# 禁止访问 install.php（安装完成后必须删除）
location ~* /install\.php$ {
    deny all;
}

# 上传目录禁止执行 PHP
location ~* ^/(static/upload|download)/.*\.(php|php5|phtml)$ {
    deny all;
}

# 上传文件大小限制
client_max_body_size 20m;

# 安全响应头
add_header X-Content-Type-Options "nosniff" always;
add_header X-Frame-Options "SAMEORIGIN" always;
add_header X-XSS-Protection "1; mode=block" always;
```

> 完整配置示例见 `deploy/nginx.production.example.conf`

### 3.4 开启 HTTPS

宝塔 → 网站 → SSL：

1. 选择 Let's Encrypt → 申请免费证书
2. 或上传商业证书
3. 开启强制 HTTPS（HTTP → HTTPS 重定向）

---

## 四、后端配置

### 4.1 环境配置

```bash
cd /www/wwwroot/xiyun-api/shopxo-backend
cp .env.production.example .env
```

编辑 `.env`：

```ini
APP_DEBUG = false

[DATABASE]
TYPE = mysql
HOSTNAME = 127.0.0.1
DATABASE = xiyun_prod
USERNAME = xiyun_app
PASSWORD = 你的强密码
HOSTPORT = 3306
CHARSET = utf8mb4
PREFIX = sxo_

# 隐私加密密钥（AES-256-CBC）
# 生成方式: php -r "echo bin2hex(openssl_random_pseudo_bytes(32));"
# ⚠️ 必须生产独立生成，离线保存备份！
MUYING_PRIVACY_KEY = 你生成的64位hex密钥
```

### 4.2 MUYING_PRIVACY_KEY 生成

```bash
php -r "echo bin2hex(openssl_random_pseudo_bytes(32));"
```

⚠️ 密钥管理要求：
- 生产密钥必须独立生成，不能与开发环境共用
- 生成后离线保存备份（如密码管理器、纸质密封信封）
- 密钥丢失将导致已加密的用户敏感数据无法解密
- 密钥泄露将导致用户敏感数据可被解密
- 不要将真实密钥提交到 Git

### 4.3 安装后安全操作

1. **确认 install.php 已删除**：
   ```bash
   # ⚠️ 生产部署前必须确认以下文件不存在
   ls -la /www/wwwroot/xiyun-api/shopxo-backend/public/install.php
   # 如果存在，必须删除：
   rm -f /www/wwwroot/xiyun-api/shopxo-backend/public/install.php
   rm -rf /www/wwwroot/xiyun-api/shopxo-backend/public/static/install/
   # 确认删除成功
   test -f /www/wwwroot/xiyun-api/shopxo-backend/public/install.php && echo "BLOCKER: install.php 仍存在！" || echo "OK: install.php 已删除"
   ```
   > 本项目已从代码仓库中移除 `public/install.php`，安装入口已归档至 `docs/archive/install.php.disabled`。
   > 如需重新安装，将该文件复制回 `shopxo-backend/public/install.php`，安装完成后必须立即删除。
   > Nginx 配置中已添加 `deny /install.php` 和 `deny /install/` 作为双重保护。

2. **修改后台入口**：
   - 默认后台入口为 `/admin`，容易被扫描
   - 修改 `shopxo-backend/config/route.php` 中的后台路由前缀为随机字符串
   - 例如：`/a8f3k2x9` 代替 `/admin`
   - 建议同时在 Nginx 中对后台路径加 IP 白名单限制

3. **后台 IP 限制**（可选但强烈建议）：
   ```nginx
   location /你的后台路径/ {
       allow 你的办公IP;
       deny all;
       try_files $uri $uri/ /index.php?s=$uri&$args;
   }
   ```

---

## 五、数据库迁移

### 5.1 执行迁移

```bash
cd /www/wwwroot/xiyun-api

# 基础表结构（ShopXO 原始）
mysql -u xiyun_app -p xiyun_prod < shopxo-backend/app/install/data/shopxo.sql

# 母婴二开迁移脚本
mysql -u xiyun_app -p xiyun_prod < docs/sql/muying_feedback.sql
mysql -u xiyun_app -p xiyun_prod < docs/sql/muying-activity-signup-privacy-split-migration.sql
```

### 5.2 数据库备份

宝塔 → 计划任务 → 添加：

- **任务类型**：备份数据库
- **执行周期**：每天凌晨 3:00
- **备份到**：本地 + 远程（建议同时备份到 OSS/S3）
- **保留份数**：7 天

---

## 六、上传目录备份

宝塔 → 计划任务 → 添加：

- **任务类型**：备份网站目录
- **备份目录**：`/www/wwwroot/xiyun-api/shopxo-backend/public/static/upload/`
- **执行周期**：每天凌晨 4:00
- **保留份数**：7 天

---

## 七、前端构建与上传

### 7.1 配置生产环境变量

```bash
cd shopxo-uniapp
cp .env.production.example .env.production
```

编辑 `.env.production`：

```ini
UNI_APP_ENV=production
UNI_APP_REQUEST_URL=https://你的API域名/
UNI_APP_STATIC_URL=https://你的API域名/
UNI_APP_UPLOAD_URL=https://你的API域名/
UNI_APP_WX_APPID=你的正式AppID
```

### 7.2 HBuilderX 构建

1. HBuilderX → 发行 → 小程序-微信
2. 确认环境变量已加载（检查编译日志中的 request_url）
3. 编译产物在 `unpackage/dist/build/mp-weixin/`
4. 用微信开发者工具导入编译产物
5. 上传到微信平台

⚠️ 构建时 prod.js 会校验：
- 缺失 AppID → 构建失败
- HTTP 地址 → 构建失败
- 内网 IP → 构建失败
- 测试号 AppID → 构建失败

---

## 八、微信公众平台配置

1. **合法域名**：
   - request 合法域名：`https://你的API域名`
   - uploadFile 合法域名：`https://你的API域名`
   - downloadFile 合法域名：`https://你的API域名`

2. **业务域名**：（如需 web-view，一期已移除可暂不配置）

3. **隐私协议**：
   - 设置 → 用户隐私保护指引 → 填写收集的信息类型和用途

---

## 九、安全检查清单

| # | 检查项 | 状态 |
|---|--------|------|
| 1 | APP_DEBUG = false | ☐ |
| 2 | 数据库使用独立用户（非 root） | ☐ |
| 3 | MySQL 3306 不开放公网 | ☐ |
| 4 | phpMyAdmin 不公网开放或限制 IP | ☐ |
| 5 | HTTPS 已开启 | ☐ |
| 6 | .env 文件不可公网访问 | ☐ |
| 7 | runtime/vendor/app/config 目录不可访问 | ☐ |
| 8 | install.php 不存在于 Web root | ☐ |
| 9 | 后台入口已改为随机路径 | ☐ |
| 10 | MUYING_PRIVACY_KEY 已独立生成 | ☐ |
| 11 | 上传目录禁止执行 PHP | ☐ |
| 12 | 数据库每日备份已配置 | ☐ |
| 13 | 上传目录每日备份已配置 | ☐ |
| 14 | 宝塔面板端口已改为非默认值 | ☐ |
| 15 | 服务器 SSH 使用密钥认证（非密码） | ☐ |
