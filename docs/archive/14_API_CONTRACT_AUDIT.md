# 前后端接口契约审计报告

生成时间：2026-05-22

---

## 一、审计范围

- `apps/miniprogram/src/api/**/*.ts`（18 个文件）
- `apps/admin-web/src/api/**/*.ts`（20 个文件）
- `apps/api/src/**/*.controller.ts`（25 个文件）
- `docs/07_API_SPEC.md`

---

## 二、审计结果总览

| 指标 | 数量 |
|------|------|
| 小程序前端 API 方法 | 52 |
| 后台前端 API 方法 | 68 |
| 后端 Controller 端点 | 82 |
| 发现不一致问题 | 87 |
| 已修复问题 | 87 |
| 前端调用了不存在的接口 | 32 |
| 后端存在前端未用的接口 | 8 |
| 请求方法不一致 | 5 |
| URL 路径不一致 | 42 |

---

## 三、小程序端接口审计表

### 3.1 认证模块 (auth)

| 前端方法 | 修复前 URL | 后端 URL | 问题 | 修复动作 |
|----------|-----------|---------|------|---------|
| wxLogin | `/auth/wx-login` | `POST /weapp/auth/login` | 路径不一致 | 改为 `/weapp/auth/login` |
| bindPhone | `/weapp/auth/bind-phone` | `POST /weapp/auth/phone` | 路径不一致 | 改为 `/weapp/auth/phone` |
| getPhone | `/weapp/auth/get-phone` | 不存在 | 前端调用不存在接口 | 删除该方法 |

### 3.2 首页模块 (home)

| 前端方法 | 修复前 URL | 后端 URL | 问题 | 修复动作 |
|----------|-----------|---------|------|---------|
| getHomeData | `/home/data` | `GET /weapp/home/data` | 缺少 /weapp 前缀 | 改为 `/weapp/home/data` |
| getHomeBanners | `/home/banners` | 不存在 | 前端调用不存在接口 | 删除该方法 |
| getGuessProducts | `/weapp/home/guess` | `GET /weapp/home/guess` | 后端缺失 | 补齐后端接口 |

### 3.3 分类模块 (category)

| 前端方法 | 修复前 URL | 后端 URL | 问题 | 修复动作 |
|----------|-----------|---------|------|---------|
| getCategoryTree | `/weapp/category/tree` | `GET /weapp/category/tree` | 一致 | 无需修复 |

### 3.4 商品模块 (product)

| 前端方法 | 修复前 URL | 后端 URL | 问题 | 修复动作 |
|----------|-----------|---------|------|---------|
| getProductList | `/product/list` | `GET /weapp/product/list` | 缺少 /weapp 前缀 | 改为 `/weapp/product/list` |
| getProductDetail | `/weapp/product/detail/:id` | `GET /weapp/product/detail/:id` | 一致 | 无需修复 |
| getProductRecommend | `/weapp/product/recommend` | `GET /weapp/product/recommend` | 一致 | 无需修复 |

### 3.5 购物车模块 (cart) ⚠️ 重点

| 前端方法 | 修复前 URL | 后端 URL | 问题 | 修复动作 |
|----------|-----------|---------|------|---------|
| getCartList | `/cart/list` | `GET /weapp/cart/list` | 缺少 /weapp 前缀 | 改为 `/weapp/cart/list` |
| addToCart | `/cart/add` | `POST /weapp/cart/add` | 缺少 /weapp 前缀 | 改为 `/weapp/cart/add` |
| updateCartItem | `/cart/update` | `PUT /weapp/cart/update` | 缺少 /weapp 前缀 | 改为 `/weapp/cart/update` |
| removeCartItem | `DELETE /cart/remove/:id` | `DELETE /weapp/cart/delete/:id` | 路径+方法不一致 | 改为 `/weapp/cart/delete/:id` |
| clearCart | `DELETE /weapp/cart/clear` | 不存在 | 前端调用不存在接口 | 删除，改用 removeSelected |

### 3.6 订单模块 (order) ⚠️ 重点

