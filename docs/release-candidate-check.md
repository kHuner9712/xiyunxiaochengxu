# Release Candidate Check — review-remediation-phase1

> 生成时间：2026-04-28
> 执行人：自动化脚本 + 人工审查

---

## 1. 当前分支

| 项目 | 值 |
|------|-----|
| 当前分支 | `review-remediation-phase1` |
| 远端同步 | `origin/review-remediation-phase1` (up to date) |
| 工作区状态 | **clean** — 无未提交文件 |

---

## 2. 相对 main 的 commit 数

| 项目 | 值 |
|------|-----|
| Ahead commits | **28** |
| 变更文件数 | **63** |
| 增加行数 | +2,469 |
| 删除行数 | -2,173 |

### Commit 列表

```
d65cd31 fix(payment): add centralized action-level payment gate
1b247db feat(review): converge dynamic/payment pages for RC submission
08c9488 fix(release): remove install entry from production package
42ff526 fix(db): make privacy migration prefix-safe with cautious history handling
4b23b52 docs(review): add phase2 hardening remediation log
13bf70f fix(review): harden compliance gates for RC submission readiness
6dc49ba docs: 新增一期合规整改报告 phase1-remediation-report.md
e3b1e60 feat(compliance): 新增提审前自检清单和自动化脚本
56b3598 feat(compliance): 医疗内容合规 - 免责声明+敏感词+禁止分类
4d443de feat(compliance): 支付链路降级 - feature_payment_enabled 门禁
f646c29 feat(compliance): 前后端双重过滤一期关闭功能菜单
c56fb22 docs: update remediation log for round 31 production deployment guide
0df8f17 docs(deployment): add BT panel production guide and harden Nginx security rules
ab45d3b docs: update remediation log for round 30 production build gates
229a46a feat(config): harden production build gates in runtime-config and update env templates
dc16fa2 docs: update remediation log for round 29 privacy consent split
7a2f860 feat(privacy): split activity signup consent into privacy-agreed and profile-sync-agreed
8418468 docs: update remediation log for round 28 pages.json slim-down
663cdb4 feat(compliance): slim down pages.json for phase-one review and gate high-risk navigation
47b6bf5 fix(compliance): add userintegral mapping and update remediation log
09dda85 fix(compliance): auto-show toast on -403 and frontend feature block
dcc73e3 feat(compliance): add qualifications to config output and expand controller feature map
5fb2544 docs: update remediation log for round 26 compliance gate fixes
626688b fix(security): replace internal IP addresses with placeholders in docs
e7fd889 fix(compliance): unify IsPhaseOneFeatureKey definition with GetAllFeatureFlags
b47c9b4 fix(compliance): gate shop dispute in aftersale detail and block wallet payment case
d39256d fix(compliance): add realstore feature flag gate in buy page
2d41ccf fix(compliance): add feature flag gates for blocked plugins in goods-detail
5bec740 fix(compliance): add feature flag gates for hospital and realstore in cart
c07cb57 fix(security): redact API keys from docs and add cert patterns to gitignore
```

---

## 3. 自检脚本结果

```
node scripts/check-phase1-release.js
```

| 类别 | 结果 |
|------|------|
| PASS | **19** |
| WARN | **3** |
| BLOCKER | **0** |
| 总计 | 22 |

### PASS 项（19）

1. pages.json 无高风险插件路径
2. shopxo-uniapp\.env.production.example 无明显密钥泄露
3. shopxo-uniapp\.env.staging.example 无明显密钥泄露
4. shopxo-uniapp\.env.release.example 无明显密钥泄露
5. runtime-config.js 包含 HTTPS 校验
6. runtime-config.js 包含测试号 AppID 拦截
7. runtime-config.js 包含 localhost/IP 拦截
8. .env.production REQUEST_URL 使用 HTTPS
9. 前端页面无高风险关键词命中
10. public/install.php 已删除
11. 后端 .env APP_DEBUG 已关闭
12. .gitignore 已忽略 .env.production
13. form-input 页面有 feature flag 门控
14. diy 页面有 feature flag 门控
15. design 页面有 feature flag 门控
16. cashier 页面有 feature flag 门控
17. paytips 页面有 feature flag 门控
18. pages.json 未注册 form-preview 页面
19. pages.json 未注册 customview 页面

