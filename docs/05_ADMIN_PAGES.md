# 禧孕母婴用品私域商城小程序 - 管理后台页面设计文档

## 1. 文档概述

| 项目 | 说明 |
|------|------|
| 项目名称 | 禧孕母婴用品私域商城小程序 |
| 运营方 | 禧孕文化传媒有限公司 |
| 业务模式 | 甲方自营商城 |
| 文档版本 | v1.0 |
| 技术栈 | Vue3 + Vite + TypeScript + Element Plus |
| 文档用途 | 定义管理后台所有页面的路径、组件、交互、接口及状态等详细设计 |

本文档对管理后台全部页面进行逐页详细设计，覆盖页面路径、页面用途、核心组件、用户操作、调用接口、页面状态、异常情况、空状态八个维度，为前端开发与后端联调提供统一规范。

---

## 2. 页面总览

| 序号 | 页面路径 | 页面名称 | 所属菜单 | 所需权限 |
|------|----------|----------|----------|----------|
| 1 | /login | 登录页 | - | 无 |
| 2 | /dashboard | 工作台 | 首页 | dashboard:view |
| 3 | /product/list | 商品列表 | 商品管理 | product:list |
| 4 | /product/edit | 商品新增/编辑 | 商品管理 | product:create / product:update |
| 5 | /product/category | 商品分类 | 商品管理 | product:category |
| 6 | /product/brand | 品牌管理 | 商品管理 | product:brand |
| 7 | /supplier/list | 供应商管理 | 商品管理 | supplier:list |
| 8 | /product/stock | 库存管理 | 商品管理 | product:stock |
| 9 | /order/list | 订单列表 | 订单管理 | order:list |
| 10 | /order/detail/:id | 订单详情 | 订单管理 | order:detail |
| 11 | /order/delivery | 发货处理 | 订单管理 | order:delivery |
| 12 | /order/aftersale | 售后列表 | 订单管理 | order:aftersale |
| 13 | /order/aftersale-detail/:id | 售后详情 | 订单管理 | order:aftersale-detail |
| 14 | /user/list | 用户列表 | 用户管理 | user:list |
| 15 | /user/detail/:id | 用户详情 | 用户管理 | user:detail |
| 16 | /user/member-level | 会员等级 | 用户管理 | user:member-level |
| 17 | /user/points-rule | 积分规则 | 用户管理 | user:points-rule |
| 18 | /marketing/coupon-list | 优惠券列表 | 营销管理 | marketing:coupon |
| 19 | /marketing/coupon-edit | 优惠券新增/编辑 | 营销管理 | marketing:coupon-create / marketing:coupon-update |
| 20 | /marketing/activity-list | 活动列表 | 营销管理 | marketing:activity |
| 21 | /marketing/activity-edit | 活动新增/编辑 | 营销管理 | marketing:activity-create / marketing:activity-update |
| 22 | /marketing/home-decor | 首页装修 | 营销管理 | marketing:home-decor |
| 23 | /marketing/banner | Banner 管理 | 营销管理 | marketing:banner |
| 24 | /marketing/recommendation | 推荐位管理 | 营销管理 | marketing:recommendation |
| 25 | /content/list | 内容列表 | 内容管理 | content:list |
| 26 | /content/edit | 内容新增/编辑 | 内容管理 | content:create / content:update |
| 27 | /statistics/index | 数据统计 | 数据统计 | statistics:view |
| 28 | /system/admin | 管理员管理 | 系统管理 | system:admin |
| 29 | /system/role | 角色权限 | 系统管理 | system:role |
| 30 | /system/config | 系统配置 | 系统管理 | system:config |
| 31 | /system/log | 操作日志 | 系统管理 | system:log |

---

## 3. 逐页详细设计

### 3.1 登录页

| 维度 | 说明 |
|------|------|
| 页面路径 | /login |
| 页面用途 | 管理员登录后台系统，验证身份后进入工作台 |
| 核心组件 | LoginForm、CaptchaImage |

**核心组件说明：**

- **LoginForm**：包含账号输入框、密码输入框、验证码输入框、登录按钮。支持回车键提交。密码输入框支持显示/隐藏切换。
- **CaptchaImage**：图形验证码组件，点击可刷新验证码图片，防止暴力破解。

**用户操作：**

1. 输入管理员账号（手机号或用户名）
2. 输入密码
3. 输入图形验证码
4. 点击「登录」按钮
5. 验证码图片点击可刷新

**调用接口：**

| 接口 | 方法 | 说明 | 请求参数 | 响应数据 |
|------|------|------|----------|----------|
| /api/admin/auth/captcha | GET | 获取图形验证码 | 无 | { captchaKey: string, captchaImage: base64 } |
| /api/admin/auth/login | POST | 管理员登录 | { username: string, password: string, captchaKey: string, captchaCode: string } | { token: string, userInfo: object } |

**页面状态：**

| 状态 | 说明 |
|------|------|
| 初始 | 页面加载完成，表单为空，验证码已展示 |
| 登录中 | 点击登录后按钮显示 loading，表单禁用 |
| 登录失败 | 接口返回错误，显示错误提示，验证码刷新 |

**异常情况：**

| 异常场景 | 处理方式 |
|----------|----------|
| 账号密码错误 | 提示「账号或密码错误」，刷新验证码，密码框清空并聚焦 |
| 验证码错误 | 提示「验证码错误」，刷新验证码，验证码框清空并聚焦 |
| 验证码过期 | 提示「验证码已过期，请刷新」，自动刷新验证码 |
| 账号被禁用 | 提示「该账号已被禁用，请联系超级管理员」 |
| 网络异常 | 提示「网络异常，请稍后重试」 |
| 连续登录失败 | 同一账号连续失败5次后锁定15分钟，提示「账号已锁定，请15分钟后重试」 |

**空状态：** 不适用

---

### 3.2 工作台

| 维度 | 说明 |
|------|------|
| 页面路径 | /dashboard |
| 页面用途 | 数据看板，展示关键运营指标，帮助管理员快速了解商城运营状况 |
| 核心组件 | StatCards、SalesChart、OrderChart、TopProducts、RecentOrders |

**核心组件说明：**

- **StatCards**：顶部统计卡片组，展示今日/昨日/本月关键指标，包括：销售额、订单数、新增用户数、活跃用户数。每个卡片包含数值、环比增长率、趋势箭头。
- **SalesChart**：销售额趋势图，支持折线图/柱状图切换，支持按日/周/月维度展示。
- **OrderChart**：订单趋势图，展示订单数量和金额趋势，支持多维度对比。
- **TopProducts**：热销商品排行，展示销量 Top 10 商品，包含商品图片、名称、销量、销售额。
- **RecentOrders**：最近订单列表，展示最近 10 条订单，包含订单号、用户、金额、状态、时间。

**用户操作：**

1. 切换时间范围（今日/昨日/近7天/近30天/自定义）
2. 查看销售额趋势图
3. 查看订单趋势图
4. 查看热销商品排行
5. 点击最近订单可跳转至订单详情

**调用接口：**

| 接口 | 方法 | 说明 | 请求参数 | 响应数据 |
|------|------|------|----------|----------|
| /api/admin/dashboard/stats | GET | 获取统计概览数据 | { startDate, endDate } | { todaySales, todayOrders, todayNewUsers, todayActiveUsers, salesGrowth, orderGrowth, userGrowth } |
| /api/admin/dashboard/charts | GET | 获取趋势图数据 | { startDate, endDate, dimension } | { salesData: [], orderData: [] } |
| /api/admin/dashboard/top-products | GET | 获取热销商品 | { limit: 10 } | [{ productId, productName, productImage, salesCount, salesAmount }] |
| /api/admin/dashboard/recent-orders | GET | 获取最近订单 | { limit: 10 } | [{ orderId, orderNo, userName, amount, status, createTime }] |

**页面状态：**

| 状态 | 说明 |
|------|------|
| 正常 | 数据加载完成，各模块正常展示 |
| 加载中 | 骨架屏展示，数据逐步加载 |

**异常情况：**

| 异常场景 | 处理方式 |
|----------|----------|
| 数据加载失败 | 对应模块显示「数据加载失败，点击重试」，支持局部重试 |
| 接口超时 | 提示「请求超时，请稍后重试」 |

**空状态：**

| 场景 | 展示 |
|------|------|
| 新系统无数据 | 统计卡片显示 0，图表显示空状态插画，提示「暂无数据，开始添加商品吧」 |
| 热销商品为空 | 显示空状态插画，提示「暂无销售数据」 |
| 最近订单为空 | 显示空状态插画，提示「暂无订单」 |

---

### 3.3 商品列表

| 维度 | 说明 |
|------|------|
| 页面路径 | /product/list |
| 页面用途 | 商品管理列表，查看、搜索、筛选所有商品，执行上下架、删除等操作 |
| 核心组件 | SearchForm、ProductTable、StatusTag、ActionButtons |

**核心组件说明：**

- **SearchForm**：搜索筛选表单，支持按商品名称、商品编号、分类、品牌、供应商、上下架状态筛选。支持重置。
- **ProductTable**：商品数据表格，列包含：商品图片、商品名称、分类、品牌、价格区间、库存、销量、状态、操作。支持分页、排序。
- **StatusTag**：商品状态标签，使用不同颜色区分：上架中（绿色）、已下架（灰色）、待审核（橙色）、审核拒绝（红色）。
- **ActionButtons**：操作按钮组，根据商品状态和用户权限动态展示：编辑、上架/下架、删除。

**用户操作：**

1. 输入商品名称搜索
2. 选择分类/品牌/供应商/状态筛选
3. 点击「新增商品」跳转至 /product/edit
4. 点击「编辑」跳转至 /product/edit/:id
5. 点击「上架/下架」切换商品状态（需二次确认）
6. 点击「删除」（需二次确认，仅下架商品可删除）
7. 切换分页

**调用接口：**

