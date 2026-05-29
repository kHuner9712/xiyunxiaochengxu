# 项目结构（发布阶段）

当前仓库按“端到端商用部署”拆分，保持边界如下：

- `apps/miniprogram`：微信小程序端（用户下单、支付、售后、自提等用户流程）
- `apps/admin-web`：管理后台（商品、订单、售后、营销、系统配置）
- `apps/api`：后端 API（业务服务、支付/退款、鉴权、任务、Prisma）
- `packages/shared`：跨端共享类型、常量、工具
- `deploy`：Docker、Nginx、部署与发布门禁脚本
- `docs`：当前有效部署/验收/合规文档
- `docs/archive`：历史阶段报告与旧版指引（保留审计价值，不作为主入口）

发布门禁入口：

- `pnpm release:check`
- `pnpm release:check:prod`

冒烟测试入口：

- `pnpm smoke`
- `pnpm smoke:public`
- `pnpm smoke:login`
- `pnpm smoke:all`
