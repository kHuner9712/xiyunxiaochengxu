# PR 合并前风险审查 — review-remediation-phase1

> 审查时间：2026-04-28
> 审查目标：确认合规门禁不会误杀核心链路

---

## 1. 检查项

### 1.1 核心链路页面是否被 feature flag 误杀

| # | 核心链路 | 前端路由 | 后端控制器 | 是否在白名单 | 是否被拦截 | 结论 |
|---|----------|----------|------------|-------------|-----------|------|
| 1 | 首页 | /pages/index/index | — | ✅ PHASE_ONE_ALLOWED_ROUTES | 否 | ✅ 安全 |
| 2 | 商品分类 | /pages/goods-category/goods-category | — | ✅ PHASE_ONE_ALLOWED_ROUTES | 否 | ✅ 安全 |
| 3 | 商品详情 | /pages/goods-detail/goods-detail | — | ✅ PHASE_ONE_ALLOWED_ROUTES | 否 | ✅ 安全 |
| 4 | 购物车 | /pages/cart/cart | — | ✅ PHASE_ONE_ALLOWED_ROUTES | 否 | ✅ 安全 |
| 5 | 下单页 buy/index | /pages/buy/buy | Buy::Index | ✅ PHASE_ONE_ALLOWED_ROUTES | 否 | ✅ 安全 |
| 6 | 待支付订单创建 buy/add | /pages/buy/buy | Buy::Add | ✅ PHASE_ONE_ALLOWED_ROUTES | 否 | ✅ 安全 |
| 7 | 活动列表 | /pages/activity/activity | Activity | ✅ PHASE_ONE_ALLOWED_ROUTES | 受 feature_activity_enabled 控制 | ✅ 预期 |
| 8 | 活动详情 | /pages/activity-detail/activity-detail | Activity | ✅ PHASE_ONE_ALLOWED_ROUTES | 受 feature_activity_enabled 控制 | ✅ 预期 |
| 9 | 活动报名 | /pages/activity-signup/activity-signup | Activity | ✅ PHASE_ONE_ALLOWED_ROUTES | 受 feature_activity_enabled 控制 | ✅ 预期 |
| 10 | 我的活动 | /pages/my-activity/my-activity | Activity | ✅ PHASE_ONE_ALLOWED_ROUTES | 受 feature_activity_enabled 控制 | ✅ 预期 |
| 11 | 个人资料 | /pages/personal/personal | — | ✅ PHASE_ONE_ALLOWED_ROUTES | 否 | ✅ 安全 |
| 12 | 意见反馈 | /pages/feedback-submit/feedback-submit | Feedback | ✅ PHASE_ONE_ALLOWED_ROUTES | 受 feature_feedback_enabled 控制 | ✅ 预期 |
| 13 | 用户协议 | /pages/agreement/agreement | — | ✅ PHASE_ONE_ALLOWED_ROUTES | 否 | ✅ 安全 |
| 14 | 隐私政策 | /pages/agreement/agreement | — | ✅ PHASE_ONE_ALLOWED_ROUTES | 否 | ✅ 安全 |

### 1.2 Common.php 集中拦截是否误杀非高风险 controller

`$CONTROLLER_FEATURE_MAP` 中注册的控制器：

