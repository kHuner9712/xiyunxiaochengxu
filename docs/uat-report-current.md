# 禧孕 V1.0 UAT 测试报告 — 当前版本

**⚠️ 重要说明**：本报告**不是服务器实测报告**，而是基于本地代码审查 + 静态分析 + .gitignore 安全检查的结果。服务器真实 UAT 尚未执行，所有"服务器实测"列均为"⏳ 待执行"。正式发布前必须完成真实服务器 UAT 并回填本文档底部的"真实 UAT 回填区"。

---

## 基本信息

| 项目 | 值 |
|------|---|
| 报告类型 | 代码审查 + 静态分析（非服务器实测） |
| 测试日期 | 2026-04-26 |
| 测试人员 | 开发团队（代码审查 + 静态分析 + 本地验证） |
| 服务器环境 | 宝塔 + Nginx 1.28.1 + MySQL 5.7.44 + PHP 8.1.32 |
| 后端地址 | 待部署（域名备案中） |
| 小程序 AppID | wxda7779770f53e901（测试号） |
| 代码版本 | 850f9bb |
| 数据库迁移版本 | muying-final-migration.sql + muying-v1-post-migration.sql（待执行） |
| 发布分支 | 待创建（release/v1.0.0-rc1） |
| 发布 tag | 待打（v1.0.0-rc1） |

---

## 本地验证结果