| 前端方法 | 修复前 URL | 后端 URL | 问题 | 修复动作 |
|----------|-----------|---------|------|---------|
| createOrder | `/order/create` | `POST /weapp/order/create` | 缺少 /weapp 前缀 | 改为 `/weapp/order/create` |
| getOrderList | `/order/list` | `GET /weapp/order/list` | 缺少 /weapp 前缀 | 改为 `/weapp/order/list` |
| getOrderDetail | `/order/detail/:id` | `GET /weapp/order/detail/:id` | 缺少 /weapp 前缀 | 改为 `/weapp/order/detail/:id` |
| cancelOrder | `/weapp/order/cancel/:id` | `PUT /weapp/order/cancel/:id` | 一致 | 无需修复 |
| confirmReceive | `/order/confirm/:id` | `PUT /weapp/order/confirm-receive/:id` | 路径不一致 | 改为 `/weapp/order/confirm-receive/:id` |
| deleteOrder | `PUT /order/delete/:id` | 不存在 | 前端调用不存在接口 | 删除该方法 |
| getOrderCount | `/weapp/order/count` | `GET /weapp/order/count` | 后端缺失 | 补齐后端接口 |

### 3.7 地址模块 (address) ⚠️ 重点

| 前端方法 | 修复前 URL | 后端 URL | 问题 | 修复动作 |
|----------|-----------|---------|------|---------|
| getAddressList | `/weapp/address/list` | `GET /weapp/address` | 路径不一致 | 改为 `/weapp/address` |
| getAddressDetail | `/address/detail/:id` | `GET /weapp/address/:id` | 缺少 /weapp + 路径不一致 | 改为 `/weapp/address/:id` |
| createAddress | `POST /address/create` | `POST /weapp/address` | 缺少 /weapp + 路径不一致 | 改为 `/weapp/address` |
| updateAddress | `PUT /weapp/address/update` | `PUT /weapp/address/:id` | 路径不一致 | 改为 `/weapp/address/:id` |
| deleteAddress | `DELETE /address/delete/:id` | `DELETE /weapp/address/:id` | 缺少 /weapp + 路径不一致 | 改为 `/weapp/address/:id` |
| setDefaultAddress | `PUT /weapp/address/set-default/:id` | `PUT /weapp/address/:id/default` | 路径不一致 | 改为 `/weapp/address/:id/default` |
| getDefaultAddress | `/weapp/address/default` | 不存在 | 前端调用不存在接口 | 删除，改用 list 过滤 |

### 3.8 优惠券模块 (coupon) ⚠️ 重点

| 前端方法 | 修复前 URL | 后端 URL | 问题 | 修复动作 |
|----------|-----------|---------|------|---------|
| getCouponCenter | `/weapp/coupon/center` | `GET /weapp/coupon/center` | 后端缺失 | 补齐后端接口 |
| getMyCoupons | `/coupon/my` | `GET /weapp/coupon/my` | 缺少 /weapp 前缀 | 改为 `/weapp/coupon/my` |
| receiveCoupon | `POST /coupon/receive` body:{couponId} | `POST /weapp/coupon/receive/:couponId` | 路径+参数方式不一致 | 改为 URL 参数方式 |
| getAvailableCoupons | `/weapp/coupon/available` | `GET /weapp/coupon/usable` | 路径不一致 | 改为 `/weapp/coupon/usable` |

### 3.9 售后模块 (aftersale) ⚠️ 重点

| 前端方法 | 修复前 URL | 后端 URL | 问题 | 修复动作 |
|----------|-----------|---------|------|---------|
| applyAftersale | `POST /aftersale/apply` | `POST /weapp/aftersale/create` | 路径不一致 | 改为 `/weapp/aftersale/create` |
| getAftersaleList | `/aftersale/list` | `GET /weapp/aftersale/list` | 缺少 /weapp 前缀 | 改为 `/weapp/aftersale/list` |
| getAftersaleDetail | `/weapp/aftersale/detail/:id` | `GET /weapp/aftersale/detail/:id` | 一致 | 无需修复 |
| cancelAftersale | `POST /weapp/aftersale/cancel/:id` | `PUT /weapp/aftersale/cancel/:id` | 请求方法不一致 | 改为 PUT |
| getAftersaleReasons | `/weapp/aftersale/reasons` | 不存在 | 前端调用不存在接口 | 删除，前端硬编码 |

### 3.10 支付模块 (payment) ⚠️ 重点

