# 禧孕优选 GO_LIVE 状态（2026-05-27）

## 1. 当前结论

- 结论：**No-Go（不可直接正式上线）**
- 说明：代码层已达到“可部署到预生产并进行真机验收”状态，但仍存在人工/环境阻塞项，未满足正式发布条件。

## 2. 代码完成项（已完成）

1. 全仓库关键命令已执行：`pnpm install`、`prisma:validate`、`prisma:generate`、`test:ci`、`build:api`、`build:admin`、`build:mini`、`release:check`。
2. `release:check` 通过：`PASS 88 / FAIL 0 / WARN 8`。
3. 小程序生产门禁已补齐：
   - `build:mini:prod`
   - `release:check:prod`
   - 生产构建强制真实 `VITE_WX_APPID`（禁止占位 AppID）
4. 协议页面正式化机制完成：隐私政策、用户协议、食品安全与售后说明页面已去除 `TODO/暂定/日期占位`。
5. 后端生产配置门禁补强：新增 `REFRESH_TOKEN_SECRET`、`WECHAT_PLATFORM_CERT_SERIAL_NO` 必填与弱密钥拦截。
6. 后台商品编辑 URL 兜底修复：避免 `undefined` URL 入库。
7. 部署硬化脚本已新增：`deploy/scripts/deploy-prod-check.sh`。
8. 上线文档已补齐：
   - `docs/OPERATOR_REQUIRED.md`
   - `docs/FUNCTION_COMPLETENESS.md`
   - `docs/DEPLOYMENT_RUNBOOK.md`
   - `docs/MANUAL_ACCEPTANCE_CHECKLIST.md`

## 3. 人工阻塞项（P0）

1. 真实小程序 AppID（用于体验版/正式版构建）。
2. 微信支付商户敏感配置与证书：商户号、APIv3 Key、商户私钥、平台证书、证书序列号。
3. 备案与资质：
   - ICP/小程序备案号
   - 营业执照统一社会信用代码
   - 食品经营许可证或仅销售预包装食品备案
   - 保健食品批准文号/备案号
   - 奶粉产品配方注册号或合规证明
4. 客服电话/客服微信/退货地址最终值与售后规则最终口径。
5. 隐私政策/用户协议最终确认人（法务/运营责任人）。

> 明细见 `docs/OPERATOR_REQUIRED.md`。

## 4. 部署阻塞项（P0）

1. 本机缺失 `.env.production`，无法执行生产 Compose 配置校验与部署。
2. 真实证书文件未提供（微信支付证书、SSL fullchain/privkey）。
3. Docker Desktop 当前未运行，无法在本机继续容器化健康检查。

## 5. 微信审核阻塞项（P0）

1. 高合规品类审核材料未提交完毕（食品/保健品/奶粉相关）。
2. 审核账号与审核备注最终稿未锁定。
3. 体验版未基于真实 AppID 构建上传，无法完成微信侧真机验收闭环。

## 6. 与 release-check 一致性

1. `release:check`（默认）通过，允许占位 AppID 以 WARN 形式提示。
2. 生产门禁命令已验证会失败（缺真实 AppID）：
   - `pnpm release:check:prod` -> FAIL（符合预期）
3. 因此当前结论维持 **No-Go**，与门禁结果一致。

## 7. 下一步（进入可发布前）

1. 运营/老板补齐 `docs/OPERATOR_REQUIRED.md` 全部 P0 字段。
2. 在预生产服务器放置 `.env.production` 与真实证书，执行 `deploy/scripts/deploy-prod-check.sh`。
3. 用真实 AppID 构建并上传体验版，完成真机支付/退款/售后/自提全链路验收。
4. 微信审核材料提交完成后，再进行 Go/No-Go 复核。
