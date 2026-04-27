# 孕禧母婴商城 — 一期合规整改报告

> 分支：`review-remediation-phase1`
> 日期：2026-04-26
> 版本：V1.0.0

---

## 1. 整改目标

孕禧母婴商城基于 ShopXO + uni-app 构建，一期提审微信小程序需满足以下合规要求：

- 不暴露未准备好的高风险功能（支付、分销、钱包、积分、优惠券、会员、直播、医院等）
- 不触碰医疗诊疗、互联网医院、药械销售等敏感边界
- 隐私授权合规，活动报名"必需信息"与"同步画像"独立授权
- 生产构建安全，不使用测试号 AppID、HTTP、localhost
- 前后端双重门禁，服务端不返回、前端不展示、直接访问被拦截

---

## 2. 已完成任务

| # | 任务 | Commit 数 | 状态 |
|---|------|----------|------|
| 1 | 统一合规配置（MuyingComplianceService + feature flags + 资质门禁） | 5 | ✅ |
| 2 | pages.json 瘦身（移除高风险页面、清理组件引用、导航门禁） | 2 | ✅ |
| 3 | 活动报名隐私授权拆分（必需信息/同步画像独立勾选） | 2 | ✅ |
| 4 | 生产环境构建配置加固（runtime-config 门禁 + env 模板） | 2 | ✅ |
| 5 | 菜单过滤（前后端双重过滤一期关闭功能） | 1 | ✅ |
| 6 | 支付链路降级（feature_payment_enabled 门禁） | 1 | ✅ |
| 7 | 医疗内容合规（免责声明 + 敏感词 + 禁止分类） | 1 | ✅ |
| 8 | 提审前自检清单 + 自动化脚本 | 1 | ✅ |

---

## 3. 修改文件列表

### 后端（15 个文件）

| 文件 | 改动说明 |
|------|---------|
| `app/service/MuyingComplianceService.php` | 核心合规服务：feature flag、资质门禁、导航过滤、支付门禁 |
| `app/service/MuyingContentComplianceService.php` | 内容合规：敏感词、禁止分类、免责声明 |
| `app/service/SystemBaseService.php` | 系统配置输出：feature flags、资质、免责声明、禁止分类 |
| `app/service/AppCenterNavService.php` | 用户中心导航：合规过滤 |
| `app/service/AppHomeNavService.php` | 首页导航：合规过滤 |
| `app/service/QuickNavService.php` | 快捷导航：合规过滤 |
| `app/service/PluginsService.php` | 插件排序：合规过滤 |
| `app/service/DiyApiService.php` | DIY 配置：移除"我的积分"入口 |
| `app/module/LayoutModule.php` | 布局模块：移除积分 URL 映射 |
| `app/api/controller/Buy.php` | 下单：支付门禁 |
| `app/api/controller/Cashier.php` | 收银台：支付门禁 |
| `app/api/controller/Order.php` | 订单支付：支付门禁 |
| `app/api/controller/Paylog.php` | 支付日志：支付门禁 |
| `app/api/controller/Common.php` | API 层：插件-feature flag 映射 |
| `app/admin/controller/Article.php` | 后台文章：分类校验 + 内容合规扫描 |
| `app/admin/controller/Activity.php` | 后台活动：分类校验 + 内容合规扫描 |

### 前端（13 个文件）

| 文件 | 改动说明 |
|------|---------|
| `common/js/config/compliance-scope.js` | 合规核心：白名单路由、插件黑名单、路由守卫、支付路由控制 |
| `common/js/config/muying-constants.js` | 常量：FeatureFlagKey、QualificationKey、TipMessage |
| `common/js/config/runtime-config.js` | 环境配置：HTTPS/测试号/localhost 门禁 |
| `common/js/http.js` | HTTP 拦截：feature flag + 插件权限 + cashier/paylog 映射 |
| `App.vue` | 全局：路由拦截器、feature flag 初始化、资质初始化 |
| `pages.json` | 瘦身：移除高风险页面、仅保留 brand/express/delivery 子包 |
| `pages/user/user.vue` | 用户中心：移除积分入口、导航合规过滤 |
| `pages/buy/buy.vue` | 下单页：支付门禁、支付未配置提示 |
| `pages/activity-detail/activity-detail.vue` | 活动详情：免责声明 |
| `pages/article-detail/article-detail.vue` | 文章详情：免责声明 |
| `pages/activity-signup/activity-signup.vue` | 活动报名：隐私授权拆分 |
| `components/payment/payment.vue` | 支付组件：支付门禁、钱包支付拦截 |
| `pages/diy/components/diy/user-info.vue` | DIY 用户信息：移除积分统计项 |

