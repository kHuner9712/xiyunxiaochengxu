# 商用收口修复记录（2026-05）

## 本次完成
- 退款金额双层校验：`ApproveAftersaleDto` + service/payment 业务兜底（整数分、>0、不超可退、不超订单实付累计）。
- 商品上架合规门禁强化：上架必须有 `attributes.compliance`；支持类目关键词保守判定食品/保健/奶粉；可用 `isRegulated=false` 显式声明普通商品。
- refresh token 独立密钥：refresh 签发与校验改用 `REFRESH_TOKEN_SECRET`；production 缺失时报错启动失败，development 回退并告警。
- 可选登录解析：新增 `@OptionalAuth()`；无 token 放行，有合法 token 注入 `request.user`，无效 token 返回未登录。
- DTO 严格化：补齐商品 SKU/商品创建校验、订单确认 DTO、订单创建 points/items/remark 等校验。
- 自提核销并发幂等：改为事务内 `updateMany` 抢占更新，重复核销返回“已核销或订单状态已变化”。
- CI 门禁补齐：增加 `pnpm build:mini` 与 `pnpm release:check`（非 strict）。

## 仍需人工完成（非代码阻塞）
- 真实小程序 `AppID/AppSecret`。
- 微信支付真实参数：商户号、APIv3 Key、商户私钥、平台证书、回调域名。
- 主体与合规资料：备案号、统一社会信用代码、食品经营许可证或预包装备案、保健食品/奶粉资质。
- 客服与售后信息：真实客服电话、客服微信、退货地址、售后规则。
- 生产验收记录：真机支付/退款/回调链路验收与留档。

## 安全要求
- 上述真实值不得提交到 Git 仓库。
- 真实值仅可通过安全环境变量、部署平台密钥管理、线下合规流程交付。
