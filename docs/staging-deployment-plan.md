# Staging 部署计划 — review-remediation-phase1

> 目标：将 review-remediation-phase1 分支部署到测试服务器/宝塔测试站点
> ⚠️ **不直接覆盖生产环境**

---

## 1. 基本信息

| 项目 | 值 |
|------|-----|
| 当前分支 | `review-remediation-phase1` |
| 部署目标 | 测试服务器 / 宝塔测试站点 |
| 后端框架 | ThinkPHP 6 (ShopXO) |
| 前端框架 | uni-app (微信小程序) |
| PHP 版本要求 | >= 8.1 |
| MySQL 版本要求 | >= 5.7 |

---

## 2. 部署前准备

### 2.1 备份数据库

```bash
# 宝塔面板 → 数据库 → 对应数据库 → 备份
# 或命令行：
mysqldump -u<DB_USER> -p<DB_NAME> > backup_$(date +%Y%m%d_%H%M%S).sql
```

### 2.2 备份代码

```bash
# 在宝塔面板网站目录下
cp -r /www/wwwroot/<SITE_DIR> /www/wwwroot/<SITE_DIR>_backup_$(date +%Y%m%d_%H%M%S)
```

### 2.3 确认当前环境

```bash
php -v              # 确认 >= 8.1
mysql --version     # 确认 >= 5.7
nginx -v            # 确认 Nginx 版本
```

---

## 3. 代码部署

### 3.1 拉取代码

```bash
cd /www/wwwroot/<SITE_DIR>
git fetch origin
git checkout review-remediation-phase1
git pull origin review-remediation-phase1
```

### 3.2 安装后端依赖

```bash
cd /www/wwwroot/<SITE_DIR>/shopxo-backend
composer install --no-dev --optimize-autoloader
```

---

## 4. SQL 迁移

> ⚠️ 执行前必须确认表前缀！所有 SQL 文件默认使用 `sxo_` 前缀。
> 如果实际表前缀不同，必须全局替换后再执行。
> 详细执行顺序见 [docs/sql/README-migration-order.md](sql/README-migration-order.md)

### 4.1 确认表前缀

```sql
-- 登录 MySQL 后执行
SHOW TABLES LIKE '%_config';
-- 观察输出，确认前缀（如 sxo_config、tp_config 等）
```

### 4.2 前缀替换（如需要）

```bash
# 如果实际前缀是 tp_ 而非 sxo_，执行替换
sed -i 's/sxo_/tp_/g' docs/sql/muying-activity-signup-privacy-split-migration.sql
# 对所有 SQL 文件执行相同替换
```

### 4.3 按顺序执行迁移

```bash
# 1. 主迁移（必须）
mysql -u<DB_USER> -p<DB_NAME> < docs/muying-final-migration.sql

# 2. 增量迁移（按顺序，详见 README-migration-order.md）
mysql -u<DB_USER> -p<DB_NAME> < docs/sql/muying-feature-switch-migration.sql
mysql -u<DB_USER> -p<DB_NAME> < docs/sql/muying-compliance-center-migration.sql
mysql -u<DB_USER> -p<DB_NAME> < docs/sql/muying-sensitive-permission-migration.sql
mysql -u<DB_USER> -p<DB_NAME> < docs/sql/muying-privacy-power-migration.sql
mysql -u<DB_USER> -p<DB_NAME> < docs/sql/muying-content-sensitive-word-power-migration.sql
mysql -u<DB_USER> -p<DB_NAME> < docs/sql/muying-content-compliance-migration.sql
mysql -u<DB_USER> -p<DB_NAME> < docs/sql/muying-feedback-type-migration.sql
mysql -u<DB_USER> -p<DB_NAME> < docs/sql/muying-activity-signup-privacy-split-migration.sql
mysql -u<DB_USER> -p<DB_NAME> < docs/sql/muying-goods-compliance-migration.sql
mysql -u<DB_USER> -p<DB_NAME> < docs/sql/muying-privacy-security-migration.sql
mysql -u<DB_USER> -p<DB_NAME> < docs/sql/muying-v1-post-migration.sql

# 3. 初始化配置（必须）
mysql -u<DB_USER> -p<DB_NAME> < docs/sql/xiyun-init-config.sql

# 4. 演示数据（可选，测试环境建议执行）
mysql -u<DB_USER> -p<DB_NAME> < docs/sql/xiyun-init-activity-demo.sql
mysql -u<DB_USER> -p<DB_NAME> < docs/sql/xiyun-init-feedback-demo.sql
```

---

## 5. 后端环境配置

### 5.1 .env 配置

编辑 `shopxo-backend/.env`：

```ini
[APP]
APP_DEBUG = false

[DATABASE]
HOSTNAME = <DB_HOST>
DATABASE = <DB_NAME>
USERNAME = <DB_USER>
PASSWORD = <DB_PASSWORD>
HOSTPORT = 3306
PREFIX = sxo_

[MUYING]
MUYING_PRIVACY_KEY = <生成一个32位随机字符串>
feature_payment_enabled = 0
feature_dynamic_page_enabled = 0
feature_realstore_enabled = 0
feature_hospital_enabled = 0
feature_wallet_enabled = 0
feature_aftersale_dispute_enabled = 0

; 一期核心功能 — 必须开启
feature_activity_enabled = 1
feature_content_enabled = 1
feature_feedback_enabled = 1
feature_invite_enabled = 1
feature_membership_enabled = 1
```

