# 禧孕母婴用品私域商城小程序 - API 接口设计文档

> 运营方：禧孕文化传媒有限公司
> 后端技术栈：Node.js + NestJS + TypeScript
> 文档版本：v1.0.0
> 最后更新：2026-05-20

---

## 1. 文档概述

本文档定义了"禧孕母婴用品私域商城小程序"全部后端 API 接口规范，供前后端开发人员协同开发使用。项目为甲方自营商城（非多商户平台），所有商品、库存、订单均由禧孕文化传媒有限公司统一管理。

API 按调用端分为三大部分：

| 分组 | 前缀 | 说明 |
|------|------|------|
| 小程序端 API | `/api/weapp/*` | 面向微信小程序用户，需微信 JWT 鉴权 |
| 管理后台 API | `/api/admin/*` | 面向运营管理人员，需管理员 JWT 鉴权 + RBAC 权限 |
| 公共 API | `/api/common/*` | 无需鉴权或仅需轻量鉴权的公共接口 |

---

## 2. 接口规范

### 2.1 请求格式

- 请求方法：`GET` / `POST` / `PUT` / `DELETE`
- Content-Type：
  - `GET` / `DELETE`：参数通过 Query String 传递
  - `POST` / `PUT`：参数通过 JSON Body 传递，`Content-Type: application/json`
  - 文件上传接口：`Content-Type: multipart/form-data`
- 字符编码：UTF-8
- 时间格式：ISO 8601（`YYYY-MM-DDTHH:mm:ss.sssZ`）
- 金额单位：所有金额字段均以 **分** 为整数单位，前端展示时需换算为元

### 2.2 统一响应格式

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

### 2.3 分页格式

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

### 2.4 错误码规范

错误码采用 5 位数字编码，前 2 位为模块分类，后 3 位为具体错误。

### 2.5 认证方式

**小程序端**：登录后获取 JWT Token，后续请求在 Header 中携带 `Authorization: Bearer <token>`，Token 有效期 7 天。

**管理后台**：登录后获取 JWT Token，后续请求在 Header 中携带 `Authorization: Bearer <token>`，Token 有效期 2 小时，支持 Refresh Token 刷新。

### 2.6 请求头规范

| Header | 必填 | 说明 |
|--------|------|------|
| Authorization | 视接口 | `Bearer <token>` 格式 |
| Content-Type | 是 | `application/json` 或 `multipart/form-data` |
| X-Request-Id | 否 | 请求追踪 ID，建议 UUID |
| X-Platform | 否 | 平台标识：`weapp` / `admin` |

---

## 3. 通用错误码

### 3.1 通用错误码

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

### 3.2 业务错误码

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

## 4. 小程序端 API

### 4.1 认证模块

#### 微信登录

- **接口名称**：微信登录
- **请求方法**：`POST`
- **URL**：`/api/weapp/auth/login`
- **权限要求**：无

**请求参数**：

| 参数名 | 类型 | 必填 | 说明 |
| ------ | ------ | ------ | ------ |
| code | string | 是 | 微信登录凭证 wx.login() 获取 |
| userInfo | object | 否 | 用户基本信息 |
| userInfo.nickName | string | 否 | 用户昵称 |
| userInfo.avatarUrl | string | 否 | 用户头像 URL |
| userInfo.gender | number | 否 | 性别：0-未知 1-男 2-女 |

**响应字段**：

| 字段名 | 类型 | 说明 |
| ------ | ------ | ------ |
| token | string | JWT Token |
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

#### 绑定手机号

- **接口名称**：绑定手机号
- **请求方法**：`POST`
- **URL**：`/api/weapp/auth/phone`
- **权限要求**：需登录

**请求参数**：

| 参数名 | 类型 | 必填 | 说明 |
| ------ | ------ | ------ | ------ |
| code | string | 是 | 微信手机号授权 code |
| encryptedData | string | 否 | 加密数据（兼容旧版） |
| iv | string | 否 | 加密算法初始向量（兼容旧版） |

**响应字段**：

| 字段名 | 类型 | 说明 |
| ------ | ------ | ------ |
| phone | string | 绑定的手机号 |

**错误码**：80001（手机号绑定失败）、50004（微信接口调用失败）

**业务说明**：优先使用微信手机号快速验证接口，兼容旧版 encryptedData/iv 方式。同一手机号若已绑定其他账号，需进行账号合并处理。

---
### 4.2 用户模块

#### 获取用户信息

- **接口名称**：获取用户信息
- **请求方法**：`GET`
- **URL**：`/api/weapp/user/info`
- **权限要求**：需登录

**请求参数**：无

**响应字段**：

| 字段名 | 类型 | 说明 |
| ------ | ------ | ------ |
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

#### 更新用户资料

- **接口名称**：更新用户资料
- **请求方法**：`PUT`
- **URL**：`/api/weapp/user/profile`
- **权限要求**：需登录

**请求参数**：

| 参数名 | 类型 | 必填 | 说明 |
| ------ | ------ | ------ | ------ |
| nickName | string | 否 | 昵称，最长 20 字符 |
| gender | number | 否 | 性别：0-未知 1-男 2-女 |
| birthday | string | 否 | 生日，格式 YYYY-MM-DD |

**响应字段**：

| 字段名 | 类型 | 说明 |
| ------ | ------ | ------ |
| success | boolean | 是否更新成功 |

**错误码**：40001（参数错误）

**业务说明**：仅允许修改昵称、性别、生日字段，手机号修改需走专门的换绑流程。

---

#### 更新头像

- **接口名称**：更新头像
- **请求方法**：`POST`
- **URL**：`/api/weapp/user/avatar`
- **权限要求**：需登录

**请求参数**：

| 参数名 | 类型 | 必填 | 说明 |
| ------ | ------ | ------ | ------ |
| file | File | 是 | 头像图片文件，支持 jpg/png，最大 2MB |

**响应字段**：

| 字段名 | 类型 | 说明 |
| ------ | ------ | ------ |
| avatarUrl | string | 新头像 URL |

**错误码**：40001（文件格式或大小不符）

**业务说明**：上传头像图片至 OSS，更新用户头像字段。旧头像若为用户上传的将自动清理。

---
### 4.3 地址模块

#### 地址列表

- **接口名称**：地址列表
- **请求方法**：`GET`
- **URL**：`/api/weapp/address/list`
- **权限要求**：需登录

**请求参数**：无

**响应字段**：

| 字段名 | 类型 | 说明 |
| ------ | ------ | ------ |
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

#### 地址详情

- **接口名称**：地址详情
- **请求方法**：`GET`
- **URL**：`/api/weapp/address/detail/:id`
- **权限要求**：需登录

**请求参数**：

| 参数名 | 类型 | 必填 | 说明 |
| ------ | ------ | ------ | ------ |
| id | number | 是 | 地址 ID（路径参数） |

**响应字段**：

| 字段名 | 类型 | 说明 |
| ------ | ------ | ------ |
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

#### 新增地址

- **接口名称**：新增地址
- **请求方法**：`POST`
- **URL**：`/api/weapp/address/create`
- **权限要求**：需登录

**请求参数**：

| 参数名 | 类型 | 必填 | 说明 |
| ------ | ------ | ------ | ------ |
| name | string | 是 | 收货人姓名，最长 20 字符 |
| phone | string | 是 | 手机号，11 位 |
| province | string | 是 | 省份 |
| city | string | 是 | 城市 |
| district | string | 是 | 区县 |
| detail | string | 是 | 详细地址，最长 200 字符 |
| isDefault | boolean | 否 | 是否设为默认，默认 false |

**响应字段**：

| 字段名 | 类型 | 说明 |
| ------ | ------ | ------ |
| id | number | 新创建的地址 ID |

**错误码**：40001（参数错误）、40002（超出地址数量限制）

**业务说明**：若 isDefault 为 true，将取消原默认地址的默认标记。每个用户最多 20 个地址。

---

#### 更新地址

- **接口名称**：更新地址
- **请求方法**：`PUT`
- **URL**：`/api/weapp/address/update/:id`
- **权限要求**：需登录

**请求参数**：

| 参数名 | 类型 | 必填 | 说明 |
| ------ | ------ | ------ | ------ |
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
| ------ | ------ | ------ |
| success | boolean | 是否更新成功 |

**错误码**：40401（地址不存在）、40001（参数错误）

**业务说明**：只能更新自己的地址。若设为默认地址，将取消原默认地址标记。

---

#### 删除地址

- **接口名称**：删除地址
- **请求方法**：`DELETE`
- **URL**：`/api/weapp/address/delete/:id`
- **权限要求**：需登录

**请求参数**：

| 参数名 | 类型 | 必填 | 说明 |
| ------ | ------ | ------ | ------ |
| id | number | 是 | 地址 ID（路径参数） |

**响应字段**：

| 字段名 | 类型 | 说明 |
| ------ | ------ | ------ |
| success | boolean | 是否删除成功 |

**错误码**：40401（地址不存在）

**业务说明**：只能删除自己的地址。若删除的是默认地址，将自动将最早创建的地址设为默认。

---

#### 设为默认地址

- **接口名称**：设为默认地址
- **请求方法**：`PUT`
- **URL**：`/api/weapp/address/set-default/:id`
- **权限要求**：需登录

**请求参数**：

| 参数名 | 类型 | 必填 | 说明 |
| ------ | ------ | ------ | ------ |
| id | number | 是 | 地址 ID（路径参数） |

**响应字段**：

| 字段名 | 类型 | 说明 |
| ------ | ------ | ------ |
| success | boolean | 是否设置成功 |

**错误码**：40401（地址不存在）

**业务说明**：将指定地址设为默认，同时取消原默认地址的默认标记。

---
### 4.4 宝宝档案模块

#### 宝宝列表

- **接口名称**：宝宝列表
- **请求方法**：`GET`
- **URL**：`/api/weapp/baby/list`
- **权限要求**：需登录

**请求参数**：无

**响应字段**：

| 字段名 | 类型 | 说明 |
| ------ | ------ | ------ |
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

#### 宝宝详情

- **接口名称**：宝宝详情
- **请求方法**：`GET`
- **URL**：`/api/weapp/baby/detail/:id`
- **权限要求**：需登录

**请求参数**：

| 参数名 | 类型 | 必填 | 说明 |
| ------ | ------ | ------ | ------ |
| id | number | 是 | 宝宝 ID（路径参数） |

**响应字段**：

| 字段名 | 类型 | 说明 |
| ------ | ------ | ------ |
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

#### 新增宝宝

- **接口名称**：新增宝宝
- **请求方法**：`POST`
- **URL**：`/api/weapp/baby/create`
- **权限要求**：需登录

**请求参数**：

| 参数名 | 类型 | 必填 | 说明 |
| ------ | ------ | ------ | ------ |
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
| ------ | ------ | ------ |
| id | number | 新创建的宝宝 ID |

**错误码**：40001（参数错误）

**业务说明**：每个用户最多 5 个宝宝档案。宝宝生日不能晚于当前日期。新增宝宝后，系统可根据月龄推荐适合的商品。

---

#### 更新宝宝

- **接口名称**：更新宝宝
- **请求方法**：`PUT`
- **URL**：`/api/weapp/baby/update/:id`
- **权限要求**：需登录

**请求参数**：

