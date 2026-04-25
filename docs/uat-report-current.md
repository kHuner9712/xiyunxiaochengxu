# 孕禧 V1.0 UAT 测试报告 — 当前版本

本文档记录当前版本的体验版部署实测状态。由于当前域名备案中、仅测试号可用，部分测试项需在服务器部署后执行。

---

## 基本信息

| 项目 | 值 |
|------|---|
| 测试日期 | 2026-04-26 |
| 测试人员 | 开发团队（代码审查 + 静态分析） |
| 服务器环境 | 宝塔 + Nginx 1.28.1 + MySQL 5.7.44 + PHP 8.1.32 |
| 后端地址 | 待部署（域名备案中） |
| 小程序 AppID | wxda7779770f53e901（测试号） |
| 代码版本 | a3fc533 |
| 数据库迁移版本 | muying-final-migration.sql（待执行） |

---

## 前置检查

| # | 检查项 | 结果 | 备注 |
|---|--------|------|------|
| P1 | check-baota-runtime.php | ⏳ 待部署执行 | 脚本已创建，需在服务器运行 |
| P2 | check-db-schema.php | ⏳ 待部署执行 | 脚本已创建，需在服务器运行 |
| P3 | preflight-production-check.php | ⏳ 待部署执行 | 脚本已创建，需在服务器运行 |
| P4 | 数据库迁移已执行 | ⏳ 待执行 | muying-final-migration.sql |
| P5 | MUYING_PRIVACY_KEY 已配置 | ⏳ 待配置 | 需生成 64 位 hex 密钥 |
| P6 | APP_DEBUG = false | ⏳ 待配置 | .env.production.example 有说明 |
| P7 | 功能开关已正确配置 | ⏳ 待配置 | 一期开启/高风险关闭 |

---

## 小程序端测试路径

### 用户浏览路径

| # | 测试路径 | 预期结果 | 实际结果 | 状态 |
|---|---------|---------|---------|------|
| 1 | 小程序启动 | 启动页 → 首页正常加载 | ⏳ 待实测 | |
| 2 | 首页加载 | 轮播/导航/推荐商品/推荐活动/孕育知识/邀请入口 | ✅ 代码审查通过：index.vue 包含所有模块 | |
| 3 | 商品分类加载 | 分类列表 + 阶段筛选栏 | ✅ 代码审查通过：goods-category.vue 含阶段筛选 | |
| 4 | 商品详情加载 | 商品信息 + 母婴标签 | ✅ 代码审查通过：goods-detail.vue 含阶段/卖点标签 | |
| 5 | 活动列表加载 | 活动卡片列表 + 阶段筛选 | ✅ 代码审查通过：activity-list.vue 含筛选 | |
| 6 | 活动详情加载 | 活动信息 + 报名按钮（7种状态） | ✅ 代码审查通过：activity-detail.vue 含状态逻辑 | |

### 用户交互路径

| # | 测试路径 | 预期结果 | 实际结果 | 状态 |
|---|---------|---------|---------|------|
| 7 | 登录 | 微信授权/手机号登录成功 | ⏳ 待实测（需测试号+服务器） | |
| 8 | 个人资料保存 | 选择备孕/孕期/产后 → 保存成功 | ✅ 代码审查通过：personal.vue 含阶段/预产期/宝宝生日 | |
| 9 | 活动报名 | 填写姓名/手机/隐私协议 → 提交成功 | ✅ 代码审查通过：activity-signup.vue 含防重复+隐私校验 | |
| 10 | 我的活动查看 | 报名记录显示 | ✅ 代码审查通过：my-activity.vue 含活动/报名 Tab | |
| 11 | 邀请页打开 | 邀请海报/邀请记录 | ✅ 代码审查通过：invite.vue 含海报+记录 | |
| 12 | 反馈提交 | 填写内容/联系方式 → 提交成功 | ✅ 代码审查通过：feedback-submit.vue | |
| 13 | 购物车 | 加入购物车 → 购物车列表 | ✅ 代码审查通过：cart.vue 含门店隐藏 | |
| 14 | 下单 | 生成待支付订单 | ✅ 代码审查通过：buy.vue 含无支付友好提示 | |

### 合规拦截路径

| # | 测试路径 | 预期结果 | 实际结果 | 状态 |
|---|---------|---------|---------|------|
| 15 | 直达钱包页面 | 路由守卫拦截 | ✅ 代码审查通过：compliance-scope.js 含 wallet 拦截 | |
| 16 | 直达分销页面 | 路由守卫拦截 | ✅ 代码审查通过：compliance-scope.js 含 distribution 拦截 | |
| 17 | 直达门店页面 | 路由守卫拦截 | ✅ 代码审查通过：compliance-scope.js 含 realstore 拦截 | |
| 18 | 抓包强传 wallet 支付 | 后端返回 -403 | ✅ 代码审查通过：OrderService::Pay 含合规拦截 | |

