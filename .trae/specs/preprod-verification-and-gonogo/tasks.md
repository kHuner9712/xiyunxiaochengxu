# Tasks

- [x] Task 1: 最终状态核对
  - [x] 1.1: main HEAD = 65ed51d8dbaeed45a231917e61c078400df8831e
  - [x] 1.2: v1.0.0-rc.2 tag 指向 65ed51d8dbaeed45a231917e61c078400df8831e ✅ 对齐
  - [x] 1.3: GO_LIVE.md 当前阶段确认
  - [x] 1.4: 小程序 API base URL = https://api.yunxixiaochengxu.com.cn/api
  - [x] 1.5: payment.controller.ts 回调路由 POST /callback + POST /refund-callback

- [x] Task 2: 确认 GitHub Actions 状态
  - [x] 2.1: ci.yml 配置正确（push main 触发）
  - [x] 2.2: release-check.yml 配置正确（workflow_dispatch 手动触发）
  - [x] 2.3: workflow 未在本地验证（需推送后 GitHub 自动触发）
  - [x] 2.4: GO_LIVE.md CI checklist 保持未勾选

- [x] Task 3: 输出服务器部署命令清单
  - [x] 3.1: 环境变量配置清单（见最终报告）
  - [x] 3.2: Docker Compose 部署步骤（deploy-preprod.sh）
  - [x] 3.3: 数据库迁移步骤（entrypoint.sh 自动执行）
  - [x] 3.4: smoke test 执行步骤
  - [x] 3.5: HTTPS/域名验证步骤

- [x] Task 4: 输出小程序体验版上传步骤
  - [x] 4.1: 构建产物路径 dist/build/mp-weixin
  - [x] 4.2: AppID 需替换真实值（当前为 wx0000000000000000）
  - [x] 4.3: 微信开发者工具操作步骤
  - [x] 4.4: 微信公众平台域名配置清单

- [x] Task 5: 确认微信审核材料完整性
  - [x] 5.1: docs/14_WECHAT_REVIEW_PACKAGE.md 6个章节完整
  - [x] 5.2: 无真实密钥/密码
  - [x] 5.3: 缺口：主体信息待填写、隐私协议/用户协议页面待配置
  - [x] 5.4: 缺口清单已输出

- [x] Task 6: 执行本地质量门禁
  - [x] 6.1: pnpm install PASS
  - [x] 6.2: prisma:validate + prisma:generate PASS
  - [x] 6.3: test:ci 337 tests PASS
  - [x] 6.4: build:api + build:admin + build:mini PASS
  - [x] 6.5: release:check 45 PASS / 0 FAIL / 2 WARN

- [x] Task 7: 更新 GO_LIVE.md 和 RELEASE_CANDIDATE.md
  - [x] 7.1: commit hash 更新为 65ed51d8dbaeed45a231917e61c078400df8831e
  - [x] 7.2: 当前阶段：代码冻结完成 → 待预生产实机部署
  - [x] 7.3: 验收记录表新增 Go/No-Go 评审记录
  - [x] 7.4: Go/No-Go 判定表：技术构建 Go，其余 No-Go
  - [x] 7.5: RELEASE_CANDIDATE.md commit hash 更新

- [ ] Task 8: 提交并推送
  - [ ] 8.1: git add / commit / push
  - [ ] 8.2: 更新 v1.0.0-rc.2 tag 指向最新 commit

# Task Dependencies
- Task 1 独立
- Task 2 依赖 Task 1
- Task 3, 4, 5 可并行
- Task 6 依赖 Task 1
- Task 7 依赖 Task 6 结果
- Task 8 依赖 Task 7
