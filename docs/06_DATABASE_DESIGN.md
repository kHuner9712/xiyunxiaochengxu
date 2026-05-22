# 禧孕母婴用品私域商城小程序 - 数据库设计文档

> 项目名称：禧孕母婴用品私域商城小程序
> 运营方：禧孕文化传媒有限公司
> 数据库：MySQL 8.0
> ORM：Prisma
> 文档版本：v1.0
> 最后更新：2026-05-20

---

## 1. 文档概述

本文档定义了"禧孕母婴用品私域商城小程序"的完整数据库设计方案。本项目为甲方（禧孕文化传媒有限公司）自营商城，非多商户平台，所有商品由甲方统一采购、定价、发货和售后。

文档涵盖以下内容：

- 数据库设计原则与命名规范
- 用户、商品、订单、营销、售后、内容、后台管理、系统等全部数据表定义
- 每张表的字段名、字段类型、是否必填、默认值、索引、详细说明
- 表间 ER 关系描述
- 索引优化建议
- 数据初始化方案

---

## 2. 数据库设计原则

| 原则 | 说明 |
|------|------|
| **自营单商户** | 不涉及多商户入驻，供应商信息仅用于内部采购管理，不对用户暴露 |
| **软删除优先** | 业务核心表（用户、商品、订单等）采用 `deleted_at` 软删除，防止数据误删及审计追溯 |
| **金额精度** | 所有金额字段使用 `DECIMAL(10,2)`，精确到分，避免浮点精度丢失 |
| **JSON 扩展** | 规格值、活动规则、物流轨迹等非结构化数据使用 JSON 类型存储，兼顾灵活性与查询需求 |
| **快照隔离** | 订单商品信息（名称、规格、图片、价格）在下单时做快照，与商品主表解耦，保证历史订单数据不受商品修改影响 |
| **索引适度** | 基于查询场景建立索引，避免过度索引影响写入性能 |
| **时区统一** | 所有时间字段使用 `DATETIME` 类型，服务层统一处理时区转换（Asia/Shanghai） |
| **字符集** | 统一使用 `utf8mb4` 字符集，`utf8mb4_unicode_ci` 排序规则，支持 Emoji 和生僻汉字 |
| **主键策略** | 全表使用 `BIGINT AUTO_INCREMENT` 自增主键，满足数据量增长需求 |
| **审计追踪** | 核心操作通过日志表（order_logs、aftersale_logs、admin_operation_logs）记录，满足业务追溯需求 |

---

## 3. 表命名规范

| 规范 | 示例 |
|------|------|
| 表名使用小写蛇形命名法（snake_case） | `user_addresses` |
| 表名使用复数形式表示集合 | `products`、`orders` |
| 关联表以两个实体名组合命名 | `activity_products`、`admin_role_permissions` |
| 日志表以 `_logs` 后缀结尾 | `order_logs`、`admin_operation_logs` |
| 记录表以 `_records` 后缀结尾 | `points_records`、`share_records` |
| 字段名使用小写蛇形命名法 | `created_at`、`receiver_name` |
| 布尔/标志字段以 `is_` 前缀开头 | `is_default`、`is_recommend` |
| 索引命名：普通索引 `idx_字段名`，唯一索引 `uk_字段名` | `idx_user_id`、`uk_order_no` |

---

## 4. 公共字段规范

以下公共字段在本文档各表中不再重复说明其含义，仅列出字段定义。

| 字段名 | 类型 | 必填 | 默认值 | 说明 |
|--------|------|------|--------|------|
| `id` | BIGINT | 是 | AUTO_INCREMENT | 主键，自增 |
| `created_at` | DATETIME | 是 | CURRENT_TIMESTAMP | 创建时间 |
| `updated_at` | DATETIME | 是 | CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP | 更新时间 |
| `deleted_at` | DATETIME | 否 | NULL | 软删除时间，NULL 表示未删除，仅部分表包含此字段 |

**说明：**

- `id` 使用 BIGINT 类型，支持最大 2^63-1 条记录，满足长期增长需求
- `created_at` 和 `updated_at` 由数据库自动维护，应用层不应手动赋值
- `deleted_at` 仅在需要软删除的表中出现，查询时通过 `WHERE deleted_at IS NULL` 过滤已删除记录
- Prisma 模型中通过 `@@map` 将驼峰字段映射为蛇形数据库列名

---

## 5. 用户相关表

### 5.1 users 用户表

用户核心信息表，存储微信小程序授权登录后的基本用户数据。

| 字段名 | 类型 | 必填 | 默认值 | 索引 | 说明 |
|--------|------|------|--------|------|------|
| `id` | BIGINT | 是 | AUTO_INCREMENT | PRIMARY | 主键 |
| `openid` | VARCHAR(64) | 是 | - | idx_openid | 微信 openid，用户在小程序中的唯一标识 |
| `union_id` | VARCHAR(64) | 否 | NULL | - | 微信 unionid，用于跨小程序/公众号关联用户 |
| `phone` | VARCHAR(20) | 否 | NULL | idx_phone | 手机号，用户授权后获取 |
| `nickname` | VARCHAR(50) | 否 | NULL | - | 昵称，默认取微信昵称 |
| `avatar_url` | VARCHAR(500) | 否 | NULL | - | 头像 URL，默认取微信头像 |
| `gender` | TINYINT | 否 | 0 | - | 性别：0=未知，1=男，2=女 |
| `member_level_id` | BIGINT | 否 | NULL | idx_member_level_id | 会员等级 ID，关联 member_levels.id |
| `growth_value` | INT | 否 | 0 | - | 成长值，用于会员等级计算 |
| `total_points` | INT | 否 | 0 | - | 累计获得积分（含已消耗和已过期的） |
| `available_points` | INT | 否 | 0 | - | 当前可用积分 |
| `last_login_at` | DATETIME | 否 | NULL | - | 最后登录时间 |
| `status` | TINYINT | 否 | 1 | - | 状态：1=正常，2=禁用 |
| `created_at` | DATETIME | 是 | CURRENT_TIMESTAMP | - | 创建时间 |
| `updated_at` | DATETIME | 是 | CURRENT_TIMESTAMP ON UPDATE | - | 更新时间 |
| `deleted_at` | DATETIME | 否 | NULL | - | 软删除时间 |

**索引详情：**

| 索引名 | 类型 | 字段 |
|--------|------|------|
| `idx_openid` | UNIQUE | `openid` |
| `idx_phone` | NORMAL | `phone` |
| `idx_member_level_id` | NORMAL | `member_level_id` |

---

### 5.2 user_profiles 用户资料扩展表

用户补充信息表，存储非核心但有助于精准营销的用户画像数据。

| 字段名 | 类型 | 必填 | 默认值 | 索引 | 说明 |
|--------|------|------|--------|------|------|
| `id` | BIGINT | 是 | AUTO_INCREMENT | PRIMARY | 主键 |
| `user_id` | BIGINT | 是 | - | idx_user_id (UNIQUE) | 用户 ID，关联 users.id，一对一关系 |
| `real_name` | VARCHAR(50) | 否 | NULL | - | 真实姓名 |
| `birthday` | DATE | 否 | NULL | - | 用户生日 |
| `baby_count` | INT | 否 | 0 | - | 宝宝数量 |
| `source` | VARCHAR(20) | 否 | NULL | - | 来源渠道：miniprogram/share/qrcode/activity 等 |
| `created_at` | DATETIME | 是 | CURRENT_TIMESTAMP | - | 创建时间 |
| `updated_at` | DATETIME | 是 | CURRENT_TIMESTAMP ON UPDATE | - | 更新时间 |

**索引详情：**

| 索引名 | 类型 | 字段 |
|--------|------|------|
| `idx_user_id` | UNIQUE | `user_id` |

---

### 5.3 user_addresses 收货地址表

用户收货地址管理，支持多地址及默认地址设置。

| 字段名 | 类型 | 必填 | 默认值 | 索引 | 说明 |
|--------|------|------|--------|------|------|
| `id` | BIGINT | 是 | AUTO_INCREMENT | PRIMARY | 主键 |
| `user_id` | BIGINT | 是 | - | idx_user_id | 用户 ID，关联 users.id |
| `receiver_name` | VARCHAR(50) | 是 | - | - | 收货人姓名 |
| `receiver_phone` | VARCHAR(20) | 是 | - | - | 收货人手机号 |
| `province` | VARCHAR(20) | 是 | - | - | 省份 |
| `city` | VARCHAR(20) | 是 | - | - | 城市 |
| `district` | VARCHAR(20) | 是 | - | - | 区/县 |
| `detail_address` | VARCHAR(200) | 是 | - | - | 详细地址（不含省市区） |
| `is_default` | TINYINT | 否 | 0 | - | 是否默认地址：1=是，0=否 |
| `created_at` | DATETIME | 是 | CURRENT_TIMESTAMP | - | 创建时间 |
| `updated_at` | DATETIME | 是 | CURRENT_TIMESTAMP ON UPDATE | - | 更新时间 |
| `deleted_at` | DATETIME | 否 | NULL | - | 软删除时间 |

**索引详情：**

| 索引名 | 类型 | 字段 |
|--------|------|------|
| `idx_user_id` | NORMAL | `user_id` |

**业务约束：**

- 每个用户最多保留 20 条地址
- 设置默认地址时，需将同用户其他地址 `is_default` 置为 0

---

### 5.4 baby_profiles 宝宝档案表

宝宝信息管理，支持多宝宝档案，用于月龄推荐和精准营销。

| 字段名 | 类型 | 必填 | 默认值 | 索引 | 说明 |
|--------|------|------|--------|------|------|
| `id` | BIGINT | 是 | AUTO_INCREMENT | PRIMARY | 主键 |
| `user_id` | BIGINT | 是 | - | idx_user_id | 用户 ID，关联 users.id |
| `nickname` | VARCHAR(50) | 否 | NULL | - | 宝宝昵称 |
| `gender` | TINYINT | 否 | 0 | - | 性别：0=未知，1=男，2=女 |
| `birthday` | DATE | 是 | - | idx_birthday | 宝宝生日，用于计算月龄 |
| `current_month_age` | INT | 否 | NULL | - | 当前月龄（月），通过定时任务每日更新或查询时计算 |
| `avatar_url` | VARCHAR(500) | 否 | NULL | - | 宝宝头像 |
| `is_default` | TINYINT | 否 | 0 | - | 是否默认宝宝：1=是，0=否 |
| `created_at` | DATETIME | 是 | CURRENT_TIMESTAMP | - | 创建时间 |
| `updated_at` | DATETIME | 是 | CURRENT_TIMESTAMP ON UPDATE | - | 更新时间 |
| `deleted_at` | DATETIME | 否 | NULL | - | 软删除时间 |

**索引详情：**

| 索引名 | 类型 | 字段 |
|--------|------|------|
| `idx_user_id` | NORMAL | `user_id` |
| `idx_birthday` | NORMAL | `birthday` |

