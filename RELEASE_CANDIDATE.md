# Release Candidate 文档

## 版本信息

| 项目 | 值 |
|------|------|
| RC 版本号 | v1.0.0-rc.2 |
| commit hash | 798eaeca19964003a83873cbcb1546ad0dd2224d |
| 构建时间 | 2026-05-27 |
| 构建人 | _待填写_ |

## 功能范围

### V1.0 核心功能
- 微信小程序登录
- 商品浏览与搜索
- 购物车管理
- 快递下单与微信支付
- 到店自提下单与自提码
- 订单管理与状态流转
- 售后申请与退款
- 优惠券系统
- 积分系统
- 会员等级体系
- 收货地址管理
- 宝宝档案

### V1.0 新增功能
- 活动内容流（推荐/优惠/视频/文章）
- 视频内嵌播放
- 文章内容详情
- 内容投放位置管理
- 到店自提点选择
- 自提码生成与展示
- 后台自提核销
- 客服与帮助（5个入口+配置页）
- 裂变分享（邀请有礼/分享有礼）
- 分享海报生成
- 邀请关系绑定
- 首单奖励幂等

### 接口契约修复
- 所有 ID 返回 string 类型（BigInt → string）
- 所有金额单位为分
- 统一序列化函数（serializeProductCard/Address/CartItem/Content/Order）

## 测试结果

| 项目 | 结果 | 备注 |
|------|------|------|
| pnpm install | PASS | Already up to date |
| prisma:validate | PASS | Schema valid |
| prisma:generate | PASS | Prisma Client v5.22.0 |
| test:ci | PASS | 337 tests (317 unit + 20 e2e) |
| build:api | PASS | NestJS build |
| build:admin | PASS | Vite build, 1889 modules |
| build:mini | PASS | uni-app build mp-weixin |
| release:check | PASS | 44 PASS / 0 FAIL / 2 WARN |

## 构建结果

| 构建目标 | 状态 | 产物大小 | 备注 |
|----------|------|----------|------|
| API | PASS | dist/ | NestJS 构建 |
| Admin Web | PASS | dist/ | Vite 构建 |
| Mini Program | PASS | dist/build/mp-weixin/ | uni-app 构建 |

## 已知 WARN

| WARN | 说明 | 影响 | 处理建议 |
|------|------|------|----------|
| Docker 未运行 | 本地 Docker 未启动，Docker 相关检查需手动确认 | 低 | 部署预生产时确认 |
| 工作目录有未提交更改 | RC2 阶段修改，提交后消除 | 低 | 提交后消除 |

## 不包含事项

以下功能不在 V1.0 范围内：
- 多商户平台
- 直播带货
- 社区/论坛
- 拼团
- 秒杀
- 预售
- 周期购
- 物流实时追踪（对接第三方API）
- 消息推送（微信订阅消息）
- 数据导出（Excel）
- 多语言
- 暗黑模式

## 需要人工验收事项

### 预生产部署验收
- [ ] Docker Compose 部署成功
- [ ] API health check 通过
- [ ] Admin Web 可访问
- [ ] uploads 静态资源可访问
- [ ] HTTPS 证书配置正确

### 小程序真机验收
- [ ] 体验版上传成功
- [ ] 登录流程正常
- [ ] 快递下单支付正常
- [ ] 自提下单支付正常
- [ ] 活动内容流正常
- [ ] 分享归因正常
- [ ] 客服入口正常

### 支付退款验收
- [ ] 真实微信支付成功
- [ ] 真实退款成功
- [ ] 重复回调幂等
- [ ] 金额不一致保护

### 微信审核
- [ ] 隐私协议已填写
- [ ] 用户协议已填写
- [ ] 小程序类目已选择
- [ ] 经营资质已上传
- [ ] 审核测试账号已提供
- [ ] 提交微信审核

## 回滚方案

### 代码回滚
1. 记录当前 commit hash
2. 创建 release tag：`git tag v1.0.0-rc.2`
3. 回滚命令：`git revert <commit-hash>` 或 `git reset --hard <commit-hash>`

### 数据库回滚
1. 部署前备份数据库：`deploy/scripts/backup.sh`
2. 回滚迁移：`npx prisma migrate resolve --rolled-back <migration-name>`
3. 恢复数据库：`deploy/scripts/restore.sh`

### Docker 回滚
1. 记录当前 Docker 镜像版本
2. 回滚命令：`docker compose down && docker compose up -d --build <旧镜像>`

### 小程序回滚
1. 微信公众平台「版本管理」→「回退」功能
2. 审核失败后修改重新提交

### 支付异常应急
1. 对账补偿：POST /api/admin/payment/reconcile
2. 退款同步：POST /api/admin/refund/sync/:outRefundNo
3. 人工确认：查看 business_events critical 事件

## 下一步部署步骤

1. **代码冻结**：确认所有修改已完成，创建 release tag
2. **预生产部署**：
   ```bash
   # 配置环境变量
   cp .env.example .env.production
   # 编辑 .env.production 填入真实值

   # 部署
   ENV_FILE=../.env.production bash deploy/scripts/deploy-preprod.sh

   # 验证
   BASE_URL=https://api.yunxixiaochengxu.com.cn bash deploy/scripts/smoke-preprod.sh
   ```
3. **小程序体验版**：上传代码到微信平台，生成体验版二维码
4. **真机验收**：按照 docs/13_MANUAL_ACCEPTANCE_GUIDE.md 执行
5. **微信审核**：准备审核材料，提交审核
6. **正式发布**：审核通过后发布