### 文档与脚本（4 个文件）

| 文件 | 说明 |
|------|------|
| `docs/wechat-review-checklist.md` | 提审前自检清单（10 大类 50+ 项） |
| `scripts/check-phase1-release.js` | 自动化自检脚本（6 大检查模块） |
| `docs/sql/muying-activity-signup-privacy-split-migration.sql` | 隐私授权拆分迁移 |
| `deploy/nginx.production.example.conf` | Nginx 安全配置 |

---

## 4. 关闭功能列表

### 永久屏蔽（PERMANENTLY_BLOCKED_PLUGINS）

| 插件 | 说明 |
|------|------|
| excellentbuyreturntocash | 退款到现金 |
| exchangerate | 汇率 |
| goodscompare | 商品对比 |
| orderfeed | 订单动态 |
| ordergoodsform | 订单商品表单 |
| orderresources | 订单资源 |
| antifakecode | 防伪码 |
| form | 表单 |
| binding | 绑定 |
| label | 标签 |

### 一期屏蔽（PHASE_ONE_BLOCKED_PLUGINS，默认关闭，feature flag 控制）

| 插件 | Feature Flag | 默认值 | 需要资质 |
|------|-------------|--------|---------|
| distribution | feature_distribution_enabled | 0 | — |
| wallet | feature_wallet_enabled | 0 | — |
| coin | feature_coin_enabled | 0 | — |
| shop | feature_shop_enabled | 0 | — |
| realstore | feature_realstore_enabled | 0 | — |
| ask | feature_ugc_enabled | 0 | — |
| blog | feature_ugc_enabled | 0 | — |
| membershiplevelvip | feature_membership_enabled | 0 | — |
| seckill | feature_seckill_enabled | 0 | — |
| video | feature_video_enabled | 0 | — |
| hospital | feature_hospital_enabled | 0 | qualification_medical |
| giftcard | feature_giftcard_enabled | 0 | — |
| givegift | feature_givegift_enabled | 0 | — |
| complaint | feature_complaint_enabled | 0 | — |
| invoice | feature_invoice_enabled | 0 | — |
| certificate | feature_certificate_enabled | 0 | — |
| scanpay | feature_scanpay_enabled | 0 | — |
| weixinliveplayer | feature_live_enabled | 0 | qualification_live |
| intellectstools | feature_intellectstools_enabled | 0 | — |
| coupon | feature_coupon_enabled | 0 | — |
| signin | feature_signin_enabled | 0 | — |
| points | feature_points_enabled | 0 | — |

### 一期屏蔽的系统功能

| 功能 | Feature Flag | 默认值 | 说明 |
|------|-------------|--------|------|
| 线上支付 | feature_payment_enabled | 0 | 收银台/订单支付/支付日志全部门禁 |
| 我的积分（系统页面） | — | — | user.vue 移除入口，DiyApiService 移除 |
| 积分抵扣 | feature_points_enabled | 0 | PaymentService 合规屏蔽 |
| 钱包支付 | feature_wallet_enabled | 0 | PaymentService 合规屏蔽 |
| 优惠券抵扣 | feature_coupon_enabled | 0 | PaymentService 合规屏蔽 |
| 扫码支付 | feature_scanpay_enabled | 0 | PaymentService 合规屏蔽 |

---

## 5. 保留功能列表

### 一期核心功能

| 功能 | Feature Flag | 默认值 | 说明 |
|------|-------------|--------|------|
| 活动列表/详情/报名 | feature_activity_enabled | 1 | 核心功能 |
| 邀请留资 | feature_invite_enabled | 1 | 核心功能 |
| 文章/内容 | feature_content_enabled | 1 | 核心功能 |
| 意见反馈 | feature_feedback_enabled | 1 | 核心功能 |
| 商品浏览/搜索/详情 | — | — | 基础功能 |
| 购物车 | — | — | 保留，支付门禁 |
| 下单（待支付） | — | — | 保留，payment_id=0 |
| 用户中心 | — | — | 保留，移除高风险入口 |
| 个人资料 | — | — | 保留 |
| 收货地址 | — | — | 保留 |
| 我的收藏 | — | — | 保留 |
| 浏览记录 | — | — | 保留 |
| 我的订单 | — | — | 保留 |
| 意见反馈 | — | — | 保留 |
| 关于我们 | — | — | 保留 |
| 协议与隐私 | — | — | 保留 |