---

## 后台端测试路径

| # | 测试路径 | 预期结果 | 实际结果 | 状态 |
|---|---------|---------|---------|------|
| 19 | 后台登录 | 混淆入口登录成功 | ⏳ 待实测 | |
| 20 | Dashboard 加载 | 今日指标/阶段分布/运营指标正常 | ✅ 代码审查通过：DashboardService 含 SafeCount/SafeSum | |
| 21 | 创建活动 | 填写信息 → 保存成功 | ⏳ 待实测 | |
| 22 | 查看报名 | 报名列表 + 姓名/手机脱敏 | ✅ 代码审查通过：MaskSignupRow + can_view_sensitive | |
| 23 | 查看报名明文 | 有敏感权限时显示明文 + 审计日志 | ✅ 代码审查通过：CanViewSensitive + MuyingAuditLogService | |
| 24 | 反馈管理 | 反馈列表 + 审核操作 | ✅ 代码审查通过：Feedback 控制器含审核逻辑 | |
| 25 | 合规中心 | 资质/开关/拦截日志 | ✅ 代码审查通过：Featureswitch + ComplianceService | |
| 26 | 尝试开启高风险功能 | 返回 403/资质不足提示 | ✅ 代码审查通过：TryToggleFeature 含资质检查 | |
| 27 | 支付方式列表 | 不返回 WalletPay/CoinPay 等 | ✅ 代码审查通过：GetComplianceBlockedPayments | |

---

## 已知阻塞问题

| # | 问题 | 严重性 | 影响 | 解决方案 | 状态 |
|---|------|--------|------|---------|------|
| 1 | 域名备案未完成 | BLOCKER | 无法配置 HTTPS 域名，小程序无法提审 | 等待备案完成 | 外部依赖 |
| 2 | 正式 AppID 未申请 | BLOCKER | 无法提交正式审核 | 备案完成后申请 | 外部依赖 |
| 3 | 微信支付未配置 | WARN | 用户只能生成待支付订单 | 一期可接受，后续对接 | 已知 |
| 4 | 服务器未部署代码 | BLOCKER | 无法运行任何实测 | 需执行部署流程 | 待执行 |

---

## 部署后待执行清单

1. **上传代码到服务器**
   ```bash
   git clone https://github.com/kHuner9712/xiyun.git /www/wwwroot/yunxi
   ```

2. **配置 .env**
   ```bash
   cp shopxo-backend/.env.production.example shopxo-backend/.env
   # 编辑 .env，替换所有占位符
   ```

3. **配置数据库**
   ```bash
   cp shopxo-backend/config/database.php shopxo-backend/config/database.php
   # 编辑 database.php
   ```

4. **执行数据库迁移**
   ```bash
   mysql -u root -p database_name < docs/muying-final-migration.sql
   ```

5. **设置权限**
   ```bash
   chmod -R 755 shopxo-backend/runtime
   chown -R www:www shopxo-backend/runtime
   ```

6. **运行检查脚本**
   ```bash
   php scripts/preflight/check-baota-runtime.php --root=/www/wwwroot/yunxi/shopxo-backend
   php scripts/preflight/check-db-schema.php --root=/www/wwwroot/yunxi/shopxo-backend
   php scripts/preflight/preflight-production-check.php --env=/www/wwwroot/yunxi/shopxo-backend/.env
   ```

7. **执行敏感数据迁移**
   ```bash
   php scripts/migrate-encrypt-sensitive.php --dry-run
   php scripts/migrate-encrypt-sensitive.php --force
   ```

8. **配置 Nginx**
   - 网站根目录指向 public/
   - 伪静态选择 thinkphp
   - SSL 证书配置
   - 禁止访问 .env / runtime/

9. **小程序配置**
   - HBuilderX 导入项目
   - 配置 .env.development（测试号 AppID + 服务器 IP）
   - 运行到微信开发者工具

---

## 测试结论

| 决策项 | 结论 |
|--------|------|
| 是否可进入体验版测试 | ⏳ 代码审查通过，待服务器部署后实测 |
| 阻塞问题清单 | 域名备案 + 正式 AppID + 服务器部署 |
| 下一步行动 | 部署到宝塔服务器 → 运行 preflight → 实测 20 条路径 → 填写实测结果 |