**业务说明：**

- `current_month_age` 建议通过定时任务每日凌晨批量计算更新，避免查询时实时计算的性能开销
- 月龄计算公式：`FLOOR(DATEDIFF(CURDATE(), birthday) / 30)`

---

### 5.5 member_levels 会员等级表

会员等级定义，基于成长值划分等级，不同等级享受不同折扣和积分倍率。

| 字段名 | 类型 | 必填 | 默认值 | 索引 | 说明 |
|--------|------|------|--------|------|------|
| `id` | BIGINT | 是 | AUTO_INCREMENT | PRIMARY | 主键 |
| `name` | VARCHAR(20) | 是 | - | - | 等级名称，如"普通会员""黄金会员" |
| `icon` | VARCHAR(500) | 否 | NULL | - | 等级图标 URL |
| `min_growth_value` | INT | 是 | - | - | 最低成长值（含） |
| `max_growth_value` | INT | 否 | NULL | - | 最高成长值（不含），NULL 表示无上限 |
| `discount_rate` | DECIMAL(3,2) | 否 | NULL | - | 折扣率，整数百分比，例如 98 表示 98 折（即 2% 优惠），95 表示 95 折（即 5% 优惠），NULL 表示无折扣 |
| `points_rate` | DECIMAL(3,1) | 否 | 1.0 | - | 积分倍率，十分制整数，例如 10 表示 1.0 倍，20 表示 2.0 倍，50 表示 5.0 倍 |
| `benefits` | TEXT | 否 | NULL | - | 权益描述 JSON，如 `{"free_shipping":true,"exclusive_coupons":3}` |
| `sort_order` | INT | 否 | 0 | - | 排序序号，值越小越靠前 |
| `status` | TINYINT | 否 | 1 | - | 状态：1=启用，2=禁用 |
| `created_at` | DATETIME | 是 | CURRENT_TIMESTAMP | - | 创建时间 |
| `updated_at` | DATETIME | 是 | CURRENT_TIMESTAMP ON UPDATE | - | 更新时间 |

---

### 5.6 user_member_records 会员变更记录表

记录用户会员等级变更历史，用于审计和用户等级回溯。

| 字段名 | 类型 | 必填 | 默认值 | 索引 | 说明 |
|--------|------|------|--------|------|------|
| `id` | BIGINT | 是 | AUTO_INCREMENT | PRIMARY | 主键 |
| `user_id` | BIGINT | 是 | - | idx_user_id | 用户 ID，关联 users.id |
| `old_level_id` | BIGINT | 否 | NULL | - | 原等级 ID，NULL 表示新注册用户首次定级 |
| `new_level_id` | BIGINT | 是 | - | - | 新等级 ID，关联 member_levels.id |
| `change_reason` | VARCHAR(200) | 否 | NULL | - | 变更原因，如"成长值达到500自动升级""管理员手动调整" |
| `created_at` | DATETIME | 是 | CURRENT_TIMESTAMP | - | 创建时间 |

**索引详情：**

| 索引名 | 类型 | 字段 |
|--------|------|------|
| `idx_user_id` | NORMAL | `user_id` |

---

### 5.7 points_records 积分记录表

用户积分变动明细，支持积分获得、消耗、过期三种类型，每笔变动均有记录。

| 字段名 | 类型 | 必填 | 默认值 | 索引 | 说明 |
|--------|------|------|--------|------|------|
| `id` | BIGINT | 是 | AUTO_INCREMENT | PRIMARY | 主键 |
| `user_id` | BIGINT | 是 | - | idx_user_id | 用户 ID，关联 users.id |
| `type` | TINYINT | 是 | - | idx_type | 类型：1=获得，2=消耗，3=过期 |
| `points` | INT | 是 | - | - | 积分数量，始终为正数，收入/支出通过 type 字段区分 |
| `balance` | INT | 否 | NULL | - | 变动后可用积分余额 |
| `source` | VARCHAR(30) | 是 | - | idx_source | 来源：order_purchase（下单）/sign_in（签到）/share（分享）/profile_complete（完善资料）/exchange（兑换）/expire（过期）/admin_adjust（管理员调整） |
| `source_id` | BIGINT | 否 | NULL | - | 关联 ID，如订单 ID、兑换记录 ID 等 |
| `description` | VARCHAR(200) | 否 | NULL | - | 描述信息，如"购买商品获得积分""签到奖励" |
| `expire_at` | DATETIME | 否 | NULL | idx_expire_at | 过期时间，仅 type=1 时有效，用于定时任务标记过期 |
| `created_at` | DATETIME | 是 | CURRENT_TIMESTAMP | - | 创建时间 |

**索引详情：**

| 索引名 | 类型 | 字段 |
|--------|------|------|
| `idx_user_id` | NORMAL | `user_id` |
| `idx_type` | NORMAL | `type` |
| `idx_source` | NORMAL | `source` |
| `idx_expire_at` | NORMAL | `expire_at` |

**业务说明：**

- 积分有效期建议为获得后次年年底，`expire_at` 在积分获得时即计算写入
- 定时任务每日扫描 `type=1 AND expire_at < NOW() AND expire_at IS NOT NULL` 的记录，将过期积分标记为 `type=3`

---

## 6. 商品相关表

### 6.1 suppliers 供应商表

供应商信息管理，仅用于后台采购管理，不对小程序用户暴露。

| 字段名 | 类型 | 必填 | 默认值 | 索引 | 说明 |
|--------|------|------|--------|------|------|
| `id` | BIGINT | 是 | AUTO_INCREMENT | PRIMARY | 主键 |
| `name` | VARCHAR(100) | 是 | - | idx_name | 供应商名称 |
| `contact_name` | VARCHAR(50) | 否 | NULL | - | 联系人姓名 |
| `contact_phone` | VARCHAR(20) | 否 | NULL | - | 联系电话 |
| `address` | VARCHAR(300) | 否 | NULL | - | 供应商地址 |
| `business_license` | VARCHAR(500) | 否 | NULL | - | 营业执照图片 URL |
| `cooperation_start_date` | DATE | 否 | NULL | - | 合作开始日期 |
| `settlement_type` | TINYINT | 否 | NULL | - | 结算方式：1=月结，2=季结，3=其他 |
| `remark` | TEXT | 否 | NULL | - | 备注信息 |
| `status` | TINYINT | 否 | 1 | idx_status | 状态：1=合作中，2=已停用 |
| `created_at` | DATETIME | 是 | CURRENT_TIMESTAMP | - | 创建时间 |
| `updated_at` | DATETIME | 是 | CURRENT_TIMESTAMP ON UPDATE | - | 更新时间 |
| `deleted_at` | DATETIME | 否 | NULL | - | 软删除时间 |

**索引详情：**

| 索引名 | 类型 | 字段 |
|--------|------|------|
| `idx_name` | NORMAL | `name` |
| `idx_status` | NORMAL | `status` |

---

### 6.2 brands 品牌表

商品品牌管理，用于品牌筛选和品牌展示。

| 字段名 | 类型 | 必填 | 默认值 | 索引 | 说明 |
|--------|------|------|--------|------|------|
| `id` | BIGINT | 是 | AUTO_INCREMENT | PRIMARY | 主键 |
| `name` | VARCHAR(50) | 是 | - | idx_name | 品牌名称 |
| `logo` | VARCHAR(500) | 否 | NULL | - | 品牌 Logo URL |
| `description` | TEXT | 否 | NULL | - | 品牌描述 |
| `sort_order` | INT | 否 | 0 | - | 排序序号 |
| `status` | TINYINT | 否 | 1 | - | 状态：1=启用，2=禁用 |
| `created_at` | DATETIME | 是 | CURRENT_TIMESTAMP | - | 创建时间 |
| `updated_at` | DATETIME | 是 | CURRENT_TIMESTAMP ON UPDATE | - | 更新时间 |
| `deleted_at` | DATETIME | 否 | NULL | - | 软删除时间 |

**索引详情：**

| 索引名 | 类型 | 字段 |
|--------|------|------|
| `idx_name` | NORMAL | `name` |

---

### 6.3 product_categories 商品分类表

商品分类管理，支持多级分类树结构，通过 `parent_id` 实现父子关系。

| 字段名 | 类型 | 必填 | 默认值 | 索引 | 说明 |
|--------|------|------|--------|------|------|
| `id` | BIGINT | 是 | AUTO_INCREMENT | PRIMARY | 主键 |
| `parent_id` | BIGINT | 否 | 0 | idx_parent_id | 父分类 ID，0 表示一级分类 |
| `name` | VARCHAR(50) | 是 | - | - | 分类名称 |
| `icon` | VARCHAR(500) | 否 | NULL | - | 分类图标 URL |
| `sort_order` | INT | 否 | 0 | idx_sort_order | 排序序号 |
| `is_show` | TINYINT | 否 | 1 | - | 是否在小程序端显示：1=是，0=否 |
| `created_at` | DATETIME | 是 | CURRENT_TIMESTAMP | - | 创建时间 |
| `updated_at` | DATETIME | 是 | CURRENT_TIMESTAMP ON UPDATE | - | 更新时间 |
| `deleted_at` | DATETIME | 否 | NULL | - | 软删除时间 |

**索引详情：**

| 索引名 | 类型 | 字段 |
|--------|------|------|
| `idx_parent_id` | NORMAL | `parent_id` |
| `idx_sort_order` | NORMAL | `sort_order` |

**业务约束：**

- 分类最多支持 3 级（一级 → 二级 → 三级）
- 删除父分类时需检查是否存在子分类

---

### 6.4 products 商品表（SPU）

商品标准产品单元（SPU），存储商品的公共信息。一个 SPU 对应多个 SKU。

