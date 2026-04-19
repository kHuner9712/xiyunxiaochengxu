# 孕禧小程序 — 正式发布参数模板

> 本文件收集所有需要人工替换的发布参数。
> 发布前逐项填写"实际值"列，确保所有占位符均已落地。
> 填写完成后，运行 `bash scripts/preflight/check-placeholders.sh` 验证无残留。

---

## 1. 微信小程序配置

| # | 参数名 | 占位符 / 当前值 | 实际值 | 填入位置 | 必须替换 |
|---|--------|----------------|--------|---------|:---:|
| 1 | AppID | `""` (空) | | `shopxo-uniapp/manifest.json` → `mp-weixin.appid` | ✅ |
| 2 | AppSecret | — | | 后台 → 系统设置 → 微信小程序配置 | ✅ |
| 3 | 服务器域名(request) | — | | 微信后台 → 开发管理 → 服务器域名 | ✅ |
| 4 | 服务器域名(uploadFile) | — | 同上 | 同上 | ✅ |
| 5 | 服务器域名(downloadFile) | — | 同上 | 同上 | ✅ |

> ⚠️ manifest.json 中 `mp-weixin.appid` 当前为空字符串，不填入真实值则无法编译上传。

---

## 2. 域名与部署路径

| # | 参数名 | 占位符 / 当前值 | 实际值 | 填入位置 | 必须替换 |
|---|--------|----------------|--------|---------|:---:|
| 1 | API 域名 | `{{API_DOMAIN}}` | | Nginx 配置、前端环境变量、微信后台 | ✅ |
| 2 | CDN 域名 | `{{CDN_DOMAIN}}` | | 前端环境变量（可与 API 同域） | ❌ |
| 3 | 部署目录 | `{{DEPLOY_PATH}}` | | Nginx root、目录权限脚本 | ✅ |
| 4 | SSL 证书路径 | `{{SSL_CERT_PATH}}` | | Nginx ssl_certificate | ✅ |
| 5 | Nginx server_name | `localhost` | | `docker/nginx/default.conf` → server_name | ✅ |

> ⚠️ `docker/nginx/default.conf` 中 server_name 当前为 `localhost`，生产环境必须替换为实际域名。

---

## 3. 数据库连接

| # | 参数名 | 占位符 / 当前值 | 实际值 | 填入位置 | 必须替换 |
|---|--------|----------------|--------|---------|:---:|
| 1 | 数据库主机 | `mysql` (Docker容器名) | | `shopxo-backend/.env` → DATABASE.HOSTNAME | ✅ |
| 2 | 数据库端口 | `3306` | | 同上 | ✅ |
| 3 | 数据库名 | `shopxo` | | 同上 | ✅ |
| 4 | 数据库用户 | `root` | | 同上 | ✅ |
| 5 | 数据库密码 | `shopxo_dev_123` / `root123456` | | `.env` → DATABASE.PASSWORD | ✅ |
| 6 | 表前缀 | `sxo_` | | 安装向导（必须与 SQL 文件一致） | ✅ |
| 7 | MySQL Root 密码 | `shopxo_dev_123` | | 根目录 `.env` → MYSQL_ROOT_PASSWORD | ✅ |

> ⚠️ **密码不一致风险**：`shopxo-backend/.env.example` 中密码为 `shopxo_dev_123`，而 `config/database.php` 中硬编码密码为 `root123456`。ThinkPHP 6 中 `.env` 优先级高于 `config/database.php`，生产部署时：
> - 方案A：创建 `.env` 文件并设置统一密码，`.env` 生效后 `database.php` 中的硬编码值不生效
> - 方案B：不创建 `.env`，直接修改 `database.php` 中的密码
> - **无论哪种方案，必须确保密码与 MySQL 实际密码一致**

---

## 4. 后端环境配置

| # | 参数名 | 占位符 / 当前值 | 实际值 | 填入位置 | 必须替换 |
|---|--------|----------------|--------|---------|:---:|
| 1 | 调试模式 | `true` | `false` | `shopxo-backend/.env` → APP_DEBUG | ✅ |
| 2 | 错误显示 | — | `false` | `shopxo-backend/config/app.php` → show_error_msg | ✅ |
| 3 | 安装入口 | 存在 | 删除 | `rm public/install.php` | ✅ |