| 接口 | 方法 | 说明 | 请求参数 | 响应数据 |
|------|------|------|----------|----------|
| /api/admin/product/list | GET | 获取商品列表 | { page, pageSize, keyword, categoryId, brandId, supplierId, status } | { total, list: [{ id, name, image, category, brand, priceRange, stock, sales, status }] } |
| /api/admin/product/status | PUT | 修改商品状态 | { id, status } | { success: boolean } |
| /api/admin/product/delete | DELETE | 删除商品 | { id } | { success: boolean } |

**页面状态：**

| 状态 | 说明 |
|------|------|
| 正常 | 列表数据正常展示 |
| 加载中 | 表格显示 loading |

**异常情况：**

| 异常场景 | 处理方式 |
|----------|----------|
| 操作失败 | 提示具体错误信息，如「操作失败，请稍后重试」 |
| 上架商品删除 | 禁用删除按钮，hover 提示「请先下架后再删除」 |
| 批量操作部分失败 | 提示「部分操作失败，请检查后重试」 |

**空状态：**

| 场景 | 展示 |
|------|------|
| 无商品数据 | 显示空状态插画，提示「暂无商品」，提供「新增商品」按钮 |
| 搜索无结果 | 提示「未找到匹配的商品，请调整搜索条件」 |

---

### 3.4 商品新增/编辑

| 维度 | 说明 |
|------|------|
| 页面路径 | /product/edit（新增）/product/edit/:id（编辑） |
| 页面用途 | 新增或编辑商品，填写商品基本信息、SKU、图片、详情等 |
| 核心组件 | BasicInfoForm、SkuForm、ImageUpload、RichTextEditor、CategorySelect、BrandSelect、SupplierSelect |

**核心组件说明：**

- **BasicInfoForm**：商品基本信息表单，包含商品名称、副标题、商品编号（编辑时只读）、分类、品牌、供应商、排序权重。
- **SkuForm**：SKU 规格表单，支持多规格组合。可添加规格名和规格值，自动生成 SKU 矩阵。每个 SKU 包含：价格、原价、库存、SKU 图片、SKU 编码。
- **ImageUpload**：图片上传组件，支持主图和多图上传，拖拽排序，设置主图。限制图片数量（最多 9 张），单张图片不超过 5MB，支持 JPG/PNG/WEBP 格式。
- **RichTextEditor**：富文本编辑器，用于编辑商品详情，支持图文混排、表格、链接等。
- **CategorySelect**：分类级联选择器，支持二级分类选择。
- **BrandSelect**：品牌下拉选择器，支持搜索。
- **SupplierSelect**：供应商下拉选择器，支持搜索。

**用户操作：**

1. 填写商品基本信息
2. 选择商品分类、品牌、供应商
3. 配置 SKU 规格，填写各 SKU 价格和库存
4. 上传商品图片，拖拽排序，设置主图
5. 编辑商品详情（富文本）
6. 点击「保存草稿」保存为草稿
7. 点击「提交审核」提交商品审核
8. 编辑模式下加载已有商品数据

**调用接口：**

| 接口 | 方法 | 说明 | 请求参数 | 响应数据 |
|------|------|------|----------|----------|
| /api/admin/product/detail | GET | 获取商品详情（编辑时） | { id } | { id, name, subtitle, categoryId, brandId, supplierId, skus: [], images: [], detail, sort } |
| /api/admin/product/create | POST | 创建商品 | { name, subtitle, categoryId, brandId, supplierId, skus, images, detail, sort, status } | { id } |
| /api/admin/product/update | PUT | 更新商品 | { id, name, subtitle, categoryId, brandId, supplierId, skus, images, detail, sort, status } | { success: boolean } |
| /api/admin/upload/image | POST | 上传图片 | FormData: { file } | { url } |

**页面状态：**

| 状态 | 说明 |
|------|------|
| 新增 | 表单为空，页面标题显示「新增商品」 |
| 编辑 | 加载已有数据填充表单，页面标题显示「编辑商品」 |
| 保存中 | 按钮显示 loading，表单禁用 |

**异常情况：**

| 异常场景 | 处理方式 |
|----------|----------|
| 保存失败 | 提示「保存失败，请稍后重试」，保留表单数据不丢失 |
| 图片上传失败 | 提示「图片上传失败」，支持重新上传 |
| 图片格式不支持 | 提示「仅支持 JPG/PNG/WEBP 格式」 |
| 图片超过大小限制 | 提示「图片大小不能超过 5MB」 |
| 图片数量超限 | 禁用上传按钮，提示「最多上传 9 张图片」 |
| 必填项未填写 | 表单校验提示，滚动到第一个错误项 |
| 分类未选择 | 提示「请选择商品分类」 |

**空状态：** 不适用

---

### 3.5 商品分类

| 维度 | 说明 |
|------|------|
| 页面路径 | /product/category |
| 页面用途 | 管理商品分类树，支持新增、编辑、删除、排序分类 |
| 核心组件 | CategoryTree、CategoryForm、DragSort |

**核心组件说明：**

- **CategoryTree**：树形分类展示，支持展开/折叠，支持两级分类（一级分类 + 二级分类）。每个节点显示分类名称、图标、排序、操作按钮。
- **CategoryForm**：分类编辑弹窗表单，包含分类名称、分类图标、排序值、是否显示。
- **DragSort**：拖拽排序组件，支持同级分类拖拽调整顺序。

**用户操作：**

1. 查看分类树结构
2. 点击「新增一级分类」
3. 在某分类下点击「新增子分类」
4. 点击「编辑」修改分类信息
5. 点击「删除」删除分类（需二次确认）
6. 拖拽分类节点调整排序

**调用接口：**

| 接口 | 方法 | 说明 | 请求参数 | 响应数据 |
|------|------|------|----------|----------|
| /api/admin/category/tree | GET | 获取分类树 | 无 | [{ id, name, icon, sort, visible, children: [] }] |
| /api/admin/category/create | POST | 新增分类 | { name, icon, parentId, sort, visible } | { id } |
| /api/admin/category/update | PUT | 更新分类 | { id, name, icon, sort, visible } | { success: boolean } |
| /api/admin/category/delete | DELETE | 删除分类 | { id } | { success: boolean } |

**页面状态：**

| 状态 | 说明 |
|------|------|
| 正常 | 分类树正常展示 |
| 加载中 | 树显示 loading |

**异常情况：**

| 异常场景 | 处理方式 |
|----------|----------|
| 删除有商品的分类 | 提示「该分类下存在商品，无法删除，请先移除或转移商品」 |
| 删除有子分类的分类 | 提示「该分类下存在子分类，无法删除，请先删除子分类」 |
| 分类名称重复 | 提示「同级分类名称不能重复」 |

**空状态：**

| 场景 | 展示 |
|------|------|
| 无分类数据 | 显示空状态插画，提示「暂无分类」，提供「新增分类」按钮 |

---

### 3.6 品牌管理

| 维度 | 说明 |
|------|------|
| 页面路径 | /product/brand |
| 页面用途 | 管理品牌信息，维护品牌列表供商品选择 |
| 核心组件 | BrandTable、BrandForm、ImageUpload |

**核心组件说明：**

- **BrandTable**：品牌列表表格，列包含：品牌 Logo、品牌名称、品牌描述、关联商品数、排序、操作。
- **BrandForm**：品牌编辑弹窗表单，包含品牌名称、品牌 Logo、品牌描述、排序值。
- **ImageUpload**：品牌 Logo 上传，单张图片，限制 2MB，支持 JPG/PNG。

**用户操作：**

1. 查看品牌列表
2. 点击「新增品牌」打开弹窗
3. 填写品牌信息，上传 Logo
4. 点击「编辑」修改品牌信息
5. 点击「删除」删除品牌（需二次确认）

**调用接口：**

| 接口 | 方法 | 说明 | 请求参数 | 响应数据 |
|------|------|------|----------|----------|
| /api/admin/brand/list | GET | 获取品牌列表 | { page, pageSize, keyword } | { total, list: [{ id, name, logo, description, productCount, sort }] } |
| /api/admin/brand/create | POST | 新增品牌 | { name, logo, description, sort } | { id } |
| /api/admin/brand/update | PUT | 更新品牌 | { id, name, logo, description, sort } | { success: boolean } |
| /api/admin/brand/delete | DELETE | 删除品牌 | { id } | { success: boolean } |

**页面状态：**

| 状态 | 说明 |
|------|------|
| 正常 | 列表数据正常展示 |
| 加载中 | 表格显示 loading |

**异常情况：**

| 异常场景 | 处理方式 |
|----------|----------|
| 删除有商品关联的品牌 | 提示「该品牌下存在关联商品，无法删除，请先解除关联」 |
| 品牌名称重复 | 提示「品牌名称已存在」 |

**空状态：**

| 场景 | 展示 |
|------|------|
| 无品牌数据 | 显示空状态插画，提示「暂无品牌」，提供「新增品牌」按钮 |

---

### 3.7 供应商管理

| 维度 | 说明 |
|------|------|
| 页面路径 | /supplier/list |
| 页面用途 | 管理供应商信息，仅内部管理使用，供应商不登录后台 |
| 核心组件 | SupplierTable、SupplierForm |

**核心组件说明：**

- **SupplierTable**：供应商列表表格，列包含：供应商名称、联系人、联系电话、地址、关联商品数、状态、操作。
- **SupplierForm**：供应商编辑弹窗表单，包含供应商名称、联系人、联系电话、地址、备注、状态（启用/禁用）。

**用户操作：**

1. 查看供应商列表
2. 点击「新增供应商」打开弹窗
3. 填写供应商信息
4. 点击「编辑」修改供应商信息
5. 点击「删除」删除供应商（需二次确认）
6. 点击「查看关联商品」跳转至商品列表并筛选该供应商

**调用接口：**

| 接口 | 方法 | 说明 | 请求参数 | 响应数据 |
|------|------|------|----------|----------|
| /api/admin/supplier/list | GET | 获取供应商列表 | { page, pageSize, keyword } | { total, list: [{ id, name, contact, phone, address, productCount, status }] } |
| /api/admin/supplier/create | POST | 新增供应商 | { name, contact, phone, address, remark, status } | { id } |
| /api/admin/supplier/update | PUT | 更新供应商 | { id, name, contact, phone, address, remark, status } | { success: boolean } |
| /api/admin/supplier/delete | DELETE | 删除供应商 | { id } | { success: boolean } |

