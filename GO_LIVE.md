# 禧孕母婴用品私域商城小程序上线验收任务单

---

## 1. 上线状态总览

| 项目 | 状态 | 备注 |
|------|------|------|
| 代码层技术就绪 | [x] | test:ci 227 测试通过，release:check 41 PASS / 0 FAIL |
| 预生产部署 | [ ] | 需在部署环境执行 |
| 小程序体验版 | [ ] | 需上传体验版 |
| 真实支付验证 | [ ] | 需真机沙箱验证 |
| 退款验证 | [ ] | 需真实退款流程验证 |
| 微信审核材料 | [ ] | 需准备隐私协议、类目、资质 |
| 正式发布 | [ ] | 审核通过后发布 |

| 字段 | 值 |
|------|------|
| 当前阶段 | 代码层技术就绪 → 待人工真机验收 |
| 版本号 | 1.0.0 |
| commit hash | _待填写（上线前最后一次通过 release:check 的 commit）_ |
| 负责人 | _待填写_ |
| 预计上线日期 | _待填写_ |
| 是否代码冻结 | 否（待本任务单全部 Go 后冻结） |
| 是否允许新增功能 | 否 |
| 当前结论 | P0/P1 已清零，构建测试全部通过，可进入人工真机验收 |

---

## 2. 代码冻结规则

1. GO_LIVE 阶段**禁止新增非必要功能**。
2. 只允许修复 P0/P1/P2 bug。
3. 支付、退款、订单、库存、优惠券、积分相关修改必须重新跑 `test:ci` 和 `release:check`。
4. 每次修改必须记录 commit hash 和验证结果。
5. 上线前最后一次通过 `release:check` 后创建 release tag。

| 修改记录 | commit hash | 修改内容 | test:ci | release:check | 日期 |
|----------|-------------|----------|---------|---------------|------|
| _示例_ | abc1234 | 修复支付调用 bug | PASS | PASS | 2026-05-23 |
| | | | | | |

---

## 3. 技术验收 checklist

- [x] `pnpm install` 通过
- [x] `pnpm --filter @baby-mall/api prisma:validate` 通过
- [x] `pnpm --filter @baby-mall/api prisma:generate` 通过
- [x] `pnpm --filter @baby-mall/api test:ci` 通过（227 tests, 10 unit + 5 e2e）
- [x] `pnpm build:api` 通过
- [x] `pnpm build:admin` 通过
- [x] `pnpm build:mini` 通过
- [x] `pnpm release:check` 通过（41 PASS / 0 FAIL / 2 WARN）
- [x] 无真实密钥、证书、.env 被提交
- [x] Prisma migrations 完整（6 个迁移文件）
- [x] schema.prisma 与 migrations 无漂移
- [ ] CI workflow 通过（需推送到远程仓库后验证）
- [ ] release-check workflow 可手动触发（需推送到远程仓库后验证）

---

## 4. 预生产部署 checklist

- [ ] 服务器准备完成
- [ ] 域名解析完成
- [ ] HTTPS 证书配置完成
- [ ] MySQL 初始化完成
- [ ] Redis 初始化完成
- [ ] .env.production 配置完成
- [ ] 微信证书文件放置完成（apiclient_key.pem、apiclient_cert.pem 等）
- [ ] `docker compose up -d --build` 成功
- [ ] `prisma migrate deploy` 成功
- [ ] API health check 成功（`GET /api/common/health`）
- [ ] Admin Web 可访问
- [ ] uploads 静态资源可访问
- [ ] Nginx API 代理正常
- [ ] 日志目录可写
- [ ] 数据库备份策略确认

---

## 5. 微信公众平台配置 checklist

- [ ] 小程序 AppID 配置
- [ ] AppSecret 配置
- [ ] request 合法域名配置（`https://api.域名`）
- [ ] uploadFile 合法域名配置（`https://api.域名`）
- [ ] downloadFile 合法域名配置（`https://api.域名`）
- [ ] socket 合法域名 — 不需要（本项目无 WebSocket）
- [ ] 业务域名配置 — 不需要（无 H5 页面）
- [ ] 微信支付商户号绑定
- [ ] API v3 key 配置
- [ ] 商户私钥配置
- [ ] 商户证书序列号配置
- [ ] 微信支付平台证书配置
- [ ] 支付回调 URL 配置（`https://api.域名/api/weapp/payment/callback`）
- [ ] 退款回调 URL 配置（`https://api.域名/api/weapp/payment/refund-callback`）
- [ ] 隐私保护指引填写
- [ ] 用户协议/隐私协议页面可访问
- [ ] 小程序类目选择（母婴用品 / 电商）
- [ ] 主体资质上传
- [ ] ICP/小程序备案确认
- [ ] 客服入口配置
- [ ] 审核测试账号准备
- [ ] 审核备注准备

---

