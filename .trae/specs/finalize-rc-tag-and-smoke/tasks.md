# Tasks

- [x] Task 1: 最终审计 — 获取 main HEAD / v1.0.0-rc.1 指向 / 差异判断
  - [x] 1.1: git rev-parse HEAD → adf5d9e3a8a80bb2df007e299e90ba16797e8193
  - [x] 1.2: git rev-parse v1.0.0-rc.1 → 1ff2fefa5da93f015174040d4dcb4118c80c6c52
  - [x] 1.3: main 领先 tag 1 个 commit
  - [x] 1.4: GO_LIVE.md / RELEASE_CANDIDATE.md 状态确认

- [x] Task 2: 修复 smoke-preprod.sh
  - [x] 2.1: 初始化 MANUAL_COUNT=0
  - [x] 2.2: 新增 manual() 函数（黄色输出）
  - [x] 2.3: 支付/退款回调改为环境变量检查（WECHAT_NOTIFY_URL / WECHAT_REFUND_NOTIFY_URL 存在性 + https 校验）
  - [x] 2.4: 最终输出 PASS / FAIL / MANUAL 三行汇总
  - [x] 2.5: 仅 FAIL_COUNT > 0 时 exit 1

- [x] Task 3: 修复或新增 deploy-preprod.sh
  - [x] 3.1: 支持 ENV_FILE 参数（默认 ../.env.production）
  - [x] 3.2: ENV_FILE 不存在时 exit 1
  - [x] 3.3: 执行 docker compose --env-file config 验证
  - [x] 3.4: 迁移失败 exit 1（entrypoint.sh 处理）
  - [x] 3.5: 输出预生产域名和后续 smoke 提示

- [x] Task 4: 重新执行质量门禁
  - [x] 4.1: pnpm install PASS
  - [x] 4.2: prisma:validate + prisma:generate PASS
  - [x] 4.3: test:ci 337 tests PASS
  - [x] 4.4: build:api + build:admin + build:mini PASS
  - [x] 4.5: release:check 45 PASS / 0 FAIL / 2 WARN

- [x] Task 5: 更新 RELEASE_CANDIDATE.md
  - [x] 5.1: RC 版本号改为 v1.0.0-rc.2
  - [x] 5.2: commit hash 使用完整 hash
  - [x] 5.3: 构建时间使用真实时间 2026-05-27
  - [x] 5.4: 已知 WARN 更新为真实结果

- [x] Task 6: 更新 GO_LIVE.md
  - [x] 6.1: commit hash 使用完整 hash
  - [x] 6.2: 修改记录表新增本次记录
  - [x] 6.3: 验收记录表新增技术/smoke 记录
  - [x] 6.4: 当前阶段：代码冻结准备完成 → 待预生产实机部署

- [x] Task 7: 新增 docs/14_WECHAT_REVIEW_PACKAGE.md
  - [x] 7.1: 小程序基础信息
  - [x] 7.2: 审核账号说明
  - [x] 7.3: 核心功能说明
  - [x] 7.4: 支付说明
  - [x] 7.5: 隐私与合规说明
  - [x] 7.6: 审核备注模板

- [x] Task 8: 创建 v1.0.0-rc.2 tag 并推送
  - [x] 8.1: 提交所有修改
  - [x] 8.2: git tag v1.0.0-rc.2
  - [x] 8.3: git push origin main --tags

# Task Dependencies
- Task 2, 3 可并行
- Task 4 依赖 Task 2, 3 完成
- Task 5, 6 依赖 Task 4 结果
- Task 7 可与 Task 5, 6 并行
- Task 8 依赖 Task 5, 6, 7 全部完成