| 参数名 | 类型 | 必填 | 说明 |
| ------ | ------ | ------ | ------ |
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
| ------ | ------ | ------ |
| success | boolean | 是否更新成功 |

**错误码**：40401（宝宝档案不存在）、40001（参数错误）

**业务说明**：只能更新自己的宝宝档案。

---

#### 删除宝宝

- **接口名称**：删除宝宝
- **请求方法**：`DELETE`
- **URL**：`/api/weapp/baby/delete/:id`
- **权限要求**：需登录

**请求参数**：

| 参数名 | 类型 | 必填 | 说明 |
| ------ | ------ | ------ | ------ |
| id | number | 是 | 宝宝 ID（路径参数） |

**响应字段**：

| 字段名 | 类型 | 说明 |
| ------ | ------ | ------ |
| success | boolean | 是否删除成功 |

**错误码**：40401（宝宝档案不存在）

**业务说明**：只能删除自己的宝宝档案。若删除的是默认宝宝，将自动将最早创建的宝宝设为默认。

---
### 4.5 首页模块

#### 首页数据

- **接口名称**：首页数据
- **请求方法**：`GET`
- **URL**：`/api/weapp/home/data`
- **权限要求**：无（登录后可获取个性化推荐）

**请求参数**：

| 参数名 | 类型 | 必填 | 说明 |
| ------ | ------ | ------ | ------ |
| babyId | number | 否 | 宝宝 ID，用于按月龄推荐 |

**响应字段**：

| 字段名 | 类型 | 说明 |
| ------ | ------ | ------ |
| banners | array | Banner 列表 |
| banners[].id | number | Banner ID |
| banners[].imageUrl | string | 图片 URL |
| banners[].linkType | number | 跳转类型：1-商品 2-分类 3-活动 4-内容页 5-外部链接 |
| banners[].linkValue | string | 跳转目标值 |
| banners[].title | string | 标题 |
| recommendations | array | 推荐位列表 |
| recommendations[].id | number | 推荐位 ID |
| recommendations[].title | string | 推荐位标题 |
| recommendations[].products | array | 推荐商品列表（精简，含 id/name/mainImage/price/originalPrice/tag） |
| hotProducts | array | 热门商品（同上结构，最多 10 个） |
| newProducts | array | 新品上架（同上结构，最多 10 个） |
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
### 4.6 分类模块

#### 分类树

- **接口名称**：分类树
- **请求方法**：`GET`
- **URL**：`/api/weapp/category/tree`
- **权限要求**：无

**请求参数**：无

**响应字段**：

| 字段名 | 类型 | 说明 |
| ------ | ------ | ------ |
| list | array | 一级分类列表 |
| list[].id | number | 分类 ID |
| list[].name | string | 分类名称 |
| list[].icon | string | 分类图标 URL |
| list[].children | array | 二级分类列表（结构同上，含 children 三级） |

**错误码**：无

**业务说明**：返回三级分类树结构，仅包含启用状态的分类。数据有 30 分钟缓存。

---
### 4.7 商品模块

#### 商品列表

- **接口名称**：商品列表
- **请求方法**：`GET`
- **URL**：`/api/weapp/product/list`
- **权限要求**：无

**请求参数**：

| 参数名 | 类型 | 必填 | 说明 |
| ------ | ------ | ------ | ------ |
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
| ------ | ------ | ------ |
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

#### 商品详情

- **接口名称**：商品详情
- **请求方法**：`GET`
- **URL**：`/api/weapp/product/detail/:id`
- **权限要求**：无

**请求参数**：

| 参数名 | 类型 | 必填 | 说明 |
| ------ | ------ | ------ | ------ |
| id | number | 是 | 商品 ID（路径参数） |

**响应字段**：

| 字段名 | 类型 | 说明 |
| ------ | ------ | ------ |
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

#### 推荐商品

- **接口名称**：推荐商品
- **请求方法**：`GET`
- **URL**：`/api/weapp/product/recommend`
- **权限要求**：无（登录后推荐更精准）

**请求参数**：

| 参数名 | 类型 | 必填 | 说明 |
| ------ | ------ | ------ | ------ |
| type | string | 否 | 推荐类型：month_age-按月龄 guess-猜你喜欢 hot-热门新品，默认 guess |
| babyId | number | 否 | 宝宝 ID（type=month_age 时必填） |
| page | number | 否 | 页码，默认 1 |
| pageSize | number | 否 | 每页条数，默认 10 |

**响应字段**：

| 字段名 | 类型 | 说明 |
| ------ | ------ | ------ |
| list | array | 商品列表（结构同商品列表） |
| pagination | object | 分页信息 |

**错误码**：40001（参数错误）

**业务说明**：按月龄推荐根据宝宝月龄匹配适用商品；猜你喜欢基于用户浏览和购买历史推荐；热门新品按销量和上架时间排序。

---
### 4.8 搜索模块

#### 热门搜索词

- **接口名称**：热门搜索词
- **请求方法**：`GET`
- **URL**：`/api/weapp/search/hot`
- **权限要求**：无

**请求参数**：无

**响应字段**：

| 字段名 | 类型 | 说明 |
| ------ | ------ | ------ |
| list | array | 热门搜索词列表 |
| list[].keyword | string | 搜索关键词 |
| list[].heat | number | 热度值 |

**错误码**：无

**业务说明**：返回近期搜索热度最高的关键词，最多 20 个。数据每日更新。

---

#### 搜索历史

- **接口名称**：搜索历史
- **请求方法**：`GET`
- **URL**：`/api/weapp/search/history`
- **权限要求**：需登录

**请求参数**：无

**响应字段**：

| 字段名 | 类型 | 说明 |
| ------ | ------ | ------ |
| list | array | 搜索历史列表 |
| list[].keyword | string | 搜索关键词 |
| list[].searchedAt | string | 搜索时间 |

**错误码**：40101（未登录）

**业务说明**：返回当前用户最近 30 条搜索记录，按时间倒序。

---

#### 清空搜索历史

- **接口名称**：清空搜索历史
- **请求方法**：`DELETE`
- **URL**：`/api/weapp/search/history`
- **权限要求**：需登录

**请求参数**：无

**响应字段**：

| 字段名 | 类型 | 说明 |
| ------ | ------ | ------ |
| success | boolean | 是否清空成功 |

**错误码**：40101（未登录）

**业务说明**：清空当前用户所有搜索历史记录。

---
### 4.9 购物车模块

#### 购物车列表

- **接口名称**：购物车列表
- **请求方法**：`GET`
- **URL**：`/api/weapp/cart/list`
- **权限要求**：需登录

**请求参数**：无

**响应字段**：

| 字段名 | 类型 | 说明 |
| ------ | ------ | ------ |
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

#### 加入购物车

- **接口名称**：加入购物车
- **请求方法**：`POST`
- **URL**：`/api/weapp/cart/add`
- **权限要求**：需登录

**请求参数**：

| 参数名 | 类型 | 必填 | 说明 |
| ------ | ------ | ------ | ------ |
| productId | number | 是 | 商品 ID |
| skuId | number | 是 | SKU ID |
| quantity | number | 是 | 数量，最小 1 |

**响应字段**：

| 字段名 | 类型 | 说明 |
| ------ | ------ | ------ |
| cartItemId | number | 购物车项 ID |
| totalQuantity | number | 购物车总数量 |

**错误码**：10001（商品已下架）、10002（库存不足）、10003（商品不存在）、10004（SKU 不存在）、20005（超出购买限制）

**业务说明**：若购物车已有相同 SKU，则数量累加。需校验商品是否上架、库存是否充足、是否超出限购数量。

---

#### 更新购物车项

- **接口名称**：更新购物车项
- **请求方法**：`PUT`
- **URL**：`/api/weapp/cart/update`
- **权限要求**：需登录

**请求参数**：

| 参数名 | 类型 | 必填 | 说明 |
| ------ | ------ | ------ | ------ |
| id | number | 是 | 购物车项 ID |
| quantity | number | 否 | 数量 |
| isSelected | boolean | 否 | 是否选中 |
| skuId | number | 否 | 更换 SKU |

**响应字段**：

| 字段名 | 类型 | 说明 |
| ------ | ------ | ------ |
| success | boolean | 是否更新成功 |

**错误码**：10002（库存不足）、20005（超出购买限制）

**业务说明**：支持修改数量、选中状态、更换 SKU。更换 SKU 时需校验新 SKU 的库存和限购。

---

#### 删除购物车项

- **接口名称**：删除购物车项
- **请求方法**：`DELETE`
- **URL**：`/api/weapp/cart/remove`
- **权限要求**：需登录

**请求参数**：

| 参数名 | 类型 | 必填 | 说明 |
| ------ | ------ | ------ | ------ |
| ids | array | 是 | 购物车项 ID 列表 |

**响应字段**：

| 字段名 | 类型 | 说明 |
| ------ | ------ | ------ |
| success | boolean | 是否删除成功 |

**错误码**：40001（参数错误）

**业务说明**：支持批量删除购物车项。

---

#### 全选/取消全选

- **接口名称**：全选/取消全选
- **请求方法**：`PUT`
- **URL**：`/api/weapp/cart/select-all`
- **权限要求**：需登录

**请求参数**：

| 参数名 | 类型 | 必填 | 说明 |
| ------ | ------ | ------ | ------ |
| isSelected | boolean | 是 | true-全选 false-取消全选 |

**响应字段**：

| 字段名 | 类型 | 说明 |
| ------ | ------ | ------ |
| success | boolean | 是否操作成功 |

**错误码**：40101（未登录）

**业务说明**：设置所有有效购物车项的选中状态。

---
### 4.10 订单模块

#### 订单确认

- **接口名称**：订单确认
- **请求方法**：`POST`
- **URL**：`/api/weapp/order/confirm`
- **权限要求**：需登录

**请求参数**：

| 参数名 | 类型 | 必填 | 说明 |
| ------ | ------ | ------ | ------ |
| cartItemIds | array | 否 | 购物车项 ID 列表（从购物车下单时传） |
| items | array | 否 | 直接购买商品列表（立即购买时传，含 productId/skuId/quantity） |
| addressId | number | 否 | 收货地址 ID |

**响应字段**：

| 字段名 | 类型 | 说明 |
| ------ | ------ | ------ |
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

#### 创建订单

- **接口名称**：创建订单
- **请求方法**：`POST`
- **URL**：`/api/weapp/order/create`
- **权限要求**：需登录

**请求参数**：

| 参数名 | 类型 | 必填 | 说明 |
| ------ | ------ | ------ | ------ |
| cartItemIds | array | 否 | 购物车项 ID 列表 |
| items | array | 否 | 直接购买商品列表 |
| addressId | number | 是 | 收货地址 ID |
| couponId | number | 否 | 使用的优惠券 ID |
| usePoints | number | 否 | 使用积分数量 |
| remark | string | 否 | 买家备注，最长 200 字符 |
| source | string | 否 | 订单来源：cart-购物车 buy_now-立即购买 |

**响应字段**：

| 字段名 | 类型 | 说明 |
| ------ | ------ | ------ |
| orderId | number | 订单 ID |
| orderNo | string | 订单编号 |
| payAmount | number | 应付金额（分） |
| needPay | boolean | 是否需要支付 |

**错误码**：10001（商品已下架）、10002（库存不足）、10005（价格已变动）、30004（优惠券未满足使用条件）、60002（积分不足）

