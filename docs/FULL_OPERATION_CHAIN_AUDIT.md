# 全功能实际操作链路审计

> 状态：**仓库级收口完成后进入真实生产验收；未完成服务器/微信真机证据前仍冻结正式公开上线。**
>
> 审计候选：以 PR #15 `agent/production-operation-closure-20260807` 的当前 HEAD 为准。任何后续提交都会使旧 SHA 的绿色结果失效。

本轮不把接口存在、静态编译、Mock 测试或单次绿色 CI 直接解释为功能正常。每条关键业务链按以下维度核对：

1. 页面入口、认证与权限；
2. 请求参数、DTO 与 BIGINT 精度；
3. 服务端状态机和事务边界；
4. 数据库、库存、积分、优惠券和权益副作用；
5. 支付、退款及其他外部系统结果；
6. 返回结构与前端回显；
7. 页面刷新后的持久化回查；
8. 取消、超时、弱网、并发、重复点击、重试和补偿路径；
9. Nest runtime provider 是否真正接入修复后的实现；
10. 生产构建、Docker、Redis/MySQL、TLS、迁移、回滚和 smoke 门禁。

## 已关闭的主要仓库级问题

### 订单、促销与弱网幂等

- 普通订单创建使用持久 `clientRequestId`，相同购买意图在网络超时/响应丢失后复用同一请求标识；数据库唯一订单号作为并发最终仲裁。
- 秒杀、开团/参团和活动多商品结算补齐同等级幂等；并发重复事务失败后回滚库存/名额等副作用并恢复赢家结果。
- 订单确认 preview 使用 latest-wins，旧请求不能覆盖新选择后的金额。
- 促销价格、履约信息、库存、限购、支付后状态、零元订单权益和售后路径按服务端权威数据收口。

### 优惠券、积分、库存与用户状态

- 优惠券领取补齐弱网重复请求保护；`perLimit > 1` 时同一次请求重试不会被误当作第二次合法领取。
- 优惠券中心前端仍保留快速双击锁，但不再把前端锁作为资产幂等的唯一保护。
- 后台库存调整提交 `expectedStock`，第一次已成功但响应丢失时，旧对话框重试会因库存版本变化被拒绝。
- 后台人工积分调整统一到行锁事务，使用 `expectedAvailablePoints` 防弱网重复加扣，并收紧为 `user:points` 专用权限。
- 用户启停改为显式目标状态，不再使用重试会反向翻转的 toggle 语义；状态变更继续撤销旧会话。

### 支付、退款与补偿

- 支付/退款回调只有真实处理成功才使用 2xx；验签、解密或业务处理失败返回非 2xx，使微信继续重试。
- production smoke 与回调 HTTP 语义保持一致，不再把失败回调 HTTP 200 当作安全行为。
- 孤儿退款回调无法确认本地退款记录时 fail-closed；不会因为基础实现返回 SUCCESS 就停止微信重试。
- 退款在调用微信前先持久化 initiating 记录；微信已受理但本地状态更新失败时保留可同步恢复的事实。
- 支付、邀请奖励、权益发放、商户分佣、秒杀/拼团后置状态均存在生产 wrapper、幂等事实或补偿/对账路径。

### 权益核销与商户结算

- 生产权益核销路径在同一 MySQL 事务内完成 entitlement `unused → used`、核销日志及快照服务分佣。
- 历史 `used` 但缺核销日志的数据有审计补偿路径。
- 商户结算的状态竞争由 state-safe wrapper 收敛。
- 商户结算从 `marketing:activity` 拆出独立 `order:merchant-settlement` 权限；迁移兼容已有生产库，fresh install 由 post-seed 再补授权。

### Runtime wiring 与 API/前端合同

- 修复 `ProductionUserService` 已实现但 Nest runtime 仍注入基础 `UserService` 的问题，并增加 provider wiring 回归门禁。
- 关键订单、支付、促销、优惠券、商品等最外层生产 wrapper 均增加 runtime/provider 合同测试。
- 小程序上传使用独立 `uni.uploadFile` 时补齐登录失效清理和跳转。
- 正式小程序构建暴露的优惠券 API 导出兼容问题已修复，并增加静态导出合同测试。
- BIGINT ID 按字符串安全传递；公开视图不暴露内部用户/订单标识。

### Redis 与生产基础设施