**页面状态：**

| 状态 | 说明 |
|------|------|
| 正常 | 列表数据正常展示 |
| 加载中 | 表格显示 loading |

**异常情况：**

| 异常场景 | 处理方式 |
|----------|----------|
| 删除有商品关联的供应商 | 提示「该供应商下存在关联商品，无法删除，请先解除关联」 |
| 供应商名称重复 | 提示「供应商名称已存在」 |

**空状态：**

| 场景 | 展示 |
|------|------|
| 无供应商数据 | 显示空状态插画，提示「暂无供应商」，提供「新增供应商」按钮 |

---

### 3.8 库存管理

| 维度 | 说明 |
|------|------|
| 页面路径 | /product/stock |
| 页面用途 | 管理商品库存，查看库存状态、调整库存、查看库存变动日志 |
| 核心组件 | StockTable、StockAdjustDialog、StockLogDialog |

**核心组件说明：**

- **StockTable**：库存列表表格，列包含：商品图片、商品名称、SKU 规格、当前库存、库存预警值、库存状态、操作。库存状态用颜色区分：充足（绿色）、偏低（橙色）、不足（红色）。
- **StockAdjustDialog**：库存调整弹窗，支持增加/减少库存，需填写调整数量和调整原因。
- **StockLogDialog**：库存变动日志弹窗，展示该 SKU 的库存变动记录，包含变动时间、变动类型（入库/出库/调整/订单扣减/售后归还）、变动数量、变动后库存、操作人。

**用户操作：**

1. 查看库存列表，支持按商品名称搜索
2. 按库存状态筛选（全部/充足/偏低/不足）
3. 点击「调整库存」打开弹窗，填写调整信息
4. 点击「查看日志」查看库存变动记录
5. 导出库存数据

**调用接口：**

| 接口 | 方法 | 说明 | 请求参数 | 响应数据 |
|------|------|------|----------|----------|
| /api/admin/stock/list | GET | 获取库存列表 | { page, pageSize, keyword, status } | { total, list: [{ id, productName, productImage, skuSpec, currentStock, warningStock, status }] } |
| /api/admin/stock/adjust | PUT | 调整库存 | { skuId, type: 'increase'/'decrease', quantity, reason } | { success: boolean } |
| /api/admin/stock/logs | GET | 获取库存日志 | { skuId, page, pageSize } | { total, list: [{ id, type, quantity, afterStock, operator, createTime }] } |

**页面状态：**

| 状态 | 说明 |
|------|------|
| 正常 | 列表数据正常展示 |
| 加载中 | 表格显示 loading |

**异常情况：**

| 异常场景 | 处理方式 |
|----------|----------|
| 调整失败 | 提示「库存调整失败，请稍后重试」 |
| 调整数量超过当前库存（减少时） | 提示「减少数量不能超过当前库存」 |
| 调整数量为 0 或负数 | 提示「调整数量必须大于 0」 |

**空状态：**

| 场景 | 展示 |
|------|------|
| 无库存记录 | 显示空状态插画，提示「暂无库存记录」 |
| 搜索无结果 | 提示「未找到匹配的库存记录」 |

---

### 3.9 订单列表

| 维度 | 说明 |
|------|------|
| 页面路径 | /order/list |
| 页面用途 | 管理所有订单，查看、搜索、筛选、导出订单 |
| 核心组件 | OrderSearch、OrderTable、StatusFilter、ExportButton |

**核心组件说明：**

- **OrderSearch**：订单搜索表单，支持按订单号、用户手机号、下单时间范围搜索。
- **OrderTable**：订单数据表格，列包含：订单号、用户信息、商品摘要、订单金额、支付方式、订单状态、下单时间、操作。支持分页。
- **StatusFilter**：订单状态筛选标签组，包含：全部、待付款、待发货、待收货、已完成、已取消、已关闭。
- **ExportButton**：导出按钮，支持按当前筛选条件导出订单 Excel。

**用户操作：**

1. 输入订单号或手机号搜索
2. 选择下单时间范围
3. 点击状态标签筛选
4. 点击订单行跳转至订单详情
5. 点击「导出」下载订单 Excel

**调用接口：**

| 接口 | 方法 | 说明 | 请求参数 | 响应数据 |
|------|------|------|----------|----------|
| /api/admin/order/list | GET | 获取订单列表 | { page, pageSize, orderNo, phone, status, startDate, endDate } | { total, list: [{ id, orderNo, userName, userPhone, productSummary, totalAmount, payMethod, status, createTime }] } |
| /api/admin/order/export | GET | 导出订单 | 同 list 参数 | 文件流（Excel） |

**页面状态：**

| 状态 | 说明 |
|------|------|
| 正常 | 列表数据正常展示 |
| 加载中 | 表格显示 loading |
| 导出中 | 导出按钮显示 loading |

**异常情况：**

| 异常场景 | 处理方式 |
|----------|----------|
| 加载失败 | 提示「数据加载失败，请稍后重试」 |
| 导出失败 | 提示「导出失败，请稍后重试」 |
| 导出数据量过大 | 提示「数据量过大，请缩小时间范围后重试」 |

**空状态：**

| 场景 | 展示 |
|------|------|
| 无订单数据 | 显示空状态插画，提示「暂无订单」 |
| 搜索无结果 | 提示「未找到匹配的订单」 |

---

### 3.10 订单详情

| 维度 | 说明 |
|------|------|
| 页面路径 | /order/detail/:id |
| 页面用途 | 查看订单完整信息，执行订单状态变更操作 |
| 核心组件 | OrderInfo、UserInfo、ProductList、PriceDetail、LogisticsInfo、OrderLog、ActionButtons |

**核心组件说明：**

- **OrderInfo**：订单基本信息卡片，包含订单号、下单时间、支付时间、支付方式、订单状态、订单备注。
- **UserInfo**：下单用户信息卡片，包含用户昵称、手机号、会员等级。
- **ProductList**：订单商品列表，展示每个商品的图片、名称、SKU 规格、单价、数量、小计。
- **PriceDetail**：价格明细卡片，包含商品总额、运费、优惠券抵扣、积分抵扣、实付金额。
- **LogisticsInfo**：物流信息卡片，包含收货人、联系电话、收货地址、物流公司、物流单号、物流轨迹。
- **OrderLog**：订单操作日志时间线，记录订单状态变更历史。
- **ActionButtons**：操作按钮组，根据订单状态动态展示：取消订单、确认付款、发货、修改物流、添加备注。

**用户操作：**

1. 查看订单完整信息
2. 根据订单状态执行对应操作
3. 添加订单备注
4. 修改物流信息（已发货状态）
5. 复制订单号、收货地址

**调用接口：**

| 接口 | 方法 | 说明 | 请求参数 | 响应数据 |
|------|------|------|----------|----------|
| /api/admin/order/detail | GET | 获取订单详情 | { id } | { id, orderNo, status, userInfo, products, priceDetail, logistics, logs, remark } |
| /api/admin/order/status | PUT | 修改订单状态 | { id, status, remark } | { success: boolean } |
| /api/admin/order/remark | PUT | 添加订单备注 | { id, remark } | { success: boolean } |

**页面状态：**

| 状态 | 说明 |
|------|------|
| 待付款 | 显示「取消订单」按钮 |
| 待发货 | 显示「发货」按钮 |
| 待收货 | 显示「修改物流」按钮 |
| 已完成 | 仅查看，显示「添加备注」 |
| 已取消/已关闭 | 仅查看 |

**异常情况：**

| 异常场景 | 处理方式 |
|----------|----------|
| 订单不存在 | 提示「订单不存在」，提供返回列表按钮 |
| 状态变更失败 | 提示具体错误信息 |
| 并发操作冲突 | 提示「订单状态已变更，请刷新后重试」 |

**空状态：** 不适用

---

### 3.11 发货处理

| 维度 | 说明 |
|------|------|
| 页面路径 | /order/delivery |
| 页面用途 | 集中处理待发货订单，支持单个发货和批量发货 |
| 核心组件 | DeliveryTable、DeliveryDialog、BatchDelivery |

**核心组件说明：**

- **DeliveryTable**：待发货订单表格，列包含：订单号、用户信息、商品摘要、收货信息、下单时间、操作。支持多选。
- **DeliveryDialog**：发货弹窗，填写物流公司（下拉选择）和物流单号。支持扫码录入物流单号。
- **BatchDelivery**：批量发货功能，选中多个订单后批量录入物流信息。

**用户操作：**

1. 查看待发货订单列表
2. 点击「发货」打开弹窗，录入物流信息
3. 勾选多个订单，点击「批量发货」
4. 按收货人/下单时间搜索筛选

**调用接口：**

| 接口 | 方法 | 说明 | 请求参数 | 响应数据 |
|------|------|------|----------|----------|
| /api/admin/order/pending-delivery | GET | 获取待发货订单 | { page, pageSize, keyword } | { total, list: [{ id, orderNo, userName, userPhone, productSummary, address, createTime }] } |
| /api/admin/order/deliver | POST | 发货 | { orderId, logisticsCompany, logisticsNo } | { success: boolean } |
| /api/admin/order/batch-deliver | POST | 批量发货 | { orders: [{ orderId, logisticsCompany, logisticsNo }] } | { successCount, failCount, failList: [] } |

**页面状态：**

| 状态 | 说明 |
|------|------|
| 正常 | 列表数据正常展示 |
| 发货中 | 弹窗按钮显示 loading |

**异常情况：**

| 异常场景 | 处理方式 |
|----------|----------|
| 发货失败 | 提示「发货失败，请稍后重试」 |
| 批量发货部分失败 | 提示「成功 N 单，失败 M 单」，失败订单标红 |
| 物流单号重复 | 提示「物流单号已存在，请检查」 |

**空状态：**

| 场景 | 展示 |
|------|------|
| 无待发货订单 | 显示空状态插画，提示「暂无待发货订单」 |

---

### 3.12 售后列表

| 维度 | 说明 |
|------|------|
| 页面路径 | /order/aftersale |
| 页面用途 | 管理所有售后申请，查看、搜索、筛选 |
| 核心组件 | AftersaleTable、StatusFilter |