### 5.2 生成 MUYING_PRIVACY_KEY

```bash
php -r "echo bin2hex(random_bytes(16)) . PHP_EOL;"
# 将输出写入 .env 的 MUYING_PRIVACY_KEY
```

### 5.3 清理缓存

```bash
cd /www/wwwroot/<SITE_DIR>/shopxo-backend
php think clear
```

### 5.4 确认 install.php 不存在

```bash
ls -la shopxo-backend/public/install.php
# 预期：No such file or directory
# 如果存在，删除：
rm -f shopxo-backend/public/install.php
```

---

## 6. Nginx 配置

### 6.1 运行目录

宝塔面板 → 网站 → 设置 → 网站目录：

- 运行目录设为 `/public`
- 防跨站攻击：关闭（ThinkPHP 需要访问 runtime 目录）

### 6.2 HTTPS 检查

```bash
curl -I https://<STAGING_DOMAIN>/api/common/init
# 确认返回 HTTP/2 200
# 确认无混合内容警告
```

### 6.3 Nginx 安全规则

确认 Nginx 配置中包含以下规则：

```nginx
# 禁止访问 install.php
location = /install.php {
    deny all;
}

# 禁止访问隐藏文件
location ~ /\. {
    deny all;
}

# 禁止访问 .env
location = /.env {
    deny all;
}

# 禁止访问 runtime 目录
location ^~ /runtime/ {
    deny all;
}
```

---

## 7. 前端构建与部署

### 7.1 配置环境变量

```bash
cd shopxo-uniapp
cp .env.production.example .env.production
```

编辑 `.env.production`：

```ini
UNI_APP_WX_APPID=<正式AppID>
UNI_APP_REQUEST_URL=https://<STAGING_DOMAIN>
```

### 7.2 HBuilderX 构建

- HBuilderX → 发行 → 小程序-微信
- 等待编译完成

### 7.3 检查构建产物

```bash
ls shopxo-uniapp/unpackage/dist/build/mp-weixin/app.json
# 确认存在
grep '"appid"' shopxo-uniapp/unpackage/dist/build/mp-weixin/project.config.json
# 确认 AppID 已注入
```

### 7.4 微信开发者工具验证

- 导入 `unpackage/dist/build/mp-weixin/` 目录
- 取消「不校验合法域名」
- 编译无报错
- 首页正常渲染

---

## 8. 部署后验证清单

| # | 验证项 | 命令/操作 | 预期结果 |
|---|--------|----------|----------|
| 1 | APP_DEBUG 已关闭 | 访问错误 URL | 不显示调试堆栈 |
| 2 | install.php 不存在 | `curl https://<DOMAIN>/install.php` | 403 或 404 |
| 3 | .env 不可访问 | `curl https://<DOMAIN>/.env` | 403 或 404 |
| 4 | runtime 不可访问 | `curl https://<DOMAIN>/runtime/` | 403 |
| 5 | HTTPS 正常 | `curl -I https://<DOMAIN>` | HTTP/2 200 |
| 6 | API 正常 | `curl https://<DOMAIN>/api/common/init` | JSON 响应 |
| 7 | feature_payment_enabled=0 | 尝试访问收银台 | 跳转错误页 |
| 8 | feature_dynamic_page_enabled=0 | 尝试访问 DIY 页面 | 跳转错误页 |
| 9 | 活动列表正常 | 小程序打开活动页 | 正常展示 |
| 10 | 首页 DIY 正常 | 小程序打开首页 | DIY 组件渲染 |
| 11 | 缓存已清理 | 检查 runtime/cache 目录 | 无旧缓存文件 |
| 12 | MUYING_PRIVACY_KEY 已设置 | 检查 .env | 32 位十六进制字符串 |

---

## 9. 回滚方案

如果部署后发现问题：

```bash
# 1. 恢复代码
rm -rf /www/wwwroot/<SITE_DIR>
mv /www/wwwroot/<SITE_DIR>_backup_<TIMESTAMP> /www/wwwroot/<SITE_DIR>

# 2. 恢复数据库
mysql -u<DB_USER> -p<DB_NAME> < backup_<TIMESTAMP>.sql

# 3. 清理缓存
cd /www/wwwroot/<SITE_DIR>/shopxo-backend
php think clear
```

---

## 10. 注意事项

1. **不要直接覆盖生产** — 本计划仅适用于测试环境
2. **表前缀必须确认** — 所有 SQL 默认 `sxo_`，实际前缀可能不同
3. **MUYING_PRIVACY_KEY 不可留空** — 加密功能依赖此密钥
4. **feature_payment_enabled=0** — 一期提审期间支付功能必须关闭
5. **feature_dynamic_page_enabled=0** — 一期提审期间动态页面必须关闭
6. **install.php 必须删除** — 安全要求
7. **APP_DEBUG=false** — 测试环境也应关闭调试模式
