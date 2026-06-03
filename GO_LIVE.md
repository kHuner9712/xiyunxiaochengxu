# 禧孕小程序 GO_LIVE 状态（2026-06-03 +08:00）

## 1. 当前结论

- 代码仓库门禁：**待重新执行当前 main 门禁后判定**。
- 当前 HEAD：`2106c80f9c1d6bb7425b380b475b1a663d0874f2`（以当前 `main` HEAD 为准）。
- 外部生产配置：负责人确认真实小程序平台配置、支付平台配置、主体资质、经营资质、备案信息、证照材料、客服与售后联系方式等，均已在服务器、微信公众平台、商户平台或其他外部平台完成配置；公开 GitHub 仓库不保存也不复核这些真实明文值。
- 正式发布：**待服务器生产门禁、体验版上传、真机验收留痕后 Go**。

## 2. 公开仓库门禁范围

公开仓库只检查可在代码仓库内验证的事项：

- 代码构建：API、管理后台、小程序默认构建。
- 类型检查：API 构建类型约束、管理后台 typecheck、小程序 typecheck。
- lint：API lint、管理后台 lint。
- API 测试：unit + e2e。
- 小程序生产构建脚本可执行性：脚本入口、产物校验逻辑、真实生产变量注入路径存在；真实 AppID 与生产 API 地址由服务器/外部平台注入，不在仓库明文复核。
- `pnpm release:check`、`pnpm release:check:freeze`、`pnpm release:check:prod` 的可执行性与结论输出。
- 敏感信息未入库：真实 AppID、密钥、证书、资质编号、备案编号、客服电话、客服微信、退货地址等不得提交到公开仓库。
- 文档与当前 `main` HEAD 一致。

## 3. 外部生产配置口径

以下项目统一归类为外部生产配置，由负责人确认已在服务器、微信公众平台、商户平台或其他外部平台完成；公开仓库不保存、不展示、不复核真实明文值：

- 微信小程序真实 AppID、合法域名、上传与提审相关后台配置。
- 微信支付商户号、证书序列号、APIv3 Key、商户私钥、平台证书、支付回调与退款回调地址。
- 主体资质、经营资质、备案信息、证照材料、资质编号。
- 客服电话、客服微信、退货地址、售后联系方式。
- 服务器 `.env.production`、证书目录、Docker/Nginx/HTTPS 私有配置。

`apps/miniprogram/src/config/legal.ts` 中公开占位联系方式不再直接作为代码仓库 No-Go；但正式版体验版/线上用户端最终展示或客服入口必须真实可用，并在真机验收中留痕。

## 4. 正式版发布门禁

正式版发布门禁以运行时和验收结果为准，需在服务器与微信生态真实环境中完成并留痕：

- 服务器私有环境变量已生效，且未写入公开仓库。
- 生产 API HTTPS 可访问，路径、证书、CORS、上传资源公网访问地址正确。
- 微信后台合法域名配置正确。
- 支付回调和退款回调真实可达、验签通过、订单/退款状态流转正确。
- 生产数据库迁移完成，确认连接的是目标生产数据库。
- Docker、Nginx、HTTPS、健康检查与 smoke 测试通过。
- 微信开发者工具体验版上传完成。
- 真机验收清单完成：登录、首页、商品、购物车、下单、支付、支付回调、退款、退款回调、售后、自提、客服、协议与最终客服入口。

## 5. 建议执行命令

以下命令需在仓库根目录执行；命令结果需以当前 `main` HEAD 重新留痕：

```bash
pnpm install
pnpm --filter @baby-mall/api prisma:validate
pnpm --filter @baby-mall/api test:ci
pnpm typecheck
pnpm lint
pnpm build:all
pnpm release:check
pnpm release:check:freeze
pnpm release:check:prod
```

服务器真实生产环境另需执行并留痕：

```bash
cd deploy
docker compose --env-file ../.env.production config
```

```bash
pnpm --filter @baby-mall/api prisma migrate deploy
```

```bash
ENV_FILE=.env.production bash deploy/scripts/deploy-prod-check.sh
pnpm smoke
pnpm smoke:public
pnpm smoke:login
pnpm smoke:all
```

## 6. Go / No-Go

- 代码仓库门禁：**待重新执行当前 main 门禁后判定**。
- 外部生产配置：**负责人确认已完成，不在公开仓库明文复核**。
- 正式发布：**待服务器生产门禁、体验版上传、真机验收留痕后 Go**。