**业务说明**：创建订单时需再次校验商品状态、库存、价格。使用乐观锁防止超卖。创建成功后扣减库存（预扣），30 分钟未支付自动取消并释放库存。

---

#### 获取微信支付参数

- **接口名称**：获取微信支付参数
- **请求方法**：`POST`
- **URL**：`/api/weapp/order/pay/:id`
- **权限要求**：需登录

**请求参数**：

| 参数名 | 类型 | 必填 | 说明 |
| ------ | ------ | ------ | ------ |
| id | number | 是 | 订单 ID（路径参数） |

**响应字段**：

| 字段名 | 类型 | 说明 |
| ------ | ------ | ------ |
| timeStamp | string | 时间戳 |
| nonceStr | string | 随机字符串 |
| package | string | 统一下单返回的 prepay_id 参数 |
| signType | string | 签名类型 |
| paySign | string | 签名 |

**错误码**：20001（订单不存在）、20002（订单状态不允许此操作）、20004（订单已支付）、50004（微信接口调用失败）

**业务说明**：仅待支付状态的订单可发起支付。后端调用微信支付统一下单接口。支付结果以微信支付回调为准。

---

#### 订单列表

- **接口名称**：订单列表
- **请求方法**：`GET`
- **URL**：`/api/weapp/order/list`
- **权限要求**：需登录

**请求参数**：

| 参数名 | 类型 | 必填 | 说明 |
| ------ | ------ | ------ | ------ |
| page | number | 否 | 页码，默认 1 |
| pageSize | number | 否 | 每页条数，默认 10 |
| status | number | 否 | 订单状态：0-全部 1-待付款 2-待发货 3-待收货 4-已完成 5-已取消 6-售后中 |

**响应字段**：

| 字段名 | 类型 | 说明 |
| ------ | ------ | ------ |
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

#### 订单详情

- **接口名称**：订单详情
- **请求方法**：`GET`
- **URL**：`/api/weapp/order/detail/:id`
- **权限要求**：需登录

**请求参数**：

| 参数名 | 类型 | 必填 | 说明 |
| ------ | ------ | ------ | ------ |
| id | number | 是 | 订单 ID（路径参数） |

**响应字段**：

| 字段名 | 类型 | 说明 |
| ------ | ------ | ------ |
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

#### 取消订单

- **接口名称**：取消订单
- **请求方法**：`PUT`
- **URL**：`/api/weapp/order/cancel/:id`
- **权限要求**：需登录

**请求参数**：

| 参数名 | 类型 | 必填 | 说明 |
| ------ | ------ | ------ | ------ |
| id | number | 是 | 订单 ID（路径参数） |
| reason | string | 否 | 取消原因 |

**响应字段**：

| 字段名 | 类型 | 说明 |
| ------ | ------ | ------ |
| success | boolean | 是否取消成功 |

**错误码**：20001（订单不存在）、20002（订单状态不允许此操作）

**业务说明**：仅待付款状态的订单可取消。取消后释放库存，退回优惠券和积分。

---

#### 确认收货

- **接口名称**：确认收货
- **请求方法**：`PUT`
- **URL**：`/api/weapp/order/confirm-receive/:id`
- **权限要求**：需登录

**请求参数**：

| 参数名 | 类型 | 必填 | 说明 |
| ------ | ------ | ------ | ------ |
| id | number | 是 | 订单 ID（路径参数） |

**响应字段**：

| 字段名 | 类型 | 说明 |
| ------ | ------ | ------ |
| success | boolean | 是否确认成功 |

**错误码**：20001（订单不存在）、20002（订单状态不允许此操作）

**业务说明**：仅待收货状态的订单可确认收货。确认收货后触发积分发放。发货后 15 天未确认将自动确认。

---

#### 删除订单

- **接口名称**：删除订单
- **请求方法**：`DELETE`
- **URL**：`/api/weapp/order/delete/:id`
- **权限要求**：需登录

**请求参数**：

| 参数名 | 类型 | 必填 | 说明 |
| ------ | ------ | ------ | ------ |
| id | number | 是 | 订单 ID（路径参数） |

**响应字段**：

| 字段名 | 类型 | 说明 |
| ------ | ------ | ------ |
| success | boolean | 是否删除成功 |

**错误码**：20001（订单不存在）、20002（订单状态不允许此操作）

**业务说明**：仅已取消或已完成的订单可删除。删除为逻辑删除。

---
### 4.11 售后模块

#### 申请售后

- **接口名称**：申请售后
- **请求方法**：`POST`
- **URL**：`/api/weapp/aftersale/create`
- **权限要求**：需登录

**请求参数**：

| 参数名 | 类型 | 必填 | 说明 |
| ------ | ------ | ------ | ------ |
| orderId | number | 是 | 订单 ID |
| orderItemId | number | 是 | 订单商品项 ID |
| type | number | 是 | 售后类型：1-仅退款 2-退货退款 3-换货 |
| reason | string | 是 | 售后原因 |
| description | string | 否 | 问题描述，最长 500 字符 |
| images | array | 否 | 凭证图片 URL 列表，最多 9 张 |
| refundAmount | number | 否 | 退款金额（分），不传则默认为商品实付金额 |

**响应字段**：

| 字段名 | 类型 | 说明 |
| ------ | ------ | ------ |
| id | number | 售后单 ID |
| aftersaleNo | string | 售后单号 |

**错误码**：20001（订单不存在）、50003（超出售后申请时效）、20002（订单状态不允许此操作）

**业务说明**：订单完成后 15 天内可申请售后。每个订单商品项仅可申请一次售后。退款金额不能超过商品实付金额。

---

#### 售后列表

- **接口名称**：售后列表
- **请求方法**：`GET`
- **URL**：`/api/weapp/aftersale/list`
- **权限要求**：需登录

**请求参数**：

| 参数名 | 类型 | 必填 | 说明 |
| ------ | ------ | ------ | ------ |
| page | number | 否 | 页码，默认 1 |
| pageSize | number | 否 | 每页条数，默认 10 |
| status | number | 否 | 状态：0-全部 1-待审核 2-审核通过 3-审核拒绝 4-退货中 5-已退款 6-已关闭 |

**响应字段**：

| 字段名 | 类型 | 说明 |
| ------ | ------ | ------ |
| list | array | 售后列表（含 id/aftersaleNo/type/typeText/status/statusText/reason/refundAmount/productName/productImage/skuName/quantity/createdAt） |
| pagination | object | 分页信息 |

**错误码**：40101（未登录）

**业务说明**：按创建时间倒序排列。

---

#### 售后详情

- **接口名称**：售后详情
- **请求方法**：`GET`
- **URL**：`/api/weapp/aftersale/detail/:id`
- **权限要求**：需登录

**请求参数**：

| 参数名 | 类型 | 必填 | 说明 |
| ------ | ------ | ------ | ------ |
| id | number | 是 | 售后单 ID（路径参数） |

**响应字段**：

| 字段名 | 类型 | 说明 |
| ------ | ------ | ------ |
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

#### 撤销售后

- **接口名称**：撤销售后
- **请求方法**：`PUT`
- **URL**：`/api/weapp/aftersale/cancel/:id`
- **权限要求**：需登录

**请求参数**：

| 参数名 | 类型 | 必填 | 说明 |
| ------ | ------ | ------ | ------ |
| id | number | 是 | 售后单 ID（路径参数） |

**响应字段**：

| 字段名 | 类型 | 说明 |
| ------ | ------ | ------ |
| success | boolean | 是否撤销成功 |

**错误码**：50001（售后申请不存在）、50002（售后状态不允许此操作）

**业务说明**：仅待审核状态的售后单可撤销。撤销后不可再次申请。

---

#### 填写退货物流

- **接口名称**：填写退货物流
- **请求方法**：`PUT`
- **URL**：`/api/weapp/aftersale/return-logistics/:id`
- **权限要求**：需登录

**请求参数**：

| 参数名 | 类型 | 必填 | 说明 |
| ------ | ------ | ------ | ------ |
| id | number | 是 | 售后单 ID（路径参数） |
| company | string | 是 | 物流公司 |
| trackingNo | string | 是 | 运单号 |

**响应字段**：

| 字段名 | 类型 | 说明 |
| ------ | ------ | ------ |
| success | boolean | 是否提交成功 |

**错误码**：50001（售后申请不存在）、50002（售后状态不允许此操作）

**业务说明**：仅审核通过且售后类型为退货退款/换货的售后单需填写退货物流。

---
### 4.12 优惠券模块

#### 可领取优惠券

- **接口名称**：可领取优惠券
- **请求方法**：`GET`
- **URL**：`/api/weapp/coupon/available`
- **权限要求**：无

**请求参数**：

| 参数名 | 类型 | 必填 | 说明 |
| ------ | ------ | ------ | ------ |
| page | number | 否 | 页码，默认 1 |
| pageSize | number | 否 | 每页条数，默认 10 |

**响应字段**：

| 字段名 | 类型 | 说明 |
| ------ | ------ | ------ |
| list | array | 优惠券列表（含 id/name/type/value/minAmount/startTime/endTime/totalCount/remainCount/limitPerUser/receivedCount/canReceive） |
| pagination | object | 分页信息 |

**错误码**：无

**业务说明**：返回当前可领取的优惠券列表。登录用户可查看已领取数量和是否可领取。

---

#### 领取优惠券

- **接口名称**：领取优惠券
- **请求方法**：`POST`
- **URL**：`/api/weapp/coupon/receive/:id`
- **权限要求**：需登录

**请求参数**：

| 参数名 | 类型 | 必填 | 说明 |
| ------ | ------ | ------ | ------ |
| id | number | 是 | 优惠券 ID（路径参数） |

**响应字段**：

| 字段名 | 类型 | 说明 |
| ------ | ------ | ------ |
| success | boolean | 是否领取成功 |
| userCouponId | number | 用户优惠券 ID |

**错误码**：30001（优惠券不存在）、30002（优惠券已领完）、30003（优惠券已领取）、30005（优惠券已过期）

**业务说明**：需校验优惠券库存、领取限制、有效期。使用乐观锁防止超领。

---

#### 我的优惠券

- **接口名称**：我的优惠券
- **请求方法**：`GET`
- **URL**：`/api/weapp/coupon/my`
- **权限要求**：需登录

**请求参数**：

| 参数名 | 类型 | 必填 | 说明 |
| ------ | ------ | ------ | ------ |
| status | number | 否 | 状态：0-全部 1-未使用 2-已使用 3-已过期 |

**响应字段**：

| 字段名 | 类型 | 说明 |
| ------ | ------ | ------ |
| list | array | 优惠券列表（含 id/couponId/name/type/value/minAmount/startTime/endTime/status/statusText/usedAt） |

**错误码**：40101（未登录）

**业务说明**：返回当前用户已领取的优惠券列表。

---

#### 下单可用优惠券

- **接口名称**：下单可用优惠券
- **请求方法**：`GET`
- **URL**：`/api/weapp/coupon/usable`
- **权限要求**：需登录

**请求参数**：

| 参数名 | 类型 | 必填 | 说明 |
| ------ | ------ | ------ | ------ |
| amount | number | 是 | 订单商品总金额（分） |

**响应字段**：

