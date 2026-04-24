# 宝塔 + Nginx 生产部署检查清单

> 本文档为孕禧小程序生产环境部署的逐项检查清单，基于宝塔面板 + Nginx 部署方案。

## 1. 服务器基础环境

| 检查项 | 要求 | 验证方式 | 状态 |
|-------|------|---------|------|
| PHP 版本 | 8.1+ | `php -v` | ☐ |
| MySQL 版本 | 5.7+ | `mysql --version` | ☐ |
| Nginx | 已安装 | `nginx -v` | ☐ |
| PHP 扩展 | curl/gd/pdo_mysql/mbstring/openssl/bcmath/json/redis | `php -m` 逐项检查 | ☐ |
| 宝塔面板 | 最新稳定版 | 宝塔后台首页 | ☐ |

## 2. 网站配置

| 检查项 | 要求 | 验证方式 | 状态 |
|-------|------|---------|------|
| 域名解析 | 已解析到服务器 IP | `ping 域名` | ☐ |
| HTTPS 证书 | 已部署 SSL 证书，浏览器无警告 | 浏览器访问 https://域名 | ☐ |
| 强制 HTTPS | HTTP 请求 301 跳转到 HTTPS | `curl -I http://域名` | ☐ |
| 网站根目录 | 指向 `shopxo-backend/public/` | 宝塔 → 网站 → 根目录 | ☐ |
| 运行目录 | `/public` | 宝塔 → 网站 → 运行目录 | ☐ |
| 伪静态 | 选择 `thinkphp` 或自定义规则 | 宝塔 → 网站 → 伪静态 | ☐ |
| 跨域配置 | API 域名允许小程序域名访问 | Nginx 配置 CORS | ☐ |

## 3. Nginx 伪静态规则

```nginx
location / {
    if (!-e $request_filename) {
        rewrite ^(.*)$ /index.php?s=$1 last;
    }
}
```

## 4. 后端配置

| 检查项 | 要求 | 验证方式 | 状态 |
|-------|------|---------|------|
| APP_DEBUG | `false` | 检查 `.env` 文件 | ☐ |
| .env 文件 | 存在且已填入真实配置 | `cat .env` | ☐ |
| .env 未提交 | `.gitignore` 包含 `.env` | `git status` 不显示 .env | ☐ |
| 数据库强密码 | 密码长度 ≥ 16 位，含大小写+数字+特殊字符 | 检查 `.env` 中 PASSWORD | ☐ |
| 数据库前缀 | `sxo_` | 检查 `.env` 中 PREFIX | ☐ |
| 数据库字符集 | `utf8mb4` | 检查 `.env` 中 CHARSET | ☐ |
| 上传目录权限 | `public/download/` 可写 | `ls -la public/download/` | ☐ |
| runtime 目录权限 | 可写 | `ls -la runtime/` | ☐ |

## 5. 安全配置

| 检查项 | 要求 | 验证方式 | 状态 |
|-------|------|---------|------|
| 禁止目录列表 | Nginx 未开启 autoindex | 浏览器访问目录无列表 | ☐ |
| 隐藏敏感文件 | `.env`/`.git` 不可访问 | `curl https://域名/.env` 返回 403/404 | ☐ |
| 管理后台入口 | 已修改默认文件名 `adminwlmqhs.php` | 检查 public/ 下管理入口文件 | ☐ |
| 防火墙 | 仅开放 80/443/22 端口 | `iptables -L` 或宝塔防火墙 | ☐ |
| SSH 端口 | 已修改默认 22 端口 | 检查 sshd 配置 | ☐ |
| 宝塔面板端口 | 已修改默认 8888 端口 | 宝塔面板设置 | ☐ |
| PHP 危险函数 | 已禁用 exec/system/passthru/shell_exec 等 | 宝塔 → PHP → 禁用函数 | ☐ |

## 6. 微信小程序配置

| 检查项 | 要求 | 验证方式 | 状态 |
|-------|------|---------|------|
| request 合法域名 | 已添加 API 域名（HTTPS） | 微信后台 → 开发管理 | ☐ |
| uploadFile 合法域名 | 已添加上传域名 | 微信后台 → 开发管理 | ☐ |
| downloadFile 合法域名 | 已添加下载域名 | 微信后台 → 开发管理 | ☐ |
| AppID | 已配置正式 AppID | 检查 `.env.production` | ☐ |
| AppSecret | 已配置且安全保管 | 微信后台 → 开发管理 | ☐ |

## 7. 功能开关确认

| 检查项 | 要求 | 验证方式 | 状态 |
|-------|------|---------|------|
| 高风险插件关闭 | distribution/wallet/coin 等功能开关为 0 | 后台配置管理 或 `preflight-production-check.sh` | ☐ |
| 一期必要功能开启 | activity/invite/content/feedback 功能开关为 1 | 后台配置管理 | ☐ |
| 测试 AppID 不存在 | 生产环境无 wx1234567890 等测试 ID | 搜索代码和配置 | ☐ |
| localhost/127.0.0.1 不存在 | 生产配置无本地地址 | `preflight-production-check.sh` | ☐ |

## 8. 部署后验证

| 检查项 | 要求 | 验证方式 | 状态 |
|-------|------|---------|------|
| 首页可访问 | HTTPS 返回 200 | `curl -I https://域名` | ☐ |
| API 可访问 | `/api.php?s=index/index` 返回 JSON | `curl https://域名/api.php?s=index/index` | ☐ |
| 管理后台可登录 | 使用管理员账号登录 | 浏览器访问管理后台 | ☐ |
| 商品列表可加载 | 前端商品页正常显示 | 小程序体验版测试 | ☐ |
| 活动报名正常 | 可正常报名和取消 | 小程序体验版测试 | ☐ |
| 支付流程正常 | 可正常下单支付 | 小程序体验版测试 | ☐ |
| 禁用功能拦截 | 访问 distribution 等插件返回"该功能暂未开放" | API 测试 | ☐ |

## 9. 备份与回滚

| 检查项 | 要求 | 验证方式 | 状态 |
|-------|------|---------|------|
| 数据库定时备份 | 宝塔 → 计划任务 → 每日备份 | 检查备份文件 | ☐ |
| 网站文件备份 | 部署前已备份 | 确认备份文件存在 | ☐ |
| 回滚方案 | 已准备回滚步骤 | 参考 `docs/release/bt-deploy-rollback-guide.md` | ☐ |

## 变更记录

| 日期 | 变更内容 |
|------|---------|
| 2026-04-24 | 初始版本 |
