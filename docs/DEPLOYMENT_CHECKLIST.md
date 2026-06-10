# 部署前收口清单（Go/No-Go）

适用阶段：正式部署前最后检查。  
目标：保证部署可靠性、配置一致性、回滚可执行。  
注意：禁止把真实密钥、证书、AppID、联系方式、证照号提交到 Git。

## 1. 服务器要求

- 系统建议：Ubuntu 22.04 LTS（或同级 Linux）
- 资源建议：4C8G 起步，系统盘可用空间 >= 50GB
- 必备软件：Docker、Docker Compose、curl、git
- 网络端口：`80`、`443` 对公网开放；`3306`、`6379` 仅内网

## 2. 域名解析要求

- `API_DOMAIN` 指向 API 服务器公网 IP
- `ADMIN_DOMAIN` 指向同一公网 IP（或负载均衡）
- A 记录生效后执行：
  - `dig <API_DOMAIN>`
  - `dig <ADMIN_DOMAIN>`

## 3. HTTPS 证书路径

- Nginx 证书文件放置：
  - `deploy/nginx/ssl/fullchain.pem`
  - `deploy/nginx/ssl/privkey.pem`
- 文件可读权限检查：
  - `ls -l deploy/nginx/ssl`

## 4. 微信小程序后台合法域名

在微信公众平台配置并保存：

- `request` 合法域名：`https://<API_DOMAIN>`
- `uploadFile` 合法域名：`https://<API_DOMAIN>`
- `downloadFile` 合法域名：`https://<API_DOMAIN>`

## 5. 微信支付回调域名

- 支付回调：`https://<API_DOMAIN>/api/weapp/pay/callback`
- 退款回调：`https://<API_DOMAIN>/api/weapp/pay/refund-callback`
- 要求：公网可达、HTTPS 证书有效、路径与后端路由一致

## 6. 上传文件公网访问规则

- `UPLOAD_PUBLIC_URL` 建议填写 API 域名根地址：`https://<API_DOMAIN>`。
- 公开文件只允许访问 `/uploads/public/...`。
- `/uploads/private/...` 必须返回 403；售后图片、营业执照、资质图片、后台敏感上传文件不得被静态 URL 直接打开。
- 兜底 `/uploads/...` 必须返回 403，避免未来新增目录误公开。
- API 容器如被误直连公网，也不得由 NestJS 静态资源暴露整个 `UPLOAD_DIR`；仅允许后端公开 `uploads/public`。
- 私有文件验收路径：本人/管理员通过 `/api/common/file/private/:id` 鉴权访问成功，其他普通用户访问失败。

## 7. .env 必填项（生产）

至少确认以下变量已填写真实值（不可占位）：

- `DB_PASSWORD`
- `REDIS_PASSWORD`
- `JWT_SECRET`
- `REFRESH_TOKEN_SECRET`
- `WECHAT_APP_ID`
- `WECHAT_APP_SECRET`
- `WECHAT_MCH_ID`
- `WECHAT_MCH_SERIAL_NO`
- `WECHAT_API_V3_KEY`
- `WECHAT_PRIVATE_KEY_PATH`（容器内路径）
- `WECHAT_PLATFORM_CERT_PATH`（容器内路径）
- `WECHAT_PLATFORM_CERT_SERIAL_NO`
- `WECHAT_NOTIFY_URL`
- `WECHAT_REFUND_NOTIFY_URL`
- `CORS_ORIGINS`
- `UPLOAD_PUBLIC_URL`
- `ADMIN_DEFAULT_USERNAME`
- `ADMIN_DEFAULT_PASSWORD`

建议顺序：

1. `cp .env.production.example .env.production`
2. 填写真实值（仅服务器本地保存）
3. 执行 `pnpm release:check:prod`

## 8. 微信支付证书文件放置路径

宿主机路径（不进 Git）：

- `deploy/certs/apiclient_key.pem`
- `deploy/certs/wechatpay_platform.pem`

容器内映射路径（与 `.env` 保持一致）：

- `/app/apps/api/certs/apiclient_key.pem`
- `/app/apps/api/certs/wechatpay_platform.pem`

## 9. 首次启动步骤

1. 首次启动前执行：
   - `pnpm release:check`
   - `pnpm release:check:prod`
2. 启动：
   - `cd deploy && docker compose --env-file ../.env.production up -d --build`
3. 首次初始化如需 seed：
   - `RUN_SEED=true` 启动 API 一次
4. 后续部署默认：
   - `RUN_SEED=false`

## 10. 数据库迁移

- 生产使用 `prisma migrate deploy`，不使用 `db push`
- 当前 entrypoint 在 `NODE_ENV=production` 下会自动执行迁移
- 发布后核验：
  - `docker compose logs api | grep -i migrate`

## 11. 管理后台访问地址

- `https://<ADMIN_DOMAIN>/`
- 登录后必须验证：
  - 首次登录强制改密流程
  - 关键页面可正常加载

## 12. 小程序构建与上传

1. 生产构建必须走脚本：`pnpm build:mini:prod`
2. 使用真实 AppID 在微信开发者工具上传体验版
3. 确认请求域名、上传下载域名与线上一致
4. 禁止直接使用源码 `apps/miniprogram/src/manifest.json` 上传体验版/正式版
5. 生产 `VITE_API_BASE_URL` 必须为 `https://<API_DOMAIN>/api`，不得使用 localhost、127.0.0.1、example.com、your-domain 等本地或占位地址

## 13. 真机验收清单

- 微信登录、浏览商品、加购、下单、支付发起
- 支付取消分流是否正确（不误导为失败）
- 支付结果确认页是否显示“确认中/成功/待支付”
- 订单详情继续支付、退款申请、退款状态更新
- 商品公开图片是否可访问，售后/资质/营业执照私有图片是否不可被静态 URL 直接访问

## 14. 回滚方案

- 代码回滚到上一个稳定 tag/commit
- 重新 `docker compose up -d --build`
- 数据库回滚前必须先备份；优先前向修复
- 回滚后立即跑 `smoke` 与健康检查

## 15. 数据备份建议

- 每日自动备份 MySQL（至少保留 7 天）
- 发布前手动做一次全量备份
- 备份文件异地存储并定期做恢复演练

## 16. 必须人工准备的真实资质/信息

以下信息不得由代码仓库占位替代，必须由运营/老板/法务线下提供并在上线前确认：

- 真实微信小程序 AppID / AppSecret
- 真实微信支付商户信息与证书
- 客服电话、客服微信、售后退货地址
- 备案号、许可证号、主体资质信息
- 法务确认后的隐私协议/用户协议正式文本

## 附：Nginx 域名模板化说明

本仓库已保留现用配置：`deploy/nginx/conf.d/default.conf`。  
同时提供模板：`deploy/nginx/conf.d/default.conf.template`。

推荐生产生成方式（示例）：

```bash
export API_DOMAIN=api.example.com
export ADMIN_DOMAIN=admin.example.com
export UPLOAD_PUBLIC_URL=https://api.example.com
envsubst '${API_DOMAIN} ${ADMIN_DOMAIN} ${UPLOAD_PUBLIC_URL}' \
  < deploy/nginx/conf.d/default.conf.template \
  > deploy/nginx/conf.d/default.conf
```

若不使用模板，也必须手工核对 `default.conf` 中 `server_name` 与证书路径。