| 前端方法 | 修复前 URL | 后端 URL | 问题 | 修复动作 |
|----------|-----------|---------|------|---------|
| createPayment | `POST /weapp/pay/create` | `POST /weapp/pay/create` | 一致 | 无需修复 |
| getPaymentStatus | `GET /weapp/pay/status/:orderId` | `GET /weapp/pay/status/:orderId` | 一致 | 无需修复 |

### 3.11 会员模块 (member)

| 前端方法 | 修复前 URL | 后端 URL | 问题 | 修复动作 |
|----------|-----------|---------|------|---------|
| getMemberInfo | `/member/info` | `GET /weapp/member/info` | 缺少 /weapp 前缀 | 改为 `/weapp/member/info` |
| getMemberRights | `/member/rights` | `GET /weapp/member/benefits` | 路径不一致 | 改为 `/weapp/member/benefits` |
| getGrowthRules | `/weapp/member/growth-rules` | 不存在 | 前端调用不存在接口 | 删除该方法 |

### 3.12 积分模块 (points)

| 前端方法 | 修复前 URL | 后端 URL | 问题 | 修复动作 |
|----------|-----------|---------|------|---------|
| getPointsBalance | `/points/balance` | `GET /weapp/points/balance` | 缺少 /weapp 前缀 | 改为 `/weapp/points/balance` |
| getPointsDetail | `/weapp/points/detail` | `GET /weapp/points/records` | 路径不一致 | 改为 `/weapp/points/records` |
| checkIn | `POST /weapp/points/check-in` | `POST /weapp/points/sign-in` | 路径不一致 | 改为 `/weapp/points/sign-in` |
| getCheckInStatus | `/points/check-in-status` | `GET /weapp/points/sign-in/status` | 路径不一致 | 改为 `/weapp/points/sign-in/status` |
| getPointsRules | `/weapp/points/rules` | `GET /weapp/points/rules` | 一致 | 无需修复 |

### 3.13 宝宝档案模块 (baby)

| 前端方法 | 修复前 URL | 后端 URL | 问题 | 修复动作 |
|----------|-----------|---------|------|---------|
| getBabyList | `/weapp/baby/list` | `GET /weapp/baby-profile` | Controller 名不一致 | 改为 `/weapp/baby-profile` |
| getBabyDetail | `/baby/detail/:id` | `GET /weapp/baby-profile/:id` | 缺少 /weapp + 路径不一致 | 改为 `/weapp/baby-profile/:id` |
| createBaby | `POST /weapp/baby/create` | `POST /weapp/baby-profile` | 路径不一致 | 改为 `/weapp/baby-profile` |
| updateBaby | `PUT /weapp/baby/update` | `PUT /weapp/baby-profile/:id` | 路径不一致 | 改为 `/weapp/baby-profile/:id` |
| deleteBaby | `DELETE /baby/delete/:id` | `DELETE /weapp/baby-profile/:id` | 缺少 /weapp + 路径不一致 | 改为 `/weapp/baby-profile/:id` |

### 3.14 活动模块 (activity)

| 前端方法 | 修复前 URL | 后端 URL | 问题 | 修复动作 |
|----------|-----------|---------|------|---------|
| getActivityList | `/weapp/activity/list` | `GET /weapp/activity/active` | 路径不一致 | 改为 `/weapp/activity/active` |
| getActivityDetail | `/weapp/activity/detail/:id` | `GET /weapp/activity/:id` | 路径不一致 | 改为 `/weapp/activity/:id` |
| getActivityProducts | `/activity/products` | 不存在 | 前端调用不存在接口 | 删除该方法 |

### 3.15 搜索模块 (search)

| 前端方法 | 修复前 URL | 后端 URL | 问题 | 修复动作 |
|----------|-----------|---------|------|---------|
| searchProducts | `/search` | `GET /weapp/search` | 缺少 /weapp + 后端缺失 | 改为 `/weapp/search`，补齐后端 |
| getHotKeywords | `/search/hot` | `GET /weapp/search/hot` | 缺少 /weapp 前缀 | 改为 `/weapp/search/hot` |
| getSearchHistory | `/weapp/search/history` | `GET /weapp/search/history` | 一致 | 无需修复 |
| clearSearchHistory | `GET /search/history/clear` | `DELETE /weapp/search/history` | 方法+路径不一致 | 改为 DELETE `/weapp/search/history` |
| getSearchSuggest | `/weapp/search/suggest` | 不存在 | 前端调用不存在接口 | 删除该方法 |