### WARN 项（3）

| # | 文件 | 说明 | 风险评估 |
|---|------|------|----------|
| 1 | shopxo-backend\.env.example:15 | `PASSWORD = 请替换为强密码` 可能触发密钥检测 | **低风险** — 仅为占位提示文本，非真实密钥 |
| 2 | manifest.json | mp-weixin.appid 为空 | **预期行为** — 构建时由 .env.production 注入 |
| 3 | project.config.json | appid 为空 | **预期行为** — 构建时由 .env.production 注入 |

---

## 4. PHP 语法检查结果

> ⚠️ 当前环境未安装 PHP CLI，无法执行 `php -l`。
> 以下为逐文件人工代码审查结果，检查项包括：花括号匹配、分号完整性、方法签名、return 语句、try/catch 闭合。

| # | 文件 | 行数 | 人工审查结果 |
|---|------|------|-------------|
| 1 | app/service/MuyingComplianceService.php | 675 | ✅ 无语法问题 |
| 2 | app/service/ActivityService.php | 1,673 | ✅ 无语法问题 |
| 3 | app/api/controller/Common.php | 357 | ✅ 无语法问题 |
| 4 | app/api/controller/Buy.php | 158 | ✅ 无语法问题 |
| 5 | app/api/controller/Cashier.php | 45 | ✅ 无语法问题 |
| 6 | app/api/controller/Order.php | 315 | ✅ 无语法问题 |
| 7 | app/api/controller/Paylog.php | 80 | ✅ 无语法问题 |

**结论**：7 个 PHP 文件人工审查未发现语法错误。但 **必须在部署前使用 `php -l` 逐文件验证**，人工审查不能替代编译级检查。

---

## 5. 前端构建结果

| 项目 | 值 |
|------|-----|
| 项目类型 | uni-app (Vue 2 / webpack) |
| 构建方式 | HBuilderX IDE |
| HBuilderX CLI | ❌ 未安装 |
| npm uni-app CLI | ❌ 未安装 |
| 构建结果 | **未执行** |

**原因**：本项目为 HBuilderX 管理的 uni-app 项目，无 CLI 构建脚本。当前开发环境未安装 HBuilderX CLI，无法执行 `uni build -p mp-weixin`。

**人工待办**：合并前必须在 HBuilderX 中执行「发行 → 小程序-微信」构建，确认无编译错误。

---

## 6. 未解决 BLOCKER

**无 BLOCKER。**

所有自检项均为 PASS 或 WARN，WARN 项均为预期行为或低风险占位文本。

---

## 7. 人工待办项

| # | 待办 | 优先级 | 说明 |
|---|------|--------|------|
| 1 | HBuilderX 构建 mp-weixin | **P0** | 合并前必须确认构建无报错 |
| 2 | `php -l` 逐文件语法检查 | **P0** | 部署前必须用 PHP CLI 验证 7 个改动文件 |
| 3 | 数据库迁移脚本执行 | **P1** | 需在生产环境执行 `muying-activity-signup-privacy-split-migration.sql`，注意表前缀替换 |
| 4 | .env.production 配置 | **P1** | 确认生产环境 `feature_payment_enabled=0`、`feature_dynamic_page_enabled=0` 等一期关闭项 |
| 5 | Nginx 配置部署 | **P1** | 参照 `deploy/nginx.production.example.conf` 更新生产 Nginx，deny /install.php |
| 6 | AppID 注入验证 | **P2** | 构建时确认 .env.production 中 AppID 正确注入 manifest.json 和 project.config.json |
| 7 | 合并后 main 分支部署验证 | **P2** | 合并后需在测试环境完整走一遍提审流程 |

---

## 8. 合并建议

| 项目 | 结论 |
|------|------|
| 是否存在 BLOCKER | ❌ 否 |
| 是否可以创建 PR | ✅ 是 |
| 是否可以自动 merge | ❌ 否 — 需人工确认上述待办项后手动合并 |

**建议**：创建 PR `review-remediation-phase1 → main`，在 PR 描述中引用本文档，待人工完成 P0 待办后合并。