| 字段名 | 类型 | 必填 | 默认值 | 索引 | 说明 |
|--------|------|------|--------|------|------|
| `id` | BIGINT | 是 | AUTO_INCREMENT | PRIMARY | 主键 |
| `name` | VARCHAR(200) | 是 | - | - | 商品名称 |
| `category_id` | BIGINT | 是 | - | idx_category_id | 分类 ID，关联 product_categories.id |
| `brand_id` | BIGINT | 否 | NULL | idx_brand_id | 品牌 ID，关联 brands.id |
| `supplier_id` | BIGINT | 否 | NULL | idx_supplier_id | 供应商 ID，仅内部管理用，关联 suppliers.id |
| `main_image` | VARCHAR(500) | 否 | NULL | - | 主图 URL |
| `images` | JSON | 否 | NULL | - | 商品图片数组，如 `["url1","url2"]` |
| `description` | TEXT | 否 | NULL | - | 商品描述（富文本 HTML） |
| `attributes` | JSON | 否 | NULL | - | 规格参数 JSON，如 `[{"name":"材质","value":"纯棉"}]` |
| `service_promise` | JSON | 否 | NULL | - | 服务承诺，如 `["7天无理由","正品保障"]` |
| `min_price` | DECIMAL(10,2) | 否 | NULL | - | 最低 SKU 价格（冗余字段，由 SKU 同步更新） |
| `max_price` | DECIMAL(10,2) | 否 | NULL | - | 最高 SKU 价格（冗余字段，由 SKU 同步更新） |
| `total_sales` | INT | 否 | 0 | - | 真实总销量 + 虚拟销量 |
| `virtual_sales` | INT | 否 | 0 | - | 虚拟销量，用于新商品基础销量展示 |
| `status` | TINYINT | 否 | 3 | idx_status | 状态：1=上架，2=下架，3=草稿 |
| `sort_order` | INT | 否 | 0 | idx_sort_order | 排序序号 |
| `is_recommend` | TINYINT | 否 | 0 | - | 是否推荐：1=是，0=否 |
| `recommend_age_min` | INT | 否 | NULL | - | 推荐月龄最小值（月） |
| `recommend_age_max` | INT | 否 | NULL | - | 推荐月龄最大值（月） |
| `is_period_purchase` | TINYINT | 否 | 0 | - | 是否支持周期购：1=是，0=否 |
| `created_at` | DATETIME | 是 | CURRENT_TIMESTAMP | - | 创建时间 |
| `updated_at` | DATETIME | 是 | CURRENT_TIMESTAMP ON UPDATE | - | 更新时间 |
| `deleted_at` | DATETIME | 否 | NULL | - | 软删除时间 |

**索引详情：**

| 索引名 | 类型 | 字段 |
|--------|------|------|
| `idx_category_id` | NORMAL | `category_id` |
| `idx_brand_id` | NORMAL | `brand_id` |
| `idx_supplier_id` | NORMAL | `supplier_id` |
| `idx_status` | NORMAL | `status` |
| `idx_sort_order` | NORMAL | `sort_order` |

---

### 6.5 product_skus 商品 SKU 表

商品库存单元（SKU），存储每个规格组合的价格、库存等信息。

| 字段名 | 类型 | 必填 | 默认值 | 索引 | 说明 |
|--------|------|------|--------|------|------|
| `id` | BIGINT | 是 | AUTO_INCREMENT | PRIMARY | 主键 |
| `product_id` | BIGINT | 是 | - | idx_product_id | 商品 ID，关联 products.id |
| `sku_code` | VARCHAR(50) | 否 | NULL | idx_sku_code | SKU 编码，用于与外部系统对接 |
| `specs` | JSON | 否 | NULL | - | 规格值 JSON，如 `{"颜色":"白色","尺码":"M"}` |
| `price` | DECIMAL(10,2) | 是 | - | - | 售价 |
| `original_price` | DECIMAL(10,2) | 否 | NULL | - | 原价（划线价） |
| `cost_price` | DECIMAL(10,2) | 否 | NULL | - | 成本价，仅后台可见 |
| `stock` | INT | 是 | 0 | - | 当前库存数量 |
| `sales` | INT | 否 | 0 | - | 销量 |
| `image` | VARCHAR(500) | 否 | NULL | - | SKU 图片 URL，不同规格可展示不同图片 |
| `weight` | DECIMAL(10,2) | 否 | NULL | - | 重量（kg），用于运费计算 |
| `barcode` | VARCHAR(50) | 否 | NULL | - | 条形码 |
| `status` | TINYINT | 否 | 1 | idx_status | 状态：1=启用，2=禁用 |
| `created_at` | DATETIME | 是 | CURRENT_TIMESTAMP | - | 创建时间 |
| `updated_at` | DATETIME | 是 | CURRENT_TIMESTAMP ON UPDATE | - | 更新时间 |

**索引详情：**

| 索引名 | 类型 | 字段 |
|--------|------|------|
| `idx_product_id` | NORMAL | `product_id` |
| `idx_sku_code` | UNIQUE | `sku_code` |
| `idx_status` | NORMAL | `status` |

**业务约束：**

- SKU 的 `price` 变更时需同步更新 products 表的 `min_price` 和 `max_price`
- 库存扣减需使用乐观锁或行锁防止超卖：`UPDATE product_skus SET stock = stock - ? WHERE id = ? AND stock >= ?`

---

### 6.6 product_images 商品图片表

商品图片管理，支持排序。与 products 表的 `images` JSON 字段互补，此表用于需要单独管理每张图片的场景。

| 字段名 | 类型 | 必填 | 默认值 | 索引 | 说明 |
|--------|------|------|--------|------|------|
| `id` | BIGINT | 是 | AUTO_INCREMENT | PRIMARY | 主键 |
| `product_id` | BIGINT | 是 | - | idx_product_id | 商品 ID，关联 products.id |
| `image_url` | VARCHAR(500) | 是 | - | - | 图片 URL |
| `sort_order` | INT | 否 | 0 | - | 排序序号 |
| `created_at` | DATETIME | 是 | CURRENT_TIMESTAMP | - | 创建时间 |

**索引详情：**

| 索引名 | 类型 | 字段 |
|--------|------|------|
| `idx_product_id` | NORMAL | `product_id` |

---

### 6.7 product_attributes 商品属性/规格模板表

分类关联的属性和规格模板，用于商品发布时选择规格和参数。

| 字段名 | 类型 | 必填 | 默认值 | 索引 | 说明 |
|--------|------|------|--------|------|------|
| `id` | BIGINT | 是 | AUTO_INCREMENT | PRIMARY | 主键 |
| `category_id` | BIGINT | 否 | NULL | idx_category_id | 分类 ID，关联 product_categories.id |
| `name` | VARCHAR(50) | 是 | - | - | 属性名，如"颜色""材质""尺码" |
| `type` | TINYINT | 否 | NULL | - | 类型：1=规格（影响 SKU），2=参数（不影响 SKU） |
| `values` | JSON | 否 | NULL | - | 可选值 JSON，如 `["白色","黑色","粉色"]` |
| `sort_order` | INT | 否 | 0 | - | 排序序号 |
| `created_at` | DATETIME | 是 | CURRENT_TIMESTAMP | - | 创建时间 |
| `updated_at` | DATETIME | 是 | CURRENT_TIMESTAMP ON UPDATE | - | 更新时间 |

**索引详情：**

| 索引名 | 类型 | 字段 |
|--------|------|------|
| `idx_category_id` | NORMAL | `category_id` |

---

### 6.8 product_stock_logs 库存变动日志表

库存变动记录，用于库存审计和问题排查。

| 字段名 | 类型 | 必填 | 默认值 | 索引 | 说明 |
|--------|------|------|--------|------|------|
| `id` | BIGINT | 是 | AUTO_INCREMENT | PRIMARY | 主键 |
| `product_id` | BIGINT | 是 | - | idx_product_id | 商品 ID |
| `sku_id` | BIGINT | 是 | - | idx_sku_id | SKU ID |
| `type` | TINYINT | 是 | - | idx_type | 类型：1=入库，2=出库，3=订单扣减，4=售后归还，5=调整 |
| `quantity` | INT | 是 | - | - | 变动数量（正数表示增加，负数表示减少） |
| `before_stock` | INT | 否 | NULL | - | 变动前库存 |
| `after_stock` | INT | 否 | NULL | - | 变动后库存 |
| `reason` | VARCHAR(200) | 否 | NULL | - | 变动原因 |
| `operator_id` | BIGINT | 否 | NULL | - | 操作人 ID（管理员） |
| `created_at` | DATETIME | 是 | CURRENT_TIMESTAMP | idx_created_at | 创建时间 |

**索引详情：**

| 索引名 | 类型 | 字段 |
|--------|------|------|
| `idx_product_id` | NORMAL | `product_id` |
| `idx_sku_id` | NORMAL | `sku_id` |
| `idx_type` | NORMAL | `type` |
| `idx_created_at` | NORMAL | `created_at` |

---

## 7. 购物车与订单表

### 7.1 carts 购物车表

用户购物车，记录用户选中的商品 SKU 及数量。

| 字段名 | 类型 | 必填 | 默认值 | 索引 | 说明 |
|--------|------|------|--------|------|------|
| `id` | BIGINT | 是 | AUTO_INCREMENT | PRIMARY | 主键 |
| `user_id` | BIGINT | 是 | - | idx_user_id | 用户 ID，关联 users.id |
| `product_id` | BIGINT | 是 | - | - | 商品 ID，关联 products.id |
| `sku_id` | BIGINT | 是 | - | - | SKU ID，关联 product_skus.id |
| `quantity` | INT | 是 | 1 | - | 数量 |
| `is_selected` | TINYINT | 否 | 1 | - | 是否选中：1=是，0=否 |
| `created_at` | DATETIME | 是 | CURRENT_TIMESTAMP | - | 创建时间 |
| `updated_at` | DATETIME | 是 | CURRENT_TIMESTAMP ON UPDATE | - | 更新时间 |

**索引详情：**

| 索引名 | 类型 | 字段 |
|--------|------|------|
| `idx_user_id` | NORMAL | `user_id` |
| `uk_user_sku` | UNIQUE | `user_id, sku_id` |

**业务约束：**

- 同一用户同一 SKU 只能有一条购物车记录，重复添加时更新 `quantity`
- 购物车数据可设置过期清理策略（如 30 天未操作自动清理）

---

### 7.2 orders 订单表

订单核心表，记录订单基本信息、金额明细、收货地址和状态流转。

