# 生产配置与环境变量对照表

> 面向：孕禧小程序一期上线

---

## 1. uni-app dev/prod 配置

| 配置项 | 开发环境 | 生产环境 | 文件位置 |
|--------|---------|---------|---------|
| API 基础地址 | `http://127.0.0.1:8080/` | `https://api.yunxi.com/` | `.env.development` / `.env.production` |
| 静态资源地址 | 空（同API域名） | `https://static.yunxi.com/` 或同API域名 | `.env.production` 的 `UNI_APP_STATIC_URL` |
| 微信 appid | `wxda7779770f53e901`（测试号） | 正式号待申请 | `manifest.json` |

### 前端环境变量配置步骤

1. 复制模板文件：
```bash
cp .env.production.example .env.production
```

2. 编辑 `.env.production`：
```
UNI_APP_REQUEST_URL=https://api.yunxi.com/
UNI_APP_STATIC_URL=https://api.yunxi.com/
```

3. HBuilderX 发行时选择「生产环境」

## 2. 后端域名/接口地址配置

| 配置项 | 开发环境 | 生产环境 | 配置方式 |
|--------|---------|---------|---------|
| 数据库主机 | `mysql`（Docker）/ `127.0.0.1` | `127.0.0.1` | `.env` HOSTNAME |
| 数据库名 | `shopxo_dev` | `shopxo_dev` 或自定义 | `.env` DATABASE |
| 数据库用户 | `root` | 专用账号（建议） | `.env` USERNAME |
| 数据库密码 | `<强密码>` | **替换为强密码** | `.env` PASSWORD |
| APP_DEBUG | `false` | `false` | `.env` |

### 后端 .env 配置步骤

1. 编辑 `shopxo-backend/.env`：
```ini
APP_DEBUG = false

[DATABASE]
TYPE = mysql
HOSTNAME = 127.0.0.1
DATABASE = shopxo_dev
USERNAME = yunxi_user
PASSWORD = <强密码>
HOSTPORT = 3306
CHARSET = utf8mb4
PREFIX = sxo_
```

2. 确认 `.env` 在 `.gitignore` 中（已确认）

## 3. 静态资源地址配置

ShopXO 静态资源（后台 CSS/JS/图片）在 `public/static/` 目录下，由 Nginx 直接服务，无需额外配置。

用户上传文件在 `public/upload/` 目录下，访问路径为 `https://api.yunxi.com/upload/`。

## 4. 微信测试号域名配置

在微信公众平台（测试号管理页面）需配置以下域名：

| 域名类型 | 域名 | 说明 |
|---------|------|------|
| request 合法域名 | `https://api.yunxi.com` | API 请求 |
| uploadFile 合法域名 | `https://api.yunxi.com` | 文件上传 |
| downloadFile 合法域名 | `https://api.yunxi.com` | 文件下载 |

> 当前域名未备案完成前，无法配置 HTTPS 域名。测试阶段需：
> - 在微信开发者工具中勾选「不校验合法域名」
> - 或使用 HTTP + 内网穿透工具（如 ngrok）进行本地调试

## 5. 当前可做 vs 待备案完成后才能做

| 能力 | 当前状态 | 条件 |
|------|---------|------|
| 本地开发调试 | ✅ 可做 | 微信开发者工具勾选「不校验合法域名」 |
| 内网联调 | ✅ 可做 | 使用内网穿透 |
| 真机扫码测试 | ⚠️ 有限 | 需内网穿透或局域网 |
| 正式小程序发布 | ❌ 不可做 | 需正式 AppID + 备案域名 |
| 微信支付 | ❌ 不可做 | 需正式商户号 |
| 微信登录 | ⚠️ 测试号可用 | 测试号支持登录 |

## 6. 需手工填写的值

| 配置项 | 占位符 | 实际值（部署时填写） |
|--------|--------|-------------------|
| 域名 | `api.yunxi.com` | ____________ |
| 数据库名 | `shopxo_dev` | ____________ |
| 数据库账号 | `yunxi_user` | ____________ |
| 数据库密码 | `<强密码>` | ____________ |
| 后端地址 | `https://api.yunxi.com/` | ____________ |
| 静态资源地址 | `https://api.yunxi.com/` | ____________ |
| 小程序测试号 AppID | `wxda7779770f53e901` | ____________ |
| 小程序测试号 AppSecret | （微信公众平台获取） | ____________ |
| 文件上传路径 | `/www/wwwroot/yunxi-api/public/upload` | ____________ |
| 日志路径 | `/www/wwwroot/yunxi-api/runtime/log` | ____________ |
| 后台入口文件名 | `adminwlmqhs.php` | ____________ |
| 后台管理员账号 | 部署时创建 | ____________ |
| 后台管理员密码 | 部署时创建 | ____________ |