| 字段名 | 类型 | 说明 |
| ------ | ------ | ------ |
| list | array | 可用优惠券列表（结构同我的优惠券，含 discountAmount） |
| unavailableList | array | 不可用优惠券列表（含 id/name/reason） |

**错误码**：40101（未登录）

**业务说明**：根据订单金额筛选可用和不可用优惠券，不可用的需说明原因。

---
### 4.13 会员模块

#### 会员中心信息

- **接口名称**：会员中心信息
- **请求方法**：`GET`
- **URL**：`/api/weapp/member/info`
- **权限要求**：需登录

**请求参数**：无

**响应字段**：

| 字段名 | 类型 | 说明 |
| ------ | ------ | ------ |
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

#### 会员权益列表

- **接口名称**：会员权益列表
- **请求方法**：`GET`
- **URL**：`/api/weapp/member/privileges`
- **权限要求**：需登录

**请求参数**：无

**响应字段**：

| 字段名 | 类型 | 说明 |
| ------ | ------ | ------ |
| levels | array | 各等级权益列表（含 level/name/icon/requiredSpent/privileges[]含 id/name/icon/description/isUnlocked） |

**错误码**：40101（未登录）

**业务说明**：展示所有等级的权益对比，标记当前用户已解锁的权益。

---
### 4.14 积分模块

#### 积分余额

- **接口名称**：积分余额
- **请求方法**：`GET`
- **URL**：`/api/weapp/points/balance`
- **权限要求**：需登录

**请求参数**：无

**响应字段**：

| 字段名 | 类型 | 说明 |
| ------ | ------ | ------ |
| points | number | 当前积分余额 |
| totalEarned | number | 累计获得积分 |
| totalUsed | number | 累计使用积分 |
| todaySignedIn | boolean | 今日是否已签到 |
| continuousDays | number | 连续签到天数 |

**错误码**：40101（未登录）

**业务说明**：返回积分概览信息，包含签到状态。

---

#### 积分明细

- **接口名称**：积分明细
- **请求方法**：`GET`
- **URL**：`/api/weapp/points/history`
- **权限要求**：需登录

**请求参数**：

| 参数名 | 类型 | 必填 | 说明 |
| ------ | ------ | ------ | ------ |
| page | number | 否 | 页码，默认 1 |
| pageSize | number | 否 | 每页条数，默认 20 |
| type | number | 否 | 类型筛选：0-全部 1-收入 2-支出 |

**响应字段**：

| 字段名 | 类型 | 说明 |
| ------ | ------ | ------ |
| list | array | 积分明细列表（含 id/type/points/balance/source/description/createdAt） |
| pagination | object | 分页信息 |

**错误码**：40101（未登录）

**业务说明**：按时间倒序排列。source 可选值：sign_in/purchase/consume/activity/admin。

---

#### 积分规则

- **接口名称**：积分规则
- **请求方法**：`GET`
- **URL**：`/api/weapp/points/rules`
- **权限要求**：无

**请求参数**：无

**响应字段**：

| 字段名 | 类型 | 说明 |
| ------ | ------ | ------ |
| list | array | 积分规则列表（含 id/name/description/points/icon） |

**错误码**：无

**业务说明**：返回所有积分获取和消耗规则说明。

---

#### 签到

- **接口名称**：签到
- **请求方法**：`POST`
- **URL**：`/api/weapp/points/sign-in`
- **权限要求**：需登录

**请求参数**：无

**响应字段**：

| 字段名 | 类型 | 说明 |
| ------ | ------ | ------ |
| points | number | 本次获得积分 |
| continuousDays | number | 连续签到天数 |
| totalPoints | number | 当前积分余额 |

**错误码**：40901（今日已签到）

**业务说明**：每日签到获得积分，连续签到天数越多积分越高。每日仅可签到一次。

---
### 4.15 活动模块

#### 活动列表

- **接口名称**：活动列表
- **请求方法**：`GET`
- **URL**：`/api/weapp/activity/list`
- **权限要求**：无

**请求参数**：

| 参数名 | 类型 | 必填 | 说明 |
| ------ | ------ | ------ | ------ |
| page | number | 否 | 页码，默认 1 |
| pageSize | number | 否 | 每页条数，默认 10 |
| type | number | 否 | 活动类型：1-限时折扣 2-满减 3-满赠 4-组合套餐 5-新人礼包 |

**响应字段**：

| 字段名 | 类型 | 说明 |
| ------ | ------ | ------ |
| list | array | 活动列表（含 id/title/coverImage/type/typeText/startTime/endTime/status/statusText/description） |
| pagination | object | 分页信息 |

**错误码**：无

**业务说明**：返回进行中和即将开始的活动列表。

---

#### 活动详情

- **接口名称**：活动详情
- **请求方法**：`GET`
- **URL**：`/api/weapp/activity/detail/:id`
- **权限要求**：无

**请求参数**：

| 参数名 | 类型 | 必填 | 说明 |
| ------ | ------ | ------ | ------ |
| id | number | 是 | 活动 ID（路径参数） |

**响应字段**：

| 字段名 | 类型 | 说明 |
| ------ | ------ | ------ |
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
### 4.16 内容模块

#### 内容列表

- **接口名称**：内容列表
- **请求方法**：`GET`
- **URL**：`/api/weapp/content/list`
- **权限要求**：无

**请求参数**：

| 参数名 | 类型 | 必填 | 说明 |
| ------ | ------ | ------ | ------ |
| page | number | 否 | 页码，默认 1 |
| pageSize | number | 否 | 每页条数，默认 10 |
| categoryId | number | 否 | 内容分类 ID |

**响应字段**：

| 字段名 | 类型 | 说明 |
| ------ | ------ | ------ |
| list | array | 内容列表（含 id/title/coverImage/summary/categoryId/categoryName/viewCount/publishedAt） |
| pagination | object | 分页信息 |

**错误码**：无

**业务说明**：返回已发布的内容列表，如育儿知识、品牌故事等。

---

#### 内容详情

- **接口名称**：内容详情
- **请求方法**：`GET`
- **URL**：`/api/weapp/content/detail/:id`
- **权限要求**：无

**请求参数**：

| 参数名 | 类型 | 必填 | 说明 |
| ------ | ------ | ------ | ------ |
| id | number | 是 | 内容 ID（路径参数） |

**响应字段**：

| 字段名 | 类型 | 说明 |
| ------ | ------ | ------ |
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
### 4.17 分享模块

#### 记录分享

- **接口名称**：记录分享
- **请求方法**：`POST`
- **URL**：`/api/weapp/share/record`
- **权限要求**：需登录

**请求参数**：

| 参数名 | 类型 | 必填 | 说明 |
| ------ | ------ | ------ | ------ |
| type | string | 是 | 分享类型：product-商品 activity-活动 content-内容 |
| targetId | number | 是 | 分享目标 ID |
| channel | string | 否 | 分享渠道：wechat-微信好友 moments-朋友圈 |

**响应字段**：

| 字段名 | 类型 | 说明 |
| ------ | ------ | ------ |
| success | boolean | 是否记录成功 |
| pointsEarned | number | 获得积分（分享奖励） |

**错误码**：40001（参数错误）

**业务说明**：记录用户分享行为，用于数据统计。根据积分规则可能获得分享奖励积分。

---

#### 获取分享海报

- **接口名称**：获取分享海报
- **请求方法**：`GET`
- **URL**：`/api/weapp/share/poster`
- **权限要求**：需登录

**请求参数**：

| 参数名 | 类型 | 必填 | 说明 |
| ------ | ------ | ------ | ------ |
| type | string | 是 | 海报类型：product-商品 activity-活动 |
| targetId | number | 是 | 目标 ID |

**响应字段**：

| 字段名 | 类型 | 说明 |
| ------ | ------ | ------ |
| posterUrl | string | 海报图片 URL |
| miniProgramCode | string | 小程序码 URL |

**错误码**：40001（参数错误）、40401（目标不存在）

**业务说明**：生成带小程序码的分享海报图片。海报有 1 小时缓存。

---
## 5. 管理后台 API

### 5.1 认证模块

#### 管理员登录

- **接口名称**：管理员登录
- **请求方法**：`POST`
- **URL**：`/api/admin/auth/login`
- **权限要求**：无

**请求参数**：

| 参数名 | 类型 | 必填 | 说明 |
| ------ | ------ | ------ | ------ |
| username | string | 是 | 用户名 |
| password | string | 是 | 密码 |
| captchaId | string | 是 | 验证码 ID |
| captchaCode | string | 是 | 验证码内容 |

**响应字段**：

| 字段名 | 类型 | 说明 |
| ------ | ------ | ------ |
| token | string | JWT Token |
| refreshToken | string | 刷新 Token |
| tokenExpireAt | string | Token 过期时间 |
| userInfo | object | 管理员信息（含 id/username/realName/avatar/roleId/roleName/permissions） |

**错误码**：80002（验证码错误）、40302（账号已被禁用）、40101（用户名或密码错误）

**业务说明**：管理员登录需验证图形验证码。连续 5 次登录失败锁定账号 30 分钟。Token 有效期 2 小时。

---

#### 获取验证码

- **接口名称**：获取验证码
- **请求方法**：`GET`
- **URL**：`/api/admin/auth/captcha`
- **权限要求**：无

**请求参数**：无

**响应字段**：

| 字段名 | 类型 | 说明 |
| ------ | ------ | ------ |
| captchaId | string | 验证码 ID |
| captchaImage | string | 验证码图片 Base64 |

**错误码**：无

**业务说明**：返回图形验证码，验证码 5 分钟有效。

---

#### 获取当前管理员信息

- **接口名称**：获取当前管理员信息
- **请求方法**：`GET`
- **URL**：`/api/admin/auth/info`
- **权限要求**：需管理员登录

**请求参数**：无

**响应字段**：

| 字段名 | 类型 | 说明 |
| ------ | ------ | ------ |
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

#### 修改密码

- **接口名称**：修改密码
- **请求方法**：`PUT`
- **URL**：`/api/admin/auth/password`
- **权限要求**：需管理员登录

**请求参数**：

| 参数名 | 类型 | 必填 | 说明 |
| ------ | ------ | ------ | ------ |
| oldPassword | string | 是 | 原密码 |
| newPassword | string | 是 | 新密码，8-20 位，需包含字母和数字 |
| confirmPassword | string | 是 | 确认新密码 |

**响应字段**：

| 字段名 | 类型 | 说明 |
| ------ | ------ | ------ |
| success | boolean | 是否修改成功 |

**错误码**：40001（参数错误）、40101（原密码错误）

**业务说明**：修改密码后需重新登录。

---
### 5.2 数据看板

#### 关键指标

- **接口名称**：关键指标
- **请求方法**：`GET`
- **URL**：`/api/admin/dashboard/stats`
- **权限要求**：需管理员登录 + dashboard:view

**请求参数**：

| 参数名 | 类型 | 必填 | 说明 |
| ------ | ------ | ------ | ------ |
| period | string | 否 | 统计周期：today-今日 yesterday-昨日 week-近7天 month-近30天，默认 today |

**响应字段**：