## 6. 小程序真机验收 checklist

### A. 登录

- [ ] 首次进入未登录状态正常
- [ ] 微信授权登录正常
- [ ] token 持久化正常（关闭小程序再打开仍登录）
- [ ] token 过期后能重新登录引导
- [ ] 退出登录正常

### B. 首页

- [ ] Banner 展示正常
- [ ] 推荐位展示正常
- [ ] 商品卡片展示正常
- [ ] 搜索入口正常
- [ ] tabBar 正常
- [ ] 下拉刷新正常

### C. 商品

- [ ] 分类列表正常
- [ ] 商品列表正常
- [ ] 搜索正常
- [ ] 商品详情正常
- [ ] SKU 选择正常
- [ ] 加入购物车正常
- [ ] 立即购买正常
- [ ] 商品下架不可购买
- [ ] 库存不足提示正确

### D. 购物车

- [ ] 加购后购物车数量正确
- [ ] 勾选/取消勾选正常
- [ ] 修改数量正常
- [ ] 删除商品正常
- [ ] 购物车结算跳转确认订单正常
- [ ] 失效商品处理正常

### E. 订单与支付

- [ ] 确认订单页服务端试算正确（金额来自 previewOrder）
- [ ] 地址选择正常
- [ ] 优惠券选择正常
- [ ] 积分抵扣正常
- [ ] 运费计算正常
- [ ] 提交订单防重复点击
- [ ] 微信支付可正常拉起（`wxPay(payment)` 而非 `payment.payParams`）
- [ ] 支付取消后订单仍为待支付
- [ ] 支付成功后后端状态为待发货
- [ ] 支付结果页以服务端 `getPaymentStatus` 为准
- [ ] 订单列表状态展示正确
- [ ] 订单详情展示正确
- [ ] 取消未支付订单释放库存/优惠券/积分
- [ ] 确认收货正常

### F. 售后

- [ ] 可售后订单显示申请入口
- [ ] 不可售后订单不显示申请入口
- [ ] 售后申请提交正常
- [ ] 售后图片上传正常
- [ ] 售后列表正常
- [ ] 售后详情正常
- [ ] 退款成功后状态正确

### G. 个人中心

- [ ] 用户信息展示正常
- [ ] 地址管理正常（新增/编辑/删除/设默认）
- [ ] 优惠券中心正常
- [ ] 我的优惠券正常
- [ ] 会员中心正常
- [ ] 积分中心正常
- [ ] 宝宝档案正常
- [ ] 内容/育儿知识正常

---

## 7. 后台运营验收 checklist

### A. 登录与权限

- [ ] 管理员登录正常
- [ ] refresh token 正常
- [ ] 强制改密正常
- [ ] 权限菜单展示正确
- [ ] 无权限接口被拒绝（403）

### B. 商品运营

- [ ] 创建商品
- [ ] 编辑商品
- [ ] 配置 SKU
- [ ] 上传商品图片
- [ ] 上架/下架
- [ ] 库存调整
- [ ] 库存日志可查
- [ ] 分类/品牌/供应商可维护

### C. 首页和营销

- [ ] Banner 配置
- [ ] 推荐位配置
- [ ] 首页装修配置
- [ ] 优惠券创建
- [ ] 优惠券启用/禁用
- [ ] 用户领取优惠券
- [ ] 优惠券使用
- [ ] 活动配置

### D. 订单运营

- [ ] 订单列表查询
- [ ] 订单详情查看
- [ ] 订单备注
- [ ] 发货
- [ ] 批量发货
- [ ] 物流信息展示
- [ ] 异常订单处理

### E. 售后退款

- [ ] 售后列表查看
- [ ] 售后审核
- [ ] 退款发起
- [ ] 退款记录查看
- [ ] 退款详情查看
- [ ] 退款对账
- [ ] 单笔退款同步（syncRefund）
- [ ] 退款异常事件可查

### F. 系统运维

- [ ] 对账与补偿中心可用
- [ ] business_events 可查询
- [ ] critical/error 事件高亮
- [ ] 操作日志可查
- [ ] 系统配置可维护
- [ ] 上传资源可访问
- [ ] 文件上传权限（system:file）生效

---

## 8. 支付与退款专项验收 checklist

### 支付

- [ ] 真实微信支付下单成功
- [ ] 支付成功回调收到
- [ ] 订单状态 `pending_payment` → `pending_delivery`
- [ ] 支付记录 `status=SUCCESS`
- [ ] 优惠券 `LOCKED` → `USED`
- [ ] 支付金额校验正确（回调金额与订单金额一致）
- [ ] 重复支付回调幂等
- [ ] 支付对账可修复异常（半成功状态可修复）

### 退款

