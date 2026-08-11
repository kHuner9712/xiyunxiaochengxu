# 部署前收口清单（Go / No-Go）

适用阶段：仓库代码审计完成后、进入服务器生产门禁前。任何一项未满足均为 No-Go。

## 1. 发布身份

- [ ] 从 `main` 部署。
- [ ] 本地 HEAD、最新 `origin/main`、批准发布的完整 40 位 SHA 三者完全一致。
- [ ] 目标 SHA 的 CI、Release Gate、API Diagnostics、Production Bootstrap Diagnostic 全部成功。
- [ ] 发布时显式传入 `EXPECTED_DEPLOY_SHA=<40位SHA>`。

## 2. 主机与 Docker

- [ ] Linux 主机具备 Docker 与 Docker Compose v2（`docker compose`）。
- [ ] Node.js 满足 `>=22.13.0 <25`；仓库 CI 基线为 22.13.0。
- [ ] `vm.overcommit_memory=1`；Redis entrypoint 会 fail-closed 检查。
- [ ] 80/443 可对公网提供服务。
- [ ] MySQL、Redis、API 宿主机端口仅绑定回环地址，不直接暴露公网。
- [ ] 磁盘空间、内存、日志与备份目录容量满足上线需求。

## 3. 正式域名与 DNS

生产域名固定：

- API：`api.yunxixiaochengxu.com.cn`
- Admin：`admin.yunxixiaochengxu.com.cn`

- [ ] 两个域名均解析到本次部署目标。
- [ ] 不依赖 Runbook 中历史 IP；以部署当天 DNS 实际结果为准。
- [ ] `HTTP_HOST_PORT=80`、`HTTPS_HOST_PORT=443`。

## 4. HTTPS 与微信支付证书

微信支付宿主机文件：

- `deploy/certs/apiclient_key.pem`
- `deploy/certs/wechatpay_platform.pem`

Nginx API 证书：

- `deploy/nginx/ssl/api/fullchain.pem`
- `deploy/nginx/ssl/api/privkey.pem`

Nginx Admin 证书：

- `deploy/nginx/ssl/admin/fullchain.pem`
- `deploy/nginx/ssl/admin/privkey.pem`

- [ ] 商户私钥可解析。
- [ ] 平台证书可解析且序列号与环境变量匹配。
- [ ] API/Admin TLS 证书链公网可信且未临近过期。

## 5. `.env.production`

- [ ] 从 `.env.production.example` 创建，文件权限建议 `600`，不提交 Git。
- [ ] `DATABASE_URL` 与 `DB_HOST/DB_PORT/DB_NAME/DB_USER/DB_PASSWORD` 完全一致。
- [ ] DB/Redis/JWT/Refresh/Admin 密码通过生产强度门禁。
- [ ] `WECHAT_APP_ID / WECHAT_APP_SECRET / WECHAT_MCH_ID / WECHAT_MCH_SERIAL_NO / WECHAT_API_V3_KEY` 为真实值。
- [ ] `WECHAT_SKIP_VERIFY=false`。
- [ ] `SMOKE_TEST_BYPASS_CAPTCHA=false`。
- [ ] 支付回调：`https://api.yunxixiaochengxu.com.cn/api/weapp/pay/callback`。
- [ ] 退款回调：`https://api.yunxixiaochengxu.com.cn/api/weapp/pay/refund-callback`。
- [ ] `CORS_ORIGINS=https://admin.yunxixiaochengxu.com.cn`。
- [ ] `UPLOAD_PUBLIC_URL=https://api.yunxixiaochengxu.com.cn`。

订单自动关闭/完成、售后期限、默认运费/包邮门槛、积分抵扣等可变业务参数不属于生产 env；它们由数据库 `system_configs` 与后台系统配置控制。

## 6. 上传与私有文件

- [ ] API 与 Nginx 使用同一持久化 `upload_data` 卷。
- [ ] Nginx 对该卷只读。
- [ ] `/uploads/public/...` 可公开访问。
- [ ] `/uploads/private/...` 返回 403。
- [ ] 其他 `/uploads/...` 返回 403。
- [ ] 售后图片、营业执照、食品/经营资质等私有文件通过后端鉴权接口访问。
- [ ] API 默认上传上限 50MB；Nginx 请求体上限 60MB，给 multipart 预留空间。

## 7. 唯一部署入口

禁止直接生产执行 `docker compose up -d --build` 或手工 `prisma migrate deploy`。

正式入口：

```bash
EXPECTED_DEPLOY_SHA=<批准的40位main SHA> \
ENV_FILE=.env.production \
bash deploy/scripts/deploy-production.sh
```

- [ ] production preflight 成功。
- [ ] 候选镜像构建成功。
- [ ] 维护窗口成功停止公网/API writers。
- [ ] 数据库备份成功。
- [ ] 临时 MySQL clone migration/status/schema drift 成功。
- [ ] live migration 成功。
- [ ] 候选 API health 与 build SHA 成功。
- [ ] Nginx `nginx -t` 成功。
- [ ] full runtime smoke 成功。

Fresh database 无需手工 `RUN_SEED=true`：entrypoint 会在 `admin_users=0` 时自动生产 seed；已有管理员的数据库不会被自动重复 seed。

## 8. 备份与恢复

一致性备份：

```bash
ENV_FILE=.env.production bash deploy/scripts/backup.sh
```

- [ ] 每个备份包含同一时间戳的 DB、uploads、checksum 三件套。
- [ ] DB 与 uploads 均在 API/background writers 停止的同一维护窗口取得。
- [ ] 备份文件异地保存并定期做恢复演练。

恢复：

```bash
ENV_FILE=.env.production bash deploy/scripts/restore.sh YYYYMMDD_HHMMSS
```

- [ ] restore 校验 checksum。
- [ ] 同批次恢复 DB 与 uploads。
- [ ] 恢复后 migration、API health、Nginx、full smoke 全部成功。
- [ ] 破坏性恢复失败时公网保持关闭。

## 9. 微信平台

- [ ] request 合法域名：`https://api.yunxixiaochengxu.com.cn`。
- [ ] uploadFile 合法域名：同上。
- [ ] downloadFile 合法域名：同上。
- [ ] 支付与退款回调公网可达且证书可信。
- [ ] 小程序生产构建使用真实 AppID 和 `https://api.yunxixiaochengxu.com.cn/api`。

## 10. 真机验收

服务器门禁全部通过后才进入：

- [ ] 微信登录。
- [ ] 商品浏览/搜索/购物车。
- [ ] 优惠券领取与使用。
- [ ] 普通订单。
- [ ] 团购/秒杀/活动订单。
- [ ] 微信支付、支付取消、支付回调。
- [ ] 发货/自提/核销。
- [ ] 售后申请。
- [ ] 退款发起、退款回调、退款状态恢复。
- [ ] 积分/会员权益。
- [ ] 客服。
- [ ] Admin 各角色菜单与 API 权限。
- [ ] 私有文件越权访问失败。

真机完整链未通过前，仍然是 No-Go。