| 字段名 | 类型 | 说明 |
| ------ | ------ | ------ |
| orderCount | number | 订单数 |
| orderCountChange | number | 订单数环比变化百分比 |
| salesAmount | number | 销售额（分） |
| salesAmountChange | number | 销售额环比变化百分比 |
| userCount | number | 新增用户数 |
| userCountChange | number | 新增用户环比变化百分比 |
| avgOrderAmount | number | 客单价（分） |
| avgOrderAmountChange | number | 客单价环比变化百分比 |
| totalUsers | number | 累计用户数 |
| totalProducts | number | 在售商品数 |
| pendingOrders | number | 待发货订单数 |
| pendingAftersales | number | 待处理售后数 |

**错误码**：40301（无权限）

**业务说明**：返回数据看板顶部关键指标卡片数据，含环比变化。

---

#### 销售趋势

- **接口名称**：销售趋势
- **请求方法**：`GET`
- **URL**：`/api/admin/dashboard/sales-chart`
- **权限要求**：需管理员登录 + dashboard:view

**请求参数**：

| 参数名 | 类型 | 必填 | 说明 |
| ------ | ------ | ------ | ------ |
| period | string | 否 | 统计周期：week-近7天 month-近30天，默认 week |
| metric | string | 否 | 指标：amount-销售额 count-订单数，默认 amount |

**响应字段**：

| 字段名 | 类型 | 说明 |
| ------ | ------ | ------ |
| chartData | array | 图表数据（含 date/value/orderCount） |

**错误码**：40301（无权限）

**业务说明**：返回销售趋势折线图数据。

---

#### 热销商品

- **接口名称**：热销商品
- **请求方法**：`GET`
- **URL**：`/api/admin/dashboard/top-products`
- **权限要求**：需管理员登录 + dashboard:view

**请求参数**：

| 参数名 | 类型 | 必填 | 说明 |
| ------ | ------ | ------ | ------ |
| period | string | 否 | 统计周期，同关键指标 |
| limit | number | 否 | 返回数量，默认 10，最大 50 |

**响应字段**：

| 字段名 | 类型 | 说明 |
| ------ | ------ | ------ |
| list | array | 热销商品列表（含 productId/productName/mainImage/salesCount/salesAmount） |

**错误码**：40301（无权限）

**业务说明**：返回指定周期内销量最高的商品排行。

---

#### 最近订单

- **接口名称**：最近订单
- **请求方法**：`GET`
- **URL**：`/api/admin/dashboard/recent-orders`
- **权限要求**：需管理员登录 + dashboard:view

**请求参数**：

| 参数名 | 类型 | 必填 | 说明 |
| ------ | ------ | ------ | ------ |
| limit | number | 否 | 返回数量，默认 10，最大 50 |

**响应字段**：

| 字段名 | 类型 | 说明 |
| ------ | ------ | ------ |
| list | array | 最近订单列表（含 id/orderNo/userName/payAmount/status/statusText/createdAt） |

**错误码**：40301（无权限）

**业务说明**：返回最近创建的订单列表。

---
### 5.3 商品管理
#### 商品列表

- **接口名称**：商品列表
- **请求方法**：`GET`
- **URL**：`/api/admin/product/list`
- **权限要求**：需管理员登录 + `product:view`

**请求参数**：page/pageSize/keyword/categoryId/brandId/status/supplierId

**响应字段**：list[]含 id/name/mainImage/categoryId/categoryName/brandId/brandName/supplierId/supplierName/price/stock/sales/status/statusText/createdAt/updatedAt + pagination

**错误码**：40301

**业务说明**：管理后台商品管理接口，需对应权限才能访问。

---
#### 商品详情

- **接口名称**：商品详情
- **请求方法**：`GET`
- **URL**：`/api/admin/product/detail/:id`
- **权限要求**：需管理员登录 + `product:view`

**请求参数**：id(路径)

**响应字段**：id/name/subtitle/mainImage/images/detailImages/description/price/originalPrice/categoryId/brandId/supplierId/skus[]含 id/name/price/originalPrice/costPrice/stock/specs/specGroups/tags/purchaseLimit/monthAgeRange/status/sales/createdAt/updatedAt

**错误码**：40401/40301

**业务说明**：管理后台商品管理接口，需对应权限才能访问。

---
#### 新增商品

- **接口名称**：新增商品
- **请求方法**：`POST`
- **URL**：`/api/admin/product/create`
- **权限要求**：需管理员登录 + `product:create`

**请求参数**：name(是)/subtitle/mainImage(是)/images/detailImages/description/categoryId(是)/brandId/supplierId/skus[](是，含 name/price/stock)/specGroups/tags/purchaseLimit/monthAgeRange/status

**响应字段**：id

**错误码**：40001/40301

**业务说明**：管理后台商品管理接口，需对应权限才能访问。

---
#### 更新商品

- **接口名称**：更新商品
- **请求方法**：`PUT`
- **URL**：`/api/admin/product/update/:id`
- **权限要求**：需管理员登录 + `product:update`

**请求参数**：id(路径)/name/subtitle/mainImage/images/detailImages/description/categoryId/brandId/supplierId/skus/specGroups/tags/purchaseLimit/monthAgeRange

**响应字段**：success

**错误码**：40401/40001/40301

**业务说明**：管理后台商品管理接口，需对应权限才能访问。

---
#### 删除商品

- **接口名称**：删除商品
- **请求方法**：`DELETE`
- **URL**：`/api/admin/product/delete/:id`
- **权限要求**：需管理员登录 + `product:delete`

**请求参数**：id(路径)

**响应字段**：success

**错误码**：40401/40301/40901(存在未完成订单)

**业务说明**：管理后台商品管理接口，需对应权限才能访问。

---
#### 上下架商品

- **接口名称**：上下架商品
- **请求方法**：`PUT`
- **URL**：`/api/admin/product/status/:id`
- **权限要求**：需管理员登录 + `product:update`

**请求参数**：id(路径)/status(是，0-下架 1-上架)

**响应字段**：success

**错误码**：40401/40001/40301

**业务说明**：管理后台商品管理接口，需对应权限才能访问。

---
### 5.4 分类管理
#### 分类树

- **接口名称**：分类树
- **请求方法**：`GET`
- **URL**：`/api/admin/category/tree`
- **权限要求**：需管理员登录 + `category:view`

**请求参数**：无

**响应字段**：list[]含 id/name/icon/sort/status/parentId/children[]

**错误码**：40301

**业务说明**：管理后台分类管理接口，需对应权限才能访问。

---
#### 新增分类

- **接口名称**：新增分类
- **请求方法**：`POST`
- **URL**：`/api/admin/category/create`
- **权限要求**：需管理员登录 + `category:create`

**请求参数**：name(是)/icon/parentId/sort/status

**响应字段**：id

**错误码**：40001/40301/40901

**业务说明**：管理后台分类管理接口，需对应权限才能访问。

---
#### 更新分类

- **接口名称**：更新分类
- **请求方法**：`PUT`
- **URL**：`/api/admin/category/update/:id`
- **权限要求**：需管理员登录 + `category:update`

**请求参数**：id(路径)/name/icon/parentId/sort/status

**响应字段**：success

**错误码**：40401/40001/40301

**业务说明**：管理后台分类管理接口，需对应权限才能访问。

---
#### 删除分类

- **接口名称**：删除分类
- **请求方法**：`DELETE`
- **URL**：`/api/admin/category/delete/:id`
- **权限要求**：需管理员登录 + `category:delete`

**请求参数**：id(路径)

**响应字段**：success

**错误码**：40401/40301/40901

**业务说明**：管理后台分类管理接口，需对应权限才能访问。

---
### 5.5 品牌管理
#### 品牌列表

- **接口名称**：品牌列表
- **请求方法**：`GET`
- **URL**：`/api/admin/brand/list`
- **权限要求**：需管理员登录 + `brand:view`

**请求参数**：page/pageSize/keyword/status

**响应字段**：list[]含 id/name/logo/description/status/productCount/createdAt + pagination

**错误码**：40301

**业务说明**：管理后台品牌管理接口，需对应权限才能访问。

---
#### 新增品牌

- **接口名称**：新增品牌
- **请求方法**：`POST`
- **URL**：`/api/admin/brand/create`
- **权限要求**：需管理员登录 + `brand:create`

**请求参数**：name(是)/logo/description/status

**响应字段**：id

**错误码**：40001/40301/40901

**业务说明**：管理后台品牌管理接口，需对应权限才能访问。

---
#### 更新品牌

- **接口名称**：更新品牌
- **请求方法**：`PUT`
- **URL**：`/api/admin/brand/update/:id`
- **权限要求**：需管理员登录 + `brand:update`

**请求参数**：id(路径)/name/logo/description/status

**响应字段**：success

**错误码**：40401/40001/40301

**业务说明**：管理后台品牌管理接口，需对应权限才能访问。

---
#### 删除品牌

- **接口名称**：删除品牌
- **请求方法**：`DELETE`
- **URL**：`/api/admin/brand/delete/:id`
- **权限要求**：需管理员登录 + `brand:delete`

**请求参数**：id(路径)

**响应字段**：success

**错误码**：40401/40301/40901

**业务说明**：管理后台品牌管理接口，需对应权限才能访问。

---
### 5.6 供应商管理
#### 供应商列表

- **接口名称**：供应商列表
- **请求方法**：`GET`
- **URL**：`/api/admin/supplier/list`
- **权限要求**：需管理员登录 + `supplier:view`

**请求参数**：page/pageSize/keyword/status

**响应字段**：list[]含 id/name/contactName/contactPhone/status/productCount/createdAt + pagination

**错误码**：40301

**业务说明**：管理后台供应商管理接口，需对应权限才能访问。

---
#### 供应商详情

- **接口名称**：供应商详情
- **请求方法**：`GET`
- **URL**：`/api/admin/supplier/detail/:id`
- **权限要求**：需管理员登录 + `supplier:view`

**请求参数**：id(路径)

**响应字段**：id/name/contactName/contactPhone/contactEmail/address/description/status/productCount/createdAt/updatedAt

**错误码**：40401/40301

**业务说明**：管理后台供应商管理接口，需对应权限才能访问。

---
#### 新增供应商

- **接口名称**：新增供应商
- **请求方法**：`POST`
- **URL**：`/api/admin/supplier/create`
- **权限要求**：需管理员登录 + `supplier:create`

**请求参数**：name(是)/contactName/contactPhone/contactEmail/address/description/status

**响应字段**：id

**错误码**：40001/40301

**业务说明**：管理后台供应商管理接口，需对应权限才能访问。

---
#### 更新供应商

- **接口名称**：更新供应商
- **请求方法**：`PUT`
- **URL**：`/api/admin/supplier/update/:id`
- **权限要求**：需管理员登录 + `supplier:update`

**请求参数**：id(路径)/name/contactName/contactPhone/contactEmail/address/description/status

**响应字段**：success

**错误码**：40401/40001/40301

**业务说明**：管理后台供应商管理接口，需对应权限才能访问。

---
#### 删除供应商

- **接口名称**：删除供应商
- **请求方法**：`DELETE`
- **URL**：`/api/admin/supplier/delete/:id`
- **权限要求**：需管理员登录 + `supplier:delete`

**请求参数**：id(路径)

**响应字段**：success

**错误码**：40401/40301/40901

**业务说明**：管理后台供应商管理接口，需对应权限才能访问。

---
### 5.7 库存管理
#### 库存列表

- **接口名称**：库存列表
- **请求方法**：`GET`
- **URL**：`/api/admin/stock/list`
- **权限要求**：需管理员登录 + `stock:view`