> ⚠️ APP_DEBUG=true 在生产环境会暴露敏感信息，必须改为 false。

---

## 5. 品牌与联系方式

| # | 参数名 | 占位符 / 当前值 | 实际值 | 填入位置 | 必须替换 |
|---|--------|----------------|--------|---------|:---:|
| 1 | 客服电话 | `{{CONTACT_PHONE}}` | | 活动数据 SQL、后台配置 | ✅ |
| 2 | 站点名称 | — | 孕禧 | 后台 → 系统设置 → home_site_name | ✅ |
| 3 | 正方形 Logo | — | | 后台 → 系统设置 → home_site_logo_square（300×300px PNG） | ✅ |
| 4 | 手机端 Logo | — | | 后台 → 系统设置 → home_site_logo_wap（220×66px） | ✅ |
| 5 | PC 端 Logo | — | | 后台 → 系统设置 → home_site_logo | ❌ |

---

## 6. 协议与隐私

| # | 参数名 | 占位符 / 当前值 | 实际值 | 填入位置 | 必须替换 |
|---|--------|----------------|--------|---------|:---:|
| 1 | 隐私政策 URL | — | | 后台 → 协议管理 → config.agreement_userprivacy_url | ✅ |
| 2 | 注册协议 URL | — | | 后台 → 协议管理 → config.agreement_userregister_url | ✅ |
| 3 | 注销协议 URL | — | | 后台 → 协议管理 → config.agreement_userlogout_url | ❌ |

---

## 7. 管理后台

| # | 参数名 | 占位符 / 当前值 | 实际值 | 填入位置 | 必须替换 |
|---|--------|----------------|--------|---------|:---:|
| 1 | 后台入口文件名 | `{{ADMIN_ENTRY}}` | | 安装后自动生成，记录在部署文档 | ✅ |
| 2 | 管理员账号 | — | | 安装时创建 | ✅ |
| 3 | 管理员密码 | — | | 安装时创建 | ✅ |

---

## 8. 前端构建环境变量

| # | 参数名 | 占位符 / 当前值 | 实际值 | 填入位置 | 必须替换 |
|---|--------|----------------|--------|---------|:---:|
| 1 | API 接口地址 | `process.env.UNI_APP_REQUEST_URL` | `https://实际域名/` | HBuilderX 发行时设置 UNI_APP_REQUEST_URL | ✅ |
| 2 | 静态资源地址 | `process.env.UNI_APP_STATIC_URL` | | HBuilderX 发行时设置 UNI_APP_STATIC_URL | ❌ |

> ⚠️ `prod.js` 中 `UNI_APP_REQUEST_URL` 为空时会 `console.error`，但不会阻断构建。必须在 HBuilderX 发行配置中设置环境变量。

---

## 9. SQL 初始化数据

| # | 参数名 | 占位符 / 当前值 | 实际值 | 填入位置 | 必须替换 |
|---|--------|----------------|--------|---------|:---:|
| 1 | 客服电话 | `{{CONTACT_PHONE}}` | | `docs/sql/yunxi-init-activity-demo.sql` 中 6 处 | ✅ |

> ⚠️ SQL 文件中有 6 处 `'{{CONTACT_PHONE}}'` 占位符，执行 SQL 前必须全局替换为真实客服电话。

---

## 10. 微信后台隐私保护指引

| # | 填写项 | 说明 | 必须填写 |
|---|--------|------|:---:|
| 1 | 收集手机号 | 用途：订单联系、活动通知 | ✅ |
| 2 | 收集位置信息 | 用途：门店自提（可选） | ❌ |
| 3 | 收集头像昵称 | 用途：个人资料展示（可选） | ❌ |
| 4 | 选择图片 | 用途：修改头像、上传地址证明 | ❌ |
| 5 | 保存图片到相册 | 用途：保存分享海报 | ❌ |

---

## 填写说明

- **必须替换** ✅：发布前必须填入实际值，否则功能异常或审核被拒
- **可选替换** ❌：不填不影响核心功能，但建议填写以获得完整体验
- **实际值**列：发布前在此文件中填写，作为发布记录存档
- 填写完成后运行 `bash scripts/preflight/check-placeholders.sh` 扫描残留占位符
- 运行 `bash scripts/preflight/check-placeholders.sh --docs-also` 同时扫描文档中的占位符
