# API 接口规范

> 后端技术栈：Node.js + NestJS + TypeScript
> 文档版本：v2.0.0
> 最后更新：2026-05-22

---

## 1. 概述

本文档定义了"禧孕母婴用品私域商城小程序"全部后端 API 接口规范，供前后端开发人员协同开发使用。项目为自营商城（非多商户平台），所有商品、库存、订单均由禧孕文化传媒有限公司统一管理。

API 按调用端分为三大部分：

| 分组 | 前缀 | 说明 |
|------|------|------|
| 小程序端 API | `/api/weapp/*` | 面向微信小程序用户，需微信 JWT 鉴权 |
| 管理后台 API | `/api/admin/*` | 面向运营管理人员，需管理员 JWT 鉴权 + RBAC 权限 |
| 公共 API | `/api/common/*` | 无需鉴权或仅需轻量鉴权的公共接口 |

### 1.1 请求格式

- 请求方法：`GET` / `POST` / `PUT` / `DELETE`
- Content-Type：
  - `GET` / `DELETE`：参数通过 Query String 传递
  - `POST` / `PUT`：参数通过 JSON Body 传递，`Content-Type: application/json`
  - 文件上传接口：`Content-Type: multipart/form-data`
- 字符编码：UTF-8
- 时间格式：ISO 8601（`YYYY-MM-DDTHH:mm:ss.sssZ`）
- 金额单位：所有金额字段均以 **分** 为整数单位，前端展示时需换算为元

### 1.2 统一响应格式

所有接口均返回以下 JSON 结构：

```json
{
  "code": 0,
  "message": "success",
  "data": {}
}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| code | number | 业务状态码，0 表示成功，非 0 表示失败 |
| message | string | 状态描述信息 |
| data | any | 业务数据，失败时可为 null |

### 1.3 分页格式

分页接口的 `data` 字段统一为：

```json
{
  "list": [],
  "pagination": {
    "page": 1,
    "pageSize": 10,
    "total": 100,
    "totalPages": 10
  }
}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| list | array | 数据列表 |
| pagination.page | number | 当前页码，从 1 开始 |
| pagination.pageSize | number | 每页条数 |
| pagination.total | number | 总记录数 |
| pagination.totalPages | number | 总页数 |

分页请求参数：

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| page | number | 否 | 页码，默认 1 |
| pageSize | number | 否 | 每页条数，默认 10，最大 100 |

### 1.4 认证方式

**小程序端**：登录后获取 accessToken + refreshToken，后续请求在 Header 中携带 `Authorization: Bearer <accessToken>`。accessToken payload 包含 tokenType=access，有效期 7 天；refreshToken 有效期 30 天。

**管理后台**：登录后获取 accessToken + refreshToken，后续请求在 Header 中携带 `Authorization: Bearer <accessToken>`。accessToken payload 包含 tokenType=access，有效期 2 小时；refreshToken 有效期 30 天。

### 1.5 请求头规范

| Header | 必填 | 说明 |
|--------|------|------|
| Authorization | 视接口 | `Bearer <token>` 格式 |
| Content-Type | 是 | `application/json` 或 `multipart/form-data` |
| X-Request-Id | 否 | 请求追踪 ID，建议 UUID |
| X-Platform | 否 | 平台标识：`weapp` / `admin` |

---

## 2. 错误码规范

### 2.1 通用错误码

| 错误码 | 说明 |
|--------|------|
| 0 | 成功 |
| 40001 | 参数错误 |
| 40002 | 请求方法不允许 |
| 40003 | 请求体解析失败 |
| 40101 | 未登录 |
| 40102 | Token 已过期 |
| 40103 | Token 无效 |
| 40301 | 无权限访问该资源 |
| 40302 | 账号已被禁用 |
| 40401 | 资源不存在 |
| 40402 | 接口不存在 |
| 40501 | 请求频率超限 |
| 40901 | 资源冲突 |
| 50001 | 服务器内部错误 |
| 50002 | 数据库错误 |
| 50003 | 第三方服务错误 |
| 50004 | 微信接口调用失败 |

### 2.2 业务错误码

| 错误码 | 说明 |
|--------|------|
| 10001 | 商品已下架 |
| 10002 | 库存不足 |
| 10003 | 商品不存在 |
| 10004 | SKU 不存在 |
| 10005 | 价格已变动 |
| 20001 | 订单不存在 |
| 20002 | 订单状态不允许此操作 |
| 20003 | 订单已取消 |
| 20004 | 订单已支付 |
| 20005 | 超出购买限制 |
| 30001 | 优惠券不存在 |
| 30002 | 优惠券已领完 |
| 30003 | 优惠券已领取 |
| 30004 | 优惠券未满足使用条件 |
| 30005 | 优惠券已过期 |
| 40001 | 地址不存在 |
| 40002 | 超出地址数量限制 |
| 50001 | 售后申请不存在 |
| 50002 | 售后状态不允许此操作 |
| 50003 | 超出售后申请时效 |
| 60001 | 会员等级不足 |
| 60002 | 积分不足 |
| 70001 | 活动不存在 |
| 70002 | 活动未开始 |
| 70003 | 活动已结束 |
| 80001 | 手机号绑定失败 |
| 80002 | 验证码错误 |

---

## 3. 小程序端 API

### 3.1 认证模块

#### 3.1.1 微信登录

- **请求方法**：`POST`
- **URL**：`/api/weapp/auth/login`
- **权限要求**：无

**请求参数**：

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| code | string | 是 | 微信登录凭证 wx.login() 获取 |
| userInfo | object | 否 | 用户基本信息 |
| userInfo.nickName | string | 否 | 用户昵称 |
| userInfo.avatarUrl | string | 否 | 用户头像 URL |
| userInfo.gender | number | 否 | 性别：0-未知 1-男 2-女 |

**响应字段**：

| 字段名 | 类型 | 说明 |
|--------|------|------|
| accessToken | string | JWT AccessToken，payload 包含 tokenType=access |
| refreshToken | string | 刷新 Token |
| tokenExpireAt | string | Token 过期时间 |
| userInfo | object | 用户信息 |
| userInfo.id | number | 用户 ID |
| userInfo.openId | string | 微信 OpenID |
| userInfo.nickName | string | 昵称 |
| userInfo.avatarUrl | string | 头像 |
| userInfo.phone | string | 手机号（可能为空） |
| userInfo.memberLevel | number | 会员等级 |
| isNewUser | boolean | 是否新用户 |

**错误码**：50004（微信接口调用失败）

**业务说明**：通过 wx.login 获取 code，后端调用微信 code2Session 接口换取 OpenID 和 SessionKey。若为新用户自动注册，若为老用户更新登录信息。返回 JWT Token 用于后续接口鉴权。

---

#### 3.1.2 绑定手机号

- **请求方法**：`POST`
- **URL**：`/api/weapp/auth/phone`
- **权限要求**：需登录

**请求参数**：

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| code | string | 是 | 微信手机号授权 code |
| encryptedData | string | 否 | 加密数据（兼容旧版） |
| iv | string | 否 | 加密算法初始向量（兼容旧版） |

**响应字段**：

| 字段名 | 类型 | 说明 |
|--------|------|------|
| phone | string | 绑定的手机号 |

**错误码**：80001（手机号绑定失败）、50004（微信接口调用失败）

**业务说明**：优先使用微信手机号快速验证接口，兼容旧版 encryptedData/iv 方式。同一手机号若已绑定其他账号，需进行账号合并处理。

---

### 3.2 用户模块

#### 3.2.1 获取用户信息

- **请求方法**：`GET`
- **URL**：`/api/weapp/user/info`
- **权限要求**：需登录

**请求参数**：无

**响应字段**：

| 字段名 | 类型 | 说明 |
|--------|------|------|
| id | number | 用户 ID |
| openId | string | 微信 OpenID |
| unionId | string | 微信 UnionID（可能为空） |
| nickName | string | 昵称 |
| avatarUrl | string | 头像 URL |
| phone | string | 手机号 |
| gender | number | 性别：0-未知 1-男 2-女 |
| birthday | string | 生日 |
| memberLevel | number | 会员等级：0-普通 1-银卡 2-金卡 3-黑金 |
| memberLevelName | string | 会员等级名称 |
| points | number | 积分余额 |
| totalSpent | number | 累计消费金额（分） |
| orderCount | number | 订单总数 |
| couponCount | number | 可用优惠券数量 |
| createdAt | string | 注册时间 |

**错误码**：40101（未登录）

**业务说明**：返回当前登录用户的完整信息，包含会员等级、积分、订单统计等聚合数据。

---

#### 3.2.2 更新用户资料

- **请求方法**：`PUT`
- **URL**：`/api/weapp/user/profile`
- **权限要求**：需登录

**请求参数**：

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| nickName | string | 否 | 昵称，最长 20 字符 |
| gender | number | 否 | 性别：0-未知 1-男 2-女 |
| birthday | string | 否 | 生日，格式 YYYY-MM-DD |

**响应字段**：

| 字段名 | 类型 | 说明 |
|--------|------|------|
| success | boolean | 是否更新成功 |

**错误码**：40001（参数错误）

**业务说明**：仅允许修改昵称、性别、生日字段，手机号修改需走专门的换绑流程。

---

### 3.3 首页模块

#### 3.3.1 首页数据

- **请求方法**：`GET`
- **URL**：`/api/weapp/home/data`
- **权限要求**：无（登录后可获取个性化推荐）

**请求参数**：

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| babyId | number | 否 | 宝宝 ID，用于按月龄推荐 |

**响应字段**：

| 字段名 | 类型 | 说明 |
|--------|------|------|
| banners | array | Banner 列表 |
| banners[].id | number | Banner ID |
| banners[].imageUrl | string | 图片 URL |
| banners[].linkType | number | 跳转类型：1-商品 2-分类 3-活动 4-内容页 5-外部链接 |
| banners[].linkValue | string | 跳转目标值 |
| banners[].title | string | 标题 |
| recommendations | array | 推荐位列表 |
| recommendations[].id | number | 推荐位 ID |
| recommendations[].title | string | 推荐位标题 |
| recommendations[].products | array | 推荐商品列表（含 id/name/mainImage/price/originalPrice/tag） |
| hotProducts | array | 热门商品（最多 10 个） |
| newProducts | array | 新品上架（最多 10 个） |
| activities | array | 进行中的活动 |
| activities[].id | number | 活动 ID |
| activities[].title | string | 活动标题 |
| activities[].coverImage | string | 活动封面 |
| activities[].startTime | string | 开始时间 |
| activities[].endTime | string | 结束时间 |
| activities[].type | number | 活动类型：1-限时折扣 2-满减 3-满赠 4-组合套餐 5-新人礼包 |

**错误码**：无

**业务说明**：首页数据聚合接口，一次请求返回所有首页展示所需数据。若用户已登录且传入 babyId，推荐位将按宝宝月龄智能推荐。数据有 5 分钟缓存。

---

#### 3.3.2 猜你喜欢

- **请求方法**：`GET`
- **URL**：`/api/weapp/home/guess`
- **权限要求**：无（登录后推荐更精准）

**请求参数**：

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| page | number | 否 | 页码，默认 1 |
| pageSize | number | 否 | 每页条数，默认 10 |

**响应字段**：

| 字段名 | 类型 | 说明 |
|--------|------|------|
| list | array | 商品列表（含 id/name/mainImage/price/originalPrice/sales/tag） |
| pagination | object | 分页信息 |

**错误码**：无

**业务说明**：基于用户浏览和购买历史推荐商品，支持分页加载。未登录用户返回热销商品。

---

### 3.4 分类模块

#### 3.4.1 分类树

- **请求方法**：`GET`
- **URL**：`/api/weapp/category/tree`
- **权限要求**：无

**请求参数**：无

**响应字段**：

| 字段名 | 类型 | 说明 |
|--------|------|------|
| list | array | 一级分类列表 |
| list[].id | number | 分类 ID |
| list[].name | string | 分类名称 |
| list[].icon | string | 分类图标 URL |
| list[].children | array | 二级分类列表（含 children 三级） |

**错误码**：无

**业务说明**：返回三级分类树结构，仅包含启用状态的分类。数据有 30 分钟缓存。

---

### 3.5 商品模块

#### 3.5.1 商品列表

- **请求方法**：`GET`
- **URL**：`/api/weapp/product/list`
- **权限要求**：无

**请求参数**：

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| page | number | 否 | 页码，默认 1 |
| pageSize | number | 否 | 每页条数，默认 10，最大 50 |
| categoryId | number | 否 | 分类 ID |
| keyword | string | 否 | 搜索关键词 |
| sort | string | 否 | 排序：default-综合 price_asc-价格升序 price_desc-价格降序 sales-销量 newest-最新 |
| minPrice | number | 否 | 最低价格（分） |
| maxPrice | number | 否 | 最高价格（分） |
| brandId | number | 否 | 品牌 ID |
| babyMonthAge | number | 否 | 宝宝月龄 |

**响应字段**：

| 字段名 | 类型 | 说明 |
|--------|------|------|
| list | array | 商品列表 |
| list[].id | number | 商品 ID |
| list[].name | string | 商品名称 |
| list[].mainImage | string | 主图 URL |
| list[].price | number | 最低 SKU 售价（分） |
| list[].originalPrice | number | 最低 SKU 原价（分） |
| list[].sales | number | 销量 |
| list[].tag | string | 标签 |
| list[].categoryId | number | 分类 ID |
| list[].brandId | number | 品牌 ID |
| pagination | object | 分页信息 |

**错误码**：40001（参数错误）

**业务说明**：仅返回上架状态的商品。支持分类、关键词、价格区间、品牌、月龄等多维度筛选。

---

#### 3.5.2 商品详情

- **请求方法**：`GET`
- **URL**：`/api/weapp/product/detail/:id`
- **权限要求**：无

**请求参数**：

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| id | number | 是 | 商品 ID（路径参数） |

**响应字段**：

| 字段名 | 类型 | 说明 |
|--------|------|------|
| id | number | 商品 ID |
| name | string | 商品名称 |
| subtitle | string | 副标题 |
| mainImage | string | 主图 URL |
| images | array | 轮播图 URL 列表 |
| detailImages | array | 详情图 URL 列表 |
| price | number | 最低售价（分） |
| originalPrice | number | 最低原价（分） |
| description | string | 商品描述（富文本） |
| sales | number | 总销量 |
| stock | number | 总库存 |
| categoryId | number | 分类 ID |
| categoryName | string | 分类名称 |
| brandId | number | 品牌 ID |
| brandName | string | 品牌名称 |
| skus | array | SKU 列表（含 id/name/price/originalPrice/stock/image/specs） |
| specGroups | array | 规格组列表（含 name/values） |
| tags | array | 标签列表（含 id/name/color） |
| isFavorite | boolean | 是否已收藏（需登录） |
| purchaseLimit | number | 限购数量，0 表示不限购 |
| monthAgeRange | string | 适用月龄范围 |
| status | number | 状态：1-上架 0-下架 |

**错误码**：40401（商品不存在）、10001（商品已下架）

**业务说明**：返回商品完整信息，包含 SKU 和规格组。登录用户可查看是否已收藏。

---

#### 3.5.3 推荐商品

- **请求方法**：`GET`
- **URL**：`/api/weapp/product/recommend`
- **权限要求**：无（登录后推荐更精准）

**请求参数**：

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| type | string | 否 | 推荐类型：month_age-按月龄 guess-猜你喜欢 hot-热门新品，默认 guess |
| babyId | number | 否 | 宝宝 ID（type=month_age 时必填） |
| page | number | 否 | 页码，默认 1 |
| pageSize | number | 否 | 每页条数，默认 10 |

**响应字段**：

| 字段名 | 类型 | 说明 |
|--------|------|------|
| list | array | 商品列表（结构同商品列表） |
| pagination | object | 分页信息 |

**错误码**：40001（参数错误）

**业务说明**：按月龄推荐根据宝宝月龄匹配适用商品；猜你喜欢基于用户浏览和购买历史推荐；热门新品按销量和上架时间排序。

---

### 3.6 品牌模块

#### 3.6.1 品牌列表

- **请求方法**：`GET`
- **URL**：`/api/weapp/brand/list`
- **权限要求**：无

**请求参数**：无