**请求参数**：page/pageSize/keyword/stockStatus(normal/low/out)/categoryId/supplierId

**响应字段**：list[]含 productId/productName/skuId/skuName/stock/lockedStock/availableStock/stockWarning/stockStatus/costPrice/supplierName + pagination

**错误码**：40301

**业务说明**：管理后台库存管理接口，需对应权限才能访问。

---
#### 库存调整

- **接口名称**：库存调整
- **请求方法**：`PUT`
- **URL**：`/api/admin/stock/adjust`
- **权限要求**：需管理员登录 + `stock:update`

**请求参数**：items[](skuId/type:in,out,set/quantity/reason)

**响应字段**：success + results[]含 skuId/beforeStock/afterStock

**错误码**：40001/40301/10004

**业务说明**：管理后台库存管理接口，需对应权限才能访问。

---
#### 库存变动日志

- **接口名称**：库存变动日志
- **请求方法**：`GET`
- **URL**：`/api/admin/stock/logs`
- **权限要求**：需管理员登录 + `stock:view`

**请求参数**：page/pageSize/skuId/productId/type(order/purchase/adjust/return)/startDate/endDate

**响应字段**：list[]含 id/skuId/skuName/productName/type/typeText/quantity/beforeStock/afterStock/reason/operatorName/createdAt + pagination

**错误码**：40301

**业务说明**：管理后台库存管理接口，需对应权限才能访问。

---
### 5.8 订单管理
#### 订单列表

- **接口名称**：订单列表
- **请求方法**：`GET`
- **URL**：`/api/admin/order/list`
- **权限要求**：需管理员登录 + `order:view`

**请求参数**：page/pageSize/orderNo/status/userId/startDate/endDate/minAmount/maxAmount

**响应字段**：list[]含 id/orderNo/userId/userName/userPhone/status/statusText/totalAmount/freightAmount/discountAmount/payAmount/itemCount/items[]/consignee/consigneePhone/consigneeAddress/remark/adminRemark/payTime/deliverTime/createdAt + pagination

**错误码**：40301

**业务说明**：管理后台订单管理接口，需对应权限才能访问。

---
#### 订单详情

- **接口名称**：订单详情
- **请求方法**：`GET`
- **URL**：`/api/admin/order/detail/:id`
- **权限要求**：需管理员登录 + `order:view`

**请求参数**：id(路径)

**响应字段**：id/orderNo/status/statusText/userId/userName/userPhone/userMemberLevel/items[]含 id/productId/productName/productImage/skuId/skuName/price/originalPrice/costPrice/quantity/subtotal/address/totalAmount/freightAmount/discountAmount/couponDiscount/pointsDiscount/payAmount/payMethod/payTime/transactionId/remark/adminRemark/logistics/deliverTime/receiveTime/cancelTime/cancelReason/refundAmount/aftersaleInfo/createdAt/updatedAt

**错误码**：20001/40301

**业务说明**：管理后台订单管理接口，需对应权限才能访问。

---
#### 修改订单状态

- **接口名称**：修改订单状态
- **请求方法**：`PUT`
- **URL**：`/api/admin/order/status/:id`
- **权限要求**：需管理员登录 + `order:update`

**请求参数**：id(路径)/status(是)/reason

**响应字段**：success

**错误码**：20001/20002/40301

**业务说明**：管理后台订单管理接口，需对应权限才能访问。

---
#### 添加备注

- **接口名称**：添加备注
- **请求方法**：`PUT`
- **URL**：`/api/admin/order/remark/:id`
- **权限要求**：需管理员登录 + `order:update`

**请求参数**：id(路径)/adminRemark(是)

**响应字段**：success

**错误码**：20001/40001/40301

**业务说明**：管理后台订单管理接口，需对应权限才能访问。

---
#### 发货

- **接口名称**：发货
- **请求方法**：`POST`
- **URL**：`/api/admin/order/deliver`
- **权限要求**：需管理员登录 + `order:deliver`

**请求参数**：orderId(是)/logisticsCompany(是)/trackingNo(是)

**响应字段**：success

**错误码**：20001/20002/40001/40301

**业务说明**：管理后台订单管理接口，需对应权限才能访问。

---
#### 批量发货

- **接口名称**：批量发货
- **请求方法**：`POST`
- **URL**：`/api/admin/order/batch-deliver`
- **权限要求**：需管理员登录 + `order:deliver`

**请求参数**：file(是，Excel文件)

**响应字段**：totalCount/successCount/failCount/failList[]含 orderNo/reason

**错误码**：40001/40301

**业务说明**：管理后台订单管理接口，需对应权限才能访问。

---
#### 导出订单

- **接口名称**：导出订单
- **请求方法**：`GET`
- **URL**：`/api/admin/order/export`
- **权限要求**：需管理员登录 + `order:export`

**请求参数**：status/startDate/endDate/format(xlsx/csv)

**响应字段**：文件流

**错误码**：40301/40001

**业务说明**：管理后台订单管理接口，需对应权限才能访问。

---
### 5.9 售后管理
#### 售后列表

- **接口名称**：售后列表
- **请求方法**：`GET`
- **URL**：`/api/admin/aftersale/list`
- **权限要求**：需管理员登录 + `aftersale:view`

**请求参数**：page/pageSize/status/type/orderNo/startDate/endDate

**响应字段**：list[]含 id/aftersaleNo/orderNo/type/typeText/status/statusText/reason/refundAmount/userName/productName/productImage/quantity/createdAt + pagination

**错误码**：40301

**业务说明**：管理后台售后管理接口，需对应权限才能访问。

---
#### 售后详情

- **接口名称**：售后详情
- **请求方法**：`GET`
- **URL**：`/api/admin/aftersale/detail/:id`
- **权限要求**：需管理员登录 + `aftersale:view`

**请求参数**：id(路径)

**响应字段**：id/aftersaleNo/type/typeText/status/statusText/reason/description/images/refundAmount/userId/userName/userPhone/orderInfo/orderItem/rejectReason/returnLogistics/refundTime/refundTransactionId/operateLogs[]/createdAt/updatedAt

**错误码**：50001/40301

**业务说明**：管理后台售后管理接口，需对应权限才能访问。

---
#### 审核通过

- **接口名称**：审核通过
- **请求方法**：`PUT`
- **URL**：`/api/admin/aftersale/approve/:id`
- **权限要求**：需管理员登录 + `aftersale:approve`

**请求参数**：id(路径)/refundAmount/remark

**响应字段**：success

**错误码**：50001/50002/40301

**业务说明**：管理后台售后管理接口，需对应权限才能访问。

---
#### 审核拒绝

- **接口名称**：审核拒绝
- **请求方法**：`PUT`
- **URL**：`/api/admin/aftersale/reject/:id`
- **权限要求**：需管理员登录 + `aftersale:approve`

**请求参数**：id(路径)/rejectReason(是)

**响应字段**：success

**错误码**：50001/50002/40001/40301

**业务说明**：管理后台售后管理接口，需对应权限才能访问。

---
#### 退款

- **接口名称**：退款
- **请求方法**：`POST`
- **URL**：`/api/admin/aftersale/refund/:id`
- **权限要求**：需管理员登录 + `aftersale:refund`

**请求参数**：id(路径)/refundAmount

**响应字段**：success + refundTransactionId

**错误码**：50001/50002/50004/40301

**业务说明**：管理后台售后管理接口，需对应权限才能访问。

---
#### 关闭售后

- **接口名称**：关闭售后
- **请求方法**：`PUT`
- **URL**：`/api/admin/aftersale/close/:id`
- **权限要求**：需管理员登录 + `aftersale:close`

**请求参数**：id(路径)/reason(是)

**响应字段**：success

**错误码**：50001/50002/40301

**业务说明**：管理后台售后管理接口，需对应权限才能访问。

---
### 5.10 用户管理
#### 用户列表

- **接口名称**：用户列表
- **请求方法**：`GET`
- **URL**：`/api/admin/user/list`
- **权限要求**：需管理员登录 + `user:view`

**请求参数**：page/pageSize/keyword/memberLevel/status/startDate/endDate

**响应字段**：list[]含 id/nickName/avatarUrl/phone/gender/memberLevel/memberLevelName/points/totalSpent/orderCount/babyCount/status/lastLoginAt/createdAt + pagination

**错误码**：40301

**业务说明**：管理后台用户管理接口，需对应权限才能访问。

---
#### 用户详情

- **接口名称**：用户详情
- **请求方法**：`GET`
- **URL**：`/api/admin/user/detail/:id`
- **权限要求**：需管理员登录 + `user:view`

**请求参数**：id(路径)

**响应字段**：id/openId/nickName/avatarUrl/phone/gender/birthday/memberLevel/memberLevelName/points/totalPoints/totalSpent/orderCount/couponCount/babies[]/recentOrders[]/status/lastLoginAt/createdAt

**错误码**：40401/40301

**业务说明**：管理后台用户管理接口，需对应权限才能访问。

---
#### 调整会员等级

- **接口名称**：调整会员等级
- **请求方法**：`PUT`
- **URL**：`/api/admin/user/level/:id`
- **权限要求**：需管理员登录 + `user:update`

**请求参数**：id(路径)/memberLevel(是)/reason(是)

**响应字段**：success

**错误码**：40401/40001/40301

**业务说明**：管理后台用户管理接口，需对应权限才能访问。

---
#### 启用/禁用用户

- **接口名称**：启用/禁用用户
- **请求方法**：`PUT`
- **URL**：`/api/admin/user/status/:id`
- **权限要求**：需管理员登录 + `user:update`

**请求参数**：id(路径)/status(是，0-禁用 1-启用)/reason(禁用时必填)

**响应字段**：success

**错误码**：40401/40001/40301

**业务说明**：管理后台用户管理接口，需对应权限才能访问。

---
### 5.11 会员等级管理
#### 等级列表

- **接口名称**：等级列表
- **请求方法**：`GET`
- **URL**：`/api/admin/member-level/list`
- **权限要求**：需管理员登录 + `member-level:view`

**请求参数**：无

**响应字段**：list[]含 id/level/name/icon/requiredSpent/discount/pointsRate/privileges[]/userCount

**错误码**：40301

**业务说明**：管理后台会员等级管理接口，需对应权限才能访问。

---
#### 更新等级配置

- **接口名称**：更新等级配置
- **请求方法**：`PUT`
- **URL**：`/api/admin/member-level/update/:id`
- **权限要求**：需管理员登录 + `member-level:update`

**请求参数**：id(路径)/name/icon/requiredSpent/discount/pointsRate/privileges

**响应字段**：success

**错误码**：40401/40001/40301

**业务说明**：管理后台会员等级管理接口，需对应权限才能访问。

---
### 5.12 积分规则管理
#### 积分规则列表

- **接口名称**：积分规则列表
- **请求方法**：`GET`
- **URL**：`/api/admin/points-rule/list`
- **权限要求**：需管理员登录 + `points-rule:view`

**请求参数**：无

**响应字段**：list[]含 id/name/type/points/description/status

**错误码**：40301

**业务说明**：管理后台积分规则管理接口，需对应权限才能访问。

---
#### 更新积分规则

- **接口名称**：更新积分规则
- **请求方法**：`PUT`
- **URL**：`/api/admin/points-rule/update/:id`
- **权限要求**：需管理员登录 + `points-rule:update`