- Redis 使用持久卷、AOF `appendonly yes`、`appendfsync everysec`。
- `maxmemory-policy` 改为 `noeviction`，避免内存压力静默淘汰会话、分布式锁和幂等正确性键。
- 生产 `/health` 真实读取 Redis `maxmemory-policy/appendonly/appendfsync`，配置错误时返回 degraded/503。
- Redis 容器入口读取 Linux 宿主机 `/proc/sys/vm/overcommit_memory`；不是 `1` 时拒绝启动，避免后台保存/AOF rewrite 在低内存条件下因 `fork()` 失败。
- Transparent Huge Pages 未关闭时 Redis 入口明确告警，提示宿主机调优。
- Redis/Nest 关闭生命周期已补齐，Open Handle Diagnostic 不依赖强制退出，真实 API SIGTERM 可干净关闭。

### Production config 与部署门禁

- production config preflight 在 Nest providers、MySQL/Redis连接和 live migration 之前执行。
- 校验真实商户私钥、平台证书、证书序列号、证书轮换映射、HTTPS webhook 和外部 HTTP timeout。
- 生产禁止验证码 bypass 和微信回调跳过验签。
- 明显 `REPLACE_WITH_* / CHANGE_ME / CHANGE_THIS` 等模板占位值在 production preflight 阶段直接拒绝。
- 生产部署必须从当前远端 `main` tip 执行，并显式提供批准的完整 40 位 `EXPECTED_DEPLOY_SHA`。
- live migration 前先构建候选镜像、完成生产配置预检、进入维护模式、停止公网入口和 API/background writers、备份生产数据库，并把该备份恢复到临时 MySQL 用候选镜像执行 migration/status/schema-drift 验证。
- 候选 API 在 Nginx 重新开放前必须健康；公开后继续执行可信 HTTPS production smoke。
- 失败发生在公开流量恢复前时支持数据库与旧 runtime 自动恢复；公开流量已恢复后不做可能丢失新写入的盲目数据库回滚。

## 同一候选 HEAD 必须通过的仓库证据

PR #15 的最终仓库候选必须由同一个精确 HEAD 同时满足：

- CI；
- Release Gate Check；
- API Unit Diagnostic；
- API E2E Diagnostic；
- API Open Handle Diagnostic。

其中主 CI 覆盖：

- Prisma validate、migration deploy、schema drift；
- runtime / frontend-backend API / deployment contracts；
- Admin operation contract tests；
- API unit + mocked HTTP E2E；
- 真实 MySQL integration；
- 小程序 unit/component tests；
- API build；
- 真实 API + MySQL/Redis runtime 与 clean SIGTERM；
- Admin build 与浏览器操作流；
- 小程序正式构建；
- production Docker image。

Release Gate 额外执行 production config preflight contract、Admin browser flow、小程序测试和真实测试库生命周期集成等门禁。

## 仍需真实生产环境完成的证据

以下项目无法由公开仓库或 GitHub Actions替代，未完成前不得把本文件解读为“可以直接公开上线”：

- 真实微信小程序 AppID/Secret、主体、隐私、客服和合法域名配置；
- 真实微信支付商户号、商户证书序列号、API v3 Key、商户私钥、平台证书及轮换证书；
- 支付/退款真实公网回调、真实验签、金额与状态流转；
- 生产 DNS、受信任 TLS 链、服务器 `.env.production`、磁盘/内存容量；
- 生产 MySQL/Redis 连接，Redis 宿主机 `vm.overcommit_memory=1`；
- 真实生产数据库备份/恢复权限与迁移演练；
- 正式 Docker/Nginx/HTTPS production smoke；
- 微信开发者工具体验版上传；
- 真机登录、首页、商品、购物车、领券、普通/促销下单、支付、退款、售后、自提/权益核销、客服完整链路。

## 当前处理原则

- 修复不是“代码存在”即完成，必须证明 production provider 真正接入。
- 资产和资金操作按至少一次网络语义设计：响应丢失和重复请求不能造成重复副作用。
- 能使用数据库唯一事实/事务的场景不依赖前端 loading 作为幂等保证。
- 外部系统失败必须 fail-closed 或进入持久补偿/对账状态，不能用日志 warning 代替业务闭环。
- 每次修改最终候选 HEAD 后重新执行全部五条门禁。
- 仓库级 Go 与正式生产 Go 分开记录；服务器/微信证据未知时一律按 Pending，而不是“默认已完成”。

## 结论

旧版文档中列出的秒杀、拼团、促销定价等已确认阻断项已经在本轮 PR 中关闭，不再继续作为当前阻断项列示。

当 PR #15 **当前 HEAD** 的五条仓库门禁全部成功且无未解决 review thread 时，可以判定“仓库级候选具备进入真实生产验收的资格”。正式公开上线仍必须等待服务器 production gate、真实微信支付/退款、体验版与真机完整链路全部留痕通过。
