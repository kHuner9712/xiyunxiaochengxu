# 禧孕优选 GO_LIVE 状态（2026-08-11）

## 1. 当前结论

- 代码仓库候选：以 PR #15 `agent/production-operation-closure-20260807` 的**当前 HEAD**为唯一候选；不得使用历史 SHA 的绿色结果替代当前 HEAD。
- 仓库级 Go 条件：当前 HEAD 的 CI、Release Gate Check、API Unit Diagnostic、API E2E Diagnostic、API Open Handle Diagnostic 必须全部成功，且 PR 不存在未解决 review thread。
- 外部生产配置：**仓库无法证明已完成，当前状态按待验收处理**。真实服务器 `.env.production`、DNS/TLS、MySQL/Redis、微信小程序与微信支付配置必须在部署环境单独验证。
- 正式发布：**No-Go，直到服务器生产门禁、真实微信支付/退款、体验版与真机验收全部留痕通过。**

仓库门禁成功只表示“当前代码候选具备进入生产验收的资格”，不等于“已经正式上线可用”。

## 2. 本轮上线前专项收口

本轮审计不是以“接口存在 / 单测通过 / CI 绿色”作为完成标准，而是按真实操作链、并发、弱网、重试、事务和部署失败模型收口。主要已覆盖：

- 普通订单创建增加跨超时、跨页面重试的持久请求标识和数据库唯一事实兜底。
- 秒杀、开团/参团、活动多商品下单补齐同等级弱网幂等，竞争失败事务回滚后恢复赢家结果。
- 优惠券领取补齐弱网幂等；`perLimit > 1` 时区分真正的第二次领取与同一次请求重试。
- 后台库存调整使用提交时库存作为操作版本，响应丢失后旧操作不能重复增减库存。
- 后台人工积分调整统一为行锁事务，并使用 `user:points` 专用权限；查看用户详情不再等价于修改积分资产。
- 用户启停由“toggle”改为显式目标状态；同一禁用/启用请求重试不会反向翻转，并继续撤销旧会话。
- 微信支付/退款失败回调保持非 2xx，使微信继续重试；生产 smoke 与该回调合同保持一致。
- 孤儿退款回调不能被误确认 SUCCESS；本地无法确认退款记录时 fail-closed。
- 商户结算从营销活动权限拆出独立结算权限，并兼容已有生产库和 fresh install 授权。
- 权益核销生产路径确认使用同一数据库事务写入 entitlement 状态、核销日志与服务分佣。
- 上传用户会话、正式小程序 API 导出、订单 preview 并发覆盖等前端真实运行问题已补齐回归保护。
- Redis 正确性状态使用 `noeviction + AOF everysec + 持久卷`；生产 `/health` 校验真实 Redis 配置。
- Redis 容器启动前验证 Linux 宿主机 `vm.overcommit_memory=1`，不满足时拒绝启动；THP 未关闭会明确告警。
- production config preflight 在连接数据库/Redis或启动 Nest providers 前校验证书、外部 HTTP timeout、危险 bypass，并拒绝明显 `REPLACE_WITH_*` 等模板占位值。

## 3. 仓库级证据范围

当前候选必须由同一精确 HEAD 完成以下证据链：

- Prisma validate、migration deploy、schema drift check。
- API unit + mocked HTTP E2E。
- 真实 MySQL operation lifecycle integration。
- 小程序 unit/component tests、typecheck 与正式构建。
- API build 与真实 API + MySQL/Redis runtime；SIGTERM 可干净退出。
- Admin build 与浏览器级操作流。
- 生产 Docker image 构建。
- Runtime/API/deployment contract audits。
- Release Gate Check。
- API Unit / E2E / Open Handle diagnostics。

任何后续代码提交都会使旧 SHA 的绿色结果失效，必须对新的 HEAD 重新执行。

## 4. 外部生产配置与真实环境门禁

以下内容不能由公开仓库绿色 CI 代替，正式发布前必须在真实服务器、微信公众平台、微信支付商户平台和真机环境验证：

- 微信小程序真实 AppID/Secret 与主体、隐私、客服配置。
- `request/upload/download` 合法域名、体验版上传及正式版域名校验。
- 微信支付真实商户号、商户证书序列号、API v3 Key、商户私钥、平台证书与证书轮换映射。
- 支付和退款回调真实公网可达、真实验签、金额与订单状态流转。
- 生产 DNS、受信任 TLS 链、证书域名/私钥匹配与有效期。
- 生产 MySQL/Redis 连接、Redis `vm.overcommit_memory=1`、磁盘与内存容量。
- 发布前数据库备份、备份恢复到临时 MySQL、候选镜像 migration/status/schema-drift 验证。
- 生产 Docker/Nginx/健康检查与 `smoke-runtime.sh`。
- 微信原生 `open-type="contact"` 客服真机可用。
- 真机完整业务链：登录 → 浏览 → 领券 → 普通/促销下单 → 微信支付 → 回调 → 履约/核销 → 售后 → 退款 → 退款回调。

## 5. 正式部署唯一入口

正式部署只能从合并后的 `main` 当前远端 tip 执行，并显式传入批准的完整 40 位 SHA：

```bash
EXPECTED_DEPLOY_SHA=<approved-40-char-main-sha> \
ENV_FILE=.env.production \
pnpm deploy:prod
```

部署脚本负责：生产配置预检、TLS/微信支付证书校验、候选镜像构建、维护模式、写入静默后的数据库备份、备份恢复迁移演练、live migration、候选 API 健康检查、Nginx 重新开放以及完整 production smoke。任何一步失败均不得把失败候选继续当作 Go。

## 6. Go / No-Go

- **代码仓库：** 当前 HEAD 五条门禁全部成功时为 Go；HEAD 一旦变化即重新计算。
- **外部生产配置：** Pending，必须在真实环境验证，不再以“负责人已确认”替代证据。
- **服务器运行时：** Pending，必须执行正式部署和 production smoke。
- **微信体验版/真机：** Pending，必须完成真实支付、退款、客服和核心业务链验收。
- **正式公开上线：No-Go，直到以上 Pending 项全部变为有留痕的 Go。**
