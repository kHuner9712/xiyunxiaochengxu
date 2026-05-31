# RELEASE_CANDIDATE（2026-05-31）

## 1. 版本结论

- 项目：禧孕优选（微信小程序 + Admin + API）
- 阶段：预生产部署脚本最终修复 + 限流启用 + CI 对齐
- 代码层面：**Go**（本地门禁已通过，CI 待核验）
- 预生产部署：**Go**
- 正式发布：**No-Go**，直到真实 AppID、支付配置、证书、数据库迁移、体验版上传、真机验收、运营/法务信息全部完成

## 1.1 本轮修复项

1. 预生产部署脚本 one-off 命令阻断修复：
   - `entrypoint.sh` 支持 `exec "$@"`，允许 Docker one-off 命令正常执行
   - 新增 `SKIP_MIGRATE` 开关，跳过迁移步骤
   - `deploy-prod-check.sh` 使用 `--entrypoint` 覆写，确保部署检查命令不被 entrypoint 阻断
2. ThrottlerGuard 限流启用：
   - 认证接口严格限流：验证码 20次/分、登录 5次/分、refresh 10次/分、小程序登录/手机号 10次/分
   - 支付回调 `@SkipThrottle` 跳过限流
3. GitHub Actions pnpm 版本对齐：
   - `ci.yml` 和 `release-check.yml` 改用 `corepack` 读取 `packageManager`
   - 安装依赖使用 `--frozen-lockfile`

## 2. 本轮实际执行命令结果

默认约定：命令在仓库根目录执行（`package.json` 所在目录）。

| 命令 | 结果 | 说明 |
|---|---|---|
| `pnpm --filter @baby-mall/api prisma:validate` | PASS | Prisma Schema 有效 |
| `pnpm --filter @baby-mall/api test:ci` | PASS | 464 unit tests (30 suites) + 23 e2e tests (6 suites) |
| `pnpm build:all` | PASS | API + Admin + 小程序构建均通过 |
| `pnpm release:check` | PASS | 106 PASS / 0 FAIL / 11 WARN（默认门禁通过） |

进入服务器预生产部署前需执行 `pnpm release:check:freeze` 作为代码冻结门禁；正式上线前仍必须执行 `pnpm release:check:prod`。

## 3. release:check:prod 失败明细（预期人工/环境阻塞）

1. 严格模式下小程序生产构建失败（未提供真实 `VITE_WX_APPID`）。
2. AppID 门禁失败（`manifest.json` 仍为占位 AppID）。
3. `legal.ts` 中客服电话占位文案未替换，严格门禁 FAIL。
4. `legal.ts` 中客服微信占位文案未替换，严格门禁 FAIL。
5. `legal.ts` 中退货地址占位文案未替换，严格门禁 FAIL。

## 4. 当前可发布性判断

1. 代码冻结门禁需以 `pnpm release:check:freeze` 为准，通过后可进入预生产部署与真机验收。
2. 正式发布门禁（prod strict）未通过，禁止正式发布。

## 5. 人工阻塞项（P0）

> **声明**：真实 AppID、密钥、证书、资质图片、客服电话、客服微信、退货地址属于部署/运营阶段人工项，不作为代码冻结失败项。

1. 微信小程序真实 AppID（体验版/正式版构建必需）。
2. 协议最终联系方式：客服电话、客服微信、退货地址（法务/运营确认后写入 `legal.ts`）。
3. 私有生产环境文件 `.env.production`（真实变量，不提交）。
4. 微信支付生产参数与证书（商户号、APIv3 Key、商户私钥、平台证书等）。
5. HTTPS 证书文件（`fullchain.pem`、`privkey.pem`）。
6. 数据库迁移（生产环境首次 Prisma migrate deploy）。
7. 体验版上传与真机验收。

## 6. 下一步建议

1. 运营/法务补齐 `docs/OPERATOR_REQUIRED.md` 与 `docs/LEGAL_CONTENT_GUIDE.md` 列项。
2. 运维按 `docs/PREPROD_EXECUTION_STEPS.md` 执行服务器预生产部署检查。
3. 提供真实 AppID 后执行：`VITE_WX_APPID=真实AppID pnpm build:mini:prod` 并上传体验版真机验收。