### 一期允许的插件

| 插件 | Feature Flag | 说明 |
|------|-------------|------|
| brand | — | 品牌专区 |
| express | — | 物流查询 |
| delivery | — | 配送方式 |

---

## 6. 前后端 Feature Flag 说明

### 后端 Feature Flag 体系

```
MuyingComplianceService::GetAllFeatureFlags()
  → 读取 MyC('feature_xxx_enabled', 默认值)
  → 通过 SystemBaseService::Common() 下发给前端
  → 前端存储到 app.globalData.feature_flags
```

### 前端 Feature Flag 体系

```
compliance-scope.js
  → is_feature_enabled(flag_key) 读取 app.globalData.feature_flags
  → filter_navigation() 过滤导航项
  → filter_plugin_sort_list() 过滤插件列表
  → is_route_allowed() 路由白名单 + feature flag 判断
  → is_plugin_allowed() 插件白名单 + feature flag + 资质判断
```

### 门禁层级

```
第1层：pages.json 白名单 → 高风险页面未注册
第2层：后端合规过滤 → API 不返回高风险菜单/插件数据
第3层：前端 filter → 二次过滤服务端数据
第4层：前端路由守卫 → uni.addInterceptor 拦截跳转
第5层：前端 HTTP 拦截 → feature flag + 插件权限检查
第6层：前端组件门禁 → payment.vue / buy.vue 入口拦截
第7层：后端控制器门禁 → Cashier/PayLog/Order::Pay 返回 -403
```

### 资质体系

| 资质 Key | 名称 | 影响插件 |
|----------|------|---------|
| qualification_icp_commercial | ICP 经营许可证 | — |
| qualification_edi | EDI 许可证 | shop/realstore |
| qualification_medical | 医疗机构执业许可证 | hospital |
| qualification_live | 网络文化经营许可证 | weixinliveplayer |
| qualification_payment | 支付资质 | — |

---

## 7. 数据库变更说明

### 需要执行的迁移脚本

按顺序执行：

```bash
1. docs/sql/muying-migration.sql              # 基础表结构
2. docs/sql/muying-mvp-migration.sql           # MVP 字段
3. docs/sql/muying-feature-switch-migration.sql # 功能开关配置
4. docs/sql/muying-goods-compliance-migration.sql # 商品合规
5. docs/sql/muying-content-compliance-migration.sql # 内容合规
6. docs/sql/muying-privacy-power-migration.sql  # 隐私权限
7. docs/sql/muying-privacy-security-migration.sql # 隐私安全
8. docs/sql/muying-sensitive-permission-migration.sql # 敏感权限
9. docs/sql/muying-compliance-center-migration.sql # 合规中心
10. docs/sql/muying-activity-signup-privacy-split-migration.sql # 隐私授权拆分
11. docs/sql/muying-feedback-type-migration.sql # 反馈类型
12. docs/sql/yunxi-init-config.sql             # 初始配置数据
13. docs/sql/yunxi-init-activity-demo.sql      # 活动演示数据
14. docs/sql/yunxi-init-feedback-demo.sql      # 反馈演示数据
```

### 关键数据表

| 表名 | 用途 |
|------|------|
| muying_feature_switch | 功能开关配置 |
| muying_qualification | 资质状态 |
| muying_content_sensitive_word | 内容敏感词 |
| muying_content_compliance_log | 内容合规日志 |
| muying_goods_risk_category | 商品风险分类 |
| muying_privacy_consent | 隐私授权记录 |

---

## 8. 部署注意事项

### 8.1 必须删除的文件

- `shopxo-backend/public/install.php` — 安装入口，提审前必须删除

### 8.2 必须重命名的文件

- `shopxo-backend/public/admin.php` — 后台入口，改为非默认名称

### 8.3 必须配置的环境变量

```bash
# 前端 .env.production
UNI_APP_ENV=production
UNI_APP_REQUEST_URL=https://备案域名/
UNI_APP_WX_APPID=正式AppID

# 后端 .env
APP_DEBUG=false
```

### 8.4 Nginx 安全配置

