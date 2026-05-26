# Tasks

- [ ] Task 1: 最终状态核对
  - [ ] 1.1: git rev-parse HEAD
  - [ ] 1.2: git rev-parse v1.0.0-rc.2
  - [ ] 1.3: 读取 GO_LIVE.md / RELEASE_CANDIDATE.md 确认 commit hash 和 release-check 结果一致性
  - [ ] 1.4: 读取小程序配置和支付回调路由确认

- [ ] Task 2: 重新执行本地质量门禁
  - [ ] 2.1: pnpm install
  - [ ] 2.2: prisma:validate + prisma:generate
  - [ ] 2.3: test:ci
  - [ ] 2.4: build:api + build:admin + build:mini
  - [ ] 2.5: release:check

- [ ] Task 3: 修正文档一致性
  - [ ] 3.1: 同步 GO_LIVE.md / RELEASE_CANDIDATE.md commit hash 为真实 HEAD
  - [ ] 3.2: 同步 release-check 结果为最新真实值
  - [ ] 3.3: 确认 GO_LIVE.md 当前阶段反映真实状态

- [ ] Task 4: 确认微信审核材料并补齐缺口
  - [ ] 4.1: 读取 docs/14_WECHAT_REVIEW_PACKAGE.md
  - [ ] 4.2: 确认6个章节完整性
  - [ ] 4.3: 占位符标注"待填写"
  - [ ] 4.4: 输出缺口清单

- [ ] Task 5: 更新 GO_LIVE.md Go/No-Go 判定表和验收记录
  - [ ] 5.1: 更新 Go/No-Go 判定表（基于真实状态）
  - [ ] 5.2: 更新验收记录表
  - [ ] 5.3: 确认未实际完成的验收项未勾选

- [ ] Task 6: 更新 RELEASE_CANDIDATE.md
  - [ ] 6.1: 更新 commit hash 和构建结果
  - [ ] 6.2: 更新已知 WARN
  - [ ] 6.3: 更新需人工验收事项状态

- [ ] Task 7: 提交并推送
  - [ ] 7.1: git add / commit / push
  - [ ] 7.2: 如有新提交，创建 v1.0.0-rc.3 tag；否则保持 v1.0.0-rc.2

# Task Dependencies
- Task 1 独立
- Task 2 依赖 Task 1
- Task 3 依赖 Task 2 结果
- Task 4 独立
- Task 5, 6 依赖 Task 3
- Task 7 依赖 Task 5, 6