**核心组件说明：**

- **AftersaleTable**：售后申请列表表格，列包含：售后单号、订单号、用户信息、商品信息、售后类型（退款/退货退款/换货）、售后原因、申请金额、售后状态、申请时间、操作。
- **StatusFilter**：售后状态筛选标签组，包含：全部、待审核、审核通过、审核拒绝、处理中、已完成、已关闭。

**用户操作：**

1. 按售后单号/订单号搜索
2. 按售后状态筛选
3. 按售后类型筛选
4. 点击「查看详情」跳转至售后详情页

**调用接口：**

| 接口 | 方法 | 说明 | 请求参数 | 响应数据 |
|------|------|------|----------|----------|
| /api/admin/aftersale/list | GET | 获取售后列表 | { page, pageSize, keyword, status, type } | { total, list: [{ id, aftersaleNo, orderNo, userName, productName, type, reason, amount, status, createTime }] } |

**页面状态：**

| 状态 | 说明 |
|------|------|
| 正常 | 列表数据正常展示 |
| 加载中 | 表格显示 loading |

**异常情况：**

| 异常场景 | 处理方式 |
|----------|----------|
| 加载失败 | 提示「数据加载失败，请稍后重试」 |

**空状态：**

| 场景 | 展示 |
|------|------|
| 无售后申请 | 显示空状态插画，提示「暂无售后申请」 |
| 搜索无结果 | 提示「未找到匹配的售后申请」 |

---

### 3.13 售后详情

| 维度 | 说明 |
|------|------|
| 页面路径 | /order/aftersale-detail/:id |
| 页面用途 | 处理售后申请，审核、退款、关闭等操作 |
| 核心组件 | AftersaleInfo、UserInfo、ProductInfo、AftersaleLog、ActionButtons |

**核心组件说明：**

- **AftersaleInfo**：售后申请信息卡片，包含售后单号、售后类型、售后原因、申请金额、用户凭证图片、申请时间。
- **UserInfo**：申请用户信息卡片，包含用户昵称、手机号、会员等级。
- **ProductInfo**：售后商品信息卡片，包含商品图片、名称、SKU 规格、单价、购买数量、售后数量。
- **AftersaleLog**：售后处理日志时间线，记录审核、退款、退货等操作历史。
- **ActionButtons**：操作按钮组，根据售后状态动态展示。

**用户操作：**

1. 查看售后申请详情
2. 审核通过（待审核状态）
3. 审核拒绝，填写拒绝原因（待审核状态）
4. 确认退款（审核通过状态）
5. 关闭售后（待审核/审核通过状态）

**调用接口：**

| 接口 | 方法 | 说明 | 请求参数 | 响应数据 |
|------|------|------|----------|----------|
| /api/admin/aftersale/detail | GET | 获取售后详情 | { id } | { id, aftersaleNo, type, reason, amount, images, status, userInfo, productInfo, logs } |
| /api/admin/aftersale/approve | PUT | 审核通过 | { id } | { success: boolean } |
| /api/admin/aftersale/reject | PUT | 审核拒绝 | { id, rejectReason } | { success: boolean } |
| /api/admin/aftersale/refund | POST | 确认退款 | { id } | { success: boolean } |
| /api/admin/aftersale/close | PUT | 关闭售后 | { id, closeReason } | { success: boolean } |

**页面状态：**

| 状态 | 说明 |
|------|------|
| 待审核 | 显示「审核通过」「审核拒绝」按钮 |
| 审核通过 | 显示「确认退款」按钮（退款类型）/ 显示「确认收货并退款」按钮（退货退款类型） |
| 审核拒绝 | 仅查看 |
| 处理中 | 显示退款进度 |
| 已完成/已关闭 | 仅查看 |

**异常情况：**

| 异常场景 | 处理方式 |
|----------|----------|
| 退款失败 | 提示「退款失败，请检查支付配置后重试」 |
| 售后单不存在 | 提示「售后单不存在」，提供返回列表按钮 |
| 并发操作冲突 | 提示「售后状态已变更，请刷新后重试」 |

**空状态：** 不适用

---

### 3.14 用户列表

| 维度 | 说明 |
|------|------|
| 页面路径 | /user/list |
| 页面用途 | 管理用户，查看、搜索、筛选用户信息 |
| 核心组件 | UserSearch、UserTable |

**核心组件说明：**

- **UserSearch**：用户搜索表单，支持按昵称、手机号、会员等级、注册时间范围搜索。
- **UserTable**：用户数据表格，列包含：用户头像、昵称、手机号、会员等级、积分余额、订单数、消费总额、注册时间、操作。支持分页。

**用户操作：**

1. 输入昵称或手机号搜索
2. 按会员等级筛选
3. 按注册时间范围筛选
4. 点击「查看详情」跳转至用户详情页
5. 快速调整会员等级（弹窗选择等级）
6. 添加用户标签

**调用接口：**

| 接口 | 方法 | 说明 | 请求参数 | 响应数据 |
|------|------|------|----------|----------|
| /api/admin/user/list | GET | 获取用户列表 | { page, pageSize, keyword, memberLevel, startDate, endDate } | { total, list: [{ id, avatar, nickname, phone, memberLevel, points, orderCount, totalSpent, createTime }] } |
| /api/admin/user/adjust-level | PUT | 调整会员等级 | { userId, levelId } | { success: boolean } |
| /api/admin/user/add-tag | PUT | 添加用户标签 | { userId, tags: [] } | { success: boolean } |

**页面状态：**

| 状态 | 说明 |
|------|------|
| 正常 | 列表数据正常展示 |
| 加载中 | 表格显示 loading |

**异常情况：**

| 异常场景 | 处理方式 |
|----------|----------|
| 加载失败 | 提示「数据加载失败，请稍后重试」 |
| 调整等级失败 | 提示「操作失败，请稍后重试」 |

**空状态：**

| 场景 | 展示 |
|------|------|
| 无用户数据 | 显示空状态插画，提示「暂无用户」 |
| 搜索无结果 | 提示「未找到匹配的用户」 |

---

### 3.15 用户详情

| 维度 | 说明 |
|------|------|
| 页面路径 | /user/detail/:id |
| 页面用途 | 查看用户完整信息，包括基本信息、订单历史、会员信息、宝宝档案、积分记录 |
| 核心组件 | UserInfo、OrderHistory、MemberInfo、BabyProfiles、PointsHistory |

**核心组件说明：**

- **UserInfo**：用户基本信息卡片，包含头像、昵称、手机号、性别、注册时间、最近登录时间、用户标签。
- **OrderHistory**：用户订单历史列表，展示最近订单，支持查看全部。包含订单号、商品摘要、金额、状态、时间。
- **MemberInfo**：会员信息卡片，包含当前等级、等级名称、等级权益、升级进度、累计消费、累计积分。
- **BabyProfiles**：宝宝档案卡片，展示用户填写的宝宝信息，包含宝宝昵称、性别、出生日期、月龄。
- **PointsHistory**：积分变动记录，展示积分获取和消费记录，包含变动时间、变动类型、变动数量、变动后余额。

**用户操作：**

1. 查看用户完整信息
2. 调整会员等级
3. 查看用户订单历史
4. 查看宝宝档案
5. 查看积分变动记录
6. 添加/编辑用户标签

**调用接口：**

| 接口 | 方法 | 说明 | 请求参数 | 响应数据 |
|------|------|------|----------|----------|
| /api/admin/user/detail | GET | 获取用户详情 | { id } | { id, avatar, nickname, phone, gender, createTime, lastLoginTime, tags, memberInfo, babyProfiles } |
| /api/admin/user/orders | GET | 获取用户订单 | { userId, page, pageSize } | { total, list: [] } |
| /api/admin/user/points-history | GET | 获取积分记录 | { userId, page, pageSize } | { total, list: [] } |

**页面状态：**

| 状态 | 说明 |
|------|------|
| 正常 | 数据正常展示 |
| 加载中 | 各卡片显示 loading |

**异常情况：**

| 异常场景 | 处理方式 |
|----------|----------|
| 用户不存在 | 提示「用户不存在」，提供返回列表按钮 |

**空状态：** 不适用

---

### 3.16 会员等级

| 维度 | 说明 |
|------|------|
| 页面路径 | /user/member-level |
| 页面用途 | 配置会员等级和权益，定义等级升级条件 |
| 核心组件 | LevelTable、LevelForm |

**核心组件说明：**

- **LevelTable**：会员等级列表表格，列包含：等级图标、等级名称、升级条件（累计消费金额）、折扣比例、积分倍率、等级权益描述、操作。
- **LevelForm**：等级编辑弹窗表单，包含等级名称、等级图标、升级条件（累计消费金额下限）、折扣比例、积分倍率、权益描述。

**用户操作：**

1. 查看所有会员等级
2. 点击「编辑」修改等级条件和权益
3. 保存修改

**调用接口：**

| 接口 | 方法 | 说明 | 请求参数 | 响应数据 |
|------|------|------|----------|----------|
| /api/admin/member-level/list | GET | 获取会员等级列表 | 无 | [{ id, name, icon, minSpent, discount, pointsRate, benefits }] } |
| /api/admin/member-level/update | PUT | 更新会员等级 | { id, name, icon, minSpent, discount, pointsRate, benefits } | { success: boolean } |

**页面状态：**

| 状态 | 说明 |
|------|------|
| 正常 | 列表数据正常展示 |
| 保存中 | 按钮显示 loading |

**异常情况：**

| 异常场景 | 处理方式 |
|----------|----------|
| 保存失败 | 提示「保存失败，请稍后重试」 |
| 升级条件冲突 | 提示「升级条件不能与相邻等级重叠」 |

**空状态：** 不适用（系统预置默认等级，不可删除）

---

### 3.17 积分规则

| 维度 | 说明 |
|------|------|
| 页面路径 | /user/points-rule |
| 页面用途 | 配置积分获取和抵扣规则，以及积分过期策略 |
| 核心组件 | PointsRuleForm、PointsExpireForm |

**核心组件说明：**