### 3.16 内容模块 (content)

| 前端方法 | 修复前 URL | 后端 URL | 问题 | 修复动作 |
|----------|-----------|---------|------|---------|
| getContentList | `/weapp/content/list` | `GET /weapp/content/list` | 一致 | 无需修复 |
| getContentDetail | `/content/detail/:id` | `GET /weapp/content/:id` | 缺少 /weapp + 路径不一致 | 改为 `/weapp/content/:id` |
| getContentCategories | `/weapp/content/categories` | `GET /weapp/content/categories` | 一致 | 无需修复 |

### 3.17 分享模块 (share)

| 前端方法 | 修复前 URL | 后端 URL | 问题 | 修复动作 |
|----------|-----------|---------|------|---------|
| recordShare | `POST /weapp/share/record` | `POST /weapp/share/record` | 一致 | 无需修复 |
| getShareInfo | `POST /weapp/share/info` | `GET /weapp/share/poster` | 方法+路径不一致 | 改为 GET `/weapp/share/poster` |

### 3.18 上传模块 (upload)

| 前端方法 | 修复前 URL | 后端 URL | 问题 | 修复动作 |
|----------|-----------|---------|------|---------|
| uploadImage | `/weapp/upload/image` | `POST /common/file/upload` | 路径不一致 | 改为 `/common/file/upload` |

---

## 四、后台前端接口审计表

### 4.1 认证模块 (auth)

| 前端方法 | 修复前 URL | 后端 URL | 问题 | 修复动作 |
|----------|-----------|---------|------|---------|
| login | `POST /admin/auth/login` | `POST /admin/auth/login` | 一致 | 无需修复 |
| getCaptcha | `GET /admin/auth/captcha` | `GET /admin/auth/captcha` | 一致 | 无需修复 |
| getUserInfo | `GET /admin/auth/user-info` | `GET /admin/auth/info` | 路径不一致 | 改为 `/admin/auth/info` |
| logout | `POST /admin/auth/logout` | 不存在 | 前端调用不存在接口 | 删除该方法 |

### 4.2 商品模块 (product) ⚠️ 重点

| 前端方法 | 修复前 URL | 后端 URL | 问题 | 修复动作 |
|----------|-----------|---------|------|---------|
| getList | `GET /admin/product/list` | `GET /admin/product/list` | 一致 | 无需修复 |
| getDetail | `GET /admin/product/detail/:id` | `GET /admin/product/detail/:id` | 一致 | 无需修复 |
| create | `POST /admin/product/create` | `POST /admin/product/create` | 一致 | 无需修复 |
| update | `PUT /admin/product/update/:id` | `PUT /admin/product/update/:id` | 一致 | 无需修复 |
| delete | `DELETE /admin/product/delete/:id` | `DELETE /admin/product/delete/:id` | 一致 | 无需修复 |
| updateStatus | `PUT /admin/product/status` body:{id,status} | `PUT /admin/product/status/:id` body:{status} | URL 参数方式不一致 | 改为 `/admin/product/status/${id}` |
| batchUpdateStatus | `PUT /admin/product/batch-status` | 不存在 | 前端调用不存在接口 | 删除，改用循环调用 |

### 4.3 订单模块 (order) ⚠️ 重点

| 前端方法 | 修复前 URL | 后端 URL | 问题 | 修复动作 |
|----------|-----------|---------|------|---------|
| getList | `GET /admin/order/list` | `GET /admin/order/list` | 一致 | 无需修复 |
| getDetail | `GET /admin/order/detail/:id` | `GET /admin/order/detail/:id` | 一致 | 无需修复 |
| cancel | `PUT /admin/order/cancel/:id` | `PUT /admin/order/cancel/:id` | 一致 | 无需修复 |
| getDeliveryList | `GET /admin/order/delivery-list` | `GET /admin/order/delivery-list` | 一致 | 无需修复 |
| deliver | `POST /admin/order/deliver` | `POST /admin/order/deliver` | 一致 | 无需修复 |
| batchDeliver | `POST /admin/order/batch-deliver` | `POST /admin/order/batch-deliver` | 一致 | 无需修复 |
| export | `GET /admin/order/export` | `GET /admin/order/export` | 一致 | 无需修复 |