- [ ] 后台发起退款成功
- [ ] `order_refunds` 创建 `initiating` 记录
- [ ] 微信受理后进入 `pending`
- [ ] 退款回调收到
- [ ] `processing` → `success`
- [ ] 售后单 `refunded`
- [ ] 库存归还
- [ ] 积分处理正确
- [ ] 重复退款回调幂等
- [ ] orphan callback 可观测（写入 RefundCallbackLog + BusinessEvent critical）
- [ ] refund sync 可补偿（微信已成功但本地未成功可修复）
- [ ] 退款金额不一致不会产生副作用

---

## 9. 数据准备 checklist

- [ ] 商品分类
- [ ] 品牌
- [ ] 供应商
- [ ] 商品 SPU
- [ ] SKU
- [ ] 主图
- [ ] 详情图
- [ ] 库存
- [ ] Banner
- [ ] 首页推荐
- [ ] 优惠券
- [ ] 活动
- [ ] 运费规则
- [ ] 售后规则
- [ ] 用户协议
- [ ] 隐私协议
- [ ] 客服信息

---

## 10. 审核发布 checklist

- [ ] 小程序体验版上传
- [ ] 体验版二维码生成
- [ ] 内部人员真机测试
- [ ] 审核账号准备
- [ ] 审核说明填写
- [ ] 隐私协议确认
- [ ] 服务类目确认
- [ ] 提交微信审核
- [ ] 审核通过
- [ ] 正式发布
- [ ] 发布后 smoke test
- [ ] 发布后支付验证
- [ ] 发布后退款验证
- [ ] 发布后 business_events 无 critical

---

## 11. 回滚方案 checklist

- [ ] 当前 commit hash 记录
- [ ] release tag 创建
- [ ] 数据库备份完成
- [ ] Docker 镜像版本记录
- [ ] 回滚命令确认：`docker compose down && docker compose up -d --build <旧镜像>`
- [ ] 数据库回滚策略确认：`prisma migrate resolve --rolled-back <migration>`
- [ ] 小程序版本回退策略确认：微信公众平台「回退」功能
- [ ] 微信审核失败处理策略：修改后重新提交
- [ ] 支付异常应急方案：对账补偿 + 人工确认
- [ ] 退款异常应急方案：syncRefund + 人工确认

---

## 12. Go / No-Go 判定

| 检查域 | 状态 | 负责人 | 备注 |
|--------|------|--------|------|
| 技术构建 | [ ] Go / [ ] No-Go | | P0/P1 已清零，227 测试通过 |
| 预生产部署 | [ ] Go / [ ] No-Go | | 需部署环境验证 |
| 小程序真机 | [ ] Go / [ ] No-Go | | 需真机测试 |
| 支付退款 | [ ] Go / [ ] No-Go | | 需真实支付/退款验证 |
| 后台运营 | [ ] Go / [ ] No-Go | | 需运营人员验收 |
| 微信审核材料 | [ ] Go / [ ] No-Go | | 需准备隐私协议、资质 |
| 数据准备 | [ ] Go / [ ] No-Go | | 需运营录入商品数据 |
| 回滚方案 | [ ] Go / [ ] No-Go | | 需确认回滚流程 |

### 最终结论

- [ ] **Go**：可以发布
- [ ] **No-Go**：禁止发布

> 所有检查域均为 Go 时，方可勾选"Go：可以发布"。

---

## 13. 验收记录

| 日期 | 验收人 | 验收项 | 结果 | 问题 | 关联 commit/issue |
|------|--------|--------|------|------|-------------------|
| 2026-05-23 | 技术审计 | 代码层技术就绪 | PASS | P0: wxPay(payParams) 已修复；P0: pointsDeduct 类型已修复 | 详见审计报告 |
| | | | | | |
| | | | | | |

---

## 附录：本轮审计已修复问题

| 级别 | 文件 | 问题 | 修复 |
|------|------|------|------|
| P0 | miniprogram/order/list.vue | `wxPay(payment.payParams)` 支付必失败 | 改为 `wxPay(payment)` |
| P0 | miniprogram/order/detail.vue | `wxPay(payment.payParams)` 支付必失败 | 改为 `wxPay(payment)` |
| P0 | miniprogram/order/confirm.vue | pointsDeduct 发送金额而非积分数量 | 改为发送积分数量 |
| P1 | shared/permissions.ts + seed.ts | system:file 权限码缺失 | 添加权限码和 seed 记录 |
| P1 | miniprogram/order/pay-result.vue | 空 catch 吞异常 | 添加 toast 提示 |
| P1 | api/config/env.validation.ts | SMOKE_TEST_BYPASS_CAPTCHA 生产未禁用 | 生产环境检测到则 exit(1) |
| P1 | api/upload/upload.service.ts | 允许 .svg 上传（XSS 风险） | 从白名单移除 |
| P2 | api/transform.interceptor.ts | BigInt 全局序列化缺失 | 添加递归 serializeBigInt |