| # | 验证项 | 结果 | 详情 |
|---|--------|------|------|
| L1 | .gitignore 防止密钥泄露 | ✅ PASS | .env/.env.local/database.php/domain.php/*.pem/*.key/*.cert 均被排除 |
| L2 | git 追踪文件无敏感信息 | ✅ PASS | git ls-files 仅含 project.private.config.example.json（示例文件） |
| L3 | 全仓库无 sxo_users 残留 | ✅ PASS | grep -rn 确认 0 结果 |
| L4 | 全仓库无待提交占位符 | ✅ PASS | 仅 check-doc-consistency.php 自身引用 |
| L5 | 关键脚本文件存在 | ✅ PASS | 7/7 文件全部存在 |
| L6 | PaymentService 合规拦截完整 | ✅ PASS | PaymentSave + PaymentStatusUpdate + BuyPaymentList + OrderService::Pay 四层拦截 |
| L7 | DashboardService 指标口径正确 | ✅ PASS | activity_signup_density/invite_register_ratio/repurchase_rate 三指标已修正 |
| L8 | 迁移脚本安全检查 | ✅ PASS | --force 必须 + MUYING_PRIVACY_KEY 检查 + IsEncrypted 防重复加密 |

---

## 前置检查（需服务器实测）

| # | 检查项 | 本地验证 | 服务器实测 | 备注 |
|---|--------|---------|-----------|------|
| P1 | check-baota-runtime.php | ✅ 脚本存在且语法正确 | ⏳ 待执行 | 需在服务器运行 |
| P2 | check-db-schema.php | ✅ 脚本存在且语法正确 | ⏳ 待执行 | 需在服务器运行 |
| P3 | preflight-production-check.php | ✅ 脚本存在且语法正确 | ⏳ 待执行 | 需在服务器运行 |
| P4 | 数据库迁移已执行 | ✅ SQL 文件存在 | ⏳ 待执行 | muying-final-migration.sql |
| P5 | MUYING_PRIVACY_KEY 已配置 | ✅ .env.production.example 有说明 | ⏳ 待配置 | 需生成 64 位 hex 密钥 |
| P6 | APP_DEBUG = false | ✅ .env.production.example 默认 false | ⏳ 待确认 | |
| P7 | 功能开关已正确配置 | ✅ muying-final-migration.sql D8 段含开关 | ⏳ 待确认 | 一期开启/高风险关闭 |

---

## 小程序端测试路径

### 用户浏览路径

| # | 测试路径 | 预期结果 | 代码审查 | 服务器实测 |
|---|---------|---------|---------|-----------|
| 1 | 小程序启动 | 启动页 → 首页正常加载 | ✅ | ⏳ |
| 2 | 首页加载 | 轮播/导航/推荐商品/推荐活动/孕育知识/邀请入口 | ✅ index.vue 包含所有模块 | ⏳ |
| 3 | 商品分类加载 | 分类列表 + 阶段筛选栏 | ✅ goods-category.vue 含阶段筛选 | ⏳ |
| 4 | 商品详情加载 | 商品信息 + 母婴标签 | ✅ goods-detail.vue 含阶段/卖点标签 | ⏳ |
| 5 | 活动列表加载 | 活动卡片列表 + 阶段筛选 | ✅ activity-list.vue 含筛选 | ⏳ |
| 6 | 活动详情加载 | 活动信息 + 报名按钮（7种状态） | ✅ activity-detail.vue 含状态逻辑 | ⏳ |

### 用户交互路径

| # | 测试路径 | 预期结果 | 代码审查 | 服务器实测 |
|---|---------|---------|---------|-----------|
| 7 | 登录 | 微信授权/手机号登录成功 | ✅ Personal 控制器含阶段保存 | ⏳ |
| 8 | 个人资料保存 | 选择备孕/孕期/产后 → 保存成功 | ✅ personal.vue 含阶段/预产期/宝宝生日 | ⏳ |
| 9 | 活动报名 | 填写姓名/手机/隐私协议 → 提交成功 | ✅ activity-signup.vue 含防重复+隐私校验 | ⏳ |
| 10 | 我的活动查看 | 报名记录显示 | ✅ my-activity.vue 含活动/报名 Tab | ⏳ |
| 11 | 邀请页打开 | 邀请海报/邀请记录 | ✅ invite.vue 含海报+记录 | ⏳ |
| 12 | 反馈提交 | 填写内容/联系方式 → 提交成功 | ✅ feedback-submit.vue | ⏳ |
| 13 | 购物车 | 加入购物车 → 购物车列表 | ✅ cart.vue 含门店隐藏 | ⏳ |
| 14 | 下单 | 生成待支付订单 | ✅ buy.vue 含无支付友好提示 | ⏳ |

### 合规拦截路径

| # | 测试路径 | 预期结果 | 代码审查 | 服务器实测 |
|---|---------|---------|---------|-----------|
| 15 | 直达钱包页面 | 路由守卫拦截 | ✅ compliance-scope.js 含 wallet 拦截 | ⏳ |
| 16 | 直达分销页面 | 路由守卫拦截 | ✅ compliance-scope.js 含 distribution 拦截 | ⏳ |
| 17 | 直达门店页面 | 路由守卫拦截 | ✅ compliance-scope.js 含 realstore 拦截 | ⏳ |
| 18 | 抓包强传 wallet 支付 | 后端返回 -403 | ✅ OrderService::Pay 含合规拦截 | ⏳ |

---

## 后台端测试路径

| # | 测试路径 | 预期结果 | 代码审查 | 服务器实测 |
|---|---------|---------|---------|-----------|
| 19 | 后台登录 | 混淆入口登录成功 | ✅ adminwlmqhs.php 入口存在 | ⏳ |
| 20 | Dashboard 加载 | 今日指标/阶段分布/运营指标正常 | ✅ DashboardService 含 SafeCount/SafeSum | ⏳ |
| 21 | 创建活动 | 填写信息 → 保存成功 | ✅ Activity 控制器含创建逻辑 | ⏳ |
| 22 | 查看报名 | 报名列表 + 姓名/手机脱敏 | ✅ MaskSignupRow + can_view_sensitive | ⏳ |
| 23 | 查看报名明文 | 有敏感权限时显示明文 + 审计日志 | ✅ CanViewSensitive + MuyingAuditLogService | ⏳ |
| 24 | 反馈管理 | 反馈列表 + 审核操作 | ✅ Feedback 控制器含审核逻辑 | ⏳ |
| 25 | 合规中心 | 资质/开关/拦截日志 | ✅ Featureswitch + ComplianceService | ⏳ |
| 26 | 尝试开启高风险功能 | 返回 403/资质不足提示 | ✅ TryToggleFeature 含资质检查 | ⏳ |
| 27 | 支付方式列表 | 不返回 WalletPay/CoinPay 等 | ✅ GetComplianceBlockedPayments | ⏳ |
| 28 | 后台启用 WalletPay | 返回 -403 | ✅ CheckPaymentEnableCompliance | ⏳ |
| 29 | 后台启用 CoinPay | 返回 -403 | ✅ CheckPaymentEnableCompliance | ⏳ |

---

## 已知阻塞问题

| # | 问题 | 严重性 | 影响 | 解决方案 | 状态 |
|---|------|--------|------|---------|------|
| 1 | 域名备案未完成 | BLOCKER | 无法配置 HTTPS 域名，小程序无法提审 | 等待备案完成 | 外部依赖 |
| 2 | 正式 AppID 未申请 | BLOCKER | 无法提交正式审核 | 备案完成后申请 | 外部依赖 |
| 3 | 微信支付未配置 | WARN | 用户只能生成待支付订单 | 一期可接受，后续对接 | 已知 |
| 4 | 服务器未部署代码 | BLOCKER | 无法运行任何实测 | 需执行部署流程 | 待执行 |

---

## 宝塔部署操作手册

以下命令可直接在宝塔服务器终端复制执行。

### 步骤 1：拉取代码

```bash
cd /www/wwwroot
git clone https://github.com/kHuner9712/xiyun.git xiyun
cd xiyun
```

### 步骤 2：配置后端 .env

```bash
cp shopxo-backend/.env.production.example shopxo-backend/.env
```

编辑 `shopxo-backend/.env`，替换以下占位符：

```ini
# 数据库配置
DATABASE.HOSTNAME = 127.0.0.1
DATABASE.DATABASE = xiyun_db          ; 改为实际数据库名
DATABASE.USERNAME = xiyun_user        ; 改为实际数据库用户（非root）
DATABASE.PASSWORD = 实际密码           ; 替换
DATABASE.PORT = 3306
DATABASE.PREFIX = sxo_

# 应用配置
APP_DEBUG = false

# 隐私加密密钥（执行下方命令生成）
# php -r "echo bin2hex(openssl_random_pseudo_bytes(32));"
MUYING_PRIVACY_KEY = 生成的64位hex密钥  ; 替换
```

### 步骤 3：配置数据库连接

```bash
cp shopxo-backend/config/database.php.example shopxo-backend/config/database.php 2>/dev/null
# 如果没有 .example，手动创建
```

### 步骤 4：创建数据库和用户

在宝塔面板 → 数据库 → 添加数据库：
- 数据库名：xiyun_db
- 用户名：xiyun_user
- 密码：自动生成或手动设置

### 步骤 5：执行数据库迁移

```bash
mysql -u xiyun_user -p xiyun_db < /www/wwwroot/xiyun/docs/muying-final-migration.sql
mysql -u xiyun_user -p xiyun_db < /www/wwwroot/xiyun/docs/sql/muying-v1-post-migration.sql
```

检查是否有 SQL 错误：
```bash
echo $?  # 0 表示成功
```

### 步骤 6：设置目录权限

```bash
cd /www/wwwroot/xiyun
chmod -R 755 shopxo-backend/runtime
chown -R www:www shopxo-backend/runtime
chmod -R 755 shopxo-backend/public/upload 2>/dev/null
mkdir -p shopxo-backend/public/upload
chown -R www:www shopxo-backend/public/upload
```

### 步骤 7：配置 Nginx 网站

在宝塔面板 → 网站 → 添加站点：
- 域名：实际域名或 IP
- 根目录：`/www/wwwroot/xiyun/shopxo-backend/public`
- PHP 版本：PHP-81
- 伪静态：选择 `thinkphp`

Nginx 配置中增加安全规则（宝塔 → 网站 → 设置 → 配置文件）：

```nginx
# 禁止访问敏感文件
location ~* ^/(\.env|runtime/|\.git/) {
    deny all;
    return 404;
}

# 禁止访问 .php 的备份文件
location ~* \.php\.bak {
    deny all;
}
```

### 步骤 8：安装 Composer 依赖

```bash
cd /www/wwwroot/xiyun/shopxo-backend
php /usr/bin/composer install --no-dev --optimize-autoloader
```

### 步骤 9：运行检查脚本

```bash
cd /www/wwwroot/xiyun

php scripts/preflight/check-baota-runtime.php --root=/www/wwwroot/xiyun/shopxo-backend
php scripts/preflight/check-db-schema.php --root=/www/wwwroot/xiyun/shopxo-backend
php scripts/preflight/preflight-production-check.php --env=/www/wwwroot/xiyun/shopxo-backend/.env --repo=/www/wwwroot/xiyun
php scripts/preflight/check-doc-consistency.php --root=/www/wwwroot/xiyun
```

### 步骤 10：执行敏感数据迁移

```bash
# 先 dry-run
php scripts/migrate-encrypt-sensitive.php --dry-run

# 确认无误后正式执行
php scripts/migrate-encrypt-sensitive.php --force
```

### 步骤 11：删除安装入口

```bash
rm -f /www/wwwroot/xiyun/shopxo-backend/public/install.php
```

### 步骤 12：小程序联调

1. HBuilderX 打开 `shopxo-uniapp`
2. 配置 `.env.development`：
   ```ini
   VITE_APP_API_URL=http://服务器IP:端口
   VITE_APP_APPID=wxda7779770f53e901
   ```
3. 运行到微信开发者工具
4. 逐条验证测试路径

---

## 测试结论

> **三个状态必须严格区分，不可混用：**
> 1. ✅ **代码审查通过** — 基于本地代码审查 + 静态分析，当前已完成
> 2. ⏳ **服务器 UAT 通过** — 需在宝塔服务器真实部署后执行，当前未完成
> 3. ⏳ **微信体验版通过** — 需域名备案 + 正式 AppID 后提审，当前未完成

| 决策项 | 结论 |
|--------|------|
| 代码审查 | ✅ 全部通过（27/27 条路径代码审查通过） |
| 本地安全检查 | ✅ .gitignore 正确，无密钥泄露风险 |
| 服务器 UAT | ⏳ **未执行**（需运维人员在宝塔服务器操作） |
| 微信体验版 | ⏳ **未执行**（依赖域名备案 + 正式 AppID） |
| 是否可进入体验版测试 | ⏳ 代码层面可部署，**但需先完成服务器部署和真实 UAT** |
| 是否可等待备案完成后准备正式提审 | ⏳ 代码已就绪，但**需先完成服务器 UAT + 体验版测试** |

### 代码审查通过项统计

| 类别 | 代码审查通过 | 服务器实测 |
|------|------------|-----------|
| 前置检查 | 7 | 0（全部待执行） |
| 小程序浏览路径 | 6 | 0（全部待执行） |
| 小程序交互路径 | 8 | 0（全部待执行） |
| 合规拦截路径 | 4 | 0（全部待执行） |
| 后台端路径 | 11 | 0（全部待执行） |
| **合计** | **36** | **0** |

### 阻塞问题统计

| 严重性 | 数量 | 说明 |
|--------|------|------|
| BLOCKER | 3 | 域名备案 + 正式AppID + 服务器部署 |
| WARN | 1 | 微信支付未配置（一期可接受） |

---

## 真实 UAT 回填区

> 以下内容需运维人员在宝塔服务器完成部署和实测后回填。全部"⏳ 待执行"变为"✅ 已通过"后，方可进入微信体验版测试。

### 服务器部署信息

| 项目 | 值 |
|------|---|
| 服务器执行时间 | ⏳ 待回填 |
| 执行人 | ⏳ 待回填 |
| 服务器路径 | ⏳ 待回填 |
| 代码版本（部署后 git log） | ⏳ 待回填 |

### 服务器预检结果

| 检查项 | 结果 | 备注 |
|--------|------|------|
| check-baota-runtime 结果 | ⏳ 待执行 | 0 BLOCKER 方可通过 |
| check-db-schema 结果 | ⏳ 待执行 | 0 BLOCKER 方可通过 |
| preflight-production-check 结果 | ⏳ 待执行 | 0 BLOCKER 方可通过 |
| 数据库迁移执行结果 | ⏳ 待执行 | 无 SQL 错误 |
| MUYING_PRIVACY_KEY 已配置 | ⏳ 待确认 | 64 位 hex 密钥 |
| APP_DEBUG = false | ⏳ 待确认 | |
| 功能开关已正确配置 | ⏳ 待确认 | 一期开启/高风险关闭 |
| 敏感数据迁移已完成 | ⏳ 待执行 | migrate-encrypt-sensitive.php --force |

### 小程序联调结果

| 测试路径 | 结果 | 备注 |
|----------|------|------|
| 小程序启动 | ⏳ 待执行 | |
| 首页加载 | ⏳ 待执行 | |
| 商品浏览 | ⏳ 待执行 | |
| 活动报名 | ⏳ 待执行 | |
| 登录/个人资料 | ⏳ 待执行 | |
| 购物车/下单 | ⏳ 待执行 | |
| 邀请有礼 | ⏳ 待执行 | |
| 反馈提交 | ⏳ 待执行 | |
| 合规拦截验证 | ⏳ 待执行 | |

### 后台联调结果

| 测试路径 | 结果 | 备注 |
|----------|------|------|
| 后台登录 | ⏳ 待执行 | |
| Dashboard | ⏳ 待执行 | |
| 活动/报名管理 | ⏳ 待执行 | |
| 商品管理 | ⏳ 待执行 | |
| 用户管理 | ⏳ 待执行 | |
| 反馈管理 | ⏳ 待执行 | |
| 合规中心 | ⏳ 待执行 | |
| 隐私数据管理 | ⏳ 待执行 | |
| 内容合规管理 | ⏳ 待执行 | |

### 阻塞问题列表

| # | 问题描述 | 严重性 | 解决方案 | 状态 |
|---|---------|--------|---------|------|
| ⏳ | （待服务器实测后回填） | | | |

### 是否允许进入体验版测试

| 决策 | 结论 |
|------|------|
| 服务器 UAT 是否通过 | ⏳ 待确认 |
| 是否允许进入体验版测试 | ⏳ 待确认（需服务器 UAT 通过后） |
| 签署人 | ⏳ 待签署 |