参考 `deploy/nginx.production.example.conf`，必须屏蔽：
- `/.git/` 目录
- `/.env` 文件
- `/vendor/` 目录
- `/public/install.php`

### 8.5 后台合规中心配置

部署后登录后台 → 合规中心，确认：
- 所有一期屏蔽功能开关为 `0`
- 资质状态正确填写
- 内容敏感词列表完整

### 8.6 缓存清理

部署后必须清理后端缓存：
```bash
php think clear
```

导航数据有 180 秒缓存，修改 feature flag 后需等待或手动清理。

---

## 9. 提审前人工完成事项

以下事项脚本无法自动完成，需人工确认：

| # | 事项 | 说明 | 状态 |
|---|------|------|------|
| 1 | 正式 AppID | 在微信公众平台申请，配置到 `.env.production` 和 `project.config.json` | ☐ |
| 2 | 域名 ICP 备案 | 域名通过管局审核 | ☐ |
| 3 | 微信合法域名 | 微信公众平台 → 开发设置 → 服务器域名 | ☐ |
| 4 | SSL 证书 | HTTPS 正常访问，证书未过期 | ☐ |
| 5 | 微信服务类目 | 选择"商业服务→电商"或"生活服务→母婴" | ☐ |
| 6 | 隐私协议文本 | 后台 → 协议管理，确认隐私政策和用户协议内容 | ☐ |
| 7 | 隐私保护指引 | 微信公众平台 → 隐私与安全，填写并提交 | ☐ |
| 8 | 删除 install.php | `rm shopxo-backend/public/install.php` | ☐ |
| 9 | 重命名 admin.php | 改为非默认名称 | ☐ |
| 10 | 修改管理员密码 | 非 admin/admin 默认密码 | ☐ |
| 11 | phpMyAdmin 不公网开放 | Nginx 配置 deny 或仅内网访问 | ☐ |
| 12 | 数据库不公网开放 | 3306 端口仅内网监听 | ☐ |
| 13 | 真机测试 | 按联调路径逐项验证 | ☐ |
| 14 | 微信支付商户号 | 如需开放支付，需完成商户号配置 | ☐ |

---

## 10. 联调路径检查清单

| # | 路径 | 预期结果 | 验证方式 |
|---|------|---------|---------|
| 1 | 首页 | 正常展示，无高风险导航 | 真机访问 |
| 2 | 商品分类 | 正常展示 | 真机访问 |
| 3 | 商品详情 | 正常展示，加购不报错 | 真机访问 |
| 4 | 活动列表 | 正常展示 | 真机访问 |
| 5 | 活动详情 | 正常展示，底部有免责声明 | 真机访问 |
| 6 | 登录流程 | 不白屏，正常登录 | 真机测试 |
| 7 | 活动报名提交 | 隐私授权两个勾选独立 | 真机测试 |
| 8 | 我的活动 | 正常查看已报名活动 | 真机访问 |
| 9 | 个人资料 | 正常查看和编辑 | 真机访问 |
| 10 | 意见反馈 | 正常打开和提交 | 真机访问 |
| 11 | 协议与隐私 | 正常打开 | 真机访问 |
| 12 | 高风险功能直接访问 | 路由守卫拦截，提示"暂未开放" | 手动输入路径 |
| 13 | 购物车 | 正常展示，支付入口提示"暂未开放" | 真机访问 |
| 14 | 文章详情 | 正常展示，底部有免责声明 | 真机访问 |

---

## 11. 自检脚本运行结果

```bash
$ node scripts/check-phase1-release.js

  PASS: 11  WARN: 3  BLOCKER: 1  总计: 15

  BLOCKER: public/install.php 仍存在（提审前必须删除）
  WARN: manifest.json mp-weixin.appid 为空（构建时由 .env.production 注入）
  WARN: project.config.json appid 为空
  WARN: shopxo-backend/.env.example:15 可能包含真实密钥（实际为中文提示）
```

BLOCKER 需部署时处理，WARN 为预期行为。

---

## 12. 回滚思路

如需回退到整改前状态：

1. 合规配置回退：后台 → 合规中心 → 将需要的功能开关设为 `1`
2. 支付恢复：`feature_payment_enabled = 1` + 配置微信支付商户号
3. 导航恢复：feature flag 打开后，后端导航过滤自动放行
4. 路由恢复：前端路由守卫根据 feature flag 动态判断，无需改代码

所有门禁均为"开关控制"，不破坏原有功能，打开开关即可恢复。