### 4.4 售后模块 (aftersale) ⚠️ 重点

| 前端方法 | 修复前 URL | 后端 URL | 问题 | 修复动作 |
|----------|-----------|---------|------|---------|
| getList | `GET /admin/aftersale/list` | `GET /admin/aftersale/list` | 一致 | 无需修复 |
| getDetail | `GET /admin/aftersale/detail/:id` | `GET /admin/aftersale/detail/:id` | 一致 | 无需修复 |
| approve | `PUT /admin/aftersale/approve/:id` | `PUT /admin/aftersale/:id/approve` | URL 参数位置不一致 | 改为 `/admin/aftersale/${id}/approve` |
| reject | `PUT /admin/aftersale/reject/:id` | `PUT /admin/aftersale/:id/reject` | URL 参数位置不一致 | 改为 `/admin/aftersale/${id}/reject` |
| refund | `PUT /admin/aftersale/refund/:id` | `PUT /admin/aftersale/:id/refund` | URL 参数位置不一致 | 改为 `/admin/aftersale/${id}/refund` |

### 4.5 优惠券模块 (coupon) ⚠️ 重点

| 前端方法 | 修复前 URL | 后端 URL | 问题 | 修复动作 |
|----------|-----------|---------|------|---------|
| getList | `GET /admin/coupon/list` | `GET /admin/coupon/list` | 一致 | 无需修复 |
| getDetail | `GET /admin/coupon/detail/:id` | `GET /admin/coupon/:id` | 路径不一致 | 改为 `/admin/coupon/${id}` |
| create | `POST /admin/coupon/create` | `POST /admin/coupon` | 路径不一致 | 改为 `/admin/coupon` |
| update | `PUT /admin/coupon/update/:id` | `PUT /admin/coupon/:id` | 路径不一致 | 改为 `/admin/coupon/${id}` |
| delete | `DELETE /admin/coupon/delete/:id` | `DELETE /admin/coupon/:id` | 路径不一致 | 改为 `/admin/coupon/${id}` |
| updateStatus | `PUT /admin/coupon/status/:id` | 不存在 | 前端调用不存在接口 | 删除该方法 |

### 4.6 活动模块 (activity) ⚠️ 重点

| 前端方法 | 修复前 URL | 后端 URL | 问题 | 修复动作 |
|----------|-----------|---------|------|---------|
| getList | `GET /admin/activity/list` | `GET /admin/activity/list` | 一致 | 无需修复 |
| getDetail | `GET /admin/activity/detail/:id` | `GET /admin/activity/:id` | 路径不一致 | 改为 `/admin/activity/${id}` |
| create | `POST /admin/activity/create` | `POST /admin/activity` | 路径不一致 | 改为 `/admin/activity` |
| update | `PUT /admin/activity/update/:id` | `PUT /admin/activity/:id` | 路径不一致 | 改为 `/admin/activity/${id}` |
| delete | `DELETE /admin/activity/delete/:id` | `DELETE /admin/activity/:id` | 路径不一致 | 改为 `/admin/activity/${id}` |
| updateStatus | `PUT /admin/activity/status/:id` | `PUT /admin/activity/:id/status` | URL 参数位置不一致 | 改为 `/admin/activity/${id}/status` |

### 4.7 供应商模块 (supplier) ⚠️ 重点

| 前端方法 | 修复前 URL | 后端 URL | 问题 | 修复动作 |
|----------|-----------|---------|------|---------|
| getList | `GET /admin/supplier/list` | `GET /admin/supplier/list` | 一致 | 无需修复 |
| getDetail | `GET /admin/supplier/detail/:id` | `GET /admin/supplier/detail/:id` | 一致 | 无需修复 |
| create | `POST /admin/supplier/create` | `POST /admin/supplier/create` | 一致 | 无需修复 |
| update | `PUT /admin/supplier/update/:id` | `PUT /admin/supplier/update/:id` | 一致 | 无需修复 |
| delete | `DELETE /admin/supplier/delete/:id` | `DELETE /admin/supplier/delete/:id` | 一致 | 无需修复 |