**请求参数**：id(路径)/name/type/points/description/status

**响应字段**：success

**错误码**：40401/40001/40301

**业务说明**：管理后台积分规则管理接口，需对应权限才能访问。

---
### 5.13 优惠券管理
#### 优惠券列表

- **接口名称**：优惠券列表
- **请求方法**：`GET`
- **URL**：`/api/admin/coupon/list`
- **权限要求**：需管理员登录 + `coupon:view`

**请求参数**：page/pageSize/status

**响应字段**：list[]含 id/name/type/value/minAmount/totalCount/receivedCount/startTime/endTime/status/createdAt + pagination

**错误码**：40301

**业务说明**：管理后台优惠券管理接口，需对应权限才能访问。

---
#### 优惠券详情

- **接口名称**：优惠券详情
- **请求方法**：`GET`
- **URL**：`/api/admin/coupon/detail/:id`
- **权限要求**：需管理员登录 + `coupon:view`

**请求参数**：id(路径)

**响应字段**：id/name/type/value/minAmount/totalCount/receivedCount/limitPerUser/startTime/endTime/status/description/createdAt

**错误码**：40401/40301

**业务说明**：管理后台优惠券管理接口，需对应权限才能访问。

---
#### 新增优惠券

- **接口名称**：新增优惠券
- **请求方法**：`POST`
- **URL**：`/api/admin/coupon/create`
- **权限要求**：需管理员登录 + `coupon:create`

**请求参数**：name(是)/type(是)/value(是)/minAmount/totalCount(是)/limitPerUser/startTime(是)/endTime(是)/description

**响应字段**：id

**错误码**：40001/40301

**业务说明**：管理后台优惠券管理接口，需对应权限才能访问。

---
#### 更新优惠券

- **接口名称**：更新优惠券
- **请求方法**：`PUT`
- **URL**：`/api/admin/coupon/update/:id`
- **权限要求**：需管理员登录 + `coupon:update`

**请求参数**：id(路径)/name/type/value/minAmount/totalCount/limitPerUser/startTime/endTime/description

**响应字段**：success

**错误码**：40401/40001/40301

**业务说明**：管理后台优惠券管理接口，需对应权限才能访问。

---
#### 启停优惠券

- **接口名称**：启停优惠券
- **请求方法**：`PUT`
- **URL**：`/api/admin/coupon/status/:id`
- **权限要求**：需管理员登录 + `coupon:update`

**请求参数**：id(路径)/status(是，0-停用 1-启用)

**响应字段**：success

**错误码**：40401/40001/40301

**业务说明**：管理后台优惠券管理接口，需对应权限才能访问。

---
#### 领取记录

- **接口名称**：领取记录
- **请求方法**：`GET`
- **URL**：`/api/admin/coupon/receive-records`
- **权限要求**：需管理员登录 + `coupon:view`

**请求参数**：page/pageSize/couponId/userId/status

**响应字段**：list[]含 id/couponId/couponName/userId/userName/phone/status/receivedAt/usedAt + pagination

**错误码**：40301

**业务说明**：管理后台优惠券管理接口，需对应权限才能访问。

---
### 5.14 活动管理
#### 活动列表

- **接口名称**：活动列表
- **请求方法**：`GET`
- **URL**：`/api/admin/activity/list`
- **权限要求**：需管理员登录 + `activity:view`

**请求参数**：page/pageSize/type/status

**响应字段**：list[]含 id/title/coverImage/type/startTime/endTime/status/createdAt + pagination

**错误码**：40301

**业务说明**：管理后台活动管理接口，需对应权限才能访问。

---
#### 活动详情

- **接口名称**：活动详情
- **请求方法**：`GET`
- **URL**：`/api/admin/activity/detail/:id`
- **权限要求**：需管理员登录 + `activity:view`

**请求参数**：id(路径)

**响应字段**：id/title/coverImage/type/startTime/endTime/status/description/rules/products[]/discountRules[]/createdAt

**错误码**：40401/40301

**业务说明**：管理后台活动管理接口，需对应权限才能访问。

---
#### 新增活动

- **接口名称**：新增活动
- **请求方法**：`POST`
- **URL**：`/api/admin/activity/create`
- **权限要求**：需管理员登录 + `activity:create`

**请求参数**：title(是)/coverImage/type(是)/startTime(是)/endTime(是)/description/rules/products[]/discountRules

**响应字段**：id

**错误码**：40001/40301

**业务说明**：管理后台活动管理接口，需对应权限才能访问。

---
#### 更新活动

- **接口名称**：更新活动
- **请求方法**：`PUT`
- **URL**：`/api/admin/activity/update/:id`
- **权限要求**：需管理员登录 + `activity:update`

**请求参数**：id(路径)/title/coverImage/type/startTime/endTime/description/rules/products/discountRules

**响应字段**：success

**错误码**：40401/40001/40301

**业务说明**：管理后台活动管理接口，需对应权限才能访问。

---
#### 启停活动

- **接口名称**：启停活动
- **请求方法**：`PUT`
- **URL**：`/api/admin/activity/status/:id`
- **权限要求**：需管理员登录 + `activity:update`

**请求参数**：id(路径)/status(是，0-停用 1-启用)

**响应字段**：success

**错误码**：40401/40001/40301

**业务说明**：管理后台活动管理接口，需对应权限才能访问。

---
#### 删除活动

- **接口名称**：删除活动
- **请求方法**：`DELETE`
- **URL**：`/api/admin/activity/delete/:id`
- **权限要求**：需管理员登录 + `activity:delete`

**请求参数**：id(路径)

**响应字段**：success

**错误码**：40401/40301

**业务说明**：管理后台活动管理接口，需对应权限才能访问。

---
### 5.15 Banner管理
#### Banner列表

- **接口名称**：Banner列表
- **请求方法**：`GET`
- **URL**：`/api/admin/banner/list`
- **权限要求**：需管理员登录 + `banner:view`

**请求参数**：无

**响应字段**：list[]含 id/title/imageUrl/linkType/linkValue/sort/status/createdAt

**错误码**：40301

**业务说明**：管理后台Banner管理接口，需对应权限才能访问。

---
#### 新增Banner

- **接口名称**：新增Banner
- **请求方法**：`POST`
- **URL**：`/api/admin/banner/create`
- **权限要求**：需管理员登录 + `banner:create`

**请求参数**：title(是)/imageUrl(是)/linkType(是)/linkValue(是)/sort/status

**响应字段**：id

**错误码**：40001/40301

**业务说明**：管理后台Banner管理接口，需对应权限才能访问。

---
#### 更新Banner

- **接口名称**：更新Banner
- **请求方法**：`PUT`
- **URL**：`/api/admin/banner/update/:id`
- **权限要求**：需管理员登录 + `banner:update`

**请求参数**：id(路径)/title/imageUrl/linkType/linkValue/sort/status

**响应字段**：success

**错误码**：40401/40001/40301

**业务说明**：管理后台Banner管理接口，需对应权限才能访问。

---
#### 删除Banner

- **接口名称**：删除Banner
- **请求方法**：`DELETE`
- **URL**：`/api/admin/banner/delete/:id`
- **权限要求**：需管理员登录 + `banner:delete`

**请求参数**：id(路径)

**响应字段**：success

**错误码**：40401/40301

**业务说明**：管理后台Banner管理接口，需对应权限才能访问。

---
#### Banner排序

- **接口名称**：Banner排序
- **请求方法**：`PUT`
- **URL**：`/api/admin/banner/sort`
- **权限要求**：需管理员登录 + `banner:update`

**请求参数**：items[](id/sort)

**响应字段**：success

**错误码**：40001/40301

**业务说明**：管理后台Banner管理接口，需对应权限才能访问。

---
### 5.16 首页装修
#### 模块列表

- **接口名称**：模块列表
- **请求方法**：`GET`
- **URL**：`/api/admin/home-section/list`
- **权限要求**：需管理员登录 + `home-section:view`

**请求参数**：无

**响应字段**：list[]含 id/type/title/sort/config/status

**错误码**：40301

**业务说明**：管理后台首页装修接口，需对应权限才能访问。

---
#### 更新模块配置

- **接口名称**：更新模块配置
- **请求方法**：`PUT`
- **URL**：`/api/admin/home-section/update`
- **权限要求**：需管理员登录 + `home-section:update`

**请求参数**：sections[](id/type/title/config/status)

**响应字段**：success

**错误码**：40001/40301

**业务说明**：管理后台首页装修接口，需对应权限才能访问。

---
#### 模块排序

- **接口名称**：模块排序
- **请求方法**：`PUT`
- **URL**：`/api/admin/home-section/sort`
- **权限要求**：需管理员登录 + `home-section:update`

**请求参数**：items[](id/sort)

**响应字段**：success

**错误码**：40001/40301

**业务说明**：管理后台首页装修接口，需对应权限才能访问。

---
### 5.17 推荐位管理
#### 推荐位列表

- **接口名称**：推荐位列表
- **请求方法**：`GET`
- **URL**：`/api/admin/recommendation/list`
- **权限要求**：需管理员登录 + `recommendation:view`

**请求参数**：无

**响应字段**：list[]含 id/title/type/productIds[]/sort/status

**错误码**：40301

**业务说明**：管理后台推荐位管理接口，需对应权限才能访问。

---
#### 更新推荐位

- **接口名称**：更新推荐位
- **请求方法**：`PUT`
- **URL**：`/api/admin/recommendation/update/:id`
- **权限要求**：需管理员登录 + `recommendation:update`

**请求参数**：id(路径)/title/type/productIds/sort/status

**响应字段**：success

**错误码**：40401/40001/40301

**业务说明**：管理后台推荐位管理接口，需对应权限才能访问。

---
### 5.18 内容管理
#### 内容列表

- **接口名称**：内容列表
- **请求方法**：`GET`
- **URL**：`/api/admin/content/list`
- **权限要求**：需管理员登录 + `content:view`

**请求参数**：page/pageSize/categoryId/status

**响应字段**：list[]含 id/title/coverImage/categoryId/categoryName/status/viewCount/publishedAt + pagination

**错误码**：40301

**业务说明**：管理后台内容管理接口，需对应权限才能访问。

---
#### 内容详情

- **接口名称**：内容详情
- **请求方法**：`GET`
- **URL**：`/api/admin/content/detail/:id`
- **权限要求**：需管理员登录 + `content:view`

**请求参数**：id(路径)

**响应字段**：id/title/coverImage/content/summary/categoryId/categoryName/status/viewCount/publishedAt/relatedProductIds/createdAt/updatedAt

**错误码**：40401/40301

**业务说明**：管理后台内容管理接口，需对应权限才能访问。

---
#### 新增内容

- **接口名称**：新增内容
- **请求方法**：`POST`
- **URL**：`/api/admin/content/create`
- **权限要求**：需管理员登录 + `content:create`

**请求参数**：title(是)/coverImage/content(是)/summary/categoryId/relatedProductIds/status

**响应字段**：id

**错误码**：40001/40301

**业务说明**：管理后台内容管理接口，需对应权限才能访问。

---
#### 更新内容

- **接口名称**：更新内容
- **请求方法**：`PUT`
- **URL**：`/api/admin/content/update/:id`
- **权限要求**：需管理员登录 + `content:update`