| 字段名 | 类型 | 必填 | 默认值 | 索引 | 说明 |
|--------|------|------|--------|------|------|
| `id` | BIGINT | 是 | AUTO_INCREMENT | PRIMARY | 主键 |
| `order_no` | VARCHAR(32) | 是 | - | uk_order_no | 订单编号，格式如 `XY20260520150030001` |
| `user_id` | BIGINT | 是 | - | idx_user_id | 用户 ID，关联 users.id |
| `status` | VARCHAR(20) | 是 | - | idx_status | 订单状态：pending_payment（待付款）/paid（已付款）/pending_delivery（待发货）/delivered（已发货）/completed（已完成）/cancelled（已取消）/aftersale（售后中） |
| `total_amount` | DECIMAL(10,2) | 是 | - | - | 商品总金额（所有 order_item 小计之和） |
| `discount_amount` | DECIMAL(10,2) | 否 | 0.00 | - | 优惠金额合计 |
| `freight_amount` | DECIMAL(10,2) | 否 | 0.00 | - | 运费 |
| `points_amount` | DECIMAL(10,2) | 否 | 0.00 | - | 积分抵扣金额 |
| `pay_amount` | DECIMAL(10,2) | 否 | NULL | - | 实付金额 = total_amount - discount_amount + freight_amount - points_amount - coupon_amount - activity_discount_amount |
| `points_deducted` | INT | 否 | 0 | - | 使用的积分数量 |
| `coupon_id` | BIGINT | 否 | NULL | - | 使用的优惠券 ID，关联 user_coupons.id |
| `coupon_amount` | DECIMAL(10,2) | 否 | 0.00 | - | 优惠券抵扣金额 |
| `activity_discount_amount` | DECIMAL(10,2) | 否 | 0.00 | - | 活动优惠金额 |
| `receiver_name` | VARCHAR(50) | 是 | - | - | 收货人姓名（快照） |
| `receiver_phone` | VARCHAR(20) | 是 | - | - | 收货人手机号（快照） |
| `province` | VARCHAR(20) | 否 | NULL | - | 省份（快照） |
| `city` | VARCHAR(20) | 否 | NULL | - | 城市（快照） |
| `district` | VARCHAR(20) | 否 | NULL | - | 区/县（快照） |
| `detail_address` | VARCHAR(200) | 否 | NULL | - | 详细地址（快照） |
| `remark` | VARCHAR(200) | 否 | NULL | - | 买家备注 |
| `admin_remark` | VARCHAR(200) | 否 | NULL | - | 管理员备注 |
| `paid_at` | DATETIME | 否 | NULL | - | 支付时间 |
| `delivered_at` | DATETIME | 否 | NULL | - | 发货时间 |
| `completed_at` | DATETIME | 否 | NULL | - | 完成时间 |
| `cancelled_at` | DATETIME | 否 | NULL | - | 取消时间 |
| `cancel_reason` | VARCHAR(200) | 否 | NULL | - | 取消原因 |
| `auto_close_at` | DATETIME | 否 | NULL | - | 自动关闭时间（未付款超时） |
| `auto_complete_at` | DATETIME | 否 | NULL | - | 自动完成时间（发货后 N 天自动确认收货） |
| `source` | VARCHAR(20) | 否 | miniprogram | - | 订单来源：miniprogram/admin |
| `created_at` | DATETIME | 是 | CURRENT_TIMESTAMP | idx_created_at | 创建时间 |
| `updated_at` | DATETIME | 是 | CURRENT_TIMESTAMP ON UPDATE | - | 更新时间 |

**索引详情：**

| 索引名 | 类型 | 字段 |
|--------|------|------|
| `uk_order_no` | UNIQUE | `order_no` |
| `idx_user_id` | NORMAL | `user_id` |
| `idx_status` | NORMAL | `status` |
| `idx_created_at` | NORMAL | `created_at` |
| `idx_paid_at` | NORMAL | `paid_at` |

**订单状态流转：**

```
pending_payment → paid → pending_delivery → delivered → completed
     ↓               ↓          ↓              ↓
  cancelled      cancelled   aftersale      aftersale
```

**业务规则：**

- `auto_close_at`：下单后 30 分钟未付款自动关闭
- `auto_complete_at`：发货后 15 天自动确认收货
- 收货地址信息在下单时做快照，后续修改地址不影响已下订单

---

### 7.3 order_items 订单商品表

订单商品明细，所有商品信息在下单时做快照，与商品主表解耦。

| 字段名 | 类型 | 必填 | 默认值 | 索引 | 说明 |
|--------|------|------|--------|------|------|
| `id` | BIGINT | 是 | AUTO_INCREMENT | PRIMARY | 主键 |
| `order_id` | BIGINT | 是 | - | idx_order_id | 订单 ID，关联 orders.id |
| `product_id` | BIGINT | 是 | - | idx_product_id | 商品 ID（关联用，非快照） |
| `sku_id` | BIGINT | 是 | - | - | SKU ID（关联用，非快照） |
| `product_name` | VARCHAR(200) | 是 | - | - | 商品名称（快照） |
| `sku_specs` | JSON | 否 | NULL | - | 规格信息快照，如 `{"颜色":"白色","尺码":"M"}` |
| `product_image` | VARCHAR(500) | 否 | NULL | - | 商品图片 URL（快照） |
| `price` | DECIMAL(10,2) | 是 | - | - | 单价（快照） |
| `original_price` | DECIMAL(10,2) | 否 | NULL | - | 原价（快照） |
| `quantity` | INT | 是 | - | - | 购买数量 |
| `subtotal` | DECIMAL(10,2) | 是 | - | - | 小计 = price × quantity |
| `activity_id` | BIGINT | 否 | NULL | - | 活动 ID，关联 activities.id |
| `activity_type` | VARCHAR(20) | 否 | NULL | - | 活动类型：flash_sale/full_reduction/full_gift/combo |
| `activity_discount` | DECIMAL(10,2) | 否 | 0.00 | - | 活动优惠金额 |
| `supplier_id` | BIGINT | 否 | NULL | idx_supplier_id | 供应商 ID，用于采购结算参考 |
| `created_at` | DATETIME | 是 | CURRENT_TIMESTAMP | - | 创建时间 |

**索引详情：**

| 索引名 | 类型 | 字段 |
|--------|------|------|
| `idx_order_id` | NORMAL | `order_id` |
| `idx_product_id` | NORMAL | `product_id` |
| `idx_supplier_id` | NORMAL | `supplier_id` |

---

### 7.4 order_payments 订单支付表

支付记录表，记录每笔订单的支付信息和微信支付回调数据。

| 字段名 | 类型 | 必填 | 默认值 | 索引 | 说明 |
|--------|------|------|--------|------|------|
| `id` | BIGINT | 是 | AUTO_INCREMENT | PRIMARY | 主键 |
| `order_id` | BIGINT | 是 | - | idx_order_id | 订单 ID，关联 orders.id |
| `payment_no` | VARCHAR(64) | 否 | NULL | uk_payment_no | 支付流水号（系统生成） |
| `transaction_id` | VARCHAR(64) | 否 | NULL | idx_transaction_id | 微信支付交易号（回调获取） |
| `amount` | DECIMAL(10,2) | 是 | - | - | 支付金额 |
| `payment_method` | VARCHAR(20) | 否 | wechat | - | 支付方式：wechat（微信支付） |
| `status` | TINYINT | 否 | 1 | - | 支付状态：1=待支付，2=成功，3=失败，4=已退款 |
| `paid_at` | DATETIME | 否 | NULL | - | 支付成功时间 |
| `raw_response` | JSON | 否 | NULL | - | 微信支付回调原始数据，用于对账和排查 |
| `created_at` | DATETIME | 是 | CURRENT_TIMESTAMP | - | 创建时间 |
| `updated_at` | DATETIME | 是 | CURRENT_TIMESTAMP ON UPDATE | - | 更新时间 |

**索引详情：**

| 索引名 | 类型 | 字段 |
|--------|------|------|
| `idx_order_id` | NORMAL | `order_id` |
| `uk_payment_no` | UNIQUE | `payment_no` |
| `idx_transaction_id` | UNIQUE | `transaction_id` |

---

### 7.5 order_refunds 退款记录表

| 字段 | 类型 | 说明 |
|------|------|------|
| id | bigint | 主键，自增 |
| refund_no | varchar(64) | 退款单号（系统生成），唯一索引 uk_refund_no |
| order_id | bigint | 关联订单 ID |
| aftersale_id | bigint | 关联售后单 ID（可空） |
| payment_id | bigint | 关联支付记录 ID（可空） |
| out_trade_no | varchar(32) | 原支付商户订单号 |
| transaction_id | varchar(64) | 原支付微信交易号（可空） |
| out_refund_no | varchar(64) | 退款商户单号，唯一索引 uk_out_refund_no |
| refund_id | varchar(64) | 微信退款单号（可空） |
| refund_amount | int | 退款金额（分） |
| total_amount | int | 原订单金额（分） |
| status | varchar(20) | 退款状态，默认 pending |
| reason | varchar(200) | 退款原因（可空） |
| raw_request | json | 原始请求（可空） |
| raw_response | json | 原始响应（可空） |
| notified_at | datetime | 回调通知时间（可空） |
| created_at | datetime | 创建时间 |
| updated_at | datetime | 更新时间 |

索引：
- uk_refund_no: refund_no 唯一索引
- uk_out_refund_no: out_refund_no 唯一索引
- idx_order_id: order_id 普通索引
- idx_aftersale_id: aftersale_id 普通索引
- idx_status: status 普通索引
- idx_refund_id: refund_id 普通索引

退款状态（status 字段）取值：
| 状态值 | 说明 |
|--------|------|
| pending | 已发起，等待微信处理 |
| processing | 微信处理中 |
| success | 退款成功 |
| failed | 退款失败 |
| closed | 退款关闭 |
| abnormal | 退款异常 |

---

### 7.6 order_delivery 订单物流表

订单物流信息，支持物流轨迹查询。

| 字段名 | 类型 | 必填 | 默认值 | 索引 | 说明 |
|--------|------|------|--------|------|------|
| `id` | BIGINT | 是 | AUTO_INCREMENT | PRIMARY | 主键 |
| `order_id` | BIGINT | 是 | - | idx_order_id | 订单 ID，关联 orders.id |
| `logistics_company` | VARCHAR(50) | 否 | NULL | - | 物流公司名称 |
| `logistics_no` | VARCHAR(50) | 否 | NULL | idx_logistics_no | 物流单号 |
| `delivery_images` | JSON | 否 | NULL | - | 发货凭证图片数组 |
| `delivered_at` | DATETIME | 否 | NULL | - | 发货时间 |
| `received_at` | DATETIME | 否 | NULL | - | 签收时间 |
| `logistics_info` | JSON | 否 | NULL | - | 物流轨迹信息，从第三方物流 API 获取并缓存 |
| `created_at` | DATETIME | 是 | CURRENT_TIMESTAMP | - | 创建时间 |
| `updated_at` | DATETIME | 是 | CURRENT_TIMESTAMP ON UPDATE | - | 更新时间 |

**索引详情：**

| 索引名 | 类型 | 字段 |
|--------|------|------|
| `idx_order_id` | NORMAL | `order_id` |
| `idx_logistics_no` | NORMAL | `logistics_no` |

---

### 7.7 order_logs 订单操作日志表

订单全生命周期操作记录，用于客服查询和问题排查。

| 字段名 | 类型 | 必填 | 默认值 | 索引 | 说明 |
|--------|------|------|--------|------|------|
| `id` | BIGINT | 是 | AUTO_INCREMENT | PRIMARY | 主键 |
| `order_id` | BIGINT | 是 | - | idx_order_id | 订单 ID，关联 orders.id |
| `operator_type` | VARCHAR(10) | 否 | NULL | - | 操作者类型：user/admin/system |
| `operator_id` | BIGINT | 否 | NULL | - | 操作者 ID |
| `action` | VARCHAR(30) | 是 | - | - | 操作类型：create/pay/deliver/confirm_receive/cancel/apply_aftersale 等 |
| `content` | TEXT | 否 | NULL | - | 操作内容描述 |
| `created_at` | DATETIME | 是 | CURRENT_TIMESTAMP | idx_created_at | 创建时间 |