- **PointsRuleForm**：积分获取规则表单，配置各行为的积分获取量，包含：消费每元获取积分、签到获取积分、评价获取积分、分享获取积分。以及积分抵扣规则：每积分抵扣金额、单笔最大抵扣比例。
- **PointsExpireForm**：积分过期规则表单，配置积分有效期（按年/按月）、过期时间点、过期提醒天数。

**用户操作：**

1. 编辑积分获取规则
2. 编辑积分抵扣规则
3. 编辑积分过期规则
4. 保存修改

**调用接口：**

| 接口 | 方法 | 说明 | 请求参数 | 响应数据 |
|------|------|------|----------|----------|
| /api/admin/points-rule/list | GET | 获取积分规则 | 无 | { earnRules: {}, deductRules: {}, expireRules: {} } |
| /api/admin/points-rule/update | PUT | 更新积分规则 | { earnRules, deductRules, expireRules } | { success: boolean } |

**页面状态：**

| 状态 | 说明 |
|------|------|
| 正常 | 表单数据正常展示 |
| 保存中 | 按钮显示 loading |

**异常情况：**

| 异常场景 | 处理方式 |
|----------|----------|
| 保存失败 | 提示「保存失败，请稍后重试」 |
| 规则值不合法 | 表单校验提示，如「积分抵扣比例不能超过 100%」 |

**空状态：** 不适用（系统预置默认规则）

---

### 3.18 优惠券列表

| 维度 | 说明 |
|------|------|
| 页面路径 | /marketing/coupon-list |
| 页面用途 | 管理优惠券，查看、新增、编辑、停用优惠券 |
| 核心组件 | CouponTable、StatusTag |

**核心组件说明：**

- **CouponTable**：优惠券列表表格，列包含：优惠券名称、类型（满减/折扣/无门槛）、面额/折扣、使用条件、发放数量、已领取/已使用、有效期、状态、操作。
- **StatusTag**：优惠券状态标签，使用不同颜色区分：进行中（绿色）、未开始（蓝色）、已结束（灰色）、已停用（红色）。

**用户操作：**

1. 查看优惠券列表
2. 点击「新增优惠券」跳转至 /marketing/coupon-edit
3. 点击「编辑」跳转至 /marketing/coupon-edit/:id
4. 点击「停用」停用进行中的优惠券（需二次确认）
5. 点击「发放记录」查看优惠券发放和使用详情

**调用接口：**

| 接口 | 方法 | 说明 | 请求参数 | 响应数据 |
|------|------|------|----------|----------|
| /api/admin/coupon/list | GET | 获取优惠券列表 | { page, pageSize, status } | { total, list: [{ id, name, type, value, condition, totalCount, receivedCount, usedCount, startDate, endDate, status }] } |
| /api/admin/coupon/status | PUT | 修改优惠券状态 | { id, status } | { success: boolean } |
| /api/admin/coupon/records | GET | 获取发放记录 | { couponId, page, pageSize } | { total, list: [] } |

**页面状态：**

| 状态 | 说明 |
|------|------|
| 正常 | 列表数据正常展示 |
| 加载中 | 表格显示 loading |

**异常情况：**

| 异常场景 | 处理方式 |
|----------|----------|
| 操作失败 | 提示具体错误信息 |
| 停用已有用户领取的优惠券 | 二次确认提示「该优惠券已有 N 人领取，停用后已领取的优惠券仍可使用，确认停用？」 |

**空状态：**

| 场景 | 展示 |
|------|------|
| 无优惠券 | 显示空状态插画，提示「暂无优惠券」，提供「新增优惠券」按钮 |

---

### 3.19 优惠券新增/编辑

| 维度 | 说明 |
|------|------|
| 页面路径 | /marketing/coupon-edit（新增）/marketing/coupon-edit/:id（编辑） |
| 页面用途 | 新增或编辑优惠券，配置优惠券类型、面额、使用规则 |
| 核心组件 | CouponForm、RuleConfig |

**核心组件说明：**

- **CouponForm**：优惠券基本信息表单，包含优惠券名称、类型选择（满减券/折扣券/无门槛券）、面额/折扣值、使用门槛金额。
- **RuleConfig**：使用规则配置，包含发放总量、每人限领数量、有效期类型（固定时间/领取后 N 天）、适用商品范围（全部商品/指定分类/指定商品）、是否与其他优惠同享。

**用户操作：**

1. 选择优惠券类型
2. 填写优惠券面额/折扣
3. 配置使用门槛
4. 设置发放规则
5. 选择适用商品范围
6. 保存

**调用接口：**

| 接口 | 方法 | 说明 | 请求参数 | 响应数据 |
|------|------|------|----------|----------|
| /api/admin/coupon/create | POST | 创建优惠券 | { name, type, value, minAmount, totalCount, perLimit, validityType, startDate, endDate, daysAfterReceive, scopeType, scopeIds, canStack } | { id } |
| /api/admin/coupon/update | PUT | 更新优惠券 | { id, ...同 create 参数 } | { success: boolean } |
| /api/admin/coupon/detail | GET | 获取优惠券详情（编辑时） | { id } | { ...优惠券完整信息 } |

**页面状态：**

| 状态 | 说明 |
|------|------|
| 新增 | 表单为空，页面标题显示「新增优惠券」 |
| 编辑 | 加载已有数据填充表单，页面标题显示「编辑优惠券」 |
| 保存中 | 按钮显示 loading |

**异常情况：**

| 异常场景 | 处理方式 |
|----------|----------|
| 保存失败 | 提示「保存失败，请稍后重试」 |
| 面额大于门槛金额 | 提示「优惠券面额不能大于使用门槛金额」 |
| 折扣值不合法 | 提示「折扣值应在 0.1-9.9 之间」 |
| 编辑已发放的优惠券 | 部分字段（类型、面额）不可修改，提示「已发放的优惠券不可修改类型和面额」 |

**空状态：** 不适用

---

### 3.20 活动列表

| 维度 | 说明 |
|------|------|
| 页面路径 | /marketing/activity-list |
| 页面用途 | 管理营销活动，查看、新增、编辑、启停活动 |
| 核心组件 | ActivityTable、StatusTag、TypeTag |

**核心组件说明：**

- **ActivityTable**：活动列表表格，列包含：活动名称、活动类型、活动时间、参与商品数、活动状态、操作。
- **StatusTag**：活动状态标签，使用不同颜色区分：进行中（绿色）、未开始（蓝色）、已结束（灰色）、已停用（红色）。
- **TypeTag**：活动类型标签，区分：限时折扣、满减活动、满赠活动、组合套餐、新人礼包。

**用户操作：**

1. 查看活动列表
2. 点击「新增活动」跳转至 /marketing/activity-edit
3. 点击「编辑」跳转至 /marketing/activity-edit/:id
4. 点击「停用/启用」切换活动状态（需二次确认）
5. 点击「查看效果」查看活动数据统计

**调用接口：**

| 接口 | 方法 | 说明 | 请求参数 | 响应数据 |
|------|------|------|----------|----------|
| /api/admin/activity/list | GET | 获取活动列表 | { page, pageSize, status, type } | { total, list: [{ id, name, type, startDate, endDate, productCount, status }] } |
| /api/admin/activity/status | PUT | 修改活动状态 | { id, status } | { success: boolean } |
| /api/admin/activity/effect | GET | 获取活动效果 | { id } | { orderCount, salesAmount, participantCount, conversionRate } |

**页面状态：**

| 状态 | 说明 |
|------|------|
| 正常 | 列表数据正常展示 |
| 加载中 | 表格显示 loading |

**异常情况：**

| 异常场景 | 处理方式 |
|----------|----------|
| 操作失败 | 提示具体错误信息 |
| 停用进行中的活动 | 二次确认提示「停用后活动将立即失效，确认停用？」 |

**空状态：**

| 场景 | 展示 |
|------|------|
| 无活动 | 显示空状态插画，提示「暂无活动」，提供「新增活动」按钮 |

---

### 3.21 活动新增/编辑

| 维度 | 说明 |
|------|------|
| 页面路径 | /marketing/activity-edit（新增）/marketing/activity-edit/:id（编辑） |
| 页面用途 | 新增或编辑活动，选择活动类型并配置规则 |
| 核心组件 | ActivityForm、TypeSelect、ProductSelect、RuleConfig |

**核心组件说明：**

- **ActivityForm**：活动基本信息表单，包含活动名称、活动时间范围、活动描述。
- **TypeSelect**：活动类型选择器，选择后动态展示对应的规则配置。
- **ProductSelect**：商品选择器，从商品列表中选择参与活动的商品，支持搜索、分类筛选。
- **RuleConfig**：活动规则配置，根据活动类型动态展示不同配置项：
  - 限时折扣：折扣比例、限购数量
  - 满减活动：满减阶梯（满 X 减 Y，支持多阶梯）
  - 限时折扣：折扣价格、活动库存、限购数量、每人限购
  - 组合套餐：套餐价格、套餐商品组合

**用户操作：**

1. 选择活动类型
2. 填写活动基本信息
3. 配置活动规则（根据类型不同）
4. 选择参与商品
5. 保存

**调用接口：**

| 接口 | 方法 | 说明 | 请求参数 | 响应数据 |
|------|------|------|----------|----------|
| /api/admin/activity/create | POST | 创建活动 | { name, type, startDate, endDate, description, rules, productIds } | { id } |
| /api/admin/activity/update | PUT | 更新活动 | { id, ...同 create 参数 } | { success: boolean } |
| /api/admin/activity/detail | GET | 获取活动详情（编辑时） | { id } | { ...活动完整信息 } |

**页面状态：**

| 状态 | 说明 |
|------|------|
| 新增 | 表单为空，页面标题显示「新增活动」 |
| 编辑 | 加载已有数据填充表单，页面标题显示「编辑活动」 |
| 保存中 | 按钮显示 loading |

**异常情况：**

| 异常场景 | 处理方式 |
|----------|----------|
| 保存失败 | 提示「保存失败，请稍后重试」 |
| 活动时间冲突 | 提示「所选商品在此时段内已参与其他活动」 |
| 折扣价格高于原价 | 提示「活动价格不能高于商品原价」 |
| 编辑进行中的活动 | 部分字段（类型、规则）不可修改，提示「进行中的活动不可修改规则」 |

