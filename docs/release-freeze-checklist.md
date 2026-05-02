# 禧孕 V1.0 发布冻结检查清单

> 在创建 release 分支前，逐项确认以下检查。全部 ✅ 后方可创建 RC 分支。

---

## 1. 代码完整性

| # | 检查项 | 状态 | 验证方式 |
|---|--------|------|----------|
| 1.1 | 所有 P0 任务已完成 | ☐ | 查看 docs/trae-remediation-log.md |
| 1.2 | 无未提交的代码变更 | ☐ | git status 干净 |
| 1.3 | 无 TODO/FIXME 占位符 | ☐ | grep -r "TODO\|FIXME" app/ |
| 1.4 | 无调试代码残留 | ☐ | grep -r "dd(\|dump(\|var_dump" app/ |

## 2. 数据库迁移

| # | 检查项 | 状态 | 验证方式 |
|---|--------|------|----------|
| 2.1 | 迁移脚本确定且幂等 | ☐ | node scripts/preflight/check-migration.js 通过 |
| 2.2 | check-db-schema 通过 | ☐ | php scripts/preflight/check-db-schema.php |
| 2.3 | 敏感数据迁移已执行 | ☐ | php scripts/migrate-encrypt-sensitive.php --force |

## 3. 文档一致性

| # | 检查项 | 状态 | 验证方式 |
|---|--------|------|----------|
| 3.1 | check-doc-consistency --strict 通过 | ☐ | php scripts/preflight/check-doc-consistency.php --strict |
| 3.2 | UAT 报告版本等于 release commit | ☐ | docs/uat-report-current.md 代码版本 = HEAD |
| 3.3 | 服务器实测不得为待执行 | ☐ | UAT 报告中无 ⏳ 待执行项 |
| 3.4 | 无"待提交"占位符 | ☐ | grep -r "待提交" docs/ |

## 4. 安全检查

| # | 检查项 | 状态 | 验证方式 |
|---|--------|------|----------|
| 4.1 | 没有真实密钥被跟踪 | ☐ | git ls-files | grep -i "key\|secret\|password" |
| 4.2 | .env 未被跟踪 | ☐ | git ls-files .env |
| 4.3 | APP_DEBUG=false | ☐ | .env 中确认 |
| 4.4 | MUYING_PRIVACY_KEY 已配置 | ☐ | .env 中确认 |

## 5. 小程序构建

| # | 检查项 | 状态 | 验证方式 |
|---|--------|------|----------|
| 5.1 | AppID 与构建环境一致 | ☐ | manifest.json mp-weixin.appid |
| 5.2 | request 合法域名已配置 | ☐ | 微信后台确认 |
| 5.3 | 隐私协议已填写 | ☐ | 微信后台确认 |

## 6. 合规检查

| # | 检查项 | 状态 | 验证方式 |
|---|--------|------|----------|
| 6.1 | 高风险功能已关闭 | ☐ | 合规中心功能开关确认 |
| 6.2 | 合规中心截图/记录已保存 | ☐ | 截图存档 |
| 6.3 | 内容合规敏感词已配置 | ☐ | 后台内容合规页面确认 |
| 6.4 | 隐私数据管理可用 | ☐ | 后台隐私数据管理页面确认 |

## 7. 发布冻结脚本

| # | 检查项 | 状态 | 验证方式 |
|---|--------|------|----------|
| 7.1 | release-freeze-check.php 通过 | ☐ | php scripts/preflight/release-freeze-check.php |

---

## 冻结签字

| 角色 | 姓名 | 日期 | 签字 |
|------|------|------|------|
| 开发负责人 | | | |
| 测试负责人 | | | |
| 产品负责人 | | | |
