# Release Notes — v0.1.0-rc1

> 孕禧母婴自营商城一期  
> 发布日期：2026-04-25  
> 仓库：https://github.com/kHuner9712/xiyun  
> 分支：trae/phase-one-rc-handoff

---

## 概述

孕禧母婴自营商城一期 RC1 版本。本版本为首个可交付候选版本，代码层面已封板，体验版可立即部署。提审需等待正式 AppID 和备案域名。

---

## 功能亮点

### 🛒 母婴自营商城
- 品牌自营商品浏览、分类筛选、商品详情
- 购物车、下单、支付流程（支付需商户号配置）
- 支付未配置时友好提示"当前为体验版/支付未开通"

### 📋 官方活动报名
- 活动列表（支持阶段筛选）、活动详情
- 在线报名、候补、取消报名
- 活动签到核销（后台操作）
- 重复报名拦截

### 👤 基础会员画像
- 孕育阶段设置：备孕 / 孕期 / 产后
- 孕期阶段填写预产期
- 产后阶段填写宝宝生日，自动计算月龄
- 阶段切换时自动清理不相关字段
- 首页阶段引导弹窗（非强制阻断）

### 🔗 一级邀请裂变
- 邀请码自动生成（8 位大写字母数字）
- 分享链接邀请注册
- 首单奖励积分自动发放
- 后台邀请奖励配置、补发、撤销

### 💬 审核制妈妈说/反馈
- 用户提交文字+图片反馈
- 后台审核（通过/拒绝）
- 敏感词拦截
- 前端展示审核通过的反馈

### 🛡️ 合规中心
- 隐私数据 AES-256-CBC 加密存储
- 敏感信息脱敏展示
- 资质门禁（一期宽松模式）
- 功能开关中心（5 个核心开关）
- 导出审计日志

### 📊 后台数据看板
- 6 大分区：交易、用户、活动、邀请、反馈、商品
- 25+ 核心指标，含口径说明
- 时间范围筛选：今日/昨日/近7天/近30天/自定义
- 空数据兼容（无数据时显示 0，不报错）

### 🏠 首页阶段推荐
- 阶段 Tab：为我推荐 / 备孕 / 孕期 / 产后 / 通用
- 按用户阶段自动推荐商品、活动、内容
- 未登录用户可浏览通用内容

### 🔒 功能开关中心
- 5 个核心开关：activity / invite / feedback / content / coupon
- 前后端双重拦截（API 守卫 + UI 控制 + 路由拦截）
- 10+ 禁用功能前后端双重拦截

---

## 合规边界

| 边界 | 说明 |
|------|------|
| 仅自营商品 | 不支持第三方商家入驻 |
| 仅一级邀请 | 不支持多级分销 |
| 审核制反馈 | 非 UGC 公开社区 |
| 无医疗问诊 | hospital 插件已关闭 |
| 无直播/视频 | weixinliveplayer/video 插件已关闭 |
| 无钱包/提现 | wallet/coin 插件已关闭 |
| 无付费会员 | membershiplevelvip 插件已关闭 |
| 无礼品卡 | giftcard/givegift 插件已关闭 |
| 无多门店 | realstore 插件已关闭 |

---

## 部署步骤

### 后端部署

1. 宝塔创建网站 + MySQL 数据库（utf8mb4）
2. `git clone https://github.com/kHuner9712/xiyun.git` → 复制到站点目录
3. `cp .env.production.example .env` → 填入数据库连接
4. 按顺序执行 6 个 SQL 迁移文件
5. `composer install --no-dev --optimize-autoloader`
6. `bash scripts/deploy/fix-permissions.sh /www/wwwroot/yunxi-api`
7. Nginx 配置参照 `deploy/nginx.production.example.conf`

### 前端构建

1. 编辑 `shopxo-uniapp/manifest.json` → 填入 AppID
2. 编辑 `shopxo-uniapp/project.config.json` → 填入 AppID
3. 创建 `shopxo-uniapp/.env.production` → 填入 API 地址和 AppID
4. HBuilderX → 发行 → 小程序-微信
5. 微信开发者工具导入编译产物 → 上传

### 验证

```bash
bash scripts/preflight/preflight-production-check.sh --env /www/wwwroot/yunxi/.env --repo /path/to/repo
```

---

## 已知限制

| 限制 | 影响 | 缓解 |
|------|------|------|
| 支付功能需商户号 | 体验版无法真实支付 | 支付未配置时显示友好提示 |
| 提审需备案域名+正式 AppID | 无法立即提审 | 体验版可用测试号+IP |
| 120+ 插件页面未注册 | 不可导航到这些页面 | 路由守卫已拦截 |
| 15+ 用户页面缺少显式登录检查 | 可能短暂空白再跳转 | API 层 is_login_check 兜底 |
| CheckFeatureEnabled 使用 exit() | 不利于单元测试 | 二期改为异常抛出 |

---

## 回滚方式

```bash
# 1. 数据库回滚
mysql -u USER -p DB < backup_before_deploy.sql

# 2. 代码回滚
cd /www/wwwroot/yunxi-api
git log --oneline -5
git reset --hard <commit_hash>
composer install --no-dev
bash scripts/deploy/fix-permissions.sh /www/wwwroot/yunxi-api

# 3. 前端回滚
# 在微信公众平台"版本管理"中选择上一版本回退
```

---

## 技术栈

| 组件 | 版本 |
|------|------|
| 后端框架 | ThinkPHP 6 (ShopXO 二开) |
| 前端框架 | uni-app (微信小程序) |
| PHP | 8.1.x |
| MySQL | 5.7+ |
| Nginx | 1.20+ |

---

## 文档索引

| 文档 | 路径 |
|------|------|
| RC 封板报告 | [docs/release/rc-gate-report.md](rc-gate-report.md) |
| 数据库迁移顺序 | [docs/release/db-migration-order.md](db-migration-order.md) |
| 体验版上线清单 | [docs/release/experience-version-launch-checklist.md](experience-version-launch-checklist.md) |
| 提审材料清单 | [docs/release/submission-materials-checklist.md](submission-materials-checklist.md) |
| UAT 验收清单 | [docs/release/uat-final-checklist.md](uat-final-checklist.md) |
| 上线前配置清单 | [docs/release/pre-launch-config-checklist.md](pre-launch-config-checklist.md) |
| 提审切换 Runbook | [docs/release/submit-switch-runbook.md](submit-switch-runbook.md) |
| 体验版部署 Runbook | [docs/release/experience-deploy-runbook.md](experience-deploy-runbook.md) |
| 一期允许功能范围 | [docs/compliance/phase-one-scope.md](../compliance/phase-one-scope.md) |
| 一期禁用功能清单 | [docs/compliance/disabled-features.md](../compliance/disabled-features.md) |
| 隐私数据映射表 | [docs/compliance/privacy-data-map.md](../compliance/privacy-data-map.md) |
| 数据看板指标口径 | [docs/release/dashboard-metrics-spec.md](dashboard-metrics-spec.md) |
| 文档总索引 | [docs/yunxi-docs-index.md](../yunxi-docs-index.md) |