**响应字段**：

| 字段名 | 类型 | 说明 |
|--------|------|------|
| list | array | 品牌列表 |
| list[].id | number | 品牌 ID |
| list[].name | string | 品牌名称 |
| list[].logo | string | 品牌 Logo URL |
| list[].description | string | 品牌描述 |

**错误码**：无

**业务说明**：返回所有启用状态的品牌列表，用于品牌筛选和品牌专区展示。

---

### 3.7 搜索模块

#### 3.7.1 商品搜索

- **请求方法**：`GET`
- **URL**：`/api/weapp/search`
- **权限要求**：无

**请求参数**：

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| keyword | string | 是 | 搜索关键词 |
| page | number | 否 | 页码，默认 1 |
| pageSize | number | 否 | 每页条数，默认 10 |
| sort | string | 否 | 排序方式 |
| categoryId | number | 否 | 分类 ID |
| minPrice | number | 否 | 最低价格（分） |
| maxPrice | number | 否 | 最高价格（分） |
| brandId | number | 否 | 品牌 ID |

**响应字段**：

| 字段名 | 类型 | 说明 |
|--------|------|------|
| list | array | 商品列表（结构同商品列表） |
| pagination | object | 分页信息 |

**错误码**：40001（参数错误）

**业务说明**：搜索商品，支持关键词、分类、价格区间、品牌等多维度筛选。登录用户搜索时自动记录搜索历史。

---

#### 3.7.2 热门关键词

- **请求方法**：`GET`
- **URL**：`/api/weapp/search/hot`
- **权限要求**：无

**请求参数**：无

**响应字段**：

| 字段名 | 类型 | 说明 |
|--------|------|------|
| list | array | 热门搜索词列表 |
| list[].keyword | string | 搜索关键词 |
| list[].heat | number | 热度值 |

**错误码**：无

**业务说明**：返回近期搜索热度最高的关键词，最多 20 个。数据每日更新。

---

#### 3.7.3 搜索历史

- **请求方法**：`GET`
- **URL**：`/api/weapp/search/history`
- **权限要求**：需登录

**请求参数**：无

**响应字段**：

| 字段名 | 类型 | 说明 |
|--------|------|------|
| list | array | 搜索历史列表 |
| list[].keyword | string | 搜索关键词 |
| list[].searchedAt | string | 搜索时间 |

**错误码**：40101（未登录）

**业务说明**：返回当前用户最近 30 条搜索记录，按时间倒序。

---

#### 3.7.4 清空搜索历史

- **请求方法**：`DELETE`
- **URL**：`/api/weapp/search/history`
- **权限要求**：需登录

**请求参数**：无

**响应字段**：

| 字段名 | 类型 | 说明 |
|--------|------|------|
| success | boolean | 是否清空成功 |

**错误码**：40101（未登录）

**业务说明**：清空当前用户所有搜索历史记录。

---

### 3.8 购物车模块

#### 3.8.1 购物车列表

- **请求方法**：`GET`
- **URL**：`/api/weapp/cart/list`
- **权限要求**：需登录

**请求参数**：无

**响应字段**：

| 字段名 | 类型 | 说明 |
|--------|------|------|
| list | array | 购物车列表 |
| list[].id | number | 购物车项 ID |
| list[].productId | number | 商品 ID |
| list[].skuId | number | SKU ID |
| list[].productName | string | 商品名称 |
| list[].productImage | string | 商品图片 |
| list[].skuName | string | SKU 规格名称 |
| list[].price | number | 售价（分） |
| list[].originalPrice | number | 原价（分） |
| list[].quantity | number | 数量 |
| list[].stock | number | 当前库存 |
| list[].isSelected | boolean | 是否选中 |
| list[].isValid | boolean | 是否有效 |
| list[].purchaseLimit | number | 限购数量 |
| totalQuantity | number | 总数量 |
| selectedCount | number | 选中数量 |
| selectedAmount | number | 选中商品总金额（分） |

**错误码**：40101（未登录）

**业务说明**：返回当前用户购物车所有商品，标记无效商品。购物车最多 99 种商品。

---

#### 3.8.2 添加购物车

- **请求方法**：`POST`
- **URL**：`/api/weapp/cart/add`
- **权限要求**：需登录

**请求参数**：

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| productId | number | 是 | 商品 ID |
| skuId | number | 是 | SKU ID |
| quantity | number | 是 | 数量，最小 1 |

**响应字段**：

| 字段名 | 类型 | 说明 |
|--------|------|------|
| cartItemId | number | 购物车项 ID |
| totalQuantity | number | 购物车总数量 |

**错误码**：10001（商品已下架）、10002（库存不足）、10003（商品不存在）、10004（SKU 不存在）、20005（超出购买限制）

**业务说明**：若购物车已有相同 SKU，则数量累加。需校验商品是否上架、库存是否充足、是否超出限购数量。

---

#### 3.8.3 更新购物车

- **请求方法**：`PUT`
- **URL**：`/api/weapp/cart/update`
- **权限要求**：需登录

**请求参数**：

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| id | number | 是 | 购物车项 ID |
| quantity | number | 否 | 数量 |
| isSelected | boolean | 否 | 是否选中 |
| skuId | number | 否 | 更换 SKU |

**响应字段**：

| 字段名 | 类型 | 说明 |
|--------|------|------|
| success | boolean | 是否更新成功 |

**错误码**：10002（库存不足）、20005（超出购买限制）

**业务说明**：支持修改数量、选中状态、更换 SKU。更换 SKU 时需校验新 SKU 的库存和限购。

---

#### 3.8.4 删除购物车项

- **请求方法**：`DELETE`
- **URL**：`/api/weapp/cart/delete/:id`
- **权限要求**：需登录

**请求参数**：

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| id | number | 是 | 购物车项 ID（路径参数） |

**响应字段**：

| 字段名 | 类型 | 说明 |
|--------|------|------|
| success | boolean | 是否删除成功 |

**错误码**：40401（购物车项不存在）

**业务说明**：删除指定的购物车项。

---

#### 3.8.5 全选/取消全选

- **请求方法**：`PUT`
- **URL**：`/api/weapp/cart/select-all`
- **权限要求**：需登录

**请求参数**：

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| isSelected | boolean | 是 | true-全选 false-取消全选 |

**响应字段**：

| 字段名 | 类型 | 说明 |
|--------|------|------|
| success | boolean | 是否操作成功 |

**错误码**：40101（未登录）

**业务说明**：设置所有有效购物车项的选中状态。

---

#### 3.8.6 删除选中

- **请求方法**：`DELETE`
- **URL**：`/api/weapp/cart/remove-selected`
- **权限要求**：需登录

**请求参数**：无

**响应字段**：

| 字段名 | 类型 | 说明 |
|--------|------|------|
| success | boolean | 是否删除成功 |

**错误码**：40101（未登录）

**业务说明**：删除购物车中所有已选中的商品项。

---

### 3.9 订单模块

#### 3.9.1 订单确认（预览）

- **请求方法**：`POST`
- **URL**：`/api/weapp/order/confirm`
- **权限要求**：需登录

**请求参数**：

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| cartItemIds | array | 否 | 购物车项 ID 列表（从购物车下单时传） |
| items | array | 否 | 直接购买商品列表（立即购买时传，含 productId/skuId/quantity） |
| addressId | number | 否 | 收货地址 ID |

**响应字段**：

| 字段名 | 类型 | 说明 |
|--------|------|------|
| orderItems | array | 订单商品列表（含 productId/skuId/productName/productImage/skuName/price/quantity/subtotal） |
| address | object | 收货地址（默认地址或指定地址） |
| totalAmount | number | 商品总金额（分） |
| freightAmount | number | 运费（分） |
| discountAmount | number | 优惠金额（分） |
| payAmount | number | 应付金额（分） |
| availableCoupons | array | 可用优惠券列表（含 id/name/type/value/minAmount/discountAmount） |
| pointsDiscount | object | 积分抵扣信息（含 availablePoints/pointsToMoney/maxDiscount） |

**错误码**：10001（商品已下架）、10002（库存不足）、10005（价格已变动）

**业务说明**：订单确认接口不创建订单，仅计算价格和展示可用优惠券。需校验商品状态、库存、价格是否变动。

---

#### 3.9.2 创建订单

- **请求方法**：`POST`
- **URL**：`/api/weapp/order/create`
- **权限要求**：需登录

**请求参数**：

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| cartItemIds | array | 否 | 购物车项 ID 列表 |
| items | array | 否 | 直接购买商品列表 |
| addressId | number | 是 | 收货地址 ID |
| couponId | number | 否 | 使用的优惠券 ID |
| usePoints | number | 否 | 使用积分数量 |
| remark | string | 否 | 买家备注，最长 200 字符 |
| source | string | 否 | 订单来源：cart-购物车 buy_now-立即购买 |

**响应字段**：

| 字段名 | 类型 | 说明 |
|--------|------|------|
| orderId | number | 订单 ID |
| orderNo | string | 订单编号 |
| payAmount | number | 应付金额（分） |
| needPay | boolean | 是否需要支付 |

**错误码**：10001（商品已下架）、10002（库存不足）、10005（价格已变动）、30004（优惠券未满足使用条件）、60002（积分不足）

**业务说明**：创建订单时需再次校验商品状态、库存、价格。使用乐观锁防止超卖。创建成功后扣减库存（预扣），30 分钟未支付自动取消并释放库存。

---

#### 3.9.3 订单支付

- **请求方法**：`POST`
- **URL**：`/api/weapp/order/pay/:id`
- **权限要求**：需登录

**请求参数**：

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| id | number | 是 | 订单 ID（路径参数） |

**响应字段**：

| 字段名 | 类型 | 说明 |
|--------|------|------|
| timeStamp | string | 时间戳 |
| nonceStr | string | 随机字符串 |
| package | string | 统一下单返回的 prepay_id 参数 |
| signType | string | 签名类型 |
| paySign | string | 签名 |

**错误码**：20001（订单不存在）、20002（订单状态不允许此操作）、20004（订单已支付）、50004（微信接口调用失败）

**业务说明**：仅待支付状态的订单可发起支付。该接口跳转至支付模块，后端调用微信支付统一下单接口。支付结果以微信支付回调为准。

---

#### 3.9.4 订单列表

- **请求方法**：`GET`
- **URL**：`/api/weapp/order/list`
- **权限要求**：需登录

**请求参数**：

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| page | number | 否 | 页码，默认 1 |
| pageSize | number | 否 | 每页条数，默认 10 |
| status | number | 否 | 订单状态：0-全部 1-待付款 2-待发货 3-待收货 4-已完成 5-已取消 6-售后中 |

**响应字段**：

| 字段名 | 类型 | 说明 |
|--------|------|------|
| list | array | 订单列表 |
| list[].id | number | 订单 ID |
| list[].orderNo | string | 订单编号 |
| list[].status | number | 订单状态 |
| list[].statusText | string | 状态文字 |
| list[].totalAmount | number | 商品总金额（分） |
| list[].freightAmount | number | 运费（分） |
| list[].discountAmount | number | 优惠金额（分） |
| list[].payAmount | number | 实付金额（分） |
| list[].items | array | 订单商品列表（含 productId/productName/productImage/skuName/price/quantity） |
| list[].createdAt | string | 创建时间 |
| list[].remainPaySeconds | number | 剩余支付时间（秒），仅待付款状态 |
| pagination | object | 分页信息 |

**错误码**：40101（未登录）

**业务说明**：按创建时间倒序排列。待付款订单显示剩余支付倒计时。

---

#### 3.9.5 订单详情

- **请求方法**：`GET`
- **URL**：`/api/weapp/order/detail/:id`
- **权限要求**：需登录

**请求参数**：

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| id | number | 是 | 订单 ID（路径参数） |

**响应字段**：

| 字段名 | 类型 | 说明 |
|--------|------|------|
| id | number | 订单 ID |
| orderNo | string | 订单编号 |
| status | number | 订单状态 |
| statusText | string | 状态文字 |
| items | array | 订单商品列表 |
| address | object | 收货地址（含 name/phone/fullAddress） |
| totalAmount | number | 商品总金额（分） |
| freightAmount | number | 运费（分） |
| discountAmount | number | 优惠金额（分） |
| couponDiscount | number | 优惠券优惠金额（分） |
| pointsDiscount | number | 积分抵扣金额（分） |
| payAmount | number | 实付金额（分） |
| payMethod | string | 支付方式 |
| payTime | string | 支付时间 |
| remark | string | 买家备注 |
| adminRemark | string | 管理员备注 |
| logistics | object | 物流信息（含 company/trackingNo/status/traces） |
| deliverTime | string | 发货时间 |
| receiveTime | string | 收货时间 |
| cancelTime | string | 取消时间 |
| cancelReason | string | 取消原因 |
| remainPaySeconds | number | 剩余支付时间（秒） |
| canApplyAftersale | boolean | 是否可申请售后 |
| createdAt | string | 创建时间 |

**错误码**：20001（订单不存在）

**业务说明**：返回订单完整信息，包含物流轨迹。只能查看自己的订单。

---

#### 3.9.6 取消订单

- **请求方法**：`PUT`
- **URL**：`/api/weapp/order/cancel/:id`
- **权限要求**：需登录

**请求参数**：

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| id | number | 是 | 订单 ID（路径参数） |
| reason | string | 否 | 取消原因 |

**响应字段**：

| 字段名 | 类型 | 说明 |
|--------|------|------|
| success | boolean | 是否取消成功 |

**错误码**：20001（订单不存在）、20002（订单状态不允许此操作）

**业务说明**：仅待付款状态的订单可取消。取消后释放库存，退回优惠券和积分。

---

#### 3.9.7 确认收货

- **请求方法**：`PUT`
- **URL**：`/api/weapp/order/confirm-receive/:id`
- **权限要求**：需登录

**请求参数**：

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| id | number | 是 | 订单 ID（路径参数） |

**响应字段**：

| 字段名 | 类型 | 说明 |
|--------|------|------|
| success | boolean | 是否确认成功 |

**错误码**：20001（订单不存在）、20002（订单状态不允许此操作）

**业务说明**：仅待收货状态的订单可确认收货。确认收货后触发积分发放。发货后 15 天未确认将自动确认。

---

#### 3.9.8 订单状态计数

- **请求方法**：`GET`
- **URL**：`/api/weapp/order/count`
- **权限要求**：需登录

**请求参数**：无

**响应字段**：

| 字段名 | 类型 | 说明 |
|--------|------|------|
| pendingPay | number | 待付款数量 |
| pendingShip | number | 待发货数量 |
| pendingReceive | number | 待收货数量 |
| pendingReview | number | 待评价数量 |
| aftersale | number | 售后中数量 |

**错误码**：40101（未登录）

**业务说明**：返回各状态订单数量，用于订单页面 Tab 角标展示。

---

### 3.10 地址模块

#### 3.10.1 地址列表

- **请求方法**：`GET`
- **URL**：`/api/weapp/address`
- **权限要求**：需登录

**请求参数**：无

**响应字段**：

| 字段名 | 类型 | 说明 |
|--------|------|------|
| list | array | 地址列表 |
| list[].id | number | 地址 ID |
| list[].name | string | 收货人姓名 |
| list[].phone | string | 手机号 |
| list[].province | string | 省份 |
| list[].city | string | 城市 |
| list[].district | string | 区县 |
| list[].detail | string | 详细地址 |
| list[].isDefault | boolean | 是否默认地址 |
| list[].fullAddress | string | 完整地址（省市区+详细） |

**错误码**：40101（未登录）

**业务说明**：返回当前用户所有收货地址，默认地址排在首位。每个用户最多保存 20 个地址。

---

#### 3.10.2 地址详情

- **请求方法**：`GET`
- **URL**：`/api/weapp/address/:id`
- **权限要求**：需登录

**请求参数**：

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| id | number | 是 | 地址 ID（路径参数） |

**响应字段**：

| 字段名 | 类型 | 说明 |
|--------|------|------|
| id | number | 地址 ID |
| name | string | 收货人姓名 |
| phone | string | 手机号 |
| province | string | 省份 |
| city | string | 城市 |
| district | string | 区县 |
| detail | string | 详细地址 |
| isDefault | boolean | 是否默认地址 |
| fullAddress | string | 完整地址 |

