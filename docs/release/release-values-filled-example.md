# 孕禧小程序 — 发布参数填写示例（假值）

> ⚠️ **本文件所有值均为假值，不可直接用于生产环境！**
> ⚠️ **本文件仅用于展示最终填写效果，帮助理解每个字段应该填什么。**
>
> 正式发布请复制 `release-values-template.md` 并填入真实值。

---

## 1. 微信小程序配置

| # | 参数名 | 占位符 | 示例值（假值） | 填入位置 |
|---|--------|--------|--------------|---------|
| 1 | AppID | `""` | `wxda7779770f53e901` | `shopxo-uniapp/manifest.json` → `mp-weixin.appid` |
| 2 | AppSecret | — | `a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6` | 后台 → 系统设置 → 微信小程序配置 |
| 3 | 服务器域名(request) | — | `https://api.yunxi-example.com` | 微信后台 → 开发管理 → 服务器域名 |
| 4 | 服务器域名(uploadFile) | — | `https://api.yunxi-example.com` | 同上 |
| 5 | 服务器域名(downloadFile) | — | `https://api.yunxi-example.com` | 同上 |

---

## 2. 域名与部署路径

| # | 参数名 | 占位符 | 示例值（假值） | 填入位置 |
|---|--------|--------|--------------|---------|
| 1 | API 域名 | `{{API_DOMAIN}}` | `api.yunxi-example.com` | Nginx 配置、前端环境变量、微信后台 |
| 2 | CDN 域名 | `{{CDN_DOMAIN}}` | `cdn.yunxi-example.com` | 前端环境变量 |
| 3 | 部署目录 | `{{DEPLOY_PATH}}` | `/data/www/yunxi` | Nginx root、目录权限脚本 |
| 4 | SSL 证书路径 | `{{SSL_CERT_PATH}}` | `/etc/nginx/ssl` | Nginx ssl_certificate |
| 5 | Nginx server_name | `localhost` | `api.yunxi-example.com` | `deploy/nginx.production.example.conf` |

---

## 3. 数据库连接

| # | 参数名 | 占位符 | 示例值（假值） | 填入位置 |
|---|--------|--------|--------------|---------|
| 1 | 数据库主机 | `mysql` | `10.0.1.50` | `shopxo-backend/.env.production` → DATABASE.HOSTNAME |
| 2 | 数据库端口 | `3306` | `3306` | 同上 |
| 3 | 数据库名 | `shopxo` | `yunxi_prod` | 同上 |
| 4 | 数据库用户 | `root` | `yunxi_app` | 同上 |
| 5 | 数据库密码 | `shopxo_dev_123` | `Kx8mP2vN9qR4wT6y` | 同上 |
| 6 | 表前缀 | `sxo_` | `sxo_` | 安装向导 |
| 7 | MySQL Root 密码 | `shopxo_dev_123` | `Yz3hF7jM5nB8dL1c` | 根目录 `.env` → MYSQL_ROOT_PASSWORD |

---

## 4. 后端环境配置

| # | 参数名 | 占位符 | 示例值（假值） | 填入位置 |
|---|--------|--------|--------------|---------|
| 1 | 调试模式 | `true` | `false` | `shopxo-backend/.env.production` → APP_DEBUG |
| 2 | 错误显示 | — | `false` | `shopxo-backend/config/app.php` → show_error_msg |
| 3 | 安装入口 | 存在 | 已删除 | `rm public/install.php` |

---

## 5. 品牌与联系方式

| # | 参数名 | 占位符 | 示例值（假值） | 填入位置 |
|---|--------|--------|--------------|---------|
| 1 | 客服电话 | `{{CONTACT_PHONE}}` | `400-8888-1234` | 活动数据 SQL、后台配置 |
| 2 | 站点名称 | — | `孕禧` | 后台 → 系统设置 → home_site_name |
| 3 | 正方形 Logo | — | `/static/upload/logo/square.png` | 后台 → 系统设置 → home_site_logo_square |
| 4 | 手机端 Logo | — | `/static/upload/logo/wap.png` | 后台 → 系统设置 → home_site_logo_wap |

---

## 6. 协议与隐私

| # | 参数名 | 占位符 | 示例值（假值） | 填入位置 |
|---|--------|--------|--------------|---------|
| 1 | 隐私政策 URL | — | `https://api.yunxi-example.com/agreement/privacy.html` | 后台 → 协议管理 |
| 2 | 注册协议 URL | — | `https://api.yunxi-example.com/agreement/register.html` | 后台 → 协议管理 |
| 3 | 注销协议 URL | — | `https://api.yunxi-example.com/agreement/logout.html` | 后台 → 协议管理 |

---

## 7. 管理后台

| # | 参数名 | 占位符 | 示例值（假值） | 填入位置 |
|---|--------|--------|--------------|---------|
| 1 | 后台入口文件名 | `{{ADMIN_ENTRY}}` | `adminX8k2m.php` | 安装后自动生成 |
| 2 | 管理员账号 | — | `admin_yunxi` | 安装时创建 |
| 3 | 管理员密码 | — | `Wp5rJ9tN3xH7kM2v` | 安装时创建 |

---

## 8. 前端构建环境变量

| # | 参数名 | 占位符 | 示例值（假值） | 填入位置 |
|---|--------|--------|--------------|---------|
| 1 | API 接口地址 | `process.env.UNI_APP_REQUEST_URL` | `https://api.yunxi-example.com/` | HBuilderX 发行时设置 |
| 2 | 静态资源地址 | `process.env.UNI_APP_STATIC_URL` | `https://cdn.yunxi-example.com/` | HBuilderX 发行时设置 |

---

## 9. SQL 初始化数据

| # | 参数名 | 占位符 | 示例值（假值） | 填入位置 |
|---|--------|--------|--------------|---------|
| 1 | 客服电话 | `{{CONTACT_PHONE}}` | `400-8888-1234` | `docs/sql/yunxi-init-activity-demo.sql` 中 6 处 |

---

## 10. 微信后台隐私保护指引

| # | 填写项 | 示例用途说明 |
|---|--------|------------|
| 1 | 收集手机号 | 用于订单联系、活动报名通知 |
| 2 | 收集位置信息 | 用于门店自提定位（可选） |
| 3 | 收集头像昵称 | 用于个人资料展示（可选） |
| 4 | 选择图片 | 用于修改头像、上传地址证明 |
| 5 | 保存图片到相册 | 用于保存邀请海报到手机 |

---

## 对应的配置文件示例

填写完上述参数后，对应配置文件应如下：

- **Nginx**: 参考 `deploy/nginx.production.example.conf`
- **后端 .env**: 参考 `shopxo-backend/.env.production.example`
- **前端构建**: 参考 `shopxo-uniapp/.env.release.example`
