# 禧孕优选 GO_LIVE 状态（2026-05-29）

## 1. 当前结论

- 结论：**可进入预生产部署，不可正式发布（No-Go for Production）**
- 说明：默认门禁可通过，生产严格门禁在缺真实 AppID 与最终联系方式前应保持失败（正确阻断）。
- 新增说明：支付补偿任务、类目合规配置、订单完成发奖幂等、销量防负回滚已完成代码落地，当前仍需真实运营/法务/支付信息完成人工闭环。

## 2. 代码完成项（已完成）

1. 订单导出已切换为 CSV，包含 UTF-8 BOM、文件名规范与 CSV 注入防护。
2. `fulfillmentType` 在前后端筛选与导出链路保持一致。
3. 部署脚本 `deploy-prod-check.sh` 已具备 `.env` 安全解析、强口令检查、证书可读检查。
4. Docker Compose 生产关键变量已改为 required 形式，防止弱默认值误部署。
5. 上线文档与预生产执行文档已补齐，可直接指导运维执行。

## 3. 当前门禁状态

1. `pnpm release:check`：通过（用于预生产准备）。
2. `pnpm release:check:prod`：未通过（预期）。
3. 严格失败原因：
- 未提供真实小程序 AppID。
- `legal.ts` 中客服电话/客服微信/退货地址仍为占位口径，未替换为最终值。

## 4. 人工阻塞项（P0）

1. 真实小程序 AppID（体验版/正式版构建）。
2. 法务/运营确认后的最终联系方式（客服电话、客服微信、退货地址）。
3. 私有 `.env.production` 真实值（仅服务器本地）。
4. 微信支付生产参数与证书（商户号、APIv3 Key、商户私钥、平台证书、序列号）。
5. HTTPS 证书（`fullchain.pem`、`privkey.pem`）。

## 5. 部署执行口径

1. 所有部署命令默认在仓库根目录执行（`package.json` 所在目录）。
2. 敏感值仅允许在服务器本地填写，不得提交 Git。
3. 真机验收记录使用：
- `docs/PREPROD_ACCEPTANCE_RECORD.md`
- `docs/MANUAL_ACCEPTANCE_CHECKLIST.md`

## 6. 下一步

1. 运维按 `docs/SERVER_DEPLOY_COMMANDS.md` 执行服务器预生产部署。
2. 运营/法务按 `docs/ENV_PRODUCTION_FILL_GUIDE.md` 与 `docs/LEGAL_CONTENT_GUIDE.md` 补齐真实信息。
3. 完成体验版构建与真机闭环后，再发起正式发布 Go/No-Go 评审。
## 2026-05-29 补偿任务与迁移补充

1. 数据库迁移新增：
   - `payment_compensation_tasks`（支付成功回调打到已取消订单时的补偿任务）
   - `payment_compensation_tasks.transaction_id` 索引
2. 部署后必须执行：
   - `pnpm --filter @baby-mall/api prisma migrate deploy`
   - `pnpm --filter @baby-mall/api prisma:validate`
3. 运营处理流程（真实支付异常）：
   - 在后台“支付补偿任务”列表筛选 `pending`；
   - 核对订单、微信交易号、金额与回调快照；
   - 按实际结果标记 `resolved` 或 `ignored`，填写处理结论；
   - 涉及退款时走真实微信退款流程并保留操作记录。