**错误码**：40401（地址不存在）

**业务说明**：只能查看自己的地址信息。

---

#### 3.10.3 创建地址

- **请求方法**：`POST`
- **URL**：`/api/weapp/address`
- **权限要求**：需登录

**请求参数**：

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| name | string | 是 | 收货人姓名，最长 20 字符 |
| phone | string | 是 | 手机号，11 位 |
| province | string | 是 | 省份 |
| city | string | 是 | 城市 |
| district | string | 是 | 区县 |
| detail | string | 是 | 详细地址，最长 200 字符 |
| isDefault | boolean | 否 | 是否设为默认，默认 false |

**响应字段**：

| 字段名 | 类型 | 说明 |
|--------|------|------|
| id | number | 新创建的地址 ID |

**错误码**：40001（参数错误）、40002（超出地址数量限制）

**业务说明**：若 isDefault 为 true，将取消原默认地址的默认标记。每个用户最多 20 个地址。

---

#### 3.10.4 更新地址

- **请求方法**：`PUT`
- **URL**：`/api/weapp/address/:id`
- **权限要求**：需登录

**请求参数**：

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| id | number | 是 | 地址 ID（路径参数） |
| name | string | 否 | 收货人姓名 |
| phone | string | 否 | 手机号 |
| province | string | 否 | 省份 |
| city | string | 否 | 城市 |
| district | string | 否 | 区县 |
| detail | string | 否 | 详细地址 |
| isDefault | boolean | 否 | 是否设为默认 |

**响应字段**：

| 字段名 | 类型 | 说明 |
|--------|------|------|
| success | boolean | 是否更新成功 |

**错误码**：40401（地址不存在）、40001（参数错误）

**业务说明**：只能更新自己的地址。若设为默认地址，将取消原默认地址标记。

---

#### 3.10.5 删除地址

- **请求方法**：`DELETE`
- **URL**：`/api/weapp/address/:id`
- **权限要求**：需登录

**请求参数**：

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| id | number | 是 | 地址 ID（路径参数） |

**响应字段**：

| 字段名 | 类型 | 说明 |
|--------|------|------|
| success | boolean | 是否删除成功 |

**错误码**：40401（地址不存在）

**业务说明**：只能删除自己的地址。若删除的是默认地址，将自动将最早创建的地址设为默认。

---

#### 3.10.6 设为默认地址

- **请求方法**：`PUT`
- **URL**：`/api/weapp/address/:id/default`
- **权限要求**：需登录

**请求参数**：

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| id | number | 是 | 地址 ID（路径参数） |

**响应字段**：

| 字段名 | 类型 | 说明 |
|--------|------|------|
| success | boolean | 是否设置成功 |

**错误码**：40401（地址不存在）

**业务说明**：将指定地址设为默认，同时取消原默认地址的默认标记。

---

### 3.11 优惠券模块

#### 3.11.1 可领优惠券

- **请求方法**：`GET`
- **URL**：`/api/weapp/coupon/available`
- **权限要求**：无

**请求参数**：

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| page | number | 否 | 页码，默认 1 |
| pageSize | number | 否 | 每页条数，默认 10 |

**响应字段**：

| 字段名 | 类型 | 说明 |
|--------|------|------|
| list | array | 优惠券列表（含 id/name/type/value/minAmount/startTime/endTime/totalCount/remainCount/limitPerUser/receivedCount/canReceive） |
| pagination | object | 分页信息 |

**错误码**：无

**业务说明**：返回当前可领取的优惠券列表。登录用户可查看已领取数量和是否可领取。

---

#### 3.11.2 领券中心

- **请求方法**：`GET`
- **URL**：`/api/weapp/coupon/center`
- **权限要求**：无

**请求参数**：

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| page | number | 否 | 页码，默认 1 |
| pageSize | number | 否 | 每页条数，默认 10 |

**响应字段**：

| 字段名 | 类型 | 说明 |
|--------|------|------|
| list | array | 优惠券列表（含 id/name/type/value/minAmount/startTime/endTime/totalCount/remainCount/limitPerUser/receivedCount/canReceive） |
| pagination | object | 分页信息 |

**错误码**：无

**业务说明**：领券中心页面专用接口，返回所有可领取的优惠券，支持分页。

---

#### 3.11.3 我的优惠券

- **请求方法**：`GET`
- **URL**：`/api/weapp/coupon/my`
- **权限要求**：需登录

**请求参数**：

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| status | number | 否 | 状态：0-全部 1-未使用 2-已使用 3-已过期 |

**响应字段**：

| 字段名 | 类型 | 说明 |
|--------|------|------|
| list | array | 优惠券列表（含 id/couponId/name/type/value/minAmount/startTime/endTime/status/statusText/usedAt） |

**错误码**：40101（未登录）

**业务说明**：返回当前用户已领取的优惠券列表。

---

#### 3.11.4 领取优惠券

- **请求方法**：`POST`
- **URL**：`/api/weapp/coupon/receive/:couponId`
- **权限要求**：需登录

**请求参数**：

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| couponId | number | 是 | 优惠券 ID（路径参数） |

**响应字段**：

| 字段名 | 类型 | 说明 |
|--------|------|------|
| success | boolean | 是否领取成功 |
| userCouponId | number | 用户优惠券 ID |

**错误码**：30001（优惠券不存在）、30002（优惠券已领完）、30003（优惠券已领取）、30005（优惠券已过期）

**业务说明**：需校验优惠券库存、领取限制、有效期。使用乐观锁防止超领。

---

#### 3.11.5 可用优惠券

- **请求方法**：`GET`
- **URL**：`/api/weapp/coupon/usable`
- **权限要求**：需登录

**请求参数**：

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| amount | number | 是 | 订单商品总金额（分） |

**响应字段**：

| 字段名 | 类型 | 说明 |
|--------|------|------|
| list | array | 可用优惠券列表（含 discountAmount） |
| unavailableList | array | 不可用优惠券列表（含 id/name/reason） |

**错误码**：40101（未登录）

**业务说明**：根据订单金额筛选可用和不可用优惠券，不可用的需说明原因。

---

### 3.12 售后模块

#### 3.12.1 申请售后

- **请求方法**：`POST`
- **URL**：`/api/weapp/aftersale/create`
- **权限要求**：需登录

**请求参数**：

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| orderId | number | 是 | 订单 ID |
| orderItemId | number | 是 | 订单商品项 ID |
| type | number | 是 | 售后类型：1-仅退款 2-退货退款 3-换货 |
| reason | string | 是 | 售后原因 |
| description | string | 否 | 问题描述，最长 500 字符 |
| images | array | 否 | 凭证图片 URL 列表，最多 9 张 |
| refundAmount | number | 否 | 退款金额（分），不传则默认为商品实付金额 |

**响应字段**：

| 字段名 | 类型 | 说明 |
|--------|------|------|
| id | number | 售后单 ID |
| aftersaleNo | string | 售后单号 |

**错误码**：20001（订单不存在）、50003（超出售后申请时效）、20002（订单状态不允许此操作）

**业务说明**：订单完成后 15 天内可申请售后。每个订单商品项仅可申请一次售后。退款金额不能超过商品实付金额。

---

#### 3.12.2 售后列表

- **请求方法**：`GET`
- **URL**：`/api/weapp/aftersale/list`
- **权限要求**：需登录

**请求参数**：

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| page | number | 否 | 页码，默认 1 |
| pageSize | number | 否 | 每页条数，默认 10 |
| status | number | 否 | 状态：0-全部 1-待审核 2-审核通过 3-审核拒绝 4-退货中 5-已退款 6-已关闭 |

**响应字段**：

| 字段名 | 类型 | 说明 |
|--------|------|------|
| list | array | 售后列表（含 id/aftersaleNo/type/typeText/status/statusText/reason/refundAmount/productName/productImage/skuName/quantity/createdAt） |
| pagination | object | 分页信息 |

**错误码**：40101（未登录）

**业务说明**：按创建时间倒序排列。

---

#### 3.12.3 售后详情

- **请求方法**：`GET`
- **URL**：`/api/weapp/aftersale/detail/:id`
- **权限要求**：需登录

**请求参数**：

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| id | number | 是 | 售后单 ID（路径参数） |

**响应字段**：

| 字段名 | 类型 | 说明 |
|--------|------|------|
| id | number | 售后单 ID |
| aftersaleNo | string | 售后单号 |
| type | number | 售后类型 |
| typeText | string | 类型文字 |
| status | number | 状态 |
| statusText | string | 状态文字 |
| reason | string | 售后原因 |
| description | string | 问题描述 |
| images | array | 凭证图片列表 |
| refundAmount | number | 退款金额（分） |
| orderInfo | object | 关联订单信息（含 orderNo/productName/productImage/skuName/price/quantity） |
| rejectReason | string | 拒绝原因 |
| returnLogistics | object | 退货物流信息（含 company/trackingNo） |
| refundTime | string | 退款时间 |
| createdAt | string | 创建时间 |
| updatedAt | string | 更新时间 |

**错误码**：50001（售后申请不存在）

**业务说明**：只能查看自己的售后单。

---

#### 3.12.4 填写退货物流

- **请求方法**：`PUT`
- **URL**：`/api/weapp/aftersale/return-logistics/:id`
- **权限要求**：需登录

**请求参数**：

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| id | number | 是 | 售后单 ID（路径参数） |
| company | string | 是 | 物流公司 |
| trackingNo | string | 是 | 运单号 |

**响应字段**：

| 字段名 | 类型 | 说明 |
|--------|------|------|
| success | boolean | 是否提交成功 |

**错误码**：50001（售后申请不存在）、50002（售后状态不允许此操作）

**业务说明**：仅审核通过且售后类型为退货退款/换货的售后单需填写退货物流。

---

#### 3.12.5 取消售后

- **请求方法**：`PUT`
- **URL**：`/api/weapp/aftersale/cancel/:id`
- **权限要求**：需登录

**请求参数**：

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| id | number | 是 | 售后单 ID（路径参数） |

**响应字段**：

| 字段名 | 类型 | 说明 |
|--------|------|------|
| success | boolean | 是否取消成功 |

**错误码**：50001（售后申请不存在）、50002（售后状态不允许此操作）

**业务说明**：仅待审核状态的售后单可取消。取消后不可再次申请。

---

### 3.13 支付模块

#### 3.13.1 创建支付

- **请求方法**：`POST`
- **URL**：`/api/weapp/pay/create`
- **权限要求**：需登录

**请求参数**：

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| orderId | number | 是 | 订单 ID |

**响应字段**：

| 字段名 | 类型 | 说明 |
|--------|------|------|
| timeStamp | string | 时间戳 |
| nonceStr | string | 随机字符串 |
| package | string | 统一下单返回的 prepay_id 参数 |
| signType | string | 签名类型 |
| paySign | string | 签名 |

**错误码**：20001（订单不存在）、20002（订单状态不允许此操作）、50004（微信接口调用失败）

**业务说明**：创建微信支付订单，返回小程序调起支付所需的参数。仅待支付状态的订单可发起支付。

---

#### 3.13.2 支付回调

- **请求方法**：`POST`
- **URL**：`/api/weapp/pay/callback`
- **权限要求**：无（Public，微信服务器调用）

**请求参数**：微信支付回调 XML/JSON 数据（由微信服务器发送）

**响应字段**：按微信支付规范返回处理结果

**业务说明**：微信支付完成后，微信服务器会调用此接口通知支付结果。后端需验签后更新订单状态：支付成功则将订单状态改为待发货，扣减实际库存，发放积分；支付失败则将订单状态改为已取消，释放预扣库存。需处理重复通知（幂等性），确保同一笔订单只处理一次。

---

#### 3.13.3 支付状态查询

- **请求方法**：`GET`
- **URL**：`/api/weapp/pay/status/:orderId`
- **权限要求**：需登录

**请求参数**：

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| orderId | number | 是 | 订单 ID（路径参数） |

**响应字段**：

| 字段名 | 类型 | 说明 |
|--------|------|------|
| orderId | number | 订单 ID |
| payStatus | number | 支付状态：0-未支付 1-已支付 2-支付失败 |
| payTime | string | 支付时间 |

**错误码**：20001（订单不存在）

**业务说明**：前端轮询查询支付状态，用于判断支付是否完成。

---

### 3.14 会员模块

#### 3.14.1 会员等级列表

- **请求方法**：`GET`
- **URL**：`/api/weapp/member/levels`
- **权限要求**：无

**请求参数**：无

**响应字段**：

| 字段名 | 类型 | 说明 |
|--------|------|------|
| list | array | 会员等级列表 |
| list[].level | number | 等级编号 |
| list[].name | string | 等级名称 |
| list[].icon | string | 等级图标 |
| list[].requiredSpent | number | 所需消费金额（分） |
| list[].discount | number | 折扣率 |
| list[].privileges | array | 权益列表 |

**错误码**：无

**业务说明**：返回所有会员等级配置信息，用于等级展示和对比。

---

#### 3.14.2 会员信息

- **请求方法**：`GET`
- **URL**：`/api/weapp/member/info`
- **权限要求**：需登录

**请求参数**：无

**响应字段**：

| 字段名 | 类型 | 说明 |
|--------|------|------|
| level | number | 当前等级 |
| levelName | string | 等级名称 |
| points | number | 当前积分 |
| totalPoints | number | 累计积分 |
| totalSpent | number | 累计消费金额（分） |
| nextLevel | object | 下一等级信息（含 level/name/requiredSpent/progress） |
| privileges | array | 当前等级权益列表（含 id/name/icon/description） |
| couponCount | number | 可用优惠券数量 |
| orderCount | number | 订单数量 |
| favoriteCount | number | 收藏数量 |

**错误码**：40101（未登录）

**业务说明**：返回会员中心页面所有展示数据。

---

#### 3.14.3 会员权益

- **请求方法**：`GET`
- **URL**：`/api/weapp/member/benefits`
- **权限要求**：需登录

**请求参数**：无

**响应字段**：

| 字段名 | 类型 | 说明 |
|--------|------|------|
| levels | array | 各等级权益列表（含 level/name/icon/requiredSpent/privileges[]含 id/name/icon/description/isUnlocked） |

**错误码**：40101（未登录）

**业务说明**：展示所有等级的权益对比，标记当前用户已解锁的权益。

---

### 3.15 积分模块

#### 3.15.1 积分余额

- **请求方法**：`GET`
- **URL**：`/api/weapp/points/balance`
- **权限要求**：需登录

**请求参数**：无

**响应字段**：

| 字段名 | 类型 | 说明 |
|--------|------|------|
| points | number | 当前积分余额 |
| totalEarned | number | 累计获得积分 |
| totalUsed | number | 累计使用积分 |
| todaySignedIn | boolean | 今日是否已签到 |
| continuousDays | number | 连续签到天数 |

**错误码**：40101（未登录）

**业务说明**：返回积分概览信息，包含签到状态。

---

#### 3.15.2 积分记录

- **请求方法**：`GET`
- **URL**：`/api/weapp/points/records`
- **权限要求**：需登录

**请求参数**：

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| page | number | 否 | 页码，默认 1 |
| pageSize | number | 否 | 每页条数，默认 20 |
| type | number | 否 | 类型筛选：0-全部 1-收入 2-支出 |

**响应字段**：

| 字段名 | 类型 | 说明 |
|--------|------|------|
| list | array | 积分记录列表（含 id/type/points/balance/source/description/createdAt） |
| pagination | object | 分页信息 |

**错误码**：40101（未登录）

**业务说明**：按时间倒序排列。source 可选值：sign_in/purchase/consume/activity/admin。

---

#### 3.15.3 签到

- **请求方法**：`POST`
- **URL**：`/api/weapp/points/sign-in`
- **权限要求**：需登录

**请求参数**：无

**响应字段**：

| 字段名 | 类型 | 说明 |
|--------|------|------|
| points | number | 本次获得积分 |
| continuousDays | number | 连续签到天数 |
| totalPoints | number | 当前积分余额 |

**错误码**：40901（今日已签到）

**业务说明**：每日签到获得积分，连续签到天数越多积分越高。每日仅可签到一次。

---

#### 3.15.4 签到状态

- **请求方法**：`GET`
- **URL**：`/api/weapp/points/sign-in/status`
- **权限要求**：需登录