**索引详情：**

| 索引名 | 类型 | 字段 |
|--------|------|------|
| `idx_order_id` | NORMAL | `order_id` |
| `idx_created_at` | NORMAL | `created_at` |

---

## 8. 营销相关表

### 8.1 coupons 优惠券模板表

优惠券模板定义，支持满减券、折扣券、无门槛券三种类型。

| 字段名 | 类型 | 必填 | 默认值 | 索引 | 说明 |
|--------|------|------|--------|------|------|
| `id` | BIGINT | 是 | AUTO_INCREMENT | PRIMARY | 主键 |
| `name` | VARCHAR(50) | 是 | - | - | 优惠券名称，如"满100减20" |
| `type` | TINYINT | 是 | - | idx_type | 类型：1=满减券，2=折扣券，3=无门槛券 |
| `value` | DECIMAL(10,2) | 是 | - | - | 优惠值：满减券为减免金额，折扣券为折扣率（如 0.85 表示 85 折） |
| `min_amount` | DECIMAL(10,2) | 否 | 0.00 | - | 最低使用金额（满减门槛），0 表示无门槛 |
| `discount_limit` | DECIMAL(10,2) | 否 | NULL | - | 折扣券最高优惠金额，防止折扣过大 |
| `total_count` | INT | 否 | 0 | - | 发放总量，0 表示不限量 |
| `received_count` | INT | 否 | 0 | - | 已领取数量 |
| `used_count` | INT | 否 | 0 | - | 已使用数量 |
| `per_limit` | INT | 否 | 1 | - | 每人限领数量 |
| `start_time` | DATETIME | 是 | - | idx_start_time | 活动开始时间 |
| `end_time` | DATETIME | 是 | - | idx_end_time | 活动结束时间 |
| `valid_days` | INT | 否 | 0 | - | 领取后有效天数，0 表示按 start_time/end_time |
| `applicable_type` | TINYINT | 否 | 1 | - | 适用范围：1=全场，2=指定分类，3=指定商品 |
| `applicable_ids` | JSON | 否 | NULL | - | 适用分类/商品 ID 列表，applicable_type 为 2 或 3 时有效 |
| `member_level_id` | BIGINT | 否 | NULL | - | 限制会员等级 ID，NULL 或 0 表示不限 |
| `is_new_user` | TINYINT | 否 | 0 | - | 是否新人专属：1=是，0=否 |
| `status` | TINYINT | 否 | 1 | idx_status | 状态：1=启用，2=禁用 |
| `created_at` | DATETIME | 是 | CURRENT_TIMESTAMP | - | 创建时间 |
| `updated_at` | DATETIME | 是 | CURRENT_TIMESTAMP ON UPDATE | - | 更新时间 |

**索引详情：**

| 索引名 | 类型 | 字段 |
|--------|------|------|
| `idx_type` | NORMAL | `type` |
| `idx_status` | NORMAL | `status` |
| `idx_start_time` | NORMAL | `start_time` |
| `idx_end_time` | NORMAL | `end_time` |

---

### 8.2 user_coupons 用户优惠券表

用户领取的优惠券实例，记录领取、使用、过期状态。

| 字段名 | 类型 | 必填 | 默认值 | 索引 | 说明 |
|--------|------|------|--------|------|------|
| `id` | BIGINT | 是 | AUTO_INCREMENT | PRIMARY | 主键 |
| `user_id` | BIGINT | 是 | - | idx_user_id | 用户 ID，关联 users.id |
| `coupon_id` | BIGINT | 是 | - | idx_coupon_id | 优惠券模板 ID，关联 coupons.id |
| `status` | TINYINT | 否 | 1 | idx_status | 状态：1=未使用，2=已使用，3=已过期 |
| `used_order_id` | BIGINT | 否 | NULL | - | 使用的订单 ID |
| `used_at` | DATETIME | 否 | NULL | - | 使用时间 |
| `expire_at` | DATETIME | 否 | NULL | idx_expire_at | 过期时间 |
| `created_at` | DATETIME | 是 | CURRENT_TIMESTAMP | - | 创建时间（领取时间） |
| `updated_at` | DATETIME | 是 | CURRENT_TIMESTAMP ON UPDATE | - | 更新时间 |

**索引详情：**

| 索引名 | 类型 | 字段 |
|--------|------|------|
| `idx_user_id` | NORMAL | `user_id` |
| `idx_coupon_id` | NORMAL | `coupon_id` |
| `idx_status` | NORMAL | `status` |
| `idx_expire_at` | NORMAL | `expire_at` |

**业务规则：**

- 领取时计算 `expire_at`：若优惠券 `valid_days > 0`，则 `expire_at = NOW() + valid_days 天`；否则取优惠券的 `end_time`
- 定时任务每日扫描并标记过期优惠券

---

### 8.3 activities 活动表

营销活动定义，支持限时折扣、满减、满赠、组合套餐、新人礼包等多种活动类型。

| 字段名 | 类型 | 必填 | 默认值 | 索引 | 说明 |
|--------|------|------|--------|------|------|
| `id` | BIGINT | 是 | AUTO_INCREMENT | PRIMARY | 主键 |
| `name` | VARCHAR(100) | 是 | - | - | 活动名称 |
| `type` | VARCHAR(20) | 是 | - | idx_type | 活动类型：flash_sale（限时折扣）/full_reduction（满减）/full_gift（满赠）/combo（组合套餐）/new_user_gift（新人礼包） |
| `description` | TEXT | 否 | NULL | - | 活动描述 |
| `rules` | JSON | 否 | NULL | - | 活动规则 JSON，不同类型结构不同 |
| `banner_image` | VARCHAR(500) | 否 | NULL | - | 活动 Banner 图片 URL |
| `start_time` | DATETIME | 是 | - | idx_start_time | 活动开始时间 |
| `end_time` | DATETIME | 是 | - | idx_end_time | 活动结束时间 |
| `status` | TINYINT | 否 | 1 | idx_status | 状态：1=未开始，2=进行中，3=已结束，4=已停用 |
| `sort_order` | INT | 否 | 0 | - | 排序序号 |
| `created_at` | DATETIME | 是 | CURRENT_TIMESTAMP | - | 创建时间 |
| `updated_at` | DATETIME | 是 | CURRENT_TIMESTAMP ON UPDATE | - | 更新时间 |

**索引详情：**

| 索引名 | 类型 | 字段 |
|--------|------|------|
| `idx_type` | NORMAL | `type` |
| `idx_status` | NORMAL | `status` |
| `idx_start_time` | NORMAL | `start_time` |
| `idx_end_time` | NORMAL | `end_time` |

**rules JSON 结构示例：**

```json
// flash_sale 限时折扣
{
  "time_slots": ["10:00", "14:00", "20:00"],
  "limit_per_user": 1
}

// full_reduction 满减
{
  "rules": [
    {"min_amount": 100, "discount": 20},
    {"min_amount": 200, "discount": 50}
  ]
}

// full_gift 满赠
{
  "min_amount": 150,
  "gift_product_id": 100,
  "gift_sku_id": 200
}

// combo 组合优惠
{
  "combo_discount": 0.9
}

// new_user_gift 新人礼包
{
  "coupon_ids": [1, 2, 3],
  "points": 100
}
```

---

### 8.4 activity_products 活动商品关联表

活动与商品的关联关系，记录活动价格、库存和限购信息。

| 字段名 | 类型 | 必填 | 默认值 | 索引 | 说明 |
|--------|------|------|--------|------|------|
| `id` | BIGINT | 是 | AUTO_INCREMENT | PRIMARY | 主键 |
| `activity_id` | BIGINT | 是 | - | idx_activity_id | 活动 ID，关联 activities.id |
| `product_id` | BIGINT | 是 | - | idx_product_id | 商品 ID，关联 products.id |
| `sku_id` | BIGINT | 否 | 0 | - | SKU ID，0 表示该商品全部 SKU 参与活动 |
| `activity_price` | DECIMAL(10,2) | 否 | NULL | - | 活动价格 |
| `activity_stock` | INT | 否 | NULL | - | 活动库存（独立于商品库存） |
| `activity_sales` | INT | 否 | 0 | - | 活动销量 |
| `limit_per_user` | INT | 否 | 0 | - | 每人限购数量，0 表示不限 |
| `sort_order` | INT | 否 | 0 | - | 排序序号 |
| `created_at` | DATETIME | 是 | CURRENT_TIMESTAMP | - | 创建时间 |
| `updated_at` | DATETIME | 是 | CURRENT_TIMESTAMP ON UPDATE | - | 更新时间 |

**索引详情：**

| 索引名 | 类型 | 字段 |
|--------|------|------|
| `idx_activity_id` | NORMAL | `activity_id` |
| `idx_product_id` | NORMAL | `product_id` |

---

### 8.5 promotion_rules 促销规则表

通用促销规则定义，支持满减、满赠等规则配置。

| 字段名 | 类型 | 必填 | 默认值 | 索引 | 说明 |
|--------|------|------|--------|------|------|
| `id` | BIGINT | 是 | AUTO_INCREMENT | PRIMARY | 主键 |
| `name` | VARCHAR(100) | 是 | - | - | 规则名称，如"满200减30" |
| `type` | VARCHAR(20) | 是 | - | - | 类型：full_reduction（满减）/full_gift（满赠） |
| `conditions` | JSON | 否 | NULL | - | 规则条件，如 `[{"min_amount":100,"discount":20},{"min_amount":200,"discount":50}]` |
| `gift_product_id` | BIGINT | 否 | NULL | - | 赠品商品 ID（满赠时使用） |
| `gift_sku_id` | BIGINT | 否 | NULL | - | 赠品 SKU ID（满赠时使用） |
| `gift_stock` | INT | 否 | NULL | - | 赠品库存 |
| `start_time` | DATETIME | 否 | NULL | - | 规则生效开始时间 |
| `end_time` | DATETIME | 否 | NULL | - | 规则生效结束时间 |
| `status` | TINYINT | 否 | 1 | - | 状态：1=启用，2=禁用 |
| `created_at` | DATETIME | 是 | CURRENT_TIMESTAMP | - | 创建时间 |
| `updated_at` | DATETIME | 是 | CURRENT_TIMESTAMP ON UPDATE | - | 更新时间 |

---

### 8.6 banners Banner 表

首页及各页面 Banner 管理，支持定时上下线和多种跳转类型。