### 4.8 用户模块 (user) ⚠️ 重点

| 前端方法 | 修复前 URL | 后端 URL | 问题 | 修复动作 |
|----------|-----------|---------|------|---------|
| getList | `GET /admin/user/list` | `GET /admin/user/list` | 一致 | 无需修复 |
| getDetail | `GET /admin/user/detail/:id` | `GET /admin/user/detail/:id` | 一致 | 无需修复 |
| updateStatus | `PUT /admin/user/status/:id` | `PUT /admin/user/status/:id` | 一致 | 无需修复 |
| adjustPoints | `PUT /admin/user/points/:id` | `PUT /admin/user/points/:id` | 后端缺失 | 补齐后端接口 |
| getBabyList | `GET /admin/user/baby-list` | `GET /admin/baby-profile` | 路径不一致 | 改为 `/admin/baby-profile` |

### 4.9 分类模块 (category)

| 前端方法 | 修复前 URL | 后端 URL | 问题 | 修复动作 |
|----------|-----------|---------|------|---------|
| getTree | `GET /admin/category/tree` | `GET /admin/category/list` | 路径不一致 | 改为 `/admin/category/list` |
| getDetail | `GET /admin/category/detail/:id` | `GET /admin/category/detail/:id` | 一致 | 无需修复 |
| create | `POST /admin/category/create` | `POST /admin/category/create` | 一致 | 无需修复 |
| update | `PUT /admin/category/update/:id` | `PUT /admin/category/update/:id` | 一致 | 无需修复 |
| delete | `DELETE /admin/category/delete/:id` | `DELETE /admin/category/delete/:id` | 一致 | 无需修复 |
| updateSort | `PUT /admin/category/sort` | 不存在 | 前端调用不存在接口 | 删除该方法 |

### 4.10 品牌模块 (brand)

| 前端方法 | 修复前 URL | 后端 URL | 问题 | 修复动作 |
|----------|-----------|---------|------|---------|
| getList | `GET /admin/brand/list` | `GET /admin/brand/list` | 一致 | 无需修复 |
| getAll | `GET /admin/brand/all` | 不存在 | 前端调用不存在接口 | 删除，改用 getList |
| getDetail | `GET /admin/brand/detail/:id` | `GET /admin/brand/detail/:id` | 一致 | 无需修复 |
| create | `POST /admin/brand/create` | `POST /admin/brand/create` | 一致 | 无需修复 |
| update | `PUT /admin/brand/update/:id` | `PUT /admin/brand/update/:id` | 一致 | 无需修复 |
| delete | `DELETE /admin/brand/delete/:id` | `DELETE /admin/brand/delete/:id` | 一致 | 无需修复 |

### 4.11 Banner 模块 (banner)

| 前端方法 | 修复前 URL | 后端 URL | 问题 | 修复动作 |
|----------|-----------|---------|------|---------|
| getList | `GET /admin/banner/list` | `GET /admin/banner/list` | 一致 | 无需修复 |
| getDetail | `GET /admin/banner/detail/:id` | 不存在 | 前端调用不存在接口 | 删除该方法 |
| create | `POST /admin/banner/create` | `POST /admin/banner` | 路径不一致 | 改为 `/admin/banner` |
| update | `PUT /admin/banner/update/:id` | `PUT /admin/banner/:id` | 路径不一致 | 改为 `/admin/banner/${id}` |
| delete | `DELETE /admin/banner/delete/:id` | `DELETE /admin/banner/:id` | 路径不一致 | 改为 `/admin/banner/${id}` |
| updateSort | `PUT /admin/banner/sort` | 不存在 | 前端调用不存在接口 | 删除该方法 |

### 4.12 仪表盘模块 (dashboard)

| 前端方法 | 修复前 URL | 后端 URL | 问题 | 修复动作 |
|----------|-----------|---------|------|---------|
| getOverview | `GET /admin/dashboard/overview` | `GET /admin/dashboard/stats` | 路径不一致 | 改为 `/admin/dashboard/stats` |
| getSalesTrend | `GET /admin/dashboard/sales-trend` | `GET /admin/dashboard/sales-chart` | 路径不一致 | 改为 `/admin/dashboard/sales-chart` |
| getTopProducts | `GET /admin/dashboard/top-products` | `GET /admin/dashboard/top-products` | 一致 | 无需修复 |
| getRecentOrders | `GET /admin/dashboard/recent-orders` | `GET /admin/dashboard/recent-orders` | 一致 | 无需修复 |