| 控制器 | 映射开关 | 是否高风险 | 是否误杀风险 |
|--------|----------|-----------|-------------|
| activity | feature_activity_enabled | 否（一期核心） | ✅ 无 — 一期应开启 |
| article | feature_content_enabled | 否（一期核心） | ✅ 无 — 一期应开启 |
| feedback | feature_feedback_enabled | 否（一期核心） | ✅ 无 — 一期应开启 |
| invite | feature_invite_enabled | 否（一期核心） | ✅ 无 — 一期应开启 |
| muyinguser | feature_membership_enabled | 否（一期核心） | ✅ 无 — 一期应开启 |
| userintegral | feature_points_enabled | 是（一期关闭） | ✅ 无 — 积分非核心链路 |
| coupon | feature_coupon_enabled | 是（一期关闭） | ✅ 无 — 优惠券非核心链路 |
| cashier | feature_payment_enabled | 是（一期关闭） | ✅ 无 — 收银台全部 action 需支付 |
| paylog | feature_payment_enabled | 是（一期关闭） | ✅ 无 — 支付日志全部 action 需支付 |
| forminput | feature_dynamic_page_enabled | 是（一期关闭） | ✅ 无 — 表单页面不可直达 |
| diy | feature_dynamic_page_enabled | 是（一期关闭） | ✅ 无 — DIY 页面不可直达 |
| design | feature_dynamic_page_enabled | 是（一期关闭） | ✅ 无 — 设计页面不可直达 |
| 其他 20+ | 各自开关 | 是（一期关闭） | ✅ 无 — 均为高风险插件 |

**关键发现**：`buy`、`order`、`goods`、`search`、`user`、`index` 等核心控制器均不在 `$CONTROLLER_FEATURE_MAP` 中，不会被 controller-level 拦截。✅ 安全。

### 1.3 feature_dynamic_page_enabled 关闭时，首页 DIY 组件是否仍能展示

**结论：✅ 安全**

首页 `index.vue` 通过组件引用方式加载 DIY：
```javascript
import componentDiy from '@/pages/diy/components/diy/diy';
```

这是 Vue 组件引用，不是路由跳转。`feature_dynamic_page_enabled` 拦截的是 `navigateTo('/pages/diy/diy')` 路由跳转，不影响组件引用。首页 DIY 组件正常加载和渲染。

### 1.4 feature_payment_enabled 关闭时，购物车和下单页是否仍可展示

**结论：✅ 安全**

| 页面 | 前端路由 | 后端 API | 行为 |
|------|----------|----------|------|
| 购物车 | /pages/cart/cart | — | 正常展示，门店/医院组件被 feature flag 隐藏 |
| 下单页 | /pages/buy/buy | Buy::Index | 正常展示，支付方式列表为空，提示"线上支付暂未开放" |
| 提交订单 | /pages/buy/buy | Buy::Add | 允许提交，payment_id 强制为 0（待支付订单） |
| 支付 | — | Order::Pay | 后端 action-level 拦截，返回 -403 |
| 收银台 | /pages/cashier/cashier | Cashier::PayData | 前端页面重定向到错误页，后端 controller-level 拦截 |

### 1.5 order/detail、order/list 是否不会被支付门禁误杀

**结论：✅ 安全**

- `order` 控制器不在 `$CONTROLLER_FEATURE_MAP` 中
- `$PAYMENT_REQUIRED_ACTIONS` 只拦截 `order/pay` 和 `order/paycheck`
- `order/index`、`order/detail`、`order/cancel`、`order/collect`、`order/delete`、`order/comments`、`order/commentssave` 均不受影响

### 1.6 order/pay、cashier/paydata、paylog/index 是否被正确拦截

**结论：✅ 正确拦截**

| API | 拦截方式 | 拦截层级 |
|-----|----------|---------|
| Order::Pay | action-level（$PAYMENT_REQUIRED_ACTIONS） | CommonInit → AssertPaymentEnabledForAction |
| Order::PayCheck | action-level（$PAYMENT_REQUIRED_ACTIONS） | CommonInit → AssertPaymentEnabledForAction |
| Cashier::PayData | controller-level + action-level 双重 | $CONTROLLER_FEATURE_MAP + $PAYMENT_REQUIRED_ACTIONS + 方法内 CheckPaymentEnabled |
| PayLog::Index | controller-level + action-level 双重 | $CONTROLLER_FEATURE_MAP + $PAYMENT_REQUIRED_ACTIONS + 方法内 CheckPaymentEnabled |
| PayLog::Detail | controller-level + action-level 双重 | $CONTROLLER_FEATURE_MAP + $PAYMENT_REQUIRED_ACTIONS + 方法内 CheckPaymentEnabled |

### 1.7 form-input 作为组件引用时是否受 route 关闭影响