**请求参数**：无

**响应字段**：

| 字段名 | 类型 | 说明 |
|--------|------|------|
| todaySignedIn | boolean | 今日是否已签到 |
| continuousDays | number | 连续签到天数 |
| signInCalendar | array | 本月签到日历（含 day/signedIn） |

**错误码**：40101（未登录）

**业务说明**：返回签到状态和当月签到日历。

---

#### 3.15.5 积分规则

- **请求方法**：`GET`
- **URL**：`/api/weapp/points/rules`
- **权限要求**：无

**请求参数**：无

**响应字段**：

| 字段名 | 类型 | 说明 |
|--------|------|------|
| list | array | 积分规则列表（含 id/name/description/points/icon） |

**错误码**：无

**业务说明**：返回所有积分获取和消耗规则说明。

---

### 3.16 宝宝档案模块

#### 3.16.1 宝宝档案列表

- **请求方法**：`GET`
- **URL**：`/api/weapp/baby-profile`
- **权限要求**：需登录

**请求参数**：无

**响应字段**：

| 字段名 | 类型 | 说明 |
|--------|------|------|
| list | array | 宝宝列表 |
| list[].id | number | 宝宝 ID |
| list[].name | string | 宝宝昵称 |
| list[].gender | number | 性别：0-未知 1-男 2-女 |
| list[].birthday | string | 出生日期 |
| list[].monthAge | number | 月龄（自动计算） |
| list[].avatarUrl | string | 头像 |
| list[].isDefault | boolean | 是否默认宝宝 |

**错误码**：40101（未登录）

**业务说明**：返回当前用户所有宝宝档案，默认宝宝排在首位。每个用户最多 5 个宝宝档案。

---

#### 3.16.2 宝宝档案详情

- **请求方法**：`GET`
- **URL**：`/api/weapp/baby-profile/:id`
- **权限要求**：需登录

**请求参数**：

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| id | number | 是 | 宝宝 ID（路径参数） |

**响应字段**：

| 字段名 | 类型 | 说明 |
|--------|------|------|
| id | number | 宝宝 ID |
| name | string | 昵称 |
| gender | number | 性别 |
| birthday | string | 出生日期 |
| monthAge | number | 月龄 |
| avatarUrl | string | 头像 |
| isDefault | boolean | 是否默认 |
| weight | number | 体重（kg） |
| height | number | 身高（cm） |
| feedingType | number | 喂养方式：0-未知 1-母乳 2-奶粉 3-混合 |
| allergyInfo | string | 过敏信息 |
| createdAt | string | 创建时间 |

**错误码**：40401（宝宝档案不存在）

**业务说明**：只能查看自己的宝宝档案。月龄由生日自动计算。

---

#### 3.16.3 创建宝宝档案

- **请求方法**：`POST`
- **URL**：`/api/weapp/baby-profile`
- **权限要求**：需登录

**请求参数**：

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| name | string | 是 | 宝宝昵称，最长 20 字符 |
| gender | number | 是 | 性别：1-男 2-女 |
| birthday | string | 是 | 出生日期，格式 YYYY-MM-DD |
| avatarUrl | string | 否 | 头像 URL |
| weight | number | 否 | 体重（kg） |
| height | number | 否 | 身高（cm） |
| feedingType | number | 否 | 喂养方式：0-未知 1-母乳 2-奶粉 3-混合 |
| allergyInfo | string | 否 | 过敏信息，最长 200 字符 |
| isDefault | boolean | 否 | 是否设为默认，默认 false |

**响应字段**：

| 字段名 | 类型 | 说明 |
|--------|------|------|
| id | number | 新创建的宝宝 ID |

**错误码**：40001（参数错误）

**业务说明**：每个用户最多 5 个宝宝档案。宝宝生日不能晚于当前日期。新增宝宝后，系统可根据月龄推荐适合的商品。

---

#### 3.16.4 更新宝宝档案

- **请求方法**：`PUT`
- **URL**：`/api/weapp/baby-profile/:id`
- **权限要求**：需登录

**请求参数**：

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| id | number | 是 | 宝宝 ID（路径参数） |
| name | string | 否 | 昵称 |
| gender | number | 否 | 性别 |
| birthday | string | 否 | 出生日期 |
| avatarUrl | string | 否 | 头像 |
| weight | number | 否 | 体重 |
| height | number | 否 | 身高 |
| feedingType | number | 否 | 喂养方式 |
| allergyInfo | string | 否 | 过敏信息 |
| isDefault | boolean | 否 | 是否默认 |

**响应字段**：

| 字段名 | 类型 | 说明 |
|--------|------|------|
| success | boolean | 是否更新成功 |

**错误码**：40401（宝宝档案不存在）、40001（参数错误）

**业务说明**：只能更新自己的宝宝档案。

---

#### 3.16.5 删除宝宝档案

- **请求方法**：`DELETE`
- **URL**：`/api/weapp/baby-profile/:id`
- **权限要求**：需登录

**请求参数**：

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| id | number | 是 | 宝宝 ID（路径参数） |

**响应字段**：

| 字段名 | 类型 | 说明 |
|--------|------|------|
| success | boolean | 是否删除成功 |

**错误码**：40401（宝宝档案不存在）

**业务说明**：只能删除自己的宝宝档案。若删除的是默认宝宝，将自动将最早创建的宝宝设为默认。

---

### 3.17 活动模块

#### 3.17.1 进行中活动

- **请求方法**：`GET`
- **URL**：`/api/weapp/activity/active`
- **权限要求**：无

**请求参数**：无

**响应字段**：

| 字段名 | 类型 | 说明 |
|--------|------|------|
| list | array | 活动列表（含 id/title/coverImage/type/typeText/startTime/endTime） |

**错误码**：无

**业务说明**：返回当前进行中的所有活动列表。

---

#### 3.17.2 活动详情

- **请求方法**：`GET`
- **URL**：`/api/weapp/activity/:id`
- **权限要求**：无

**请求参数**：

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| id | number | 是 | 活动 ID（路径参数） |

**响应字段**：

| 字段名 | 类型 | 说明 |
|--------|------|------|
| id | number | 活动 ID |
| title | string | 活动标题 |
| coverImage | string | 封面图 |
| type | number | 活动类型 |
| typeText | string | 类型文字 |
| status | number | 活动状态 |
| statusText | string | 状态文字 |
| startTime | string | 开始时间 |
| endTime | string | 结束时间 |
| description | string | 活动描述（富文本） |
| rules | string | 活动规则（富文本） |
| products | array | 活动商品列表（含 id/name/mainImage/price/activityPrice/stock/sales/limitPerUser） |
| discountRules | array | 满减规则（type=2 时，含 minAmount/discountAmount） |

**错误码**：70001（活动不存在）

**业务说明**：返回活动完整信息，包含活动商品和规则。

---

#### 3.17.3 按类型查活动

- **请求方法**：`GET`
- **URL**：`/api/weapp/activity/type/:type`
- **权限要求**：无

**请求参数**：

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| type | number | 是 | 活动类型（路径参数）：1-限时折扣 2-满减 3-满赠 4-组合套餐 5-新人礼包 |

**响应字段**：

| 字段名 | 类型 | 说明 |
|--------|------|------|
| list | array | 活动列表（含 id/title/coverImage/type/typeText/startTime/endTime） |

**错误码**：无

**业务说明**：按活动类型筛选返回活动列表。

---

### 3.18 内容模块

#### 3.18.1 内容分类

- **请求方法**：`GET`
- **URL**：`/api/weapp/content/categories`
- **权限要求**：无

**请求参数**：无

**响应字段**：

| 字段名 | 类型 | 说明 |
|--------|------|------|
| list | array | 内容分类列表（含 id/name/sort） |

**错误码**：无

**业务说明**：返回所有内容分类，用于内容页 Tab 展示。

---

#### 3.18.2 内容列表

- **请求方法**：`GET`
- **URL**：`/api/weapp/content/list`
- **权限要求**：无

**请求参数**：

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| page | number | 否 | 页码，默认 1 |
| pageSize | number | 否 | 每页条数，默认 10 |
| categoryId | number | 否 | 内容分类 ID |

**响应字段**：

| 字段名 | 类型 | 说明 |
|--------|------|------|
| list | array | 内容列表（含 id/title/coverImage/summary/categoryId/categoryName/viewCount/publishedAt） |
| pagination | object | 分页信息 |

**错误码**：无

**业务说明**：返回已发布的内容列表，如育儿知识、品牌故事等。

---

#### 3.18.3 内容详情

- **请求方法**：`GET`
- **URL**：`/api/weapp/content/:id`
- **权限要求**：无

**请求参数**：

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| id | number | 是 | 内容 ID（路径参数） |

**响应字段**：

| 字段名 | 类型 | 说明 |
|--------|------|------|
| id | number | 内容 ID |
| title | string | 标题 |
| coverImage | string | 封面图 |
| content | string | 正文内容（富文本） |
| summary | string | 摘要 |
| categoryId | number | 分类 ID |
| categoryName | string | 分类名称 |
| viewCount | number | 浏览量 |
| publishedAt | string | 发布时间 |
| relatedProducts | array | 关联推荐商品（含 id/name/mainImage/price） |

**错误码**：40401（内容不存在）

**业务说明**：访问时自动增加浏览量。可关联推荐商品，实现内容带货。

---

### 3.19 分享模块

#### 3.19.1 记录分享

- **请求方法**：`POST`
- **URL**：`/api/weapp/share/record`
- **权限要求**：需登录

**请求参数**：

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| type | string | 是 | 分享类型：product-商品 activity-活动 content-内容 |
| targetId | number | 是 | 分享目标 ID |
| channel | string | 否 | 分享渠道：wechat-微信好友 moments-朋友圈 |

**响应字段**：

| 字段名 | 类型 | 说明 |
|--------|------|------|
| success | boolean | 是否记录成功 |
| pointsEarned | number | 获得积分（分享奖励） |

**错误码**：40001（参数错误）

**业务说明**：记录用户分享行为，用于数据统计。根据积分规则可能获得分享奖励积分。

---

#### 3.19.2 分享海报

- **请求方法**：`GET`
- **URL**：`/api/weapp/share/poster`
- **权限要求**：需登录

**请求参数**：

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| type | string | 是 | 海报类型：product-商品 activity-活动 |
| targetId | number | 是 | 目标 ID |

**响应字段**：

| 字段名 | 类型 | 说明 |
|--------|------|------|
| posterUrl | string | 海报图片 URL |
| miniProgramCode | string | 小程序码 URL |

**错误码**：40001（参数错误）、40401（目标不存在）

**业务说明**：生成带小程序码的分享海报图片。海报有 1 小时缓存。

---

## 4. 公共 API

### 4.1 文件上传

- **请求方法**：`POST`
- **URL**：`/api/common/file/upload`
- **权限要求**：需登录
- **Content-Type**：`multipart/form-data`

**请求参数**：

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| file | File | 是 | 上传文件，支持 jpg/png/gif/pdf，最大 10MB |
| type | string | 否 | 文件类型：image/video/document，默认 image |

**响应字段**：

| 字段名 | 类型 | 说明 |
|--------|------|------|
| id | number | 文件 ID |
| url | string | 文件访问 URL |
| name | string | 文件名 |
| size | number | 文件大小（字节） |
| type | string | 文件 MIME 类型 |

**错误码**：40001（文件格式或大小不符）

**业务说明**：文件上传至 OSS，返回文件访问 URL。图片支持 jpg/png/gif，文档支持 pdf，视频支持 mp4。

---

### 4.2 文件详情

- **请求方法**：`GET`
- **URL**：`/api/common/file/:id`
- **权限要求**：无

**请求参数**：

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| id | number | 是 | 文件 ID（路径参数） |

**响应字段**：

| 字段名 | 类型 | 说明 |
|--------|------|------|
| id | number | 文件 ID |
| url | string | 文件访问 URL |
| name | string | 文件名 |
| size | number | 文件大小（字节） |
| type | string | 文件 MIME 类型 |
| createdAt | string | 上传时间 |

**错误码**：40401（文件不存在）

**业务说明**：获取文件元信息。

---

## 5. 管理后台 API

### 5.1 认证模块

#### 5.1.1 验证码

- **请求方法**：`GET`
- **URL**：`/api/admin/auth/captcha`
- **权限要求**：无（Public）

**请求参数**：无

**响应字段**：

| 字段名 | 类型 | 说明 |
|--------|------|------|
| captchaId | string | 验证码 ID |
| captchaImage | string | 验证码图片 Base64 |

**错误码**：无

**业务说明**：返回图形验证码，验证码 5 分钟有效。

---

#### 5.1.2 管理员登录

- **请求方法**：`POST`
- **URL**：`/api/admin/auth/login`
- **权限要求**：无（Public）

**请求参数**：

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| username | string | 是 | 用户名 |
| password | string | 是 | 密码 |
| captchaId | string | 是 | 验证码 ID |
| captchaCode | string | 是 | 验证码内容 |

**响应字段**：

| 字段名 | 类型 | 说明 |
|--------|------|------|
| accessToken | string | JWT AccessToken |
| refreshToken | string | 刷新 Token |
| tokenExpireAt | string | Token 过期时间 |
| userInfo | object | 管理员信息（含 id/username/realName/avatar/roleId/roleName/permissions） |

**错误码**：80002（验证码错误）、40302（账号已被禁用）、40101（用户名或密码错误）

**业务说明**：管理员登录需验证图形验证码。连续 5 次登录失败锁定账号 30 分钟。Token 有效期 2 小时。

---

#### 5.1.3 刷新 Token

- **请求方法**：`POST`
- **URL**：`/api/admin/auth/refresh`
- **权限要求**：无（Public）

**请求参数**：

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| refreshToken | string | 是 | 刷新 Token |

**响应字段**：

| 字段名 | 类型 | 说明 |
|--------|------|------|
| accessToken | string | 新的 JWT AccessToken |
| refreshToken | string | 新的刷新 Token |
| tokenExpireAt | string | Token 过期时间 |

**错误码**：40103（Token 无效）、40102（Token 已过期）

**业务说明**：使用 refreshToken 换取新的 accessToken 和 refreshToken。refreshToken 有效期 30 天，过期后需重新登录。

---

#### 5.1.4 退出登录

- **请求方法**：`POST`
- **URL**：`/api/admin/auth/logout`
- **权限要求**：需管理员登录

**请求参数**：无

**响应字段**：

| 字段名 | 类型 | 说明 |
|--------|------|------|
| null | null | 无返回数据 |

**错误码**：40101（未登录）

**业务说明**：退出登录，使当前 accessToken 和 refreshToken 失效。

---

#### 5.1.5 管理员信息

- **请求方法**：`GET`
- **URL**：`/api/admin/auth/info`
- **权限要求**：需管理员登录

**请求参数**：无

**响应字段**：

| 字段名 | 类型 | 说明 |
|--------|------|------|
| id | number | 管理员 ID |
| username | string | 用户名 |
| realName | string | 真实姓名 |
| avatar | string | 头像 |
| phone | string | 手机号 |
| email | string | 邮箱 |
| roleId | number | 角色 ID |
| roleName | string | 角色名称 |
| permissions | array | 权限标识列表 |
| lastLoginAt | string | 最后登录时间 |
| lastLoginIp | string | 最后登录 IP |

**错误码**：40101（未登录）

**业务说明**：返回当前登录管理员完整信息，包含权限列表用于前端菜单和按钮权限控制。

---

#### 5.1.6 修改密码

- **请求方法**：`PUT`
- **URL**：`/api/admin/auth/password`
- **权限要求**：需管理员登录

**请求参数**：

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| oldPassword | string | 是 | 原密码 |
| newPassword | string | 是 | 新密码，8-20 位，需包含字母和数字 |
| confirmPassword | string | 是 | 确认新密码 |

**响应字段**：

| 字段名 | 类型 | 说明 |
|--------|------|------|
| success | boolean | 是否修改成功 |

**错误码**：40001（参数错误）、40101（原密码错误）

**业务说明**：修改密码后需重新登录。

---

### 5.2 商品管理

#### 5.2.1 商品列表

- **请求方法**：`GET`
- **URL**：`/api/admin/product/list`
- **权限要求**：需管理员登录 + `product:view`

