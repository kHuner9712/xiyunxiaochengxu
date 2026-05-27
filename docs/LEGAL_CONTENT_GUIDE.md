# 协议内容维护指南（LEGAL_CONTENT_GUIDE）

本文用于规范 `apps/miniprogram/src/config/legal.ts` 的维护方式，确保微信审核和线上合规一致。

## 1. 上线前必须确认的字段

1. 隐私政策：`privacyPolicy.updatedAt`、`privacyPolicy.effectiveAt`
2. 用户协议：`userAgreement.updatedAt`、`userAgreement.effectiveAt`
3. 食品安全说明：`foodSafety.updatedAt`、`foodSafety.effectiveAt`
4. 客服电话：`contact.customerPhone`
5. 客服微信：`contact.customerWechat`
6. 退货地址：`contact.returnAddress`
7. 客服提示语：`contact.serviceNotice`

> 上述字段需要法务/运营确认后才能作为正式审核内容。

## 2. 如何修改 legal.ts

文件路径：`apps/miniprogram/src/config/legal.ts`

建议流程：

1. 运营提供最终文案与联系方式。
2. 法务确认日期与条款口径。
3. 工程师更新 `LEGAL_PROFILE` 字段并提交代码。
4. 运行：`pnpm release:check` 与 `pnpm release:check:prod`。

示例（仅示意，不代表真实值）：

```ts
contact: {
  customerPhone: '400-000-0000',
  customerWechat: 'xiyun_service',
  returnAddress: '山东省临沂市xx区xx路xx号',
  serviceNotice: '服务时间 09:00-18:00，节假日请留言。',
}
```

## 3. 哪些内容不能写“暂定”

1. 用户可见协议页面中的日期。
2. 用户可见协议页面中的客服电话、客服微信、退货地址。
3. 食品/保健食品/奶粉相关合规描述中的编号字段（不得编造）。

## 4. 门禁策略

1. `pnpm release:check`：占位联系方式会提示 WARN。
2. `pnpm release:check:prod`：占位联系方式会 FAIL。

## 5. 安全要求

1. 不得在 `legal.ts` 中写入任何密钥或证书内容。
2. 证照编号不得编造，必须由运营/法务提供真实信息。