**请求参数**：id(路径)/title/coverImage/content/summary/categoryId/relatedProductIds/status

**响应字段**：success

**错误码**：40401/40001/40301

**业务说明**：管理后台内容管理接口，需对应权限才能访问。

---
#### 删除内容

- **接口名称**：删除内容
- **请求方法**：`DELETE`
- **URL**：`/api/admin/content/delete/:id`
- **权限要求**：需管理员登录 + `content:delete`

**请求参数**：id(路径)

**响应字段**：success

**错误码**：40401/40301

**业务说明**：管理后台内容管理接口，需对应权限才能访问。

---
#### 上下架内容

- **接口名称**：上下架内容
- **请求方法**：`PUT`
- **URL**：`/api/admin/content/status/:id`
- **权限要求**：需管理员登录 + `content:update`

**请求参数**：id(路径)/status(是，0-下架 1-上架)

**响应字段**：success

**错误码**：40401/40001/40301

**业务说明**：管理后台内容管理接口，需对应权限才能访问。

---
#### 内容分类列表

- **接口名称**：内容分类列表
- **请求方法**：`GET`
- **URL**：`/api/admin/content/category/list`
- **权限要求**：需管理员登录 + `content:view`

**请求参数**：无

**响应字段**：list[]含 id/name/sort/createdAt

**错误码**：40301

**业务说明**：管理后台内容管理接口，需对应权限才能访问。

---
#### 新增内容分类

- **接口名称**：新增内容分类
- **请求方法**：`POST`
- **URL**：`/api/admin/content/category/create`
- **权限要求**：需管理员登录 + `content:create`

**请求参数**：name(是)/sort

**响应字段**：id

**错误码**：40001/40301

**业务说明**：管理后台内容管理接口，需对应权限才能访问。

---
### 5.19 宝宝档案
#### 宝宝档案列表

- **接口名称**：宝宝档案列表
- **请求方法**：`GET`
- **URL**：`/api/admin/baby/list`
- **权限要求**：需管理员登录 + `baby:view`

**请求参数**：page/pageSize/keyword/gender

**响应字段**：list[]含 id/name/gender/birthday/monthAge/userId/userName/createdAt + pagination

**错误码**：40301

**业务说明**：管理后台宝宝档案接口，需对应权限才能访问。

---
#### 宝宝月龄分布统计

- **接口名称**：宝宝月龄分布统计
- **请求方法**：`GET`
- **URL**：`/api/admin/baby/statistics`
- **权限要求**：需管理员登录 + `baby:view`

**请求参数**：无

**响应字段**：distribution[]含 monthAgeRange/count/percentage

**错误码**：40301

**业务说明**：管理后台宝宝档案接口，需对应权限才能访问。

---
### 5.20 数据统计
#### 销售统计

- **接口名称**：销售统计
- **请求方法**：`GET`
- **URL**：`/api/admin/statistics/sales`
- **权限要求**：需管理员登录 + `statistics:view`

**请求参数**：startDate/endDate/granularity(day/week/month)

**响应字段**：chartData[]含 date/orderCount/salesAmount/avgOrderAmount

**错误码**：40301

**业务说明**：管理后台数据统计接口，需对应权限才能访问。

---
#### 商品统计

- **接口名称**：商品统计
- **请求方法**：`GET`
- **URL**：`/api/admin/statistics/products`
- **权限要求**：需管理员登录 + `statistics:view`

**请求参数**：startDate/endDate/sortBy/limit

**响应字段**：list[]含 productId/productName/salesCount/salesAmount/stockStatus

**错误码**：40301

**业务说明**：管理后台数据统计接口，需对应权限才能访问。

---
#### 用户统计

- **接口名称**：用户统计
- **请求方法**：`GET`
- **URL**：`/api/admin/statistics/users`
- **权限要求**：需管理员登录 + `statistics:view`

**请求参数**：startDate/endDate

**响应字段**：newUsers/activeUsers/totalUsers/memberDistribution[]含 level/count

**错误码**：40301

**业务说明**：管理后台数据统计接口，需对应权限才能访问。

---
#### 活动效果统计

- **接口名称**：活动效果统计
- **请求方法**：`GET`
- **URL**：`/api/admin/statistics/activities`
- **权限要求**：需管理员登录 + `statistics:view`

**请求参数**：startDate/endDate/activityId

**响应字段**：list[]含 activityId/activityName/visitCount/orderCount/salesAmount/conversionRate

**错误码**：40301

**业务说明**：管理后台数据统计接口，需对应权限才能访问。

---
### 5.21 管理员管理
#### 管理员列表

- **接口名称**：管理员列表
- **请求方法**：`GET`
- **URL**：`/api/admin/admin-user/list`
- **权限要求**：需管理员登录 + `admin-user:view`

**请求参数**：page/pageSize/keyword/status

**响应字段**：list[]含 id/username/realName/phone/roleId/roleName/status/lastLoginAt/createdAt + pagination

**错误码**：40301

**业务说明**：管理后台管理员管理接口，需对应权限才能访问。

---
#### 新增管理员

- **接口名称**：新增管理员
- **请求方法**：`POST`
- **URL**：`/api/admin/admin-user/create`
- **权限要求**：需管理员登录 + `admin-user:create`

**请求参数**：username(是)/password(是)/realName/phone/email/roleId(是)

**响应字段**：id

**错误码**：40001/40301/40901

**业务说明**：管理后台管理员管理接口，需对应权限才能访问。

---
#### 更新管理员

- **接口名称**：更新管理员
- **请求方法**：`PUT`
- **URL**：`/api/admin/admin-user/update/:id`
- **权限要求**：需管理员登录 + `admin-user:update`

**请求参数**：id(路径)/realName/phone/email/roleId/status

**响应字段**：success

**错误码**：40401/40001/40301

**业务说明**：管理后台管理员管理接口，需对应权限才能访问。

---
#### 删除管理员

- **接口名称**：删除管理员
- **请求方法**：`DELETE`
- **URL**：`/api/admin/admin-user/delete/:id`
- **权限要求**：需管理员登录 + `admin-user:delete`

**请求参数**：id(路径)

**响应字段**：success

**错误码**：40401/40301

**业务说明**：管理后台管理员管理接口，需对应权限才能访问。

---
#### 重置密码

- **接口名称**：重置密码
- **请求方法**：`PUT`
- **URL**：`/api/admin/admin-user/reset-password/:id`
- **权限要求**：需管理员登录 + `admin-user:update`

**请求参数**：id(路径)/newPassword(是)

**响应字段**：success

**错误码**：40401/40001/40301

**业务说明**：管理后台管理员管理接口，需对应权限才能访问。

---
### 5.22 角色权限
#### 角色列表

- **接口名称**：角色列表
- **请求方法**：`GET`
- **URL**：`/api/admin/role/list`
- **权限要求**：需管理员登录 + `role:view`

**请求参数**：无

**响应字段**：list[]含 id/name/description/permissions[]/userCount/createdAt

**错误码**：40301

**业务说明**：管理后台角色权限接口，需对应权限才能访问。

---
#### 新增角色

- **接口名称**：新增角色
- **请求方法**：`POST`
- **URL**：`/api/admin/role/create`
- **权限要求**：需管理员登录 + `role:create`

**请求参数**：name(是)/description/permissions[](是)

**响应字段**：id

**错误码**：40001/40301/40901

**业务说明**：管理后台角色权限接口，需对应权限才能访问。

---
#### 更新角色

- **接口名称**：更新角色
- **请求方法**：`PUT`
- **URL**：`/api/admin/role/update/:id`
- **权限要求**：需管理员登录 + `role:update`

**请求参数**：id(路径)/name/description/permissions

**响应字段**：success

**错误码**：40401/40001/40301

**业务说明**：管理后台角色权限接口，需对应权限才能访问。

---
#### 删除角色

- **接口名称**：删除角色
- **请求方法**：`DELETE`
- **URL**：`/api/admin/role/delete/:id`
- **权限要求**：需管理员登录 + `role:delete`

**请求参数**：id(路径)

**响应字段**：success

**错误码**：40401/40301/40901(角色下有用户)

**业务说明**：管理后台角色权限接口，需对应权限才能访问。

---
#### 权限树

- **接口名称**：权限树
- **请求方法**：`GET`
- **URL**：`/api/admin/permission/tree`
- **权限要求**：需管理员登录 + `permission:view`

**请求参数**：无

**响应字段**：tree[]含 id/name/code/type/children[]

**错误码**：40301

**业务说明**：管理后台角色权限接口，需对应权限才能访问。

---
### 5.23 系统配置
#### 配置列表

- **接口名称**：配置列表
- **请求方法**：`GET`
- **URL**：`/api/admin/system-config/list`
- **权限要求**：需管理员登录 + `system-config:view`

**请求参数**：无

**响应字段**：list[]含 id/key/value/description/group/updatedAt

**错误码**：40301

**业务说明**：管理后台系统配置接口，需对应权限才能访问。

---
#### 更新配置

- **接口名称**：更新配置
- **请求方法**：`PUT`
- **URL**：`/api/admin/system-config/update`
- **权限要求**：需管理员登录 + `system-config:update`

**请求参数**：configs[](id/value)

**响应字段**：success

**错误码**：40001/40301

**业务说明**：管理后台系统配置接口，需对应权限才能访问。

---
### 5.24 操作日志
#### 操作日志列表

- **接口名称**：操作日志列表
- **请求方法**：`GET`
- **URL**：`/api/admin/operation-log/list`
- **权限要求**：需管理员登录 + `operation-log:view`

**请求参数**：page/pageSize/operator/module/action/startDate/endDate

**响应字段**：list[]含 id/operatorName/module/action/targetType/targetId/detail/ip/createdAt + pagination

**错误码**：40301

**业务说明**：管理后台操作日志接口，需对应权限才能访问。

---
## 6. 公共 API

### 6.1 文件上传

#### 文件上传

- **接口名称**：文件上传
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

### 6.2 获取文件信息

#### 获取文件信息

- **接口名称**：获取文件信息
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

### 6.3 地区数据

#### 地区数据

- **接口名称**：地区数据
- **请求方法**：`GET`
- **URL**：`/api/common/region/tree`
- **权限要求**：无

**请求参数**：无

**响应字段**：

| 字段名 | 类型 | 说明 |
|--------|------|------|
| list | array | 省份列表 |
| list[].code | string | 行政区划代码 |
| list[].name | string | 地区名称 |
| list[].children | array | 市级列表（含 children 区级） |

**错误码**：无

**业务说明**：返回省市区三级地区数据树。数据有 24 小时缓存。

---

## 7. 微信支付回调

### 7.1 微信支付回调通知

- **接口名称**：微信支付回调通知
- **请求方法**：`POST`
- **URL**：`/api/weapp/pay/callback`
- **权限要求**：无（微信服务器调用）

**请求参数**：微信支付回调 XML/JSON 数据（由微信服务器发送）

**响应字段**：按微信支付规范返回处理结果

**业务说明**：微信支付完成后，微信服务器会调用此接口通知支付结果。后端需验签后更新订单状态：支付成功则将订单状态改为待发货，扣减实际库存，发放积分；支付失败则将订单状态改为已取消，释放预扣库存。需处理重复通知（幂等性），确保同一笔订单只处理一次。回调处理失败时返回非成功响应，微信会重试通知。