**请求参数**：page/pageSize/keyword/categoryId/brandId/status/supplierId

**响应字段**：list[]含 id/name/mainImage/categoryId/categoryName/brandId/brandName/supplierId/supplierName/price/stock/sales/status/statusText/createdAt/updatedAt + pagination

**错误码**：40301

---

#### 5.2.2 商品详情

- **请求方法**：`GET`
- **URL**：`/api/admin/product/detail/:id`
- **权限要求**：需管理员登录 + `product:view`

**请求参数**：id(路径)

**响应字段**：id/name/subtitle/mainImage/images/detailImages/description/price/originalPrice/categoryId/brandId/supplierId/skus[]含 id/name/price/originalPrice/costPrice/stock/specs/specGroups/tags/purchaseLimit/monthAgeRange/status/sales/createdAt/updatedAt

**错误码**：40401、40301

---

#### 5.2.3 创建商品

- **请求方法**：`POST`
- **URL**：`/api/admin/product/create`
- **权限要求**：需管理员登录 + `product:create`

**请求参数**：name(是)/subtitle/mainImage(是)/images/detailImages/description/categoryId(是)/brandId/supplierId/skus[](是，含 name/price/stock)/specGroups/tags/purchaseLimit/monthAgeRange/status

**响应字段**：id

**错误码**：40001、40301

---

#### 5.2.4 更新商品

- **请求方法**：`PUT`
- **URL**：`/api/admin/product/update/:id`
- **权限要求**：需管理员登录 + `product:update`

**请求参数**：id(路径)/name/subtitle/mainImage/images/detailImages/description/categoryId/brandId/supplierId/skus/specGroups/tags/purchaseLimit/monthAgeRange

**响应字段**：success

**错误码**：40401、40001、40301

---

#### 5.2.5 删除商品

- **请求方法**：`DELETE`
- **URL**：`/api/admin/product/delete/:id`
- **权限要求**：需管理员登录 + `product:delete`

**请求参数**：id(路径)

**响应字段**：success

**错误码**：40401、40301、40901（存在未完成订单）

---

#### 5.2.6 上下架商品

- **请求方法**：`PUT`
- **URL**：`/api/admin/product/status/:id`
- **权限要求**：需管理员登录 + `product:update`

**请求参数**：id(路径)/status(是，0-下架 1-上架)

**响应字段**：success

**错误码**：40401、40001、40301

---

### 5.3 分类管理

#### 5.3.1 分类列表

- **请求方法**：`GET`
- **URL**：`/api/admin/category/list`
- **权限要求**：需管理员登录 + `category:view`

**请求参数**：无

**响应字段**：list[]含 id/name/icon/sort/status/parentId/children[]

**错误码**：40301

---

#### 5.3.2 分类详情

- **请求方法**：`GET`
- **URL**：`/api/admin/category/detail/:id`
- **权限要求**：需管理员登录 + `category:view`

**请求参数**：id(路径)

**响应字段**：id/name/icon/sort/status/parentId/children[]

**错误码**：40401、40301

---

#### 5.3.3 创建分类

- **请求方法**：`POST`
- **URL**：`/api/admin/category/create`
- **权限要求**：需管理员登录 + `category:create`

**请求参数**：name(是)/icon/parentId/sort/status

**响应字段**：id

**错误码**：40001、40301、40901

---

#### 5.3.4 更新分类

- **请求方法**：`PUT`
- **URL**：`/api/admin/category/update/:id`
- **权限要求**：需管理员登录 + `category:update`

**请求参数**：id(路径)/name/icon/parentId/sort/status

**响应字段**：success

**错误码**：40401、40001、40301

---

#### 5.3.5 删除分类

- **请求方法**：`DELETE`
- **URL**：`/api/admin/category/delete/:id`
- **权限要求**：需管理员登录 + `category:delete`

**请求参数**：id(路径)

**响应字段**：success

**错误码**：40401、40301、40901

---

### 5.4 品牌管理

#### 5.4.1 品牌列表

- **请求方法**：`GET`
- **URL**：`/api/admin/brand/list`
- **权限要求**：需管理员登录 + `brand:view`

**请求参数**：page/pageSize/keyword/status

**响应字段**：list[]含 id/name/logo/description/status/productCount/createdAt + pagination

**错误码**：40301

---

#### 5.4.2 品牌详情

- **请求方法**：`GET`
- **URL**：`/api/admin/brand/detail/:id`
- **权限要求**：需管理员登录 + `brand:view`

**请求参数**：id(路径)

**响应字段**：id/name/logo/description/status/productCount/createdAt/updatedAt

**错误码**：40401、40301

---

#### 5.4.3 创建品牌

- **请求方法**：`POST`
- **URL**：`/api/admin/brand/create`
- **权限要求**：需管理员登录 + `brand:create`

**请求参数**：name(是)/logo/description/status

**响应字段**：id

**错误码**：40001、40301、40901

---

#### 5.4.4 更新品牌

- **请求方法**：`PUT`
- **URL**：`/api/admin/brand/update/:id`
- **权限要求**：需管理员登录 + `brand:update`

**请求参数**：id(路径)/name/logo/description/status

**响应字段**：success

**错误码**：40401、40001、40301

---

#### 5.4.5 删除品牌

- **请求方法**：`DELETE`
- **URL**：`/api/admin/brand/delete/:id`
- **权限要求**：需管理员登录 + `brand:delete`

**请求参数**：id(路径)

**响应字段**：success

**错误码**：40401、40301、40901

---

### 5.5 Banner 管理

#### 5.5.1 Banner 列表

- **请求方法**：`GET`
- **URL**：`/api/admin/banner/list`
- **权限要求**：需管理员登录 + `banner:view`

**请求参数**：无

**响应字段**：list[]含 id/title/imageUrl/linkType/linkValue/sort/status/createdAt

**错误码**：40301

---

#### 5.5.2 创建 Banner

- **请求方法**：`POST`
- **URL**：`/api/admin/banner`
- **权限要求**：需管理员登录 + `banner:create`

**请求参数**：title(是)/imageUrl(是)/linkType(是)/linkValue(是)/sort/status

**响应字段**：id

**错误码**：40001、40301

---

#### 5.5.3 更新 Banner

- **请求方法**：`PUT`
- **URL**：`/api/admin/banner/:id`
- **权限要求**：需管理员登录 + `banner:update`

**请求参数**：id(路径)/title/imageUrl/linkType/linkValue/sort/status

**响应字段**：success

**错误码**：40401、40001、40301

---

#### 5.5.4 删除 Banner

- **请求方法**：`DELETE`
- **URL**：`/api/admin/banner/:id`
- **权限要求**：需管理员登录 + `banner:delete`

**请求参数**：id(路径)

**响应字段**：success

**错误码**：40401、40301

---

### 5.6 优惠券管理

#### 5.6.1 优惠券列表

- **请求方法**：`GET`
- **URL**：`/api/admin/coupon/list`
- **权限要求**：需管理员登录 + `coupon:view`

**请求参数**：page/pageSize/status

**响应字段**：list[]含 id/name/type/value/minAmount/totalCount/receivedCount/startTime/endTime/status/createdAt + pagination

**错误码**：40301

---

#### 5.6.2 优惠券详情

- **请求方法**：`GET`
- **URL**：`/api/admin/coupon/:id`
- **权限要求**：需管理员登录 + `coupon:view`

**请求参数**：id(路径)

**响应字段**：id/name/type/value/minAmount/totalCount/receivedCount/limitPerUser/startTime/endTime/status/description/createdAt

**错误码**：40401、40301

---

#### 5.6.3 创建优惠券

- **请求方法**：`POST`
- **URL**：`/api/admin/coupon`
- **权限要求**：需管理员登录 + `coupon:create`

**请求参数**：name(是)/type(是)/value(是)/minAmount/totalCount(是)/limitPerUser/startTime(是)/endTime(是)/description

**响应字段**：id

**错误码**：40001、40301

---

#### 5.6.4 更新优惠券

- **请求方法**：`PUT`
- **URL**：`/api/admin/coupon/:id`
- **权限要求**：需管理员登录 + `coupon:update`

**请求参数**：id(路径)/name/type/value/minAmount/totalCount/limitPerUser/startTime/endTime/description

**响应字段**：success

**错误码**：40401、40001、40301

---

#### 5.6.5 删除优惠券

- **请求方法**：`DELETE`
- **URL**：`/api/admin/coupon/:id`
- **权限要求**：需管理员登录 + `coupon:delete`

**请求参数**：id(路径)

**响应字段**：success

**错误码**：40401、40301

---

### 5.7 活动管理

#### 5.7.1 活动列表

- **请求方法**：`GET`
- **URL**：`/api/admin/activity/list`
- **权限要求**：需管理员登录 + `activity:view`

**请求参数**：page/pageSize/type/status

**响应字段**：list[]含 id/title/coverImage/type/startTime/endTime/status/createdAt + pagination

**错误码**：40301

---

#### 5.7.2 活动详情

- **请求方法**：`GET`
- **URL**：`/api/admin/activity/:id`
- **权限要求**：需管理员登录 + `activity:view`

**请求参数**：id(路径)

**响应字段**：id/title/coverImage/type/startTime/endTime/status/description/rules/products[]/discountRules[]/createdAt

**错误码**：40401、40301

---

#### 5.7.3 创建活动

- **请求方法**：`POST`
- **URL**：`/api/admin/activity`
- **权限要求**：需管理员登录 + `activity:create`

**请求参数**：title(是)/coverImage/type(是)/startTime(是)/endTime(是)/description/rules/products[]/discountRules

**响应字段**：id

**错误码**：40001、40301

---

#### 5.7.4 更新活动

- **请求方法**：`PUT`
- **URL**：`/api/admin/activity/:id`
- **权限要求**：需管理员登录 + `activity:update`

**请求参数**：id(路径)/title/coverImage/type/startTime/endTime/description/rules/products/discountRules

**响应字段**：success

**错误码**：40401、40001、40301

---

#### 5.7.5 删除活动

- **请求方法**：`DELETE`
- **URL**：`/api/admin/activity/:id`
- **权限要求**：需管理员登录 + `activity:delete`

**请求参数**：id(路径)

**响应字段**：success

**错误码**：40401、40301

---

#### 5.7.6 更新活动状态

- **请求方法**：`PUT`
- **URL**：`/api/admin/activity/:id/status`
- **权限要求**：需管理员登录 + `activity:update`

**请求参数**：id(路径)/status(是)

**响应字段**：success

**错误码**：40401、40001、40301

---

#### 5.7.7 添加活动商品

- **请求方法**：`POST`
- **URL**：`/api/admin/activity/:activityId/product`
- **权限要求**：需管理员登录 + `activity:update`

**请求参数**：activityId(路径)/productId(是)/activityPrice/stock/limitPerUser

**响应字段**：id

**错误码**：40001、40301

---

#### 5.7.8 删除活动商品

- **请求方法**：`DELETE`
- **URL**：`/api/admin/activity/product/:id`
- **权限要求**：需管理员登录 + `activity:update`

**请求参数**：id(路径)

**响应字段**：success

**错误码**：40401、40301

---

### 5.8 订单管理

#### 5.8.1 订单列表

- **请求方法**：`GET`
- **URL**：`/api/admin/order/list`
- **权限要求**：需管理员登录 + `order:view`

**请求参数**：page/pageSize/orderNo/status/userId/startDate/endDate/minAmount/maxAmount

**响应字段**：list[]含 id/orderNo/userId/userName/userPhone/status/statusText/totalAmount/freightAmount/discountAmount/payAmount/itemCount/items[]/consignee/consigneePhone/consigneeAddress/remark/adminRemark/payTime/deliverTime/createdAt + pagination

**错误码**：40301

---

#### 5.8.2 订单详情

- **请求方法**：`GET`
- **URL**：`/api/admin/order/detail/:id`
- **权限要求**：需管理员登录 + `order:view`

**请求参数**：id(路径)

**响应字段**：id/orderNo/status/statusText/userId/userName/userPhone/userMemberLevel/items[]含 id/productId/productName/productImage/skuId/skuName/price/originalPrice/costPrice/quantity/subtotal/address/totalAmount/freightAmount/discountAmount/couponDiscount/pointsDiscount/payAmount/payMethod/payTime/transactionId/remark/adminRemark/logistics/deliverTime/receiveTime/cancelTime/cancelReason/refundAmount/aftersaleInfo/createdAt/updatedAt

**错误码**：20001、40301

---

#### 5.8.3 更新订单状态

- **请求方法**：`PUT`
- **URL**：`/api/admin/order/status/:id`
- **权限要求**：需管理员登录 + `order:update`

**请求参数**：id(路径)/status(是)/reason

**响应字段**：success

**错误码**：20001、20002、40301

---

#### 5.8.4 订单备注

- **请求方法**：`PUT`
- **URL**：`/api/admin/order/remark/:id`
- **权限要求**：需管理员登录 + `order:update`

**请求参数**：id(路径)/adminRemark(是)

**响应字段**：success

**错误码**：20001、40001、40301

---

#### 5.8.5 取消订单

- **请求方法**：`PUT`
- **URL**：`/api/admin/order/cancel/:id`
- **权限要求**：需管理员登录 + `order:update`

**请求参数**：id(路径)/reason

**响应字段**：success

**错误码**：20001、20002、40301

---

#### 5.8.6 待发货列表

- **请求方法**：`GET`
- **URL**：`/api/admin/order/delivery-list`
- **权限要求**：需管理员登录 + `order:view`

**请求参数**：page/pageSize

**响应字段**：list[]含 id/orderNo/userName/userPhone/consignee/consigneePhone/consigneeAddress/items[]/payAmount/createdAt + pagination

**错误码**：40301

**业务说明**：返回待发货状态的订单列表，便于发货操作。

---

#### 5.8.7 批量发货

- **请求方法**：`POST`
- **URL**：`/api/admin/order/batch-deliver`
- **权限要求**：需管理员登录 + `order:deliver`

**请求参数**：file(是，Excel 文件)

**响应字段**：totalCount/successCount/failCount/failList[]含 orderNo/reason

**错误码**：40001、40301

---

#### 5.8.8 发货

- **请求方法**：`POST`
- **URL**：`/api/admin/order/deliver`
- **权限要求**：需管理员登录 + `order:deliver`

**请求参数**：orderId(是)/logisticsCompany(是)/trackingNo(是)

**响应字段**：success

**错误码**：20001、20002、40001、40301

---

#### 5.8.9 导出订单

- **请求方法**：`GET`
- **URL**：`/api/admin/order/export`
- **权限要求**：需管理员登录 + `order:export`

**请求参数**：status/startDate/endDate/format(xlsx/csv)

**响应字段**：文件流

**错误码**：40301、40001

---

### 5.9 售后管理

#### 5.9.1 售后列表

- **请求方法**：`GET`
- **URL**：`/api/admin/aftersale/list`
- **权限要求**：需管理员登录 + `aftersale:view`

**请求参数**：page/pageSize/status/type/orderNo/startDate/endDate

**响应字段**：list[]含 id/aftersaleNo/orderNo/type/typeText/status/statusText/reason/refundAmount/userName/productName/productImage/quantity/createdAt + pagination

**错误码**：40301

---

#### 5.9.2 售后详情

- **请求方法**：`GET`
- **URL**：`/api/admin/aftersale/detail/:id`
- **权限要求**：需管理员登录 + `aftersale:view`

**请求参数**：id(路径)

**响应字段**：id/aftersaleNo/type/typeText/status/statusText/reason/description/images/refundAmount/userId/userName/userPhone/orderInfo/orderItem/rejectReason/returnLogistics/refundTime/refundTransactionId/operateLogs[]/createdAt/updatedAt

**错误码**：50001、40301

---

#### 5.9.3 审核通过

- **请求方法**：`PUT`
- **URL**：`/api/admin/aftersale/:id/approve`
- **权限要求**：需管理员登录 + `aftersale:approve`

**请求参数**：id(路径)/refundAmount/remark

**响应字段**：success

**错误码**：50001、50002、40301

---

#### 5.9.4 审核拒绝

- **请求方法**：`PUT`
- **URL**：`/api/admin/aftersale/:id/reject`
- **权限要求**：需管理员登录 + `aftersale:approve`

