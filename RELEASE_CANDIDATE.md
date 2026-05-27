# RELEASE_CANDIDATE（2026-05-28）

## 1. 版本结论

- 项目：禧孕优选（微信小程序 + Admin + API）
- 阶段：预生产部署脚本最终修复
- 结论：**可进入预生产部署，不可正式发布（No-Go for Production）**

## 1.1 本轮修复项

1. `deploy-prod-check.sh` 增加 `ENV_FILE` 绝对路径规范化，兼容三种调用方式：
- `bash deploy/scripts/deploy-prod-check.sh`
- `ENV_FILE=.env.production bash deploy/scripts/deploy-prod-check.sh`
- `cd deploy && ENV_FILE=../.env.production bash scripts/deploy-prod-check.sh`
2. 微信支付证书路径校验拆分为：
- `.env.production` 中校验容器内路径（`/app/apps/api/certs/...`）
- 宿主机固定路径文件可读性校验（`deploy/certs/...` 与 `deploy/nginx/ssl/...`）
3. 文档同步：
- `docs/ENV_PRODUCTION_FILL_GUIDE.md`
- `docs/SERVER_DEPLOY_COMMANDS.md`
- `docs/PREPROD_EXECUTION_STEPS.md`
- `docs/PREPROD_SCRIPT_SELFTEST.md`

## 2. 本轮实际执行命令结果

默认约定：命令在仓库根目录执行（`package.json` 所在目录）。

| 命令 | 结果 | 说明 |
|---|---|---|
| `pnpm install` | PASS | 依赖已就绪 |
| `pnpm --filter @baby-mall/api prisma:validate` | PASS | Prisma Schema 有效 |
| `pnpm --filter @baby-mall/api prisma:generate` | PASS | Prisma Client 生成成功 |
| `pnpm --filter @baby-mall/api test:ci` | PASS | 单测+e2e 通过（24+5 套件） |
| `pnpm build:api` | PASS | API 构建通过 |
| `pnpm build:admin` | PASS | Admin 构建通过 |
| `pnpm build:mini` | PASS | 小程序默认构建通过 |
| `pnpm release:check` | PASS | `PASS 94 / FAIL 0 / WARN 9`（默认门禁通过） |
| `bash -n deploy/scripts/deploy-prod-check.sh` | PASS | 脚本语法检查通过 |
| `pnpm release:check:prod` | FAIL（预期） | `PASS 93 / FAIL 5 / WARN 5`（严格门禁阻断） |

## 3. release:check:prod 失败明细（预期人工/环境阻塞）

1. 严格模式下小程序生产构建失败（未提供真实 `VITE_WX_APPID`）。
2. AppID 门禁失败（`manifest.json` 仍为占位 AppID）。
3. `legal.ts` 中客服电话占位文案未替换，严格门禁 FAIL。
4. `legal.ts` 中客服微信占位文案未替换，严格门禁 FAIL。
5. `legal.ts` 中退货地址占位文案未替换，严格门禁 FAIL。

## 4. 当前可发布性判断

1. 代码质量门禁（默认）已通过，可进入预生产部署与真机验收。
2. 正式发布门禁（prod strict）未通过，禁止正式发布。

## 5. 人工阻塞项（P0）

1. 微信小程序真实 AppID（体验版/正式版构建必需）。
2. 协议最终联系方式：客服电话、客服微信、退货地址（法务/运营确认后写入 `legal.ts`）。
3. 私有生产环境文件 `.env.production`（真实变量，不提交）。
4. 微信支付生产参数与证书（商户号、APIv3 Key、商户私钥、平台证书等）。
5. HTTPS 证书文件（`fullchain.pem`、`privkey.pem`）。

## 6. 下一步建议

1. 运营/法务补齐 `docs/OPERATOR_REQUIRED.md` 与 `docs/LEGAL_CONTENT_GUIDE.md` 列项。
2. 运维按 `docs/PREPROD_EXECUTION_STEPS.md` 执行服务器预生产部署检查。
3. 提供真实 AppID 后执行：`VITE_WX_APPID=真实AppID pnpm build:mini:prod` 并上传体验版真机验收。