**空状态：** 不适用

---

### 3.22 首页装修

| 维度 | 说明 |
|------|------|
| 页面路径 | /marketing/home-decor |
| 页面用途 | 配置小程序首页模块，通过可视化拖拽方式管理首页布局 |
| 核心组件 | ModuleList、ModuleConfig、PreviewPanel、DragSort |

**核心组件说明：**

- **ModuleList**：可用模块列表，包含：轮播图、金刚区、商品推荐、活动入口、内容卡片、公告栏、分割线。点击添加到页面。
- **ModuleConfig**：模块配置面板，选中模块后展示对应配置项。不同模块类型有不同的配置表单。
- **PreviewPanel**：手机预览面板，实时预览首页效果，模拟小程序展示。
- **DragSort**：拖拽排序，支持模块上下拖拽调整顺序。

**用户操作：**

1. 从模块列表添加模块到页面
2. 点击模块进入配置
3. 配置模块内容和样式
4. 拖拽调整模块顺序
5. 删除模块
6. 实时预览效果
7. 保存配置

**调用接口：**

| 接口 | 方法 | 说明 | 请求参数 | 响应数据 |
|------|------|------|----------|----------|
| /api/admin/home-section/list | GET | 获取首页模块配置 | 无 | [{ id, type, sort, config, visible }] } |
| /api/admin/home-section/update | PUT | 保存首页模块配置 | { sections: [{ type, sort, config, visible }] } | { success: boolean } |

**页面状态：**

| 状态 | 说明 |
|------|------|
| 正常 | 模块列表和预览正常展示 |
| 保存中 | 保存按钮显示 loading |

**异常情况：**

| 异常场景 | 处理方式 |
|----------|----------|
| 保存失败 | 提示「保存失败，请稍后重试」 |
| 模块配置不完整 | 提示「请完善模块配置」 |

**空状态：**

| 场景 | 展示 |
|------|------|
| 无模块 | 预览面板显示空状态，提示「请从左侧添加模块」 |

---

### 3.23 Banner 管理

| 维度 | 说明 |
|------|------|
| 页面路径 | /marketing/banner |
| 页面用途 | 管理首页 Banner，配置轮播图及跳转链接 |
| 核心组件 | BannerTable、BannerForm、ImageUpload、DragSort |

**核心组件说明：**

- **BannerTable**：Banner 列表表格，列包含：排序、Banner 图片、标题、跳转类型、跳转目标、状态、操作。支持拖拽排序。
- **BannerForm**：Banner 编辑弹窗表单，包含标题、Banner 图片、跳转类型（商品详情/分类页面/活动页面/外部链接/无跳转）、跳转目标、显示状态、排序值。
- **ImageUpload**：Banner 图片上传，建议尺寸 750×300px，限制 2MB，支持 JPG/PNG/WEBP。
- **DragSort**：拖拽排序组件，支持拖拽调整 Banner 展示顺序。

**用户操作：**

1. 查看 Banner 列表
2. 点击「新增 Banner」打开弹窗
3. 上传 Banner 图片
4. 配置跳转类型和目标
5. 拖拽调整排序
6. 点击「编辑」修改 Banner
7. 点击「删除」删除 Banner（需二次确认）
8. 切换显示/隐藏状态

**调用接口：**

| 接口 | 方法 | 说明 | 请求参数 | 响应数据 |
|------|------|------|----------|----------|
| /api/admin/banner/list | GET | 获取 Banner 列表 | 无 | [{ id, title, image, jumpType, jumpTarget, sort, visible }] } |
| /api/admin/banner/create | POST | 新增 Banner | { title, image, jumpType, jumpTarget, sort, visible } | { id } |
| /api/admin/banner/update | PUT | 更新 Banner | { id, title, image, jumpType, jumpTarget, sort, visible } | { success: boolean } |
| /api/admin/banner/delete | DELETE | 删除 Banner | { id } | { success: boolean } |

**页面状态：**

| 状态 | 说明 |
|------|------|
| 正常 | 列表数据正常展示 |
| 保存中 | 按钮显示 loading |

**异常情况：**

| 异常场景 | 处理方式 |
|----------|----------|
| 操作失败 | 提示具体错误信息 |
| 图片上传失败 | 提示「图片上传失败，请重新上传」 |
| 图片尺寸不符 | 提示「建议上传 750×300px 的图片以获得最佳展示效果」 |

**空状态：**

| 场景 | 展示 |
|------|------|
| 无 Banner | 显示空状态插画，提示「暂无 Banner」，提供「新增 Banner」按钮 |

---

### 3.24 推荐位管理

| 维度 | 说明 |
|------|------|
| 页面路径 | /marketing/recommendation |
| 页面用途 | 管理推荐位和推荐商品，配置首页推荐区域展示内容 |
| 核心组件 | RecommendTable、ProductSelect |

**核心组件说明：**

- **RecommendTable**：推荐位列表表格，列包含：推荐位名称、推荐位标识、关联商品数、排序、操作。
- **ProductSelect**：商品选择器，从商品列表中选择推荐商品，支持搜索、拖拽排序。

**用户操作：**

1. 查看推荐位列表
2. 点击「编辑」配置推荐位
3. 添加/移除推荐商品
4. 拖拽调整推荐商品排序
5. 保存

**调用接口：**

| 接口 | 方法 | 说明 | 请求参数 | 响应数据 |
|------|------|------|----------|----------|
| /api/admin/recommendation/list | GET | 获取推荐位列表 | 无 | [{ id, name, code, productCount, sort }] } |
| /api/admin/recommendation/update | PUT | 更新推荐位商品 | { id, productIds } | { success: boolean } |
| /api/admin/recommendation/detail | GET | 获取推荐位详情 | { id } | { id, name, code, products: [] } |

**页面状态：**

| 状态 | 说明 |
|------|------|
| 正常 | 列表数据正常展示 |
| 保存中 | 按钮显示 loading |

**异常情况：**

| 异常场景 | 处理方式 |
|----------|----------|
| 操作失败 | 提示具体错误信息 |
| 商品已下架 | 提示「该商品已下架，是否移除推荐？」 |

**空状态：**

| 场景 | 展示 |
|------|------|
| 无推荐位 | 显示空状态插画，提示「暂无推荐位」 |

---

### 3.25 内容列表

| 维度 | 说明 |
|------|------|
| 页面路径 | /content/list |
| 页面用途 | 管理育儿知识等内容文章，查看、新增、编辑、上下架 |
| 核心组件 | ContentTable、CategoryFilter |

**核心组件说明：**

- **ContentTable**：内容列表表格，列包含：封面图、标题、分类、阅读量、点赞数、发布时间、状态、操作。
- **CategoryFilter**：内容分类筛选，支持按分类筛选内容。

**用户操作：**

1. 查看内容列表
2. 按分类筛选
3. 按标题搜索
4. 点击「新增内容」跳转至 /content/edit
5. 点击「编辑」跳转至 /content/edit/:id
6. 点击「上架/下架」切换状态（需二次确认）
7. 点击「删除」删除内容（需二次确认）

**调用接口：**

| 接口 | 方法 | 说明 | 请求参数 | 响应数据 |
|------|------|------|----------|----------|
| /api/admin/content/list | GET | 获取内容列表 | { page, pageSize, keyword, categoryId, status } | { total, list: [{ id, title, coverImage, category, viewCount, likeCount, publishTime, status }] } |
| /api/admin/content/status | PUT | 修改内容状态 | { id, status } | { success: boolean } |
| /api/admin/content/delete | DELETE | 删除内容 | { id } | { success: boolean } |

**页面状态：**

| 状态 | 说明 |
|------|------|
| 正常 | 列表数据正常展示 |
| 加载中 | 表格显示 loading |

**异常情况：**

| 异常场景 | 处理方式 |
|----------|----------|
| 操作失败 | 提示具体错误信息 |

**空状态：**

| 场景 | 展示 |
|------|------|
| 无内容 | 显示空状态插画，提示「暂无内容」，提供「新增内容」按钮 |
| 搜索无结果 | 提示「未找到匹配的内容」 |

---

### 3.26 内容新增/编辑

| 维度 | 说明 |
|------|------|
| 页面路径 | /content/edit（新增）/content/edit/:id（编辑） |
| 页面用途 | 新增或编辑内容文章，编辑正文、上传封面 |
| 核心组件 | ContentForm、RichTextEditor、ImageUpload、CategorySelect |

**核心组件说明：**

- **ContentForm**：内容基本信息表单，包含标题、分类、摘要、来源。
- **RichTextEditor**：富文本编辑器，用于编辑内容正文，支持图文混排、视频嵌入、表格、链接等。
- **ImageUpload**：封面上传，单张图片，建议尺寸 750×420px，限制 2MB。
- **CategorySelect**：内容分类选择器。

**用户操作：**

1. 填写标题和分类
2. 上传封面图片
3. 编辑正文内容
4. 填写摘要
5. 点击「保存草稿」
6. 点击「发布」
7. 编辑模式下加载已有内容数据

**调用接口：**

| 接口 | 方法 | 说明 | 请求参数 | 响应数据 |
|------|------|------|----------|----------|
| /api/admin/content/create | POST | 创建内容 | { title, categoryId, coverImage, summary, content, source, status } | { id } |
| /api/admin/content/update | PUT | 更新内容 | { id, ...同 create 参数 } | { success: boolean } |
| /api/admin/content/detail | GET | 获取内容详情（编辑时） | { id } | { ...内容完整信息 } |

**页面状态：**

| 状态 | 说明 |
|------|------|
| 新增 | 表单为空，页面标题显示「新增内容」 |
| 编辑 | 加载已有数据填充表单，页面标题显示「编辑内容」 |
| 保存中 | 按钮显示 loading |

**异常情况：**

| 异常场景 | 处理方式 |
|----------|----------|
| 保存失败 | 提示「保存失败，请稍后重试」 |
| 封面上传失败 | 提示「封面上传失败，请重新上传」 |
| 正文图片上传失败 | 提示「图片上传失败」，支持重新上传 |