**结论：✅ 安全**

`buy.vue` 和 `goods-detail.vue` 通过组件引用 `form-input-base`：
```javascript
import componentFormInputBase from '@/pages/form-input/components/form-input/form-input-base';
```

这是 Vue 组件引用，不是路由跳转。`feature_dynamic_page_enabled` 拦截的是 `navigateTo('/pages/form-input/form-input')` 路由跳转，不影响组件引用。下单页和商品详情页中的表单组件正常加载和渲染。

---

## 2. 检查结果

| 类别 | 结果 |
|------|------|
| 核心链路误杀 | ✅ 无误杀 |
| Common.php 集中拦截误杀 | ✅ 无误杀 |
| DIY 组件展示 | ✅ 不受影响 |
| 购物车/下单页展示 | ✅ 不受影响（支付方式为空，提示文案） |
| 订单查看不受支付门控 | ✅ 正确 |
| 支付 action 正确拦截 | ✅ 正确 |
| form-input 组件引用 | ✅ 不受影响 |

---

## 3. 发现的问题

### 3.1 潜在风险：cashier/paylog 双重拦截

**描述**：`cashier` 和 `paylog` 同时存在于 `$CONTROLLER_FEATURE_MAP`（controller-level）和 `$PAYMENT_REQUIRED_ACTIONS`（action-level）中。当前 cashier 只有 `PayData` 一个 action、paylog 只有 `Index` 和 `Detail` 两个 action，全部都需要支付门控，所以不构成误杀。

**风险**：如果未来在这两个控制器中新增不需要支付的 action（如 `cashier/status`），controller-level 拦截会误杀该 action。

**建议**：后续迭代中考虑将 cashier 和 paylog 从 `$CONTROLLER_FEATURE_MAP` 中移除，仅依赖 `$PAYMENT_REQUIRED_ACTIONS` 做 action-level 精确拦截。当前不修改，因为不构成实际误杀。

**严重程度**：低 — 当前无影响，仅作为后续优化建议。

### 3.2 潜在风险：一期核心功能开关未默认开启

**描述**：`feature_activity_enabled`、`feature_content_enabled`、`feature_feedback_enabled`、`feature_invite_enabled`、`feature_membership_enabled` 等一期核心功能开关，如果生产环境 `.env` 中未显式设置为 1，则这些功能会被关闭。

**风险**：部署时遗漏配置导致核心功能不可用。

**建议**：在部署文档中明确列出所有一期必须开启的开关。已在 `docs/uat-server-checklist.md` 和 `docs/wechat-submit-human-tasks.md` 中覆盖。

**严重程度**：中 — 需人工确认部署配置。

---

## 4. 修复内容

本次审查**未发现误杀问题**，无需代码修复。

---

## 5. 仍需人工真机验证的事项

| # | 验证项 | 验证方式 | 优先级 |
|---|--------|----------|--------|
| 1 | 首页 DIY 组件正常渲染 | 真机打开首页，确认 DIY 布局正常显示 | P0 |
| 2 | 购物车正常展示，无门店/医院模块 | 真机打开购物车，确认基础功能正常 | P0 |
| 3 | 下单页展示"线上支付暂未开放"提示 | 真机进入下单页，确认提示文案显示 | P0 |
| 4 | 提交订单生成待支付订单 | 真机提交订单，确认 payment_id=0 | P0 |
| 5 | 订单列表/详情正常查看 | 真机查看历史订单，确认不受支付门控影响 | P0 |
| 6 | 收银台/支付结果页被拦截 | 真机尝试访问 cashier/paytips，确认跳转错误页 | P1 |
| 7 | 活动列表/详情/报名正常 | 真机操作活动全流程 | P1 |
| 8 | 商品详情页表单组件正常 | 真机打开含表单的商品，确认组件渲染 | P1 |
| 9 | 一期核心功能开关已开启 | 检查生产 .env 配置 | P0 |
| 10 | 后端 -403 响应前端 toast 正常 | 触发一个被拦截的 API，确认 toast 提示 | P1 |