| 字段名 | 类型 | 必填 | 默认值 | 索引 | 说明 |
|--------|------|------|--------|------|------|
| `id` | BIGINT | 是 | AUTO_INCREMENT | PRIMARY | 主键 |
| `title` | VARCHAR(100) | 否 | NULL | - | Banner 标题（后台标识用） |
| `image` | VARCHAR(500) | 是 | - | - | 图片 URL |
| `link_type` | TINYINT | 否 | NULL | - | 跳转类型：1=商品详情，2=分类页，3=活动页，4=自定义页面，5=无跳转 |
| `link_value` | VARCHAR(200) | 否 | NULL | - | 跳转值，如商品 ID、分类 ID、活动 ID 或自定义 URL |
| `sort_order` | INT | 否 | 0 | idx_sort_order | 排序序号 |
| `status` | TINYINT | 否 | 1 | idx_status | 状态：1=启用，2=禁用 |
| `start_time` | DATETIME | 否 | NULL | - | 展示开始时间，NULL 表示立即展示 |
| `end_time` | DATETIME | 否 | NULL | - | 展示结束时间，NULL 表示永久展示 |
| `created_at` | DATETIME | 是 | CURRENT_TIMESTAMP | - | 创建时间 |
| `updated_at` | DATETIME | 是 | CURRENT_TIMESTAMP ON UPDATE | - | 更新时间 |

**索引详情：**

| 索引名 | 类型 | 字段 |
|--------|------|------|
| `idx_sort_order` | NORMAL | `sort_order` |
| `idx_status` | NORMAL | `status` |

---

### 8.7 home_sections 首页模块配置表

首页各模块的配置和排序，支持灵活调整首页布局。

| 字段名 | 类型 | 必填 | 默认值 | 索引 | 说明 |
|--------|------|------|--------|------|------|
| `id` | BIGINT | 是 | AUTO_INCREMENT | PRIMARY | 主键 |
| `type` | VARCHAR(20) | 是 | - | - | 模块类型：banner/quick_nav/recommend/hot/new/age_recommend/activity |
| `title` | VARCHAR(50) | 否 | NULL | - | 模块标题，如"为你推荐""热门商品" |
| `config` | JSON | 否 | NULL | - | 模块配置 JSON，如 `{"count":10,"category_id":5}` |
| `sort_order` | INT | 否 | 0 | idx_sort_order | 排序序号，决定模块在首页的展示顺序 |
| `status` | TINYINT | 否 | 1 | idx_status | 状态：1=启用，2=禁用 |
| `created_at` | DATETIME | 是 | CURRENT_TIMESTAMP | - | 创建时间 |
| `updated_at` | DATETIME | 是 | CURRENT_TIMESTAMP ON UPDATE | - | 更新时间 |

**索引详情：**

| 索引名 | 类型 | 字段 |
|--------|------|------|
| `idx_sort_order` | NORMAL | `sort_order` |
| `idx_status` | NORMAL | `status` |

**config JSON 结构示例：**

```json
// banner 模块
{
  "banner_ids": [1, 2, 3]
}

// quick_nav 快捷导航
{
  "items": [
    {"name": "奶粉辅食", "icon": "url", "link_type": 2, "link_value": "5"},
    {"name": "纸尿裤", "icon": "url", "link_type": 2, "link_value": "8"}
  ]
}

// recommend/hot/new 商品推荐
{
  "count": 10,
  "product_ids": [1, 2, 3]
}

// age_recommend 月龄推荐
{
  "age_range": [6, 12]
}
```

---

### 8.8 share_records 分享记录表

用户分享行为记录，用于分享积分奖励和数据统计。

| 字段名 | 类型 | 必填 | 默认值 | 索引 | 说明 |
|--------|------|------|--------|------|------|
| `id` | BIGINT | 是 | AUTO_INCREMENT | PRIMARY | 主键 |
| `user_id` | BIGINT | 是 | - | idx_user_id | 分享用户 ID，关联 users.id |
| `share_type` | VARCHAR(20) | 是 | - | idx_share_type | 分享类型：product/activity/poster |
| `share_id` | BIGINT | 否 | NULL | idx_share_id | 分享对象 ID，如商品 ID、活动 ID |
| `share_channel` | VARCHAR(20) | 否 | NULL | - | 分享渠道：wechat_friend（微信好友）/wechat_moments（朋友圈） |
| `created_at` | DATETIME | 是 | CURRENT_TIMESTAMP | - | 创建时间 |

**索引详情：**

| 索引名 | 类型 | 字段 |
|--------|------|------|
| `idx_user_id` | NORMAL | `user_id` |
| `idx_share_type` | NORMAL | `share_type` |
| `idx_share_id` | NORMAL | `share_id` |

---

## 9. 售后相关表

### 9.1 aftersale_orders 售后订单表

售后申请和处理记录，支持仅退款和退货退款两种类型。

| 字段名 | 类型 | 必填 | 默认值 | 索引 | 说明 |
|--------|------|------|--------|------|------|
| `id` | BIGINT | 是 | AUTO_INCREMENT | PRIMARY | 主键 |
| `aftersale_no` | VARCHAR(32) | 是 | - | uk_aftersale_no | 售后单号，格式如 `AS20260520150030001` |
| `order_id` | BIGINT | 是 | - | idx_order_id | 订单 ID，关联 orders.id |
| `order_item_id` | BIGINT | 是 | - | - | 订单商品 ID，关联 order_items.id |
| `user_id` | BIGINT | 是 | - | idx_user_id | 用户 ID，关联 users.id |
| `type` | TINYINT | 是 | - | - | 类型：1=仅退款，2=退货退款 |
| `reason` | VARCHAR(200) | 是 | - | - | 售后原因 |
| `description` | TEXT | 否 | NULL | - | 问题描述 |
| `images` | JSON | 否 | NULL | - | 凭证图片数组 |
| `status` | VARCHAR(20) | 是 | - | idx_status | 状态：pending_review（待审核）/approved（审核通过）/rejected（审核拒绝）/returned（已退货）/pending_refund（待退款，管理员已确认退款，等待微信退款回调）/refunded（已退款）/closed（已关闭） |
| `refund_amount` | DECIMAL(10,2) | 否 | NULL | - | 退款金额 |
| `reject_reason` | VARCHAR(200) | 否 | NULL | - | 拒绝原因 |
| `return_logistics_company` | VARCHAR(50) | 否 | NULL | - | 退货物流公司 |
| `return_logistics_no` | VARCHAR(50) | 否 | NULL | - | 退货物流单号 |
| `admin_id` | BIGINT | 否 | NULL | - | 处理管理员 ID |
| `reviewed_at` | DATETIME | 否 | NULL | - | 审核时间 |
| `refunded_at` | DATETIME | 否 | NULL | - | 退款时间 |
| `created_at` | DATETIME | 是 | CURRENT_TIMESTAMP | - | 创建时间 |
| `updated_at` | DATETIME | 是 | CURRENT_TIMESTAMP ON UPDATE | - | 更新时间 |

**索引详情：**

| 索引名 | 类型 | 字段 |
|--------|------|------|
| `uk_aftersale_no` | UNIQUE | `aftersale_no` |
| `idx_order_id` | NORMAL | `order_id` |
| `idx_user_id` | NORMAL | `user_id` |
| `idx_status` | NORMAL | `status` |

**售后状态流转：**

```
pending_review → approved → returned → pending_refund → refunded
       ↓              ↓
   rejected        rejected
       ↓
     closed
```

---

### 9.2 aftersale_logs 售后操作日志表

售后全流程操作记录。

| 字段名 | 类型 | 必填 | 默认值 | 索引 | 说明 |
|--------|------|------|--------|------|------|
| `id` | BIGINT | 是 | AUTO_INCREMENT | PRIMARY | 主键 |
| `aftersale_id` | BIGINT | 是 | - | idx_aftersale_id | 售后 ID，关联 aftersale_orders.id |
| `operator_type` | VARCHAR(10) | 否 | NULL | - | 操作者类型：user/admin/system |
| `operator_id` | BIGINT | 否 | NULL | - | 操作者 ID |
| `action` | VARCHAR(30) | 是 | - | - | 操作类型：apply/approve/reject/ship_return/confirm_return/refund/close |
| `content` | TEXT | 否 | NULL | - | 操作内容描述 |
| `created_at` | DATETIME | 是 | CURRENT_TIMESTAMP | - | 创建时间 |

**索引详情：**

| 索引名 | 类型 | 字段 |
|--------|------|------|
| `idx_aftersale_id` | NORMAL | `aftersale_id` |

---

## 10. 内容相关表

### 10.1 content_categories 内容分类表

内容（育儿知识、品牌故事等）分类管理。

| 字段名 | 类型 | 必填 | 默认值 | 索引 | 说明 |
|--------|------|------|--------|------|------|
| `id` | BIGINT | 是 | AUTO_INCREMENT | PRIMARY | 主键 |
| `name` | VARCHAR(50) | 是 | - | - | 分类名称，如"育儿知识""品牌故事" |
| `icon` | VARCHAR(500) | 否 | NULL | - | 分类图标 URL |
| `sort_order` | INT | 否 | 0 | - | 排序序号 |
| `status` | TINYINT | 否 | 1 | - | 状态：1=启用，2=禁用 |
| `created_at` | DATETIME | 是 | CURRENT_TIMESTAMP | - | 创建时间 |
| `updated_at` | DATETIME | 是 | CURRENT_TIMESTAMP ON UPDATE | - | 更新时间 |

---

### 10.2 contents 内容表

内容文章管理，支持富文本和封面图。

| 字段名 | 类型 | 必填 | 默认值 | 索引 | 说明 |
|--------|------|------|--------|------|------|
| `id` | BIGINT | 是 | AUTO_INCREMENT | PRIMARY | 主键 |
| `category_id` | BIGINT | 否 | NULL | idx_category_id | 分类 ID，关联 content_categories.id |
| `title` | VARCHAR(200) | 是 | - | - | 标题 |
| `cover_image` | VARCHAR(500) | 否 | NULL | - | 封面图 URL |
| `content` | TEXT | 是 | - | - | 正文（富文本 HTML） |
| `summary` | VARCHAR(500) | 否 | NULL | - | 摘要 |
| `view_count` | INT | 否 | 0 | - | 浏览量 |
| `sort_order` | INT | 否 | 0 | - | 排序序号 |
| `status` | TINYINT | 否 | 2 | idx_status | 状态：1=已发布，2=草稿，3=已下架 |
| `published_at` | DATETIME | 否 | NULL | idx_published_at | 发布时间 |
| `created_at` | DATETIME | 是 | CURRENT_TIMESTAMP | - | 创建时间 |
| `updated_at` | DATETIME | 是 | CURRENT_TIMESTAMP ON UPDATE | - | 更新时间 |
| `deleted_at` | DATETIME | 否 | NULL | - | 软删除时间 |

**索引详情：**

| 索引名 | 类型 | 字段 |
|--------|------|------|
| `idx_category_id` | NORMAL | `category_id` |
| `idx_status` | NORMAL | `status` |
| `idx_published_at` | NORMAL | `published_at` |

---

## 11. 后台相关表

### 11.1 admin_users 管理员表

后台管理员账号，支持多角色权限控制。