**请求参数**：id(路径)/rejectReason(是)

**响应字段**：success

**错误码**：50001、50002、40001、40301

---

#### 5.9.5 退款

- **请求方法**：`PUT`
- **URL**：`/api/admin/aftersale/:id/refund`
- **权限要求**：需管理员登录 + `aftersale:refund`

**请求参数**：id(路径)/refundAmount

**响应字段**：success + refundTransactionId

**错误码**：50001、50002、50004、40301

---

### 5.10 用户管理

#### 5.10.1 用户列表

- **请求方法**：`GET`
- **URL**：`/api/admin/user/list`
- **权限要求**：需管理员登录 + `user:view`

**请求参数**：page/pageSize/keyword/memberLevel/status/startDate/endDate

**响应字段**：list[]含 id/nickName/avatarUrl/phone/gender/memberLevel/memberLevelName/points/totalSpent/orderCount/babyCount/status/lastLoginAt/createdAt + pagination

**错误码**：40301

---

#### 5.10.2 用户详情

- **请求方法**：`GET`
- **URL**：`/api/admin/user/detail/:id`
- **权限要求**：需管理员登录 + `user:view`

**请求参数**：id(路径)

**响应字段**：id/openId/nickName/avatarUrl/phone/gender/birthday/memberLevel/memberLevelName/points/totalPoints/totalSpent/orderCount/couponCount/babies[]/recentOrders[]/status/lastLoginAt/createdAt

**错误码**：40401、40301

---

#### 5.10.3 调整会员等级

- **请求方法**：`PUT`
- **URL**：`/api/admin/user/level/:id`
- **权限要求**：需管理员登录 + `user:update`

**请求参数**：id(路径)/memberLevel(是)/reason(是)

**响应字段**：success

**错误码**：40401、40001、40301

---

#### 5.10.4 切换用户状态

- **请求方法**：`PUT`
- **URL**：`/api/admin/user/status/:id`
- **权限要求**：需管理员登录 + `user:update`

**请求参数**：id(路径)/status(是，0-禁用 1-启用)/reason(禁用时必填)

**响应字段**：success

**错误码**：40401、40001、40301

---

#### 5.10.5 调整用户积分

- **请求方法**：`PUT`
- **URL**：`/api/admin/user/points/:id`
- **权限要求**：需管理员登录 + `user:update`

**请求参数**：id(路径)/points(是，正数增加负数扣减)/reason(是)

**响应字段**：success

**错误码**：40401、40001、40301、60002（积分不足）

---

### 5.11 宝宝档案管理

#### 5.11.1 宝宝档案列表

- **请求方法**：`GET`
- **URL**：`/api/admin/baby-profile`
- **权限要求**：需管理员登录 + `baby:view`

**请求参数**：page/pageSize/keyword/gender

**响应字段**：list[]含 id/name/gender/birthday/monthAge/userId/userName/createdAt + pagination

**错误码**：40301

---

### 5.12 会员等级管理

#### 5.12.1 会员等级列表

- **请求方法**：`GET`
- **URL**：`/api/admin/member/levels`
- **权限要求**：需管理员登录 + `member-level:view`

**请求参数**：无

**响应字段**：list[]含 id/level/name/icon/requiredSpent/discount/pointsRate/privileges[]/userCount

**错误码**：40301

---

#### 5.12.2 创建会员等级

- **请求方法**：`POST`
- **URL**：`/api/admin/member/levels`
- **权限要求**：需管理员登录 + `member-level:create`

**请求参数**：level(是)/name(是)/icon/requiredSpent/discount/pointsRate/privileges

**响应字段**：id

**错误码**：40001、40301

---

#### 5.12.3 更新会员等级

- **请求方法**：`PUT`
- **URL**：`/api/admin/member/levels/:id`
- **权限要求**：需管理员登录 + `member-level:update`

**请求参数**：id(路径)/name/icon/requiredSpent/discount/pointsRate/privileges

**响应字段**：success

**错误码**：40401、40001、40301

---

### 5.13 积分管理

#### 5.13.1 积分记录

- **请求方法**：`GET`
- **URL**：`/api/admin/points/records`
- **权限要求**：需管理员登录 + `points:view`

**请求参数**：page/pageSize/userId/type/source/startDate/endDate

**响应字段**：list[]含 id/userId/userName/type/points/balance/source/description/createdAt + pagination

**错误码**：40301

---

#### 5.13.2 调整积分

- **请求方法**：`POST`
- **URL**：`/api/admin/points/adjust`
- **权限要求**：需管理员登录 + `points:adjust`

**请求参数**：userId(是)/points(是，正数增加负数扣减)/reason(是)

**响应字段**：success

**错误码**：40001、40301、60002（积分不足）

---

#### 5.13.3 清理过期积分

- **请求方法**：`POST`
- **URL**：`/api/admin/points/expire-clean`
- **权限要求**：需管理员登录 + `points:adjust`

**请求参数**：无

**响应字段**：cleanedCount/cleanedPoints

**错误码**：40301

**业务说明**：清理已过期的积分记录，将过期积分余额清零。建议定期执行。

---

### 5.14 供应商管理

#### 5.14.1 供应商列表

- **请求方法**：`GET`
- **URL**：`/api/admin/supplier/list`
- **权限要求**：需管理员登录 + `supplier:view`

**请求参数**：page/pageSize/keyword/status

**响应字段**：list[]含 id/name/contactName/contactPhone/status/productCount/createdAt + pagination

**错误码**：40301

---

#### 5.14.2 供应商详情

- **请求方法**：`GET`
- **URL**：`/api/admin/supplier/detail/:id`
- **权限要求**：需管理员登录 + `supplier:view`

**请求参数**：id(路径)

**响应字段**：id/name/contactName/contactPhone/contactEmail/address/description/status/productCount/createdAt/updatedAt

**错误码**：40401、40301

---

#### 5.14.3 创建供应商

- **请求方法**：`POST`
- **URL**：`/api/admin/supplier/create`
- **权限要求**：需管理员登录 + `supplier:create`

**请求参数**：name(是)/contactName/contactPhone/contactEmail/address/description/status

**响应字段**：id

**错误码**：40001、40301

---

#### 5.14.4 更新供应商

- **请求方法**：`PUT`
- **URL**：`/api/admin/supplier/update/:id`
- **权限要求**：需管理员登录 + `supplier:update`

**请求参数**：id(路径)/name/contactName/contactPhone/contactEmail/address/description/status

**响应字段**：success

**错误码**：40401、40001、40301

---

#### 5.14.5 删除供应商

- **请求方法**：`DELETE`
- **URL**：`/api/admin/supplier/delete/:id`
- **权限要求**：需管理员登录 + `supplier:delete`

**请求参数**：id(路径)

**响应字段**：success

**错误码**：40401、40301、40901

---

#### 5.14.6 更新供应商状态

- **请求方法**：`PUT`
- **URL**：`/api/admin/supplier/status/:id`
- **权限要求**：需管理员登录 + `supplier:update`

**请求参数**：id(路径)/status(是)

**响应字段**：success

**错误码**：40401、40001、40301

---

### 5.15 内容管理

#### 5.15.1 内容列表

- **请求方法**：`GET`
- **URL**：`/api/admin/content/list`
- **权限要求**：需管理员登录 + `content:view`

**请求参数**：page/pageSize/categoryId/status

**响应字段**：list[]含 id/title/coverImage/categoryId/categoryName/status/viewCount/publishedAt + pagination

**错误码**：40301

---

#### 5.15.2 内容详情

- **请求方法**：`GET`
- **URL**：`/api/admin/content/:id`
- **权限要求**：需管理员登录 + `content:view`

**请求参数**：id(路径)

**响应字段**：id/title/coverImage/content/summary/categoryId/categoryName/status/viewCount/publishedAt/relatedProductIds/createdAt/updatedAt

**错误码**：40401、40301

---

#### 5.15.3 创建内容

- **请求方法**：`POST`
- **URL**：`/api/admin/content`
- **权限要求**：需管理员登录 + `content:create`

**请求参数**：title(是)/coverImage/content(是)/summary/categoryId/relatedProductIds/status

**响应字段**：id

**错误码**：40001、40301

---

#### 5.15.4 更新内容

- **请求方法**：`PUT`
- **URL**：`/api/admin/content/:id`
- **权限要求**：需管理员登录 + `content:update`

**请求参数**：id(路径)/title/coverImage/content/summary/categoryId/relatedProductIds/status

**响应字段**：success

**错误码**：40401、40001、40301

---

#### 5.15.5 删除内容

- **请求方法**：`DELETE`
- **URL**：`/api/admin/content/:id`
- **权限要求**：需管理员登录 + `content:delete`

**请求参数**：id(路径)

**响应字段**：success

**错误码**：40401、40301

---

#### 5.15.6 创建内容分类

- **请求方法**：`POST`
- **URL**：`/api/admin/content/category`
- **权限要求**：需管理员登录 + `content:create`

**请求参数**：name(是)/sort

**响应字段**：id

**错误码**：40001、40301

---

#### 5.15.7 更新内容分类

- **请求方法**：`PUT`
- **URL**：`/api/admin/content/category/:id`
- **权限要求**：需管理员登录 + `content:update`

**请求参数**：id(路径)/name/sort

**响应字段**：success

**错误码**：40401、40001、40301

---

#### 5.15.8 删除内容分类

- **请求方法**：`DELETE`
- **URL**：`/api/admin/content/category/:id`
- **权限要求**：需管理员登录 + `content:delete`

**请求参数**：id(路径)

**响应字段**：success

**错误码**：40401、40301

---

### 5.16 数据看板

#### 5.16.1 仪表盘统计

- **请求方法**：`GET`
- **URL**：`/api/admin/dashboard/stats`
- **权限要求**：需管理员登录 + `dashboard:view`

**请求参数**：period(否，today/yesterday/week/month，默认 today)

**响应字段**：orderCount/orderCountChange/salesAmount/salesAmountChange/userCount/userCountChange/avgOrderAmount/avgOrderAmountChange/totalUsers/totalProducts/pendingOrders/pendingAftersales

**错误码**：40301

**业务说明**：返回数据看板顶部关键指标卡片数据，含环比变化。

---

#### 5.16.2 销售趋势

- **请求方法**：`GET`
- **URL**：`/api/admin/dashboard/sales-chart`
- **权限要求**：需管理员登录 + `dashboard:view`

**请求参数**：period(否，week/month，默认 week)/metric(否，amount/count，默认 amount)

**响应字段**：chartData[]含 date/value/orderCount

**错误码**：40301

**业务说明**：返回销售趋势折线图数据。

---

#### 5.16.3 热销商品

- **请求方法**：`GET`
- **URL**：`/api/admin/dashboard/top-products`
- **权限要求**：需管理员登录 + `dashboard:view`

**请求参数**：period/limit(否，默认 10，最大 50)

**响应字段**：list[]含 productId/productName/mainImage/salesCount/salesAmount

**错误码**：40301

**业务说明**：返回指定周期内销量最高的商品排行。

---

#### 5.16.4 最近订单

- **请求方法**：`GET`
- **URL**：`/api/admin/dashboard/recent-orders`
- **权限要求**：需管理员登录 + `dashboard:view`

**请求参数**：limit(否，默认 10，最大 50)

**响应字段**：list[]含 id/orderNo/userName/payAmount/status/statusText/createdAt

**错误码**：40301

**业务说明**：返回最近创建的订单列表。

---

### 5.17 管理员管理

#### 5.17.1 管理员列表

- **请求方法**：`GET`
- **URL**：`/api/admin/admin-user`
- **权限要求**：需管理员登录 + `admin-user:view`

**请求参数**：page/pageSize/keyword/status

**响应字段**：list[]含 id/username/realName/phone/roleId/roleName/status/lastLoginAt/createdAt + pagination

**错误码**：40301

---

#### 5.17.2 管理员详情

- **请求方法**：`GET`
- **URL**：`/api/admin/admin-user/:id`
- **权限要求**：需管理员登录 + `admin-user:view`

**请求参数**：id(路径)

**响应字段**：id/username/realName/phone/email/avatar/roleId/roleName/permissions/status/lastLoginAt/lastLoginIp/createdAt

**错误码**：40401、40301

---

#### 5.17.3 创建管理员

- **请求方法**：`POST`
- **URL**：`/api/admin/admin-user`
- **权限要求**：需管理员登录 + `admin-user:create`

**请求参数**：username(是)/password(是)/realName/phone/email/roleId(是)

**响应字段**：id

**错误码**：40001、40301、40901

---

#### 5.17.4 更新管理员

- **请求方法**：`PUT`
- **URL**：`/api/admin/admin-user/:id`
- **权限要求**：需管理员登录 + `admin-user:update`

**请求参数**：id(路径)/realName/phone/email/roleId/status

**响应字段**：success

**错误码**：40401、40001、40301

---

#### 5.17.5 更新管理员状态

- **请求方法**：`PUT`
- **URL**：`/api/admin/admin-user/:id/status`
- **权限要求**：需管理员登录 + `admin-user:update`

**请求参数**：id(路径)/status(是，0-禁用 1-启用)

**响应字段**：success

**错误码**：40401、40001、40301

---

#### 5.17.6 删除管理员

- **请求方法**：`DELETE`
- **URL**：`/api/admin/admin-user/:id`
- **权限要求**：需管理员登录 + `admin-user:delete`

**请求参数**：id(路径)

**响应字段**：success

**错误码**：40401、40301

---

### 5.18 角色权限

#### 5.18.1 角色列表

- **请求方法**：`GET`
- **URL**：`/api/admin/role`
- **权限要求**：需管理员登录 + `role:view`

**请求参数**：无

**响应字段**：list[]含 id/name/description/permissions[]/userCount/createdAt

**错误码**：40301

---

#### 5.18.2 角色详情

- **请求方法**：`GET`
- **URL**：`/api/admin/role/:id`
- **权限要求**：需管理员登录 + `role:view`

**请求参数**：id(路径)

**响应字段**：id/name/description/permissions[]/userCount/createdAt/updatedAt

**错误码**：40401、40301

---

#### 5.18.3 创建角色

- **请求方法**：`POST`
- **URL**：`/api/admin/role`
- **权限要求**：需管理员登录 + `role:create`

**请求参数**：name(是)/description/permissions[](是)

**响应字段**：id

**错误码**：40001、40301、40901

---

#### 5.18.4 更新角色

- **请求方法**：`PUT`
- **URL**：`/api/admin/role/:id`
- **权限要求**：需管理员登录 + `role:update`

**请求参数**：id(路径)/name/description/permissions

**响应字段**：success

**错误码**：40401、40001、40301

---

#### 5.18.5 删除角色

- **请求方法**：`DELETE`
- **URL**：`/api/admin/role/:id`
- **权限要求**：需管理员登录 + `role:delete`

**请求参数**：id(路径)

**响应字段**：success

**错误码**：40401、40301、40901（角色下有用户）

---

#### 5.18.6 权限树

- **请求方法**：`GET`
- **URL**：`/api/admin/permission/tree`
- **权限要求**：需管理员登录 + `permission:view`

**请求参数**：无

**响应字段**：tree[]含 id/name/code/type/children[]

**错误码**：40301

**业务说明**：返回完整权限树结构，用于角色分配权限时展示。

---

### 5.19 操作日志

#### 5.19.1 操作日志列表

- **请求方法**：`GET`
- **URL**：`/api/admin/operation-log`
- **权限要求**：需管理员登录 + `operation-log:view`

**请求参数**：page/pageSize/operator/module/action/startDate/endDate

**响应字段**：list[]含 id/operatorName/module/action/targetType/targetId/detail/ip/createdAt + pagination

**错误码**：40301

---

### 5.20 系统配置

#### 5.20.1 配置列表

- **请求方法**：`GET`
- **URL**：`/api/admin/system-config/list`
- **权限要求**：需管理员登录 + `system-config:view`

**请求参数**：无

**响应字段**：list[]含 id/key/value/description/group/updatedAt

**错误码**：40301

---

#### 5.20.2 按组查配置

- **请求方法**：`GET`
- **URL**：`/api/admin/system-config/group/:groupName`
- **权限要求**：需管理员登录 + `system-config:view`

**请求参数**：groupName(路径，配置分组名)