**空状态：** 不适用

---

### 3.27 数据统计

| 维度 | 说明 |
|------|------|
| 页面路径 | /statistics/index |
| 页面用途 | 数据统计分析，多维度查看商城运营数据 |
| 核心组件 | DateRangePicker、SalesChart、ProductRankChart、UserGrowthChart、ActivityEffectChart |

**核心组件说明：**

- **DateRangePicker**：日期范围选择器，支持快捷选项（近7天/近30天/近90天/自定义）。
- **SalesChart**：销售额统计图，支持折线图/柱状图切换，展示销售额和订单数趋势。
- **ProductRankChart**：商品排行图，展示销量 Top 10 和销售额 Top 10 商品。
- **UserGrowthChart**：用户增长图，展示新增用户、活跃用户趋势。
- **ActivityEffectChart**：活动效果图，展示各活动的参与人数、销售额、转化率对比。

**用户操作：**

1. 选择时间范围
2. 切换统计维度（日/周/月）
3. 查看各图表数据
4. 导出报表（Excel）

**调用接口：**

| 接口 | 方法 | 说明 | 请求参数 | 响应数据 |
|------|------|------|----------|----------|
| /api/admin/statistics/sales | GET | 获取销售统计 | { startDate, endDate, dimension } | { chartData: [], summary: {} } |
| /api/admin/statistics/products | GET | 获取商品统计 | { startDate, endDate, sortBy, limit } | { topBySales: [], topByAmount: [] } |
| /api/admin/statistics/users | GET | 获取用户统计 | { startDate, endDate, dimension } | { newUsers: [], activeUsers: [] } |
| /api/admin/statistics/activities | GET | 获取活动统计 | { startDate, endDate } | { activities: [] } |
| /api/admin/statistics/export | GET | 导出报表 | 同统计参数 | 文件流（Excel） |

**页面状态：**

| 状态 | 说明 |
|------|------|
| 正常 | 图表数据正常展示 |
| 加载中 | 图表显示 loading |

**异常情况：**

| 异常场景 | 处理方式 |
|----------|----------|
| 数据加载失败 | 对应图表显示「数据加载失败，点击重试」 |
| 导出失败 | 提示「导出失败，请稍后重试」 |

**空状态：**

| 场景 | 展示 |
|------|------|
| 暂无数据 | 图表显示空状态，提示「暂无数据」 |

---

### 3.28 管理员管理

| 维度 | 说明 |
|------|------|
| 页面路径 | /system/admin |
| 页面用途 | 管理后台管理员账号，新增、编辑、删除、分配角色 |
| 核心组件 | AdminTable、AdminForm、RoleSelect |

**核心组件说明：**

- **AdminTable**：管理员列表表格，列包含：用户名、姓名、手机号、角色、最后登录时间、状态、操作。
- **AdminForm**：管理员编辑弹窗表单，包含用户名（新增时可填，编辑时只读）、姓名、手机号、初始密码（仅新增）、角色选择、状态。
- **RoleSelect**：角色下拉选择器，从角色列表中选择分配给管理员的角色。

**用户操作：**

1. 查看管理员列表
2. 点击「新增管理员」打开弹窗
3. 填写管理员信息，分配角色
4. 点击「编辑」修改管理员信息
5. 点击「删除」删除管理员（需二次确认）
6. 点击「重置密码」重置管理员密码

**调用接口：**

| 接口 | 方法 | 说明 | 请求参数 | 响应数据 |
|------|------|------|----------|----------|
| /api/admin/admin-user/list | GET | 获取管理员列表 | { page, pageSize, keyword } | { total, list: [{ id, username, name, phone, roles, lastLoginTime, status }] } |
| /api/admin/admin-user/create | POST | 新增管理员 | { username, name, phone, password, roleIds, status } | { id } |
| /api/admin/admin-user/update | PUT | 更新管理员 | { id, name, phone, roleIds, status } | { success: boolean } |
| /api/admin/admin-user/delete | DELETE | 删除管理员 | { id } | { success: boolean } |
| /api/admin/admin-user/reset-password | PUT | 重置密码 | { id } | { newPassword } |

**页面状态：**

| 状态 | 说明 |
|------|------|
| 正常 | 列表数据正常展示 |
| 保存中 | 按钮显示 loading |

**异常情况：**

| 异常场景 | 处理方式 |
|----------|----------|
| 删除自己 | 禁用删除按钮，提示「不能删除当前登录的管理员」 |
| 删除最后一个超级管理员 | 禁用删除按钮，提示「系统至少保留一个超级管理员」 |
| 用户名重复 | 提示「用户名已存在」 |
| 手机号重复 | 提示「该手机号已被其他管理员使用」 |

**空状态：**

| 场景 | 展示 |
|------|------|
| 无管理员 | 显示空状态插画，提示「暂无管理员」，提供「新增管理员」按钮 |

---

### 3.29 角色权限

| 维度 | 说明 |
|------|------|
| 页面路径 | /system/role |
| 页面用途 | 管理角色和权限，新增角色、分配权限、删除角色 |
| 核心组件 | RoleTable、RoleForm、PermissionTree |

**核心组件说明：**

- **RoleTable**：角色列表表格，列包含：角色名称、角色描述、关联管理员数、创建时间、操作。
- **RoleForm**：角色编辑弹窗表单，包含角色名称、角色描述。
- **PermissionTree**：权限树组件，树形展示所有权限项，支持勾选分配权限。权限树结构按菜单模块分组：商品管理、订单管理、用户管理、营销管理、内容管理、数据统计、系统管理。

**用户操作：**

1. 查看角色列表
2. 点击「新增角色」打开弹窗
3. 填写角色名称和描述
4. 在权限树中勾选分配权限
5. 点击「编辑」修改角色信息和权限
6. 点击「删除」删除角色（需二次确认）

**调用接口：**

| 接口 | 方法 | 说明 | 请求参数 | 响应数据 |
|------|------|------|----------|----------|
| /api/admin/role/list | GET | 获取角色列表 | 无 | [{ id, name, description, adminCount, createTime }] } |
| /api/admin/role/create | POST | 新增角色 | { name, description, permissionIds } | { id } |
| /api/admin/role/update | PUT | 更新角色 | { id, name, description, permissionIds } | { success: boolean } |
| /api/admin/role/delete | DELETE | 删除角色 | { id } | { success: boolean } |
| /api/admin/role/permissions | GET | 获取权限树 | 无 | [{ id, name, children: [] }] } |

**页面状态：**

| 状态 | 说明 |
|------|------|
| 正常 | 列表数据正常展示 |
| 保存中 | 按钮显示 loading |

**异常情况：**

| 异常场景 | 处理方式 |
|----------|----------|
| 删除有管理员的角色 | 提示「该角色下存在 N 个管理员，无法删除，请先解除关联」 |
| 角色名称重复 | 提示「角色名称已存在」 |
| 删除超级管理员角色 | 禁用删除按钮，提示「超级管理员角色不可删除」 |

**空状态：**

| 场景 | 展示 |
|------|------|
| 无角色 | 显示空状态插画，提示「暂无角色」，提供「新增角色」按钮 |

---

### 3.30 系统配置

| 维度 | 说明 |
|------|------|
| 页面路径 | /system/config |
| 页面用途 | 管理系统全局配置，如商城基本信息、支付配置、物流配置等 |
| 核心组件 | ConfigForm、ConfigGroup |

**核心组件说明：**

- **ConfigGroup**：配置分组标签页，包含：基本设置、支付设置、物流设置、通知设置、其他设置。
- **ConfigForm**：配置表单，根据当前分组展示对应配置项：
  - 基本设置：商城名称、商城 Logo、客服电话、客服微信、关于我们、用户协议、隐私政策
  - 支付设置：微信支付商户号、支付密钥、支付回调地址
  - 物流设置：默认物流公司、运费模板、免运费金额
  - 通知设置：订单通知手机号、售后通知手机号、库存预警通知
  - 其他设置：积分功能开关、签到功能开关、分享功能开关

**用户操作：**

1. 切换配置分组标签
2. 编辑配置项
3. 保存配置

**调用接口：**

| 接口 | 方法 | 说明 | 请求参数 | 响应数据 |
|------|------|------|----------|----------|
| /api/admin/system-config/list | GET | 获取系统配置 | { group } | { configs: [{ key, value, label, type }] } |
| /api/admin/system-config/update | PUT | 更新系统配置 | { group, configs: [{ key, value }] } | { success: boolean } |

**页面状态：**

| 状态 | 说明 |
|------|------|
| 正常 | 配置表单正常展示 |
| 保存中 | 保存按钮显示 loading |

**异常情况：**

| 异常场景 | 处理方式 |
|----------|----------|
| 保存失败 | 提示「保存失败，请稍后重试」 |
| 必填项未填写 | 表单校验提示 |
| 支付配置格式错误 | 提示「请填写正确的商户号格式」 |

**空状态：** 不适用（系统预置默认配置）

---

### 3.31 操作日志

| 维度 | 说明 |
|------|------|
| 页面路径 | /system/log |
| 页面用途 | 查看管理员操作日志，审计追踪 |
| 核心组件 | LogTable、LogFilter |

**核心组件说明：**

- **LogTable**：操作日志表格，列包含：操作时间、操作人、操作模块、操作类型（新增/编辑/删除/查询/导出）、操作描述、IP 地址、操作结果（成功/失败）。支持分页。
- **LogFilter**：日志筛选表单，支持按操作人、操作模块、操作类型、时间范围筛选。

**用户操作：**

1. 按操作人筛选
2. 按操作模块筛选
3. 按操作类型筛选
4. 按时间范围筛选
5. 点击「查看详情」查看操作详细内容（请求参数、响应结果）

**调用接口：**

| 接口 | 方法 | 说明 | 请求参数 | 响应数据 |
|------|------|------|----------|----------|
| /api/admin/operation-log/list | GET | 获取操作日志 | { page, pageSize, operator, module, type, startDate, endDate } | { total, list: [{ id, operator, module, type, description, ip, result, createTime }] } |
| /api/admin/operation-log/detail | GET | 获取日志详情 | { id } | { id, ...详细信息, requestParams, responseResult } |