| 字段名 | 类型 | 必填 | 默认值 | 索引 | 说明 |
|--------|------|------|--------|------|------|
| `id` | BIGINT | 是 | AUTO_INCREMENT | PRIMARY | 主键 |
| `username` | VARCHAR(50) | 是 | - | uk_username | 用户名，唯一 |
| `password` | VARCHAR(200) | 是 | - | - | 密码，bcrypt 加密存储 |
| `real_name` | VARCHAR(50) | 否 | NULL | - | 真实姓名 |
| `avatar` | VARCHAR(500) | 否 | NULL | - | 头像 URL |
| `phone` | VARCHAR(20) | 否 | NULL | idx_phone | 手机号 |
| `status` | TINYINT | 否 | 1 | - | 状态：1=正常，2=禁用 |
| `last_login_at` | DATETIME | 否 | NULL | - | 最后登录时间 |
| `last_login_ip` | VARCHAR(50) | 否 | NULL | - | 最后登录 IP |
| `created_at` | DATETIME | 是 | CURRENT_TIMESTAMP | - | 创建时间 |
| `updated_at` | DATETIME | 是 | CURRENT_TIMESTAMP ON UPDATE | - | 更新时间 |
| `deleted_at` | DATETIME | 否 | NULL | - | 软删除时间 |

**索引详情：**

| 索引名 | 类型 | 字段 |
|--------|------|------|
| `uk_username` | UNIQUE | `username` |
| `idx_phone` | NORMAL | `phone` |

---

### 11.2 admin_roles 角色表

管理员角色定义，采用 RBAC 权限模型。

| 字段名 | 类型 | 必填 | 默认值 | 索引 | 说明 |
|--------|------|------|--------|------|------|
| `id` | BIGINT | 是 | AUTO_INCREMENT | PRIMARY | 主键 |
| `name` | VARCHAR(50) | 是 | - | - | 角色名称，如"超级管理员""运营""客服" |
| `code` | VARCHAR(50) | 是 | - | uk_code | 角色编码，如 `super_admin`/`operator`/`cs` |
| `description` | VARCHAR(200) | 否 | NULL | - | 角色描述 |
| `status` | TINYINT | 否 | 1 | - | 状态：1=启用，2=禁用 |
| `created_at` | DATETIME | 是 | CURRENT_TIMESTAMP | - | 创建时间 |
| `updated_at` | DATETIME | 是 | CURRENT_TIMESTAMP ON UPDATE | - | 更新时间 |

**索引详情：**

| 索引名 | 类型 | 字段 |
|--------|------|------|
| `uk_code` | UNIQUE | `code` |

---

### 11.3 admin_permissions 权限表

权限定义，支持菜单和按钮两级权限。

| 字段名 | 类型 | 必填 | 默认值 | 索引 | 说明 |
|--------|------|------|--------|------|------|
| `id` | BIGINT | 是 | AUTO_INCREMENT | PRIMARY | 主键 |
| `parent_id` | BIGINT | 否 | 0 | idx_parent_id | 父权限 ID，0 表示顶级权限 |
| `name` | VARCHAR(50) | 是 | - | - | 权限名称，如"商品管理""商品上架" |
| `code` | VARCHAR(50) | 是 | - | uk_code | 权限编码，如 `product:list`/`product:publish` |
| `type` | TINYINT | 否 | 1 | - | 类型：1=菜单，2=按钮 |
| `sort_order` | INT | 否 | 0 | - | 排序序号 |
| `created_at` | DATETIME | 是 | CURRENT_TIMESTAMP | - | 创建时间 |
| `updated_at` | DATETIME | 是 | CURRENT_TIMESTAMP ON UPDATE | - | 更新时间 |

**索引详情：**

| 索引名 | 类型 | 字段 |
|--------|------|------|
| `uk_code` | UNIQUE | `code` |
| `idx_parent_id` | NORMAL | `parent_id` |

---

### 11.4 admin_role_permissions 角色权限关联表

角色与权限的多对多关联。

| 字段名 | 类型 | 必填 | 默认值 | 索引 | 说明 |
|--------|------|------|--------|------|------|
| `id` | BIGINT | 是 | AUTO_INCREMENT | PRIMARY | 主键 |
| `role_id` | BIGINT | 是 | - | idx_role_id | 角色 ID，关联 admin_roles.id |
| `permission_id` | BIGINT | 是 | - | idx_permission_id | 权限 ID，关联 admin_permissions.id |

**索引详情：**

| 索引名 | 类型 | 字段 |
|--------|------|------|
| `idx_role_id` | NORMAL | `role_id` |
| `idx_permission_id` | NORMAL | `permission_id` |
| `uk_role_permission` | UNIQUE | `role_id, permission_id` |

---

### 11.5 admin_user_roles 管理员角色关联表

管理员与角色的多对多关联。

| 字段名 | 类型 | 必填 | 默认值 | 索引 | 说明 |
|--------|------|------|--------|------|------|
| `id` | BIGINT | 是 | AUTO_INCREMENT | PRIMARY | 主键 |
| `admin_user_id` | BIGINT | 是 | - | idx_admin_user_id | 管理员 ID，关联 admin_users.id |
| `role_id` | BIGINT | 是 | - | idx_role_id | 角色 ID，关联 admin_roles.id |

**索引详情：**

| 索引名 | 类型 | 字段 |
|--------|------|------|
| `idx_admin_user_id` | NORMAL | `admin_user_id` |
| `idx_role_id` | NORMAL | `role_id` |
| `uk_admin_role` | UNIQUE | `admin_user_id, role_id` |

---

### 11.6 admin_operation_logs 操作日志表

管理员操作审计日志，记录所有后台关键操作。

| 字段名 | 类型 | 必填 | 默认值 | 索引 | 说明 |
|--------|------|------|--------|------|------|
| `id` | BIGINT | 是 | AUTO_INCREMENT | PRIMARY | 主键 |
| `admin_user_id` | BIGINT | 是 | - | idx_admin_user_id | 管理员 ID，关联 admin_users.id |
| `module` | VARCHAR(30) | 否 | NULL | idx_module | 模块：product/order/user/coupon/activity/content/system 等 |
| `action` | VARCHAR(30) | 否 | NULL | - | 操作：create/update/delete/publish/export 等 |
| `target_type` | VARCHAR(30) | 否 | NULL | - | 对象类型：product/order/coupon 等 |
| `target_id` | BIGINT | 否 | NULL | - | 对象 ID |
| `content` | TEXT | 否 | NULL | - | 操作内容详情（变更前后对比等） |
| `ip` | VARCHAR(50) | 否 | NULL | - | IP 地址 |
| `user_agent` | VARCHAR(500) | 否 | NULL | - | User-Agent |
| `created_at` | DATETIME | 是 | CURRENT_TIMESTAMP | idx_created_at | 创建时间 |

**索引详情：**

| 索引名 | 类型 | 字段 |
|--------|------|------|
| `idx_admin_user_id` | NORMAL | `admin_user_id` |
| `idx_module` | NORMAL | `module` |
| `idx_created_at` | NORMAL | `created_at` |

---

## 12. 系统相关表

### 12.1 file_assets 文件资源表

文件上传管理，支持本地存储和云存储（腾讯云 COS / 阿里云 OSS）。

| 字段名 | 类型 | 必填 | 默认值 | 索引 | 说明 |
|--------|------|------|--------|------|------|
| `id` | BIGINT | 是 | AUTO_INCREMENT | PRIMARY | 主键 |
| `file_name` | VARCHAR(200) | 否 | NULL | - | 存储文件名（含路径） |
| `original_name` | VARCHAR(200) | 否 | NULL | - | 原始上传文件名 |
| `file_path` | VARCHAR(500) | 是 | - | - | 文件存储路径 |
| `file_size` | BIGINT | 否 | NULL | - | 文件大小（bytes） |
| `file_type` | VARCHAR(20) | 否 | NULL | idx_file_type | 文件类型：image/video/document |
| `mime_type` | VARCHAR(50) | 否 | NULL | - | MIME 类型，如 `image/jpeg` |
| `storage_type` | TINYINT | 否 | 1 | - | 存储类型：1=本地，2=腾讯云 COS，3=阿里云 OSS |
| `bucket` | VARCHAR(100) | 否 | NULL | - | 存储桶名称 |
| `url` | VARCHAR(500) | 否 | NULL | - | 访问 URL |
| `group_name` | VARCHAR(50) | 否 | NULL | idx_group_name | 分组名称，如 `product`/`banner`/`content` |
| `uploader_id` | BIGINT | 否 | NULL | idx_uploader_id | 上传者 ID |
| `uploader_type` | VARCHAR(10) | 否 | NULL | - | 上传者类型：admin/user |
| `created_at` | DATETIME | 是 | CURRENT_TIMESTAMP | - | 创建时间 |

**索引详情：**

| 索引名 | 类型 | 字段 |
|--------|------|------|
| `idx_file_type` | NORMAL | `file_type` |
| `idx_group_name` | NORMAL | `group_name` |
| `idx_uploader_id` | NORMAL | `uploader_id` |

---

### 12.2 system_configs 系统配置表

系统级配置项，采用键值对存储，支持分组管理。

| 字段名 | 类型 | 必填 | 默认值 | 索引 | 说明 |
|--------|------|------|--------|------|------|
| `id` | BIGINT | 是 | AUTO_INCREMENT | PRIMARY | 主键 |
| `group_name` | VARCHAR(30) | 是 | - | uk_group_key | 配置分组，如 `basic`/`payment`/`logistics`/`points` |
| `config_key` | VARCHAR(50) | 是 | - | uk_group_key | 配置键，如 `shop_name`/`points_rate` |
| `config_value` | TEXT | 否 | NULL | - | 配置值 |
| `value_type` | VARCHAR(20) | 否 | string | - | 值类型：string/number/json/boolean |
| `description` | VARCHAR(200) | 否 | NULL | - | 配置说明 |
| `created_at` | DATETIME | 是 | CURRENT_TIMESTAMP | - | 创建时间 |
| `updated_at` | DATETIME | 是 | CURRENT_TIMESTAMP ON UPDATE | - | 更新时间 |

**索引详情：**

| 索引名 | 类型 | 字段 |
|--------|------|------|
| `uk_group_key` | UNIQUE | `group_name, config_key` |

---

## 13. ER 关系图

以下用文字描述各表之间的关联关系。

### 13.1 用户域关系

```
users 1 ──── 1 user_profiles          （用户 → 资料扩展，一对一）
users 1 ──── N user_addresses         （用户 → 收货地址，一对多）
users 1 ──── N baby_profiles          （用户 → 宝宝档案，一对多）
users N ──── 1 member_levels          （用户 → 会员等级，多对一）
users 1 ──── N user_member_records    （用户 → 会员变更记录，一对多）
users 1 ──── N points_records         （用户 → 积分记录，一对多）
```

### 13.2 商品域关系