**响应字段**：list[]含 id/key/value/description/group/updatedAt

**错误码**：40301

**业务说明**：按配置分组查询配置项，便于分组展示和编辑。

---

#### 5.20.3 更新配置

- **请求方法**：`PUT`
- **URL**：`/api/admin/system-config/update`
- **权限要求**：需管理员登录 + `system-config:update`

**请求参数**：id(是)/value(是)

**响应字段**：success

**错误码**：40001、40301

---

#### 5.20.4 批量更新配置

- **请求方法**：`PUT`
- **URL**：`/api/admin/system-config/batch-update`
- **权限要求**：需管理员登录 + `system-config:update`

**请求参数**：configs[](含 id/value)

**响应字段**：success

**错误码**：40001、40301

**业务说明**：批量更新多个配置项，适用于分组保存场景。

---

### 5.21 文件管理

#### 5.21.1 文件列表

- **请求方法**：`GET`
- **URL**：`/api/admin/file/list`
- **权限要求**：需管理员登录 + `file:view`

**请求参数**：page/pageSize/type/startDate/endDate

**响应字段**：list[]含 id/url/name/size/type/createdAt + pagination

**错误码**：40301

---

#### 5.21.2 文件详情

- **请求方法**：`GET`
- **URL**：`/api/admin/file/:id`
- **权限要求**：需管理员登录 + `file:view`

**请求参数**：id(路径)

**响应字段**：id/url/name/size/type/createdAt

**错误码**：40401、40301

---

#### 5.21.3 文件上传

- **请求方法**：`POST`
- **URL**：`/api/admin/file/upload`
- **权限要求**：需管理员登录 + `file:upload`
- **Content-Type**：`multipart/form-data`

**请求参数**：file(是)/type(否)

**响应字段**：id/url/name/size/type

**错误码**：40001、40301

**业务说明**：管理后台专用文件上传接口，与公共文件上传接口功能相同但需管理员权限。

---

### 5.22 支付退款回调

#### 5.22.1 微信支付回调

- **请求方法**：`POST`
- **URL**：`/api/weapp/pay/callback`
- **权限要求**：无（Public，SkipTransform）

**请求参数**：微信支付回调 XML/JSON 数据（由微信服务器发送）

**响应字段**：按微信支付规范返回处理结果

**业务说明**：微信支付成功后回调，验签后更新订单状态。支付成功则将订单状态改为待发货，扣减实际库存，发放积分；支付失败则将订单状态改为已取消，释放预扣库存。需处理重复通知（幂等性），确保同一笔订单只处理一次。

---

#### 5.22.2 微信退款回调

- **请求方法**：`POST`
- **URL**：`/api/weapp/pay/refund-callback`
- **权限要求**：无（Public，SkipTransform）

**请求参数**：微信退款回调 XML/JSON 数据（由微信服务器发送）

**响应字段**：按微信支付规范返回处理结果

**业务说明**：微信退款状态变更回调，验签后更新退款单和售后单状态。退款成功则更新退款单状态为已退款，同步更新售后单状态；退款异常则标记退款异常，需人工处理。

---

### 5.23 退款记录管理

#### 5.23.1 退款记录列表

- **请求方法**：`GET`
- **URL**：`/api/admin/refund/list`
- **权限要求**：需管理员登录 + `order:refund` 或 `order:aftersale:refund`

**请求参数**：

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| page | number | 否 | 页码，默认 1 |
| pageSize | number | 否 | 每页条数，默认 10 |
| orderId | number | 否 | 订单 ID |
| status | number | 否 | 退款状态：0-全部 1-退款中 2-已退款 3-退款失败 |
| refundNo | string | 否 | 退款单号 |

**响应字段**：list[]含 id/refundNo/orderId/orderNo/aftersaleNo/refundAmount/status/statusText/transactionId/reason/createdAt + pagination

**错误码**：40301

---

#### 5.23.2 退款记录详情

- **请求方法**：`GET`
- **URL**：`/api/admin/refund/detail/:id`
- **权限要求**：需管理员登录 + `order:refund` 或 `order:aftersale:refund`

**请求参数**：id(路径)

**响应字段**：id/refundNo/orderId/orderNo/aftersaleNo/refundAmount/status/statusText/transactionId/reason/operateLogs[]/createdAt/updatedAt

**错误码**：40401、40301

---

## 6. 接口汇总

### 6.1 小程序端接口（70 个）

| 序号 | 方法 | 路径 | 说明 |
|------|------|------|------|
| 1 | POST | /api/weapp/auth/login | 微信登录 |
| 2 | POST | /api/weapp/auth/phone | 绑定手机号 |
| 3 | GET | /api/weapp/home/data | 首页数据 |
| 4 | GET | /api/weapp/home/guess | 猜你喜欢(分页) |
| 5 | GET | /api/weapp/category/tree | 分类树 |
| 6 | GET | /api/weapp/product/list | 商品列表 |
| 7 | GET | /api/weapp/product/detail/:id | 商品详情 |
| 8 | GET | /api/weapp/product/recommend | 推荐商品 |
| 9 | GET | /api/weapp/cart/list | 购物车列表 |
| 10 | POST | /api/weapp/cart/add | 添加购物车 |
| 11 | PUT | /api/weapp/cart/update | 更新购物车 |
| 12 | DELETE | /api/weapp/cart/delete/:id | 删除购物车项 |
| 13 | PUT | /api/weapp/cart/select-all | 全选/取消全选 |
| 14 | DELETE | /api/weapp/cart/remove-selected | 删除选中 |
| 15 | POST | /api/weapp/order/confirm | 订单确认(预览) |
| 16 | POST | /api/weapp/order/create | 创建订单 |
| 17 | POST | /api/weapp/order/pay/:id | 订单支付 |
| 18 | GET | /api/weapp/order/list | 订单列表 |
| 19 | GET | /api/weapp/order/detail/:id | 订单详情 |
| 20 | PUT | /api/weapp/order/cancel/:id | 取消订单 |
| 21 | PUT | /api/weapp/order/confirm-receive/:id | 确认收货 |
| 22 | GET | /api/weapp/order/count | 订单状态计数 |
| 23 | GET | /api/weapp/address | 地址列表 |
| 24 | GET | /api/weapp/address/:id | 地址详情 |
| 25 | POST | /api/weapp/address | 创建地址 |
| 26 | PUT | /api/weapp/address/:id | 更新地址 |
| 27 | DELETE | /api/weapp/address/:id | 删除地址 |
| 28 | PUT | /api/weapp/address/:id/default | 设为默认 |
| 29 | GET | /api/weapp/coupon/available | 可领优惠券 |
| 30 | GET | /api/weapp/coupon/center | 领券中心(分页) |
| 31 | GET | /api/weapp/coupon/my | 我的优惠券 |
| 32 | POST | /api/weapp/coupon/receive/:couponId | 领取优惠券 |
| 33 | GET | /api/weapp/coupon/usable | 可用优惠券 |
| 34 | POST | /api/weapp/aftersale/create | 申请售后 |
| 35 | GET | /api/weapp/aftersale/list | 售后列表 |
| 36 | GET | /api/weapp/aftersale/detail/:id | 售后详情 |
| 37 | PUT | /api/weapp/aftersale/return-logistics/:id | 填写退货物流 |
| 38 | PUT | /api/weapp/aftersale/cancel/:id | 取消售后 |
| 39 | POST | /api/weapp/pay/create | 创建支付 |
| 40 | POST | /api/weapp/pay/callback | 支付回调(Public) |
| 41 | POST | /api/weapp/pay/refund-callback | 退款回调(Public) |
| 42 | GET | /api/weapp/pay/status/:orderId | 支付状态 |
| 43 | GET | /api/weapp/member/levels | 会员等级列表 |
| 44 | GET | /api/weapp/member/info | 会员信息 |
| 45 | GET | /api/weapp/member/benefits | 会员权益 |
| 46 | GET | /api/weapp/points/balance | 积分余额 |
| 47 | GET | /api/weapp/points/records | 积分记录 |
| 48 | POST | /api/weapp/points/sign-in | 签到 |
| 49 | GET | /api/weapp/points/sign-in/status | 签到状态 |
| 50 | GET | /api/weapp/points/rules | 积分规则 |
| 51 | GET | /api/weapp/baby-profile | 宝宝档案列表 |
| 52 | GET | /api/weapp/baby-profile/:id | 宝宝档案详情 |
| 53 | POST | /api/weapp/baby-profile | 创建宝宝档案 |
| 54 | PUT | /api/weapp/baby-profile/:id | 更新宝宝档案 |
| 55 | DELETE | /api/weapp/baby-profile/:id | 删除宝宝档案 |
| 56 | GET | /api/weapp/activity/active | 进行中活动 |
| 57 | GET | /api/weapp/activity/:id | 活动详情 |
| 58 | GET | /api/weapp/activity/type/:type | 按类型查活动 |
| 59 | GET | /api/weapp/search | 商品搜索 |
| 60 | GET | /api/weapp/search/hot | 热门关键词 |
| 61 | GET | /api/weapp/search/history | 搜索历史 |
| 62 | DELETE | /api/weapp/search/history | 清空搜索历史 |
| 63 | GET | /api/weapp/content/categories | 内容分类 |
| 64 | GET | /api/weapp/content/list | 内容列表 |
| 65 | GET | /api/weapp/content/:id | 内容详情 |
| 66 | POST | /api/weapp/share/record | 记录分享 |
| 67 | GET | /api/weapp/share/poster | 分享海报 |
| 68 | GET | /api/weapp/user/info | 用户信息 |
| 69 | PUT | /api/weapp/user/profile | 更新用户资料 |
| 70 | GET | /api/weapp/brand/list | 品牌列表 |

### 6.2 公共接口（2 个）

| 序号 | 方法 | 路径 | 说明 |
|------|------|------|------|
| 71 | POST | /api/common/file/upload | 文件上传 |
| 72 | GET | /api/common/file/:id | 文件详情 |

### 6.3 管理后台接口（105 个）

| 序号 | 方法 | 路径 | 说明 |
|------|------|------|------|
| 73 | GET | /api/admin/auth/captcha | 验证码(Public) |
| 74 | POST | /api/admin/auth/login | 管理员登录(Public) |
| 75 | POST | /api/admin/auth/refresh | 刷新Token(Public) |
| 76 | POST | /api/admin/auth/logout | 退出登录 |
| 77 | GET | /api/admin/auth/info | 管理员信息 |
| 78 | PUT | /api/admin/auth/password | 修改密码 |
| 79 | GET | /api/admin/product/list | 商品列表 |
| 80 | GET | /api/admin/product/detail/:id | 商品详情 |
| 81 | POST | /api/admin/product/create | 创建商品 |
| 82 | PUT | /api/admin/product/update/:id | 更新商品 |
| 83 | DELETE | /api/admin/product/delete/:id | 删除商品 |
| 84 | PUT | /api/admin/product/status/:id | 上下架 |
| 85 | GET | /api/admin/category/list | 分类列表 |
| 86 | GET | /api/admin/category/detail/:id | 分类详情 |
| 87 | POST | /api/admin/category/create | 创建分类 |
| 88 | PUT | /api/admin/category/update/:id | 更新分类 |
| 89 | DELETE | /api/admin/category/delete/:id | 删除分类 |
| 90 | GET | /api/admin/brand/list | 品牌列表 |
| 91 | GET | /api/admin/brand/detail/:id | 品牌详情 |
| 92 | POST | /api/admin/brand/create | 创建品牌 |
| 93 | PUT | /api/admin/brand/update/:id | 更新品牌 |
| 94 | DELETE | /api/admin/brand/delete/:id | 删除品牌 |
| 95 | GET | /api/admin/banner/list | Banner列表 |
| 96 | POST | /api/admin/banner | 创建Banner |
| 97 | PUT | /api/admin/banner/:id | 更新Banner |
| 98 | DELETE | /api/admin/banner/:id | 删除Banner |
| 99 | GET | /api/admin/coupon/list | 优惠券列表 |
| 100 | GET | /api/admin/coupon/:id | 优惠券详情 |
| 101 | POST | /api/admin/coupon | 创建优惠券 |
| 102 | PUT | /api/admin/coupon/:id | 更新优惠券 |
| 103 | DELETE | /api/admin/coupon/:id | 删除优惠券 |
| 104 | GET | /api/admin/activity/list | 活动列表 |
| 105 | GET | /api/admin/activity/:id | 活动详情 |
| 106 | POST | /api/admin/activity | 创建活动 |
| 107 | PUT | /api/admin/activity/:id | 更新活动 |
| 108 | DELETE | /api/admin/activity/:id | 删除活动 |
| 109 | PUT | /api/admin/activity/:id/status | 更新活动状态 |
| 110 | POST | /api/admin/activity/:activityId/product | 添加活动商品 |
| 111 | DELETE | /api/admin/activity/product/:id | 删除活动商品 |
| 112 | GET | /api/admin/order/list | 订单列表 |
| 113 | GET | /api/admin/order/detail/:id | 订单详情 |
| 114 | PUT | /api/admin/order/status/:id | 更新订单状态 |
| 115 | PUT | /api/admin/order/remark/:id | 订单备注 |
| 116 | PUT | /api/admin/order/cancel/:id | 取消订单 |
| 117 | GET | /api/admin/order/delivery-list | 待发货列表 |
| 118 | POST | /api/admin/order/batch-deliver | 批量发货 |
| 119 | POST | /api/admin/order/deliver | 发货 |
| 120 | GET | /api/admin/order/export | 导出订单 |
| 121 | GET | /api/admin/aftersale/list | 售后列表 |
| 122 | GET | /api/admin/aftersale/detail/:id | 售后详情 |
| 123 | PUT | /api/admin/aftersale/:id/approve | 审核通过 |
| 124 | PUT | /api/admin/aftersale/:id/reject | 审核拒绝 |
| 125 | PUT | /api/admin/aftersale/:id/refund | 退款 |
| 126 | GET | /api/admin/user/list | 用户列表 |
| 127 | GET | /api/admin/user/detail/:id | 用户详情 |
| 128 | PUT | /api/admin/user/level/:id | 调整会员等级 |
| 129 | PUT | /api/admin/user/status/:id | 切换用户状态 |
| 130 | PUT | /api/admin/user/points/:id | 调整用户积分 |
| 131 | GET | /api/admin/baby-profile | 宝宝档案列表(管理) |
| 132 | GET | /api/admin/member/levels | 会员等级列表 |
| 133 | POST | /api/admin/member/levels | 创建会员等级 |
| 134 | PUT | /api/admin/member/levels/:id | 更新会员等级 |
| 135 | GET | /api/admin/points/records | 积分记录 |
| 136 | POST | /api/admin/points/adjust | 调整积分 |
| 137 | POST | /api/admin/points/expire-clean | 清理过期积分 |
| 138 | GET | /api/admin/supplier/list | 供应商列表 |
| 139 | GET | /api/admin/supplier/detail/:id | 供应商详情 |
| 140 | POST | /api/admin/supplier/create | 创建供应商 |
| 141 | PUT | /api/admin/supplier/update/:id | 更新供应商 |
| 142 | DELETE | /api/admin/supplier/delete/:id | 删除供应商 |
| 143 | PUT | /api/admin/supplier/status/:id | 更新供应商状态 |
| 144 | GET | /api/admin/content/list | 内容列表 |
| 145 | GET | /api/admin/content/:id | 内容详情 |
| 146 | POST | /api/admin/content | 创建内容 |
| 147 | PUT | /api/admin/content/:id | 更新内容 |
| 148 | DELETE | /api/admin/content/:id | 删除内容 |
| 149 | POST | /api/admin/content/category | 创建内容分类 |
| 150 | PUT | /api/admin/content/category/:id | 更新内容分类 |
| 151 | DELETE | /api/admin/content/category/:id | 删除内容分类 |
| 152 | GET | /api/admin/dashboard/stats | 仪表盘统计 |
| 153 | GET | /api/admin/dashboard/sales-chart | 销售趋势 |
| 154 | GET | /api/admin/dashboard/top-products | 热销商品 |
| 155 | GET | /api/admin/dashboard/recent-orders | 最近订单 |
| 156 | GET | /api/admin/admin-user | 管理员列表 |
| 157 | GET | /api/admin/admin-user/:id | 管理员详情 |
| 158 | POST | /api/admin/admin-user | 创建管理员 |
| 159 | PUT | /api/admin/admin-user/:id | 更新管理员 |
| 160 | PUT | /api/admin/admin-user/:id/status | 更新管理员状态 |
| 161 | DELETE | /api/admin/admin-user/:id | 删除管理员 |
| 162 | GET | /api/admin/role | 角色列表 |
| 163 | GET | /api/admin/role/:id | 角色详情 |
| 164 | POST | /api/admin/role | 创建角色 |
| 165 | PUT | /api/admin/role/:id | 更新角色 |
| 166 | DELETE | /api/admin/role/:id | 删除角色 |
| 167 | GET | /api/admin/permission/tree | 权限树 |
| 168 | GET | /api/admin/operation-log | 操作日志列表 |
| 169 | GET | /api/admin/system-config/list | 系统配置列表 |
| 170 | GET | /api/admin/system-config/group/:groupName | 按组查配置 |
| 171 | PUT | /api/admin/system-config/update | 更新配置 |
| 172 | PUT | /api/admin/system-config/batch-update | 批量更新配置 |
| 173 | GET | /api/admin/file/list | 文件列表 |
| 174 | GET | /api/admin/file/:id | 文件详情 |
| 175 | POST | /api/admin/file/upload | 文件上传 |
| 176 | GET | /api/admin/refund/list | 退款记录列表 |
| 177 | GET | /api/admin/refund/detail/:id | 退款记录详情 |

