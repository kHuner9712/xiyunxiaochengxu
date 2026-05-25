# Tasks

- [x] Task 1: 修正 GO_LIVE.md 与验收文档漂移
  - [x] 1.1: 修正个人中心验收项（删除"育儿知识"，改为活动内容流+客服入口）
  - [x] 1.2: 拆分支付专项验收为快递/自提两种状态流转
  - [x] 1.3: 新增小程序真机验收项（活动feed/视频/文章/分享归因/邀请/客服/自提）
  - [x] 1.4: 新增后台验收项（自提点/核销/客服/内容/裂变/分享/邀请）
  - [x] 1.5: 新增支付退款专项验收项（自提状态/pickupCode/核销幂等/裂变奖励）
  - [x] 1.6: 新增数据准备 checklist（自提点/客服配置/裂变活动/视频/文章/测试账号）
  - [x] 1.7: 同步更新 docs/12_ACCEPTANCE_CHECKLIST.md
  - [x] 1.8: 同步更新 docs/10_ORDER_PAYMENT_AFTERSALE.md

- [x] Task 2: 补齐 .env.example 缺失变量
  - [x] 2.1: 添加 UPLOAD_PUBLIC_URL
  - [x] 2.2: 添加 REFRESH_TOKEN_SECRET / REFRESH_TOKEN_EXPIRES_IN
  - [x] 2.3: 添加 API_PREFIX 说明
  - [x] 2.4: 添加 ALERT_WEBHOOK_URL（已有但确认注释清晰）
  - [x] 2.5: 确认客服配置通过 SystemConfig 管理，无需额外环境变量

- [x] Task 3: 完善 env.validation.ts 生产安全
  - [x] 3.1: 添加 WECHAT_SKIP_VERIFY 在 production 下禁止为 true 的校验
  - [x] 3.2: 添加 WECHAT_NOTIFY_URL 到 production requiredVars
  - [x] 3.3: 添加 WECHAT_MCH_ID / WECHAT_API_V3_KEY 到 production requiredVars

- [x] Task 4: 新增 smoke-preprod.sh
  - [x] 4.1: 基础端点（health/home/product/list）
  - [x] 4.2: V1.0 新端点（activity-feed/content/pickup-store/customer-service）
  - [x] 4.3: 权限边界（share/visit public, user/info 401）
  - [x] 4.4: 后台可达性（admin login，不写真实密码）
  - [x] 4.5: 输出 PASS/FAIL 汇总，FAIL 时 exit 1

- [x] Task 5: 新增 docs/13_MANUAL_ACCEPTANCE_GUIDE.md
  - [x] 5.1: 验收前准备（API域名/体验版/测试用户/测试数据）
  - [x] 5.2: 小程序验收路径（18个场景）
  - [x] 5.3: 后台验收路径（11个场景）
  - [x] 5.4: 支付退款专项验收
  - [x] 5.5: 通过标准与阻止上线条件

- [x] Task 6: 新增 RELEASE_CANDIDATE.md
  - [x] 6.1: RC 版本号 / commit hash / 功能范围
  - [x] 6.2: 测试结果 / 构建结果 / 已知 WARN
  - [x] 6.3: 不包含事项 / 需人工验收事项
  - [x] 6.4: 回滚方案 / 下一步部署步骤

- [x] Task 7: 检查 seed.ts 幂等性和权限完整性
  - [x] 7.1: 确认默认 admin 创建幂等
  - [x] 7.2: 确认所有新增权限码存在（pickup/share/customer-service/content）
  - [x] 7.3: 确认 seed 可重复执行不重复插入
  - [x] 7.4: 确认默认客服配置初始化

- [x] Task 8: 安全扫描
  - [x] 8.1: 搜索 APP_SECRET/API_V3_KEY/PRIVATE_KEY 等敏感词确认无真实值
  - [x] 8.2: 确认 .env.example 无真实密钥
  - [x] 8.3: 确认裂变文案无违规表达
  - [x] 8.4: 确认 WECHAT_SKIP_VERIFY 在 production 不生效

- [x] Task 9: 运行完整质量门禁
  - [x] 9.1: pnpm install
  - [x] 9.2: prisma:validate + prisma:generate
  - [x] 9.3: test:ci
  - [x] 9.4: build:api + build:admin + build:mini
  - [x] 9.5: release:check

- [ ] Task 10: 提交并推送到 GitHub

# Task Dependencies
- Task 2,3 可并行
- Task 4 依赖 Task 2（env变量确认）
- Task 5,6 可并行
- Task 7,8 可并行
- Task 9 依赖所有修复完成
- Task 10 依赖 Task 9 通过