```
product_categories 1 ──── N product_categories  （分类自引用，父子关系）
product_categories 1 ──── N products            （分类 → 商品，一对多）
brands 1 ──── N products                        （品牌 → 商品，一对多）
suppliers 1 ──── N products                     （供应商 → 商品，一对多）
products 1 ──── N product_skus                  （商品 → SKU，一对多）
products 1 ──── N product_images                （商品 → 图片，一对多）
product_categories 1 ──── N product_attributes  （分类 → 属性模板，一对多）
product_skus 1 ──── N product_stock_logs        （SKU → 库存日志，一对多）
```

### 13.3 订单域关系

```
users 1 ──── N carts                           （用户 → 购物车，一对多）
users 1 ──── N orders                          （用户 → 订单，一对多）
orders 1 ──── N order_items                    （订单 → 订单商品，一对多）
orders 1 ──── 1 order_payments                 （订单 → 支付记录，一对一）
orders 1 ──── N order_refunds                  （订单 → 退款记录，一对多）
orders 1 ──── 1 order_delivery                 （订单 → 物流信息，一对一）
orders 1 ──── N order_logs                     （订单 → 操作日志，一对多）
products 1 ──── N order_items                  （商品 → 订单商品，一对多）
product_skus 1 ──── N order_items              （SKU → 订单商品，一对多）
```

### 13.4 营销域关系

```
coupons 1 ──── N user_coupons                  （优惠券模板 → 用户优惠券，一对多）
users 1 ──── N user_coupons                    （用户 → 用户优惠券，一对多）
activities 1 ──── N activity_products           （活动 → 活动商品，一对多）
products 1 ──── N activity_products             （商品 → 活动商品，一对多）
users 1 ──── N share_records                   （用户 → 分享记录，一对多）
```

### 13.5 售后域关系

```
orders 1 ──── N aftersale_orders               （订单 → 售后单，一对多）
order_items 1 ──── N aftersale_orders           （订单商品 → 售后单，一对多）
users 1 ──── N aftersale_orders                 （用户 → 售后单，一对多）
aftersale_orders 1 ──── N aftersale_logs        （售后单 → 售后日志，一对多）
```

### 13.6 内容域关系

```
content_categories 1 ──── N contents           （内容分类 → 内容，一对多）
```

### 13.7 后台域关系

```
admin_users N ──── N admin_roles                （管理员 ↔ 角色，多对多，通过 admin_user_roles）
admin_roles N ──── N admin_permissions          （角色 ↔ 权限，多对多，通过 admin_role_permissions）
admin_permissions 1 ──── N admin_permissions    （权限自引用，父子关系）
admin_users 1 ──── N admin_operation_logs       （管理员 → 操作日志，一对多）
```

### 13.8 跨域关系

```
orders ←── user_coupons          （订单使用优惠券）
orders ←── points_records        （订单获得/消耗积分）
order_items ←── activities       （订单商品关联活动）
order_items ←── suppliers        （订单商品关联供应商，用于结算）
```

---

## 14. 索引优化建议

### 14.1 索引设计原则

| 原则 | 说明 |
|------|------|
| **高频查询优先** | 优先为高频查询场景建立索引，如订单列表、商品搜索、用户查询 |
| **联合索引遵循最左前缀** | 联合索引字段顺序按区分度从高到低排列 |
| **避免冗余索引** | 已有联合索引 `(a, b)` 时，不再单独建 `a` 的索引 |
| **控制单表索引数量** | 单表索引建议不超过 8 个，避免影响写入性能 |
| **JSON 字段不建索引** | MySQL 8.0 支持 JSON 字段索引，但建议通过虚拟生成列间接索引 |

### 14.2 关键查询场景与索引

| 查询场景 | 涉及表 | 建议索引 |
|----------|--------|----------|
| 用户登录/注册 | users | `idx_openid`（UNIQUE） |
| 用户订单列表 | orders | `idx_user_id` + `idx_status` |
| 商品分类筛选 | products | `idx_category_id` + `idx_status` |
| 商品搜索 | products | 考虑引入 Elasticsearch，数据库侧 `idx_status` + `idx_sort_order` |
| 订单超时关闭 | orders | `idx_status` + `auto_close_at`（联合索引） |
| 积分过期处理 | points_records | `idx_type` + `idx_expire_at`（联合索引） |
| 优惠券过期处理 | user_coupons | `idx_status` + `idx_expire_at`（联合索引） |
| 活动商品查询 | activity_products | `idx_activity_id` + `idx_product_id` |
| 后台订单搜索 | orders | `uk_order_no` + `idx_status` + `idx_created_at` |
| 库存扣减防超卖 | product_skus | 行锁 + `PRIMARY` |

### 14.3 性能优化建议

1. **订单表分区**：当订单量超过 500 万条时，考虑按 `created_at` 做 RANGE 分区
2. **冷热数据分离**：已完成超过 6 个月的订单可归档到历史表
3. **读写分离**：后台报表查询走从库，避免影响小程序端性能
4. **缓存策略**：
   - 商品详情、分类树、Banner 等读多写少数据使用 Redis 缓存
   - 用户信息、会员等级使用 Redis 缓存，变更时同步更新
5. **JSON 字段优化**：
   - 频繁查询的 JSON 属性考虑提取为独立列
   - 如 `product_skus.specs` 中的规格值，若需按规格筛选，可创建虚拟生成列并建索引
6. **连接池配置**：Prisma 连接池建议配置 `connection_limit=10`，`pool_timeout=30`

---

## 15. 数据初始化

### 15.1 初始会员等级

| 等级名称 | 最低成长值 | 最高成长值 | 折扣率 | 积分倍率 | 排序 |
|----------|-----------|-----------|--------|---------|------|
| 普通会员 | 0 | 999 | NULL | 1.0 | 1 |
| 银卡会员 | 1000 | 4999 | 0.98 | 2.0 | 2 |
| 金卡会员 | 5000 | 19999 | 0.95 | 3.0 | 3 |
| 黑金会员 | 20000 | NULL | 0.90 | 5.0 | 4 |

### 15.2 初始管理员账号

| 用户名 | 密码 | 真实姓名 | 角色 |
|--------|------|---------|------|
| admin | （首次登录后强制修改） | 超级管理员 | super_admin |

### 15.3 初始角色

| 角色名称 | 角色编码 | 描述 |
|----------|---------|------|
| 超级管理员 | super_admin | 拥有所有权限 |
| 运营管理 | operator | 商品管理、订单管理、营销管理、内容管理 |
| 客服 | cs | 订单查看、售后处理 |
| 财务 | finance | 订单查看、退款审核、数据导出 |

### 15.4 初始系统配置

| 分组 | 配置键 | 配置值 | 值类型 | 说明 |
|------|--------|--------|--------|------|
| basic | shop_name | 禧孕母婴商城 | string | 商城名称 |
| basic | shop_logo | （Logo URL） | string | 商城 Logo |
| basic | customer_service_phone | 400-XXX-XXXX | string | 客服电话 |
| basic | icp_number | （ICP 备案号） | string | ICP 备案号 |
| payment | wechat_mch_id | （商户号） | string | 微信支付商户号 |
| payment | wechat_api_key | （API 密钥） | string | 微信支付 API 密钥 |
| payment | order_auto_close_minutes | 30 | number | 未付款订单自动关闭时间（分钟） |
| logistics | order_auto_complete_days | 15 | number | 发货后自动确认收货天数 |
| logistics | free_shipping_amount | 99 | number | 满额包邮金额（元） |
| logistics | default_freight | 10 | number | 默认运费（元） |
| points | points_rate | 1 | number | 消费 1 元获得积分数 |
| points | points_expire_months | 12 | number | 积分有效月数 |
| points | sign_in_points | 5 | number | 每日签到积分 |
| points | share_points | 3 | number | 分享获得积分 |
| points | profile_complete_points | 50 | number | 完善资料奖励积分 |
| points | points_deduct_rate | 100 | number | 积分抵扣比率（100 积分 = 1 元） |
| points | points_deduct_max_percent | 30 | number | 积分最多抵扣订单金额百分比 |

### 15.5 初始权限数据

| 权限名称 | 权限编码 | 类型 | 父权限 | 排序 |
|----------|---------|------|--------|------|
| 首页 | dashboard | 菜单 | 0 | 1 |
| 商品管理 | product | 菜单 | 0 | 2 |
| 商品列表 | product:list | 菜单 | product | 1 |
| 新增商品 | product:create | 按钮 | product:list | 1 |
| 编辑商品 | product:update | 按钮 | product:list | 2 |
| 删除商品 | product:delete | 按钮 | product:list | 3 |
| 上架/下架 | product:publish | 按钮 | product:list | 4 |
| 分类管理 | product:category | 菜单 | product | 2 |
| 品牌管理 | product:brand | 菜单 | product | 3 |
| 供应商管理 | product:supplier | 菜单 | product | 4 |
| 订单管理 | order | 菜单 | 0 | 3 |
| 订单列表 | order:list | 菜单 | order | 1 |
| 订单发货 | order:deliver | 按钮 | order:list | 1 |
| 订单备注 | order:remark | 按钮 | order:list | 2 |
| 取消订单 | order:cancel | 按钮 | order:list | 3 |
| 售后管理 | order:aftersale | 菜单 | order | 2 |
| 审核售后 | order:aftersale:review | 按钮 | order:aftersale | 1 |
| 退款 | order:aftersale:refund | 按钮 | order:aftersale | 2 |
| 用户管理 | user | 菜单 | 0 | 4 |
| 用户列表 | user:list | 菜单 | user | 1 |
| 会员等级 | user:member_level | 菜单 | user | 2 |
| 积分管理 | user:points | 菜单 | user | 3 |
| 营销管理 | marketing | 菜单 | 0 | 5 |
| 优惠券管理 | marketing:coupon | 菜单 | marketing | 1 |
| 活动管理 | marketing:activity | 菜单 | marketing | 2 |
| Banner 管理 | marketing:banner | 菜单 | marketing | 3 |
| 首页配置 | marketing:home | 菜单 | marketing | 4 |
| 内容管理 | content | 菜单 | 0 | 6 |
| 内容列表 | content:list | 菜单 | content | 1 |
| 内容分类 | content:category | 菜单 | content | 2 |
| 系统设置 | system | 菜单 | 0 | 7 |
| 系统配置 | system:config | 菜单 | system | 1 |
| 管理员管理 | system:admin | 菜单 | system | 2 |
| 角色权限 | system:role | 菜单 | system | 3 |
| 文件管理 | system:file | 菜单 | system | 4 |
| 操作日志 | system:log | 菜单 | system | 5 |

---

> **文档结束**
>
> 本文档定义了禧孕母婴用品私域商城小程序的全部数据库表结构。后续如有表结构变更，需同步更新本文档，并记录变更原因和日期。建议配合 Prisma Schema 文件一起维护，确保文档与代码一致。