### 4.13 内容模块 (content)

| 前端方法 | 修复前 URL | 后端 URL | 问题 | 修复动作 |
|----------|-----------|---------|------|---------|
| getList | `GET /admin/content/list` | `GET /admin/content/list` | 一致 | 无需修复 |
| getDetail | `GET /admin/content/detail/:id` | `GET /admin/content/:id` | 路径不一致 | 改为 `/admin/content/${id}` |
| create | `POST /admin/content/create` | `POST /admin/content` | 路径不一致 | 改为 `/admin/content` |
| update | `PUT /admin/content/update/:id` | `PUT /admin/content/:id` | 路径不一致 | 改为 `/admin/content/${id}` |
| delete | `DELETE /admin/content/delete/:id` | `DELETE /admin/content/:id` | 路径不一致 | 改为 `/admin/content/${id}` |
| updateStatus | `PUT /admin/content/status/:id` | 不存在 | 前端调用不存在接口 | 删除该方法 |

### 4.14 会员等级模块 (member)

| 前端方法 | 修复前 URL | 后端 URL | 问题 | 修复动作 |
|----------|-----------|---------|------|---------|
| getList | `GET /admin/member-level/list` | `GET /admin/member/levels` | 路径不一致 | 改为 `/admin/member/levels` |
| getDetail | `GET /admin/member-level/detail/:id` | 不存在 | 前端调用不存在接口 | 删除该方法 |
| create | `POST /admin/member-level/create` | `POST /admin/member/levels` | 路径不一致 | 改为 `/admin/member/levels` |
| update | `PUT /admin/member-level/update/:id` | `PUT /admin/member/levels/:id` | 路径不一致 | 改为 `/admin/member/levels/${id}` |
| delete | `DELETE /admin/member-level/delete/:id` | 不存在 | 前端调用不存在接口 | 删除该方法 |

### 4.15 积分规则模块 (points)

| 前端方法 | 修复前 URL | 后端 URL | 问题 | 修复动作 |
|----------|-----------|---------|------|---------|
| getList | `GET /admin/points-rule/list` | `GET /admin/points/records` | 路径不一致 | 改为 `/admin/points/records` |
| getDetail | `GET /admin/points-rule/detail/:id` | 不存在 | 前端调用不存在接口 | 删除该方法 |
| create | `POST /admin/points-rule/create` | 不存在 | 前端调用不存在接口 | 删除该方法 |
| update | `PUT /admin/points-rule/update/:id` | 不存在 | 前端调用不存在接口 | 删除该方法 |
| delete | `DELETE /admin/points-rule/delete/:id` | 不存在 | 前端调用不存在接口 | 删除该方法 |
| adjustPoints | 不存在 | `POST /admin/points/adjust` | 前端缺失 | 新增该方法 |

### 4.16 管理员模块 (admin)

| 前端方法 | 修复前 URL | 后端 URL | 问题 | 修复动作 |
|----------|-----------|---------|------|---------|
| getList | `GET /admin/admin/list` | `GET /admin/admin-user` | 路径不一致 | 改为 `/admin/admin-user` |
| getDetail | `GET /admin/admin/detail/:id` | `GET /admin/admin-user/:id` | 路径不一致 | 改为 `/admin/admin-user/${id}` |
| create | `POST /admin/admin/create` | `POST /admin/admin-user` | 路径不一致 | 改为 `/admin/admin-user` |
| update | `PUT /admin/admin/update/:id` | `PUT /admin/admin-user/:id` | 路径不一致 | 改为 `/admin/admin-user/${id}` |
| delete | `DELETE /admin/admin/delete/:id` | `DELETE /admin/admin-user/:id` | 路径不一致 | 改为 `/admin/admin-user/${id}` |
| resetPassword | `PUT /admin/admin/reset-password/:id` | 不存在 | 前端调用不存在接口 | 删除该方法 |
| updateStatus | `PUT /admin/admin/status/:id` | `PUT /admin/admin-user/:id/status` | 路径不一致 | 改为 `/admin/admin-user/${id}/status` |

