# 禧孕 V1.0 宝塔面板生产部署指南

## 1. 服务器环境要求

| 组件 | 版本 | 说明 |
|------|------|------|
| Nginx | 1.24+ | 宝塔默认安装 |
| PHP | 8.1 | 不要使用 7.x 或 8.2+ |
| MySQL | 5.7 | 不要使用 8.0 |
| phpMyAdmin | 5.2+ | 仅限内网访问 |

## 2. 宝塔面板初始化

### 2.1 安装软件

在宝塔 → 软件商店 中安装：
- Nginx 1.24+
- PHP 8.1
- MySQL 5.7
- phpMyAdmin 5.2

### 2.2 PHP 配置

宝塔 → 软件商店 → PHP 8.1 → 设置：

1. **安装扩展**：`fileinfo`、`redis`（可选）、`openssl`（必须）
2. **禁用函数**：删除 `putenv`、`proc_open`、`pcntl_signal`（ThinkPHP 队列需要），保留禁用 `exec`、`shell_exec`、`system`、`passthru`、`popen`
3. **配置修改**：
   - `post_max_size = 20M`
   - `upload_max_filesize = 20M`
   - `max_execution_time = 300`
   - `memory_limit = 256M`

### 2.3 MySQL 安全

1. MySQL 3306 端口**不开放公网**（宝塔 → 安全 → 防火墙，不放行 3306）
2. 创建专用数据库用户（不使用 root）：
   ```sql
   CREATE USER 'xiyun_app'@'127.0.0.1' IDENTIFIED BY '强密码≥16位';
   CREATE DATABASE xiyun_prod DEFAULT CHARSET utf8mb4 COLLATE utf8mb4_general_ci;
   GRANT ALL PRIVILEGES ON xiyun_prod.* TO 'xiyun_app'@'127.0.0.1';
   FLUSH PRIVILEGES;
   ```

## 3. 网站创建

### 3.1 创建站点

宝塔 → 网站 → 添加站点：
- 域名：填写备案域名（如 `api.xiyun.com`）
- 根目录：`/www/wwwroot/api.xiyun.com`
- PHP 版本：PHP 8.1
- 数据库：选择已创建的 `xiyun_prod`

### 3.2 设置运行目录

宝塔 → 网站 → 设置 → 网站目录：
- **运行目录**：`/public`（不是根目录！）
- 这确保 `/app`、`/runtime`、`.env` 等目录不对外暴露

### 3.3 配置伪静态

宝塔 → 网站 → 设置 → 伪静态 → 选择 `thinkphp`：

```nginx
location / {
    if (!-e $request_filename) {
        rewrite ^(.*)$ /index.php?s=$1 last;
    }
}
```

### 3.4 配置 SSL

宝塔 → 网站 → 设置 → SSL：
- 选择 Let's Encrypt 免费证书
- 或上传自有证书
- 开启强制 HTTPS

### 3.5 安全配置

在 Nginx 配置中添加（宝塔 → 网站 → 设置 → 配置文件）：

```nginx
# 禁止访问敏感文件
location ~ /\.env {
    deny all;
}
location ~ /runtime/ {
    deny all;
}
# 禁止访问 .git
location ~ /\.git {
    deny all;
}
# 禁止访问 sql 文件
location ~ \.sql$ {
    deny all;
}
```

## 4. 代码部署

### 4.1 上传代码

```bash
cd /www/wwwroot/api.xiyun.com
git clone https://github.com/kHuner9712/xiyun.git .
```

或通过宝塔文件管理器上传 ZIP 包。

### 4.2 配置后端环境

```bash
cd /www/wwwroot/api.xiyun.com/shopxo-backend
cp .env.production.example .env
```

编辑 `.env`，替换所有占位符：
- `{{DB_HOST}}` → `127.0.0.1`
- `{{DB_NAME}}` → `xiyun_prod`
- `{{DB_USER}}` → `xiyun_app`
- `{{DB_PASS}}` → 实际密码
- `{{PRIVACY_KEY}}` → 执行 `php -r "echo bin2hex(openssl_random_pseudo_bytes(32));"` 生成

确认 `APP_DEBUG = false`。

### 4.3 安装 PHP 依赖（Composer）

```bash
cd /www/wwwroot/api.xiyun.com/shopxo-backend

# [MUYING-二开] 生产环境必须使用 --no-dev 跳过开发依赖，--optimize-autoloader 优化类加载
composer install --no-dev --optimize-autoloader
```

