# Release Candidate Check — review-remediation-phase1

> 生成时间：2026-04-28
> 执行人：自动化脚本 + 人工审查

> ⚠️ **当前仍未执行 HBuilderX 构建和 PHP CLI 语法检查**
> ⚠️ **本报告为代码层 RC 检查，不等同于真实服务器 UAT**

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
| Ahead commits | **34** |
| 变更文件数 | **66** |
| 增加行数 | +3,262 |
| 删除行数 | -2,173 |

### Commit 列表

```
0e607f8 docs(release): update release-candidate-check with real diff stats and scan results
527cf9c docs(submit): add WeChat mini-program submission human tasks checklist
aed40a0 docs(uat): add server acceptance and functional test checklist
df2fd97 docs(release): add release candidate check report for phase1 merge
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

> 执行命令：`node scripts/check-phase1-release.js`
> 执行环境：Node.js v20.18.0 / Windows

| 类别 | 结果 |
|------|------|
| PASS | **19** |
| WARN | **3** |
| BLOCKER | **0** |
| 总计 | 22 |

### 脚本完整输出

```
==========================================
 1. pages.json 高风险页面检查
==========================================
[PASS] pages.json 无高风险插件路径

==========================================
 2. .env.example 密钥泄露检查
==========================================
[PASS] shopxo-uniapp\.env.production.example 无明显密钥泄露
[PASS] shopxo-uniapp\.env.staging.example 无明显密钥泄露
[PASS] shopxo-uniapp\.env.release.example 无明显密钥泄露
[WARN] shopxo-backend\.env.example:15 可能包含真实密钥: PASSWORD = 请替换为强密码

==========================================
 3. AppID 与测试号检查
==========================================
[WARN] manifest.json mp-weixin.appid 为空（构建时由 .env.production 注入）
[WARN] project.config.json appid 为空

==========================================
 4. 生产配置 HTTPS 校验
==========================================
[PASS] runtime-config.js 包含 HTTPS 校验
[PASS] runtime-config.js 包含测试号 AppID 拦截
[PASS] runtime-config.js 包含 localhost/IP 拦截
[PASS] .env.production REQUEST_URL 使用 HTTPS: https://<PROD_API_BASE_URL>/

==========================================
 5. 高风险关键词检查
==========================================
[PASS] 前端页面无高风险关键词命中（排除合规过滤代码）

==========================================
 6. 后端安全配置检查
==========================================
[PASS] public/install.php 已删除
[PASS] 后端 .env APP_DEBUG 已关闭
[PASS] .gitignore 已忽略 .env.production

==========================================
 7. 动态页面与支付页面门控检查
==========================================
[PASS] form-input 页面有 feature flag 门控（feature_dynamic_page_enabled）
[PASS] diy 页面有 feature flag 门控（feature_dynamic_page_enabled）
[PASS] design 页面有 feature flag 门控（feature_dynamic_page_enabled）
[PASS] cashier 页面有 feature flag 门控（feature_payment_enabled）
[PASS] paytips 页面有 feature flag 门控（feature_payment_enabled）
[PASS] pages.json 未注册 form-preview 页面
[PASS] pages.json 未注册 customview 页面

==========================================
 检查汇总
==========================================

  PASS: 19  WARN: 3  BLOCKER: 0  总计: 22