---

## 10. V1.0 新增 API

### 10.1 自提点模块 【V1.0 必做】

#### 10.1.1 自提点列表

- **请求方法**：`GET`
- **URL**：`/api/weapp/pickup/stores`
- **权限要求**：需登录

**请求参数**：

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| keyword | string | 否 | 搜索关键词（门店名称/地址） |
| page | number | 否 | 页码，默认 1 |
| pageSize | number | 否 | 每页条数，默认 10 |

**响应字段**：

| 字段名 | 类型 | 说明 |
|--------|------|------|
| list | array | 自提点列表 |
| list[].id | string | 自提点 ID |
| list[].name | string | 门店名称 |
| list[].address | string | 完整地址 |
| list[].businessHours | string | 营业时间 |
| list[].phone | string | 联系电话 |
| list[].image | string | 门店图片 URL |
| list[].latitude | number | 纬度 |
| list[].longitude | number | 经度 |
| pagination | object | 分页信息 |

**错误码**：无

---

#### 10.1.2 自提点详情

- **请求方法**：`GET`
- **URL**：`/api/weapp/pickup/stores/:id`
- **权限要求**：需登录

**请求参数**：

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| id | string | 是 | 自提点 ID（路径参数） |

**响应字段**：

| 字段名 | 类型 | 说明 |
|--------|------|------|
| id | string | 自提点 ID |
| name | string | 门店名称 |
| province | string | 省份 |
| city | string | 城市 |
| district | string | 区/县 |
| detailAddress | string | 详细地址 |
| businessHours | string | 营业时间 |
| phone | string | 联系电话 |
| image | string | 门店图片 URL |
| latitude | number | 纬度 |
| longitude | number | 经度 |

**错误码**：40401（自提点不存在）

---

### 10.2 订单模块扩展 【V1.0 必做】

#### 10.2.1 订单试算扩展

在现有 `/api/weapp/order/preview` 接口的请求参数中新增：

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| fulfillmentType | string | 否 | 配送方式：delivery-快递配送，pickup-到店自提，默认 delivery |
| pickupStoreId | string | 否 | 自提点 ID（fulfillmentType=pickup 时必填） |

响应字段新增：

| 字段名 | 类型 | 说明 |
|--------|------|------|
| fulfillmentType | string | 配送方式 |
| pickupStore | object | 自提点信息（fulfillmentType=pickup 时返回） |
| pickupStore.id | string | 自提点 ID |
| pickupStore.name | string | 门店名称 |
| pickupStore.address | string | 完整地址 |
| shippingFee | number | 运费（fulfillmentType=pickup 时为 0） |

---

#### 10.2.2 创建订单扩展

在现有 `/api/weapp/order/create` 接口的请求参数中新增：

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| fulfillmentType | string | 否 | 配送方式：delivery-快递配送，pickup-到店自提，默认 delivery |
| pickupStoreId | string | 否 | 自提点 ID（fulfillmentType=pickup 时必填） |

响应字段新增：

| 字段名 | 类型 | 说明 |
|--------|------|------|
| pickupCode | string | 自提码（fulfillmentType=pickup 且支付成功后返回） |

---

#### 10.2.3 订单详情扩展

在现有 `/api/weapp/order/detail` 接口的响应字段中新增：

| 字段名 | 类型 | 说明 |
|--------|------|------|
| fulfillmentType | string | 配送方式：delivery-快递配送，pickup-到店自提 |
| pickupCode | string | 自提码（自提订单） |
| pickupStore | object | 自提点信息（自提订单） |
| pickupStore.id | string | 自提点 ID |
| pickupStore.name | string | 门店名称 |
| pickupStore.address | string | 完整地址 |
| pickupStore.businessHours | string | 营业时间 |
| pickupStore.phone | string | 联系电话 |
| pickupStore.latitude | number | 纬度 |
| pickupStore.longitude | number | 经度 |
| pickedUpAt | string | 核销时间（已核销时返回） |

---

### 10.3 自提核销 API（管理后台）【V1.0 必做】

#### 10.3.1 查询自提码对应订单

- **请求方法**：`GET`
- **URL**：`/api/admin/pickup/verify-query`
- **权限要求**：需登录 + pickup:verify 权限

**请求参数**：

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| pickupCode | string | 是 | 自提码 |

**响应字段**：

| 字段名 | 类型 | 说明 |
|--------|------|------|
| orderId | string | 订单 ID |
| orderNo | string | 订单号 |
| items | array | 商品列表 |
| storeName | string | 自提点名称 |
| userName | string | 用户昵称 |
| userPhone | string | 用户手机号 |
| status | string | 订单状态 |

**错误码**：40401（自提码不存在）、20002（订单状态不允许核销）

---

#### 10.3.2 确认核销

- **请求方法**：`POST`
- **URL**：`/api/admin/pickup/verify-confirm`
- **权限要求**：需登录 + pickup:verify 权限

**请求参数**：

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| pickupCode | string | 是 | 自提码 |

**响应字段**：

| 字段名 | 类型 | 说明 |
|--------|------|------|
| success | boolean | 是否核销成功 |
| verifiedAt | string | 核销时间 |

**错误码**：40401（自提码不存在）、20002（订单状态不允许核销）、40901（重复核销）

---

### 10.4 客服配置 API 【V1.0 必做】

#### 10.4.1 获取客服配置（小程序端）

- **请求方法**：`GET`
- **URL**：`/api/weapp/customer-service/config`
- **权限要求**：无

**请求参数**：无

**响应字段**：

| 字段名 | 类型 | 说明 |
|--------|------|------|
| onlineEnabled | boolean | 是否启用在线客服 |
| phone | string | 客服电话 |
| wechat | string | 客服微信号 |
| qrcodeUrl | string | 客服二维码图片 URL |
| workTime | string | 工作时间描述 |
| offlineMessage | string | 非工作时间自动回复语 |

**错误码**：无

---

#### 10.4.2 获取客服配置（管理后台）

- **请求方法**：`GET`
- **URL**：`/api/admin/customer-service/config`
- **权限要求**：需登录 + system:customer-service 权限

**请求参数**：无

**响应字段**：同 10.4.1

---

#### 10.4.3 更新客服配置（管理后台）

- **请求方法**：`PUT`
- **URL**：`/api/admin/customer-service/config-update`
- **权限要求**：需登录 + system:customer-service 权限

**请求参数**：

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| onlineEnabled | boolean | 否 | 是否启用在线客服 |
| phone | string | 否 | 客服电话 |
| wechat | string | 否 | 客服微信号 |
| qrcodeUrl | string | 否 | 客服二维码图片 URL |
| workTime | string | 否 | 工作时间描述 |
| offlineMessage | string | 否 | 非工作时间自动回复语 |

**响应字段**：

| 字段名 | 类型 | 说明 |
|--------|------|------|
| success | boolean | 是否更新成功 |

---

### 10.5 活动内容流 API 【V1.0 必做】

#### 10.5.1 活动首页内容流

- **请求方法**：`GET`
- **URL**：`/api/weapp/activity/feed`
- **权限要求**：无

**请求参数**：

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| tab | string | 否 | 子Tab：recommend-推荐，discount-优惠，video-视频，article-文章，offline-线下·自提，默认 recommend |
| page | number | 否 | 页码，默认 1 |
| pageSize | number | 否 | 每页条数，默认 10 |

**响应字段**：

| 字段名 | 类型 | 说明 |
|--------|------|------|
| list | array | 内容列表（混合类型） |
| list[].type | string | 内容类型：activity-活动，article-文章，video-视频 |
| list[].id | string | 内容 ID |
| list[].title | string | 标题 |
| list[].coverImage | string | 封面图 URL |
| list[].tag | string | 标签 |
| list[].viewCount | number | 浏览量/播放量 |
| list[].publishTime | string | 发布时间 |
| list[].startTime | string | 活动开始时间（type=activity） |
| list[].endTime | string | 活动结束时间（type=activity） |
| list[].activityType | number | 活动类型（type=activity） |
| list[].videoDuration | number | 视频时长秒数（type=video） |
| pagination | object | 分页信息 |

**错误码**：40001（参数错误）

---

#### 10.5.2 内容详情扩展

在现有 `/api/weapp/content/detail` 接口的响应字段中新增：

| 字段名 | 类型 | 说明 |
|--------|------|------|
| contentType | string | 内容类型：article-文章，video-视频 |
| videoUrl | string | 视频 URL（contentType=video） |
| videoCover | string | 视频封面图 URL |
| videoDuration | number | 视频时长（秒） |
| tags | array | 标签列表 |
| relatedProducts | array | 关联商品列表（含 id/name/mainImage/price） |
| relatedActivityId | string | 关联活动 ID |

---

### 10.6 分享与裂变 API 【V1.0 必做】

#### 10.6.1 记录分享行为

- **请求方法**：`POST`
- **URL**：`/api/weapp/share/record`
- **权限要求**：需登录

**请求参数**：

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| shareType | string | 是 | 分享类型：product-商品，activity-活动，content-内容，invite-邀请 |
| shareId | string | 否 | 分享对象 ID（商品ID/活动ID/内容ID） |
| channel | string | 否 | 分享渠道：friend-好友/群，moments-朋友圈海报，qrcode-二维码 |

**响应字段**：

| 字段名 | 类型 | 说明 |
|--------|------|------|
| success | boolean | 是否记录成功 |
| reward | object | 奖励信息（如有） |
| reward.type | string | 奖励类型：points |
| reward.amount | number | 奖励数量 |

---

#### 10.6.2 获取分享海报数据

- **请求方法**：`GET`
- **URL**：`/api/weapp/share/poster`
- **权限要求**：需登录

**请求参数**：

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| type | string | 是 | 海报类型：product-商品，activity-活动，invite-邀请 |
| id | string | 否 | 对象 ID（type=product/activity 时必填） |

**响应字段**：

| 字段名 | 类型 | 说明 |
|--------|------|------|
| posterData | object | 海报渲染数据（标题、价格、图片等） |
| qrcodeUrl | string | 专属小程序码 URL（含邀请参数） |

---

#### 10.6.3 绑定邀请关系

- **请求方法**：`POST`
- **URL**：`/api/weapp/share/bind-invite`
- **权限要求**：需登录

**请求参数**：

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| inviterId | string | 是 | 邀请人用户 ID（从分享链接参数获取） |

**响应字段**：

| 字段名 | 类型 | 说明 |
|--------|------|------|
| success | boolean | 是否绑定成功 |
| isNewBind | boolean | 是否新绑定（已绑定过返回 false） |

**错误码**：40001（参数错误）、40901（已绑定其他邀请人）

**业务说明**：用户通过分享链接进入小程序后，前端从启动参数中获取 inviterId，调用此接口绑定邀请关系。同一用户只能绑定一个邀请人。

---

#### 10.6.4 获取邀请统计

- **请求方法**：`GET`
- **URL**：`/api/weapp/share/invite-stats`
- **权限要求**：需登录

**请求参数**：无

**响应字段**：

| 字段名 | 类型 | 说明 |
|--------|------|------|
| totalInvites | number | 累计邀请人数 |
| orderedInvites | number | 已下单邀请人数 |
| totalReward | number | 已获奖励总额（积分） |

---

#### 10.6.5 获取邀请记录

- **请求方法**：`GET`
- **URL**：`/api/weapp/share/invite-records`
- **权限要求**：需登录

**请求参数**：

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| page | number | 否 | 页码，默认 1 |
| pageSize | number | 否 | 每页条数，默认 10 |

**响应字段**：

| 字段名 | 类型 | 说明 |
|--------|------|------|
| list | array | 邀请记录列表 |
| list[].avatar | string | 被邀请人头像 |
| list[].nickname | string | 被邀请人昵称（脱敏） |
| list[].status | string | 状态：registered-已注册，ordered-已下单，rewarded-已发放奖励 |
| list[].createTime | string | 绑定时间 |
| pagination | object | 分页信息 |

---

#### 10.6.6 裂变奖励发放（内部接口）

- **请求方法**：`POST`
- **URL**：`/api/internal/share/reward`
- **权限要求**：内部服务调用（不对外暴露）

**请求参数**：

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| inviterId | string | 是 | 邀请人用户 ID |
| inviteeId | string | 是 | 被邀请人用户 ID |
| campaignId | string | 是 | 裂变活动 ID |
| triggerEvent | string | 是 | 触发事件：register-注册，first_order-首单完成 |

**响应字段**：

| 字段名 | 类型 | 说明 |
|--------|------|------|
| success | boolean | 是否发放成功 |
| rewardType | string | 奖励类型 |
| rewardAmount | number | 奖励数量 |

**业务说明**：此接口由订单完成等事件触发内部调用，不对外暴露。发放前需校验防刷规则和奖励上限。

---

### 10.7 帮助中心 API 【V1.0 必做】

#### 10.7.1 获取帮助中心内容

- **请求方法**：`GET`
- **URL**：`/api/weapp/help/list`
- **权限要求**：无

**请求参数**：

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| category | string | 否 | 帮助分类：shopping-购物指南，aftersale-售后规则，delivery-配送说明，member-会员权益 |

**响应字段**：

| 字段名 | 类型 | 说明 |
|--------|------|------|
| list | array | 帮助内容列表 |
| list[].id | string | 帮助 ID |
| list[].question | string | 问题 |
| list[].answer | string | 答案 |
| list[].category | string | 分类 |

---

### 10.8 管理后台新增 API 【V1.0 必做】

#### 10.8.1 自提点管理 API

| 接口 | 方法 | URL | 说明 |
|------|------|-----|------|
| 自提点列表 | GET | /api/admin/pickup/store-list | 分页查询自提点列表 |
| 新增自提点 | POST | /api/admin/pickup/store-create | 新增自提点 |
| 更新自提点 | PUT | /api/admin/pickup/store-update | 更新自提点信息 |
| 删除自提点 | DELETE | /api/admin/pickup/store-delete | 删除自提点（软删除） |

#### 10.8.2 裂变活动配置 API

| 接口 | 方法 | URL | 说明 |
|------|------|-----|------|
| 获取裂变配置 | GET | /api/admin/share/campaign-config | 获取当前裂变活动配置 |
| 更新裂变配置 | PUT | /api/admin/share/campaign-config-update | 更新裂变活动配置 |

#### 10.8.3 邀请/分享统计 API

| 接口 | 方法 | URL | 说明 |
|------|------|-----|------|
| 分享统计概览 | GET | /api/admin/share/stats | 获取邀请统计概览数据 |
| 邀请关系列表 | GET | /api/admin/share/invite-relations | 分页查询邀请关系列表 |
| 奖励发放记录 | GET | /api/admin/share/reward-logs | 分页查询奖励发放记录 |
| 异常邀请记录 | GET | /api/admin/share/abnormal | 分页查询异常邀请记录 |