> ⚠️ **严禁在生产环境执行 `composer update`**（会修改 composer.lock，可能拉取预期外版本导致线上故障）。
> 如果 `composer.lock` 未提交到仓库，先用开发机执行 `composer update` 生成后提交，再在生产执行 `composer install`。

### 4.4 导入数据库

```bash
# 按顺序执行 SQL 迁移
mysql -u xiyun_app -p xiyun_prod < docs/muying-final-migration.sql
mysql -u xiyun_app -p xiyun_prod < docs/sql/muying-feature-switch-migration.sql
mysql -u xiyun_app -p xiyun_prod < docs/sql/muying-compliance-center-migration.sql
```

或通过 phpMyAdmin 导入。

### 4.5 设置目录权限

```bash
cd /www/wwwroot/api.xiyun.com/shopxo-backend
chmod -R 755 .
chmod -R 777 runtime/
chmod -R 777 public/upload/
chown -R www:www .
```

### 4.6 运行 preflight 检查

```bash
php scripts/preflight/preflight-production-check.php --repo=/www/wwwroot/api.xiyun.com
```

所有检查项必须通过。

## 5. 前端构建与上传

### 5.1 配置前端环境与 AppID

```bash
cd shopxo-uniapp
cp .env.production.example .env.production
```

编辑 `.env.production`，替换占位符：
- `{{API_DOMAIN}}` → `api.xiyun.com`
- `{{WX_APPID}}` → 正式小程序 AppID

同时手动修改以下两个文件中的 AppID（三处须一致）：
- `shopxo-uniapp/manifest.json` → `mp-weixin.appid`
- `shopxo-uniapp/project.config.json` → `appid`

#### ⚠️ 防止正式 AppID 误提交到 Git 仓库

填写正式 AppID 后，`manifest.json` 和 `project.config.json` 会在 Git 中显示为 modified。**提交前必须确认不将真实 AppID 提交到公开仓库。**

```bash
# 推荐：标记为本地不跟踪变更
git update-index --assume-unchanged shopxo-uniapp/manifest.json
git update-index --assume-unchanged shopxo-uniapp/project.config.json

# 如需恢复跟踪（例如要切换到测试 AppID）
git update-index --no-assume-unchanged shopxo-uniapp/manifest.json
git update-index --no-assume-unchanged shopxo-uniapp/project.config.json
```

> 运行 `bash scripts/preflight/preflight-production-check.sh` 可验证三处 AppID 一致、非空、且非测试号。

### 5.2 HBuilderX 构建

1. 用 HBuilderX 打开 `shopxo-uniapp` 目录
2. 点击 发行 → 小程序-微信
3. 等待编译完成
4. 用微信开发者工具导入 `unpackage/dist/build/mp-weixin/`
5. 点击上传

### 5.3 微信后台配置

1. 登录 [微信公众平台](https://mp.weixin.qq.com)
2. 开发管理 → 开发设置 → 服务器域名：
   - request 合法域名：`https://api.xiyun.com`
   - uploadFile 合法域名：`https://api.xiyun.com`
   - downloadFile 合法域名：`https://api.xiyun.com`
3. 版本管理 → 提交审核

## 6. 部署后验证

1. 访问 `https://api.xiyun.com/api/common/baseconfig` 确认 API 正常
2. 后台登录 `https://api.xiyun.com/admin.php` 修改默认管理员密码
3. 后台 → 合规中心 → 确认所有高风险功能开关为关闭状态
4. 后台 → 系统设置 → 确认 APP_DEBUG 已关闭
5. 小程序体验版测试核心流程：浏览商品 → 加购 → 下单 → 支付

## 7. 安全清单

| 项目 | 状态 |
|------|------|
| APP_DEBUG = false | ☐ |
| 运行目录 = /public | ☐ |
| .env 不可公网访问 | ☐ |
| runtime/ 不可公网访问 | ☐ |
| MySQL 3306 不开放公网 | ☐ |
| phpMyAdmin 不公网开放 | ☐ |
| SSL 证书已配置 | ☐ |
| 默认管理员密码已修改 | ☐ |
| MUYING_PRIVACY_KEY 已配置 | ☐ |
| 高风险功能开关已关闭 | ☐ |