**页面状态：**

| 状态 | 说明 |
|------|------|
| 正常 | 列表数据正常展示 |
| 加载中 | 表格显示 loading |

**异常情况：**

| 异常场景 | 处理方式 |
|----------|----------|
| 加载失败 | 提示「数据加载失败，请稍后重试」 |

**空状态：**

| 场景 | 展示 |
|------|------|
| 无日志 | 显示空状态插画，提示「暂无日志」 |
| 搜索无结果 | 提示「未找到匹配的日志记录」 |

---

## 4. 后台布局设计

### 4.1 整体布局

后台采用经典的管理系统布局结构：

```
┌─────────────────────────────────────────────────────┐
│                    顶部导航栏                         │
├──────────┬──────────────────────────────────────────┤
│          │              面包屑导航                     │
│          ├──────────────────────────────────────────┤
│  左侧    │                                          │
│  菜单    │            主内容区                        │
│          │                                          │
│          │                                          │
│          │                                          │
│          │                                          │
├──────────┴──────────────────────────────────────────┤
│                    底部信息栏                         │
└─────────────────────────────────────────────────────┘
```

### 4.2 顶部导航栏

- 左侧：系统 Logo + 系统名称「禧孕母婴商城管理后台」
- 右侧：消息通知图标、管理员头像 + 名称、修改密码、退出登录
- 高度：56px
- 背景：白色，底部 1px 边框

### 4.3 左侧菜单

- 宽度：220px（展开）/ 64px（折叠）
- 支持展开/折叠切换
- 菜单层级：一级菜单 + 二级菜单，最多两级
- 当前页面菜单高亮
- 根据用户权限动态渲染菜单项
- 菜单分组：
  - 首页：工作台
  - 商品管理：商品列表、商品新增、商品分类、品牌管理、供应商管理、库存管理
  - 订单管理：订单列表、发货处理、售后列表
  - 用户管理：用户列表、会员等级、积分规则
  - 营销管理：优惠券列表、活动列表、首页装修、Banner 管理、推荐位管理
  - 内容管理：内容列表
  - 数据统计：数据统计
  - 系统管理：管理员管理、角色权限、系统配置、操作日志

### 4.4 主内容区

- 最小高度：calc(100vh - 56px)
- 内边距：20px
- 背景：#f5f7fa

### 4.5 面包屑导航

- 位于主内容区顶部
- 展示当前页面路径，如「商品管理 / 商品列表」
- 支持点击跳转上级页面

### 4.6 标签页

- 支持多标签页，点击菜单打开新标签页
- 标签页支持右键菜单：关闭当前、关闭其他、关闭所有
- 刷新当前标签页
- 标签页持久化（刷新页面后恢复）

### 4.7 响应式适配

| 断点 | 宽度范围 | 布局调整 |
|------|----------|----------|
| xl | ≥1920px | 左侧菜单展开，主内容区最大宽度不限 |
| lg | ≥1200px | 左侧菜单展开，主内容区自适应 |
| md | ≥992px | 左侧菜单折叠为图标模式 |
| sm | <992px | 左侧菜单隐藏，通过汉堡按钮唤出抽屉菜单 |

---

## 5. 全局组件设计

### 5.1 组件列表

| 组件名称 | 用途 | 使用页面 |
|----------|------|----------|
| PageContainer | 页面容器，统一页面标题、面包屑、操作区布局 | 所有页面 |
| SearchForm | 通用搜索表单，支持展开/收起 | 列表页 |
| DataTable | 通用数据表格，封装分页、排序、多选、loading | 列表页 |
| StatusTag | 状态标签，根据状态值展示不同颜色 | 商品列表、订单列表、优惠券列表、活动列表 |
| ImageUpload | 图片上传组件，支持单图/多图、拖拽排序、预览 | 商品编辑、品牌管理、Banner 管理、内容编辑 |
| RichTextEditor | 富文本编辑器，支持图文混排 | 商品编辑、内容编辑 |
| CategorySelect | 分类级联选择器 | 商品编辑、内容编辑 |
| ProductSelect | 商品选择器，支持搜索、多选 | 活动编辑、推荐位管理 |
| DragSort | 拖拽排序组件 | 商品分类、首页装修、Banner 管理、推荐位管理 |
| ConfirmDialog | 确认弹窗，封装二次确认逻辑 | 所有需要确认操作的页面 |
| DetailCard | 详情信息卡片，统一标题+内容布局 | 订单详情、用户详情、售后详情 |
| Timeline | 时间线组件，展示操作日志 | 订单详情、售后详情 |
| EmptyState | 空状态组件，支持自定义图标和文案 | 所有列表页 |
| ExportButton | 导出按钮，封装导出逻辑和 loading | 订单列表、数据统计 |
| PermissionButton | 权限按钮，根据权限控制按钮显示/隐藏 | 所有有操作按钮的页面 |
| TagInput | 标签输入组件 | 用户列表 |

### 5.2 组件设计规范

- 所有全局组件放置于 `src/components/` 目录
- 组件命名采用 PascalCase
- 组件 Props 使用 TypeScript 接口定义
- 组件事件使用 emit 定义，提供完整类型
- 组件支持 v-model 的使用双向绑定
- 组件内部状态使用 ref/reactive 管理
- 组件样式使用 scoped，避免全局污染

---

## 6. 权限控制实现

### 6.1 权限模型

采用 RBAC（基于角色的访问控制）模型：

```
管理员 ──多对多──> 角色 ──多对多──> 权限
```

- 一个管理员可拥有多个角色
- 一个角色可拥有多个权限
- 权限粒度：菜单权限 + 按钮权限 + 数据权限

### 6.2 菜单权限

**实现方式：**

1. 用户登录后，后端返回该用户拥有的权限列表
2. 前端根据权限列表过滤路由配置，动态注册路由
3. 左侧菜单根据权限动态渲染，无权限的菜单不展示
4. 直接访问无权限页面时，跳转至 403 页面

**权限标识格式：** `模块:操作`，如 `product:list`、`product:create`、`product:update`、`product:delete`

**实现代码位置：** `src/router/guards.ts`（路由守卫）、`src/store/permission.ts`（权限状态管理）

### 6.3 按钮权限

**实现方式：**

1. 使用自定义指令 `v-permission` 控制按钮显示/隐藏
2. 指令参数为权限标识字符串或数组
3. 无权限时按钮不渲染（而非禁用），避免界面冗余

**使用示例：**

```html
<el-button v-permission="'product:create'" @click="handleCreate">新增商品</el-button>
<el-button v-permission="'product:delete'" @click="handleDelete">删除</el-button>
```

**实现代码位置：** `src/directives/permission.ts`

### 6.4 数据权限

**实现方式：**

1. 数据权限由后端接口控制，前端无需特殊处理
2. 不同角色的管理员查询数据时，后端根据角色自动过滤数据范围
3. 数据权限级别：
   - 全部数据：超级管理员可查看所有数据
   - 本部门数据：部门管理员可查看本部门相关数据
   - 仅本人数据：普通管理员仅可查看自己创建的数据

**数据权限应用场景：**

| 数据类型 | 超级管理员 | 部门管理员 | 普通管理员 |
|----------|------------|------------|------------|
| 订单数据 | 全部订单 | 本部门相关订单 | 本人处理订单 |
| 操作日志 | 全部日志 | 本部门日志 | 本人操作日志 |
| 统计数据 | 全部统计 | 本部门统计 | 本人相关统计 |

### 6.5 权限列表

| 权限标识 | 权限名称 | 所属模块 |
|----------|----------|----------|
| dashboard:view | 查看工作台 | 首页 |
| product:list | 查看商品列表 | 商品管理 |
| product:create | 新增商品 | 商品管理 |
| product:update | 编辑商品 | 商品管理 |
| product:delete | 删除商品 | 商品管理 |
| product:category | 管理分类 | 商品管理 |
| product:brand | 管理品牌 | 商品管理 |
| product:stock | 管理库存 | 商品管理 |
| supplier:list | 管理供应商 | 商品管理 |
| order:list | 查看订单列表 | 订单管理 |
| order:detail | 查看订单详情 | 订单管理 |
| order:delivery | 发货处理 | 订单管理 |
| order:aftersale | 查看售后列表 | 订单管理 |
| order:aftersale-detail | 处理售后 | 订单管理 |
| user:list | 查看用户列表 | 用户管理 |
| user:detail | 查看用户详情 | 用户管理 |
| user:member-level | 管理会员等级 | 用户管理 |
| user:points-rule | 管理积分规则 | 用户管理 |
| marketing:coupon | 管理优惠券 | 营销管理 |
| marketing:coupon-create | 新增优惠券 | 营销管理 |
| marketing:coupon-update | 编辑优惠券 | 营销管理 |
| marketing:activity | 管理活动 | 营销管理 |
| marketing:activity-create | 新增活动 | 营销管理 |
| marketing:activity-update | 编辑活动 | 营销管理 |
| marketing:home-decor | 首页装修 | 营销管理 |
| marketing:banner | 管理 Banner | 营销管理 |
| marketing:recommendation | 管理推荐位 | 营销管理 |
| content:list | 查看内容列表 | 内容管理 |
| content:create | 新增内容 | 内容管理 |
| content:update | 编辑内容 | 内容管理 |
| statistics:view | 查看数据统计 | 数据统计 |
| system:admin | 管理管理员 | 系统管理 |
| system:role | 管理角色权限 | 系统管理 |
| system:config | 管理系统配置 | 系统管理 |
| system:log | 查看操作日志 | 系统管理 |

### 6.6 预置角色

| 角色名称 | 角色描述 | 拥有权限 |
|----------|----------|----------|
| 超级管理员 | 拥有全部权限 | 所有权限 |
| 运营管理员 | 负责日常运营 | 商品管理、订单管理、营销管理、内容管理、数据统计 |
| 客服管理员 | 负责客服售后 | 订单管理（查看+售后）、用户管理（查看） |
| 内容管理员 | 负责内容运营 | 内容管理 |
| 数据分析师 | 负责数据分析 | 数据统计、订单管理（查看） |