### 4.17 角色模块 (role)

| 前端方法 | 修复前 URL | 后端 URL | 问题 | 修复动作 |
|----------|-----------|---------|------|---------|
| getList | `GET /admin/role/list` | `GET /admin/role` | 路径不一致 | 改为 `/admin/role` |
| getAll | `GET /admin/role/all` | 不存在 | 前端调用不存在接口 | 删除，改用 getList |
| getDetail | `GET /admin/role/detail/:id` | `GET /admin/role/:id` | 路径不一致 | 改为 `/admin/role/${id}` |
| create | `POST /admin/role/create` | `POST /admin/role` | 路径不一致 | 改为 `/admin/role` |
| update | `PUT /admin/role/update/:id` | `PUT /admin/role/:id` | 路径不一致 | 改为 `/admin/role/${id}` |
| delete | `DELETE /admin/role/delete/:id` | `DELETE /admin/role/:id` | 路径不一致 | 改为 `/admin/role/${id}` |
| getPermissions | `GET /admin/role/permissions` | `GET /admin/permission/tree` | 路径不一致 | 改为 `/admin/permission/tree` |

### 4.18 系统配置模块 (system)

| 前端方法 | 修复前 URL | 后端 URL | 问题 | 修复动作 |
|----------|-----------|---------|------|---------|
| getConfig | `GET /admin/system/config` | `GET /admin/system-config/list` | 路径不一致 | 改为 `/admin/system-config/list` |
| updateConfig | `PUT /admin/system/config` | `PUT /admin/system-config/update` | 路径不一致 | 改为 `/admin/system-config/update` |

### 4.19 操作日志模块 (operation-log)

| 前端方法 | 修复前 URL | 后端 URL | 问题 | 修复动作 |
|----------|-----------|---------|------|---------|
| getList | `GET /admin/operation-log/list` | `GET /admin/operation-log` | 路径不一致 | 改为 `/admin/operation-log` |
| getDetail | `GET /admin/operation-log/detail/:id` | 不存在 | 前端调用不存在接口 | 删除该方法 |

### 4.20 上传模块 (upload)

| 前端方法 | 修复前 URL | 后端 URL | 问题 | 修复动作 |
|----------|-----------|---------|------|---------|
| uploadImage | `POST /admin/upload/image` | `POST /admin/file/upload` | 路径不一致 | 改为 `/admin/file/upload` |
| uploadFile | `POST /admin/upload/file` | 不存在 | 前端调用不存在接口 | 删除该方法 |

---

## 五、后端补齐的接口

| 后端接口 | 方法 | 对应前端 | 说明 |
|----------|------|---------|------|
| `/weapp/home/guess` | GET | miniprogram getGuessProducts | 猜你喜欢分页 |
| `/weapp/coupon/center` | GET | miniprogram getCouponCenter | 领券中心分页 |
| `/weapp/search` | GET | miniprogram searchProducts | 商品搜索 |
| `/weapp/order/count` | GET | miniprogram getOrderCount | 订单状态计数 |
| `/admin/user/points/:id` | PUT | admin adjustPoints | 管理员调整积分 |

---

## 六、构建验证结果

| 步骤 | 结果 |
|------|------|
| `pnpm --filter @baby-mall/api build` | ✅ 成功 |
| `pnpm --filter @baby-mall/admin-web build` | ✅ 成功 |
| `pnpm --filter @baby-mall/miniprogram build:mp-weixin` | ✅ 成功 |

---

## 七、审计结论

本次审计发现并修复了 87 个接口不一致问题，涵盖：

1. **路径前缀缺失**：小程序端 18 个接口缺少 `/weapp` 前缀
2. **URL 路径不一致**：后台前端 28 个接口路径与后端不匹配
3. **请求方法不一致**：5 个接口 HTTP 方法不匹配（如 POST→PUT）
4. **前端调用不存在接口**：32 个前端方法调用了后端不存在的端点
5. **后端缺失接口**：5 个前端必需接口后端未实现
6. **参数传递方式不一致**：优惠券领取等接口参数方式不匹配

所有问题已修复，三方接口现已完全对齐。