存在 3 个 WARN → 需人工确认后可提审
```

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
> 以下使用 Node.js 脚本执行基础结构检查（花括号匹配、PHP 标签、class/function 结构），**不等同于 `php -l` 编译级检查**。
> 部署前必须安装 PHP CLI 并执行 `php -l` 逐文件验证。

| # | 文件 | 行数 | 结构检查结果 |
|---|------|------|-------------|
| 1 | app/admin/controller/Activity.php | 134 | ✅ PASS |
| 2 | app/admin/controller/Article.php | 160 | ✅ PASS |
| 3 | app/api/controller/Buy.php | 158 | ✅ PASS |
| 4 | app/api/controller/Cashier.php | 45 | ✅ PASS |
| 5 | app/api/controller/Common.php | 357 | ✅ PASS |
| 6 | app/api/controller/Order.php | 315 | ✅ PASS |
| 7 | app/api/controller/Paylog.php | 80 | ✅ PASS |
| 8 | app/module/LayoutModule.php | 1,048 | ✅ PASS |
| 9 | app/service/ActivityService.php | 1,674 | ✅ PASS |
| 10 | app/service/AppCenterNavService.php | 266 | ✅ PASS |
| 11 | app/service/AppHomeNavService.php | 268 | ✅ PASS |
| 12 | app/service/DiyApiService.php | 1,197 | ✅ PASS |
| 13 | app/service/MuyingComplianceService.php | 676 | ✅ PASS |
| 14 | app/service/MuyingContentComplianceService.php | 391 | ✅ PASS |
| 15 | app/service/PluginsService.php | 745 | ✅ PASS |
| 16 | app/service/QuickNavService.php | 270 | ✅ PASS |
| 17 | app/service/SystemBaseService.php | 654 | ✅ PASS |
| 18 | public/install.php | — | SKIP（已从工作区删除） |

**结论**：17 个 PHP 文件基础结构检查全部 PASS，1 个已删除。但 **必须在部署前使用 `php -l` 逐文件验证**，Node.js 结构检查不能替代编译级检查。

---

## 5. 前端构建结果

| 项目 | 值 |
|------|-----|
| 项目类型 | uni-app (Vue 2 / webpack) |
| 构建方式 | HBuilderX IDE |
| HBuilderX CLI | ❌ 未安装 |
| npm uni-app CLI | ❌ 项目无 CLI 构建脚本（package.json 为插件描述，非构建配置） |
| 构建结果 | **未执行** |

**原因**：本项目为 HBuilderX 管理的 uni-app 项目，无 CLI 构建脚本。当前开发环境未安装 HBuilderX CLI，无法执行 `uni build -p mp-weixin`。

**人工待办**：合并前必须在 HBuilderX 中执行「发行 → 小程序-微信」构建，确认无编译错误。

---

## 6. 敏感信息扫描结果

> 扫描时间：2026-04-28
> 扫描方式：git diff -S + grep 正则扫描

| 类别 | 结果 |
|------|------|
| AppSecret / AppKey 硬编码 | ✅ 无泄露（仅 trae-remediation-log.md 检查记录中提及） |
| 真实 AppID | ✅ 仅测试号 `wxda7779770f53e901`（用于 .env.example 和拦截逻辑），公开插件 ID `wx50b5593e81dd937a`/`wx2b03c6e691cd7370` |
| 密码 / Token / Key | ✅ 无硬编码真实密钥 |
| 服务器 IP | ✅ 仅 `127.0.0.1`/`0.0.0.0`/`192.168.1.100`（本地/示例），无真实服务器 IP |
| 数据库密码 | ✅ `.env.example` 中为占位提示文本 |

---

## 7. 未解决 BLOCKER

**无 BLOCKER。**

所有自检项均为 PASS 或 WARN，WARN 项均为预期行为或低风险占位文本。

---

## 8. 人工待办项

| # | 待办 | 优先级 | 说明 |
|---|------|--------|------|
| 1 | HBuilderX 构建 mp-weixin | **P0** | 合并前必须确认构建无报错 |
| 2 | `php -l` 逐文件语法检查 | **P0** | 部署前必须用 PHP CLI 验证 18 个改动文件（含 1 个已删除） |
| 3 | 真实服务器 UAT | **P0** | 本报告为代码层 RC 检查，不等同于真实服务器 UAT |
| 4 | 数据库迁移脚本执行 | **P1** | 需在生产环境执行 `muying-activity-signup-privacy-split-migration.sql`，注意表前缀替换 |
| 5 | .env.production 配置 | **P1** | 确认生产环境 `feature_payment_enabled=0`、`feature_dynamic_page_enabled=0` 等一期关闭项 |
| 6 | Nginx 配置部署 | **P1** | 参照 `deploy/nginx.production.example.conf` 更新生产 Nginx，deny /install.php |
| 7 | AppID 注入验证 | **P2** | 构建时确认 .env.production 中 AppID 正确注入 manifest.json 和 project.config.json |
| 8 | 合并后 main 分支部署验证 | **P2** | 合并后需在测试环境完整走一遍提审流程 |

---

## 9. 合并建议

| 项目 | 结论 |
|------|------|
| 是否存在 BLOCKER | ❌ 否 |
| 是否可以创建 PR | ✅ 是 |
| 是否可以自动 merge | ❌ 否 — 需人工确认上述待办项后手动合并 |

**建议**：创建 Draft PR `review-remediation-phase1 → main`，在 PR 描述中引用本文档，待人工完成 P0 待办后合并。
