# 禧孕小程序 — 首页内容填写模板

> 本文档是后台人工填写首页内容的操作模板。
> 每个模块标注了：后台操作路径、必填字段、填写示例、注意事项。
> 正式环境可删改，演示环境可直接参考填写。

---

## 1. 首页轮播图

**后台路径**：手机管理 → 首页轮播

**数据表**：`sxo_slide`

**必填字段**：

| 字段 | 说明 | 格式要求 |
|------|------|---------|
| `name` | 轮播名称 | 内部标识，不展示给用户 |
| `images_url` | 图片地址 | 建议尺寸 750×360px，先在"附件管理"上传 |
| `event_type` | 跳转类型 | 0=WEB页面，1=内部页面（推荐） |
| `event_value` | 跳转地址 | 内部页面填小程序路径 |
| `platform` | 展示平台 | 必须包含 `weixin` |
| `is_enable` | 是否启用 | 1=启用 |
| `sort` | 排序 | 数字越小越靠前 |

**platform 格式**：JSON 数组，如 `["weixin"]` 或 `["weixin","h5"]`

**最少 3 张，建议 3-5 张**：

| 序号 | name | event_type | event_value | 建议图片内容 |
|------|------|-----------|-------------|-------------|
| 1 | 新人专享福利 | 1 | /pages/activity/activity | 活动列表页截图/设计图 |
| 2 | 孕妈课堂免费报名 | 1 | /pages/activity-detail/activity-detail?id={替换为实际活动ID} | 课堂活动海报 |
| 3 | 邀请有礼 积分翻倍 | 1 | /pages/invite/invite | 邀请裂变宣传图 |

**注意事项**：
- 图片必须先上传到服务器（附件管理 → 上传），再复制路径填入
- `event_value` 中活动详情页的 `id` 需替换为实际活动 ID
- 不要使用外部 URL 图片，必须上传到本站

---

## 2. 首页导航

**后台路径**：手机管理 → 首页导航

**数据表**：`sxo_app_home_nav`

**必填字段**：

| 字段 | 说明 | 格式要求 |
|------|------|---------|
| `name` | 导航名称 | 用户可见，2-4个字 |
| `images_url` | 图标地址 | 建议尺寸 120×120px，PNG 透明底 |
| `event_type` | 跳转类型 | 1=内部页面（推荐） |
| `event_value` | 跳转地址 | 小程序路径 |
| `platform` | 展示平台 | 必须包含 `weixin` |
| `is_enable` | 是否启用 | 1=启用 |
| `sort` | 排序 | 数字越小越靠前 |
| `is_need_login` | 是否需登录 | 0=不需要，1=需要 |

**最少 4 个，建议 4-8 个**：

| 序号 | name | event_type | event_value | is_need_login | 建议图标 |
|------|------|-----------|-------------|:---:|---------|
| 1 | 孕妈课堂 | 1 | /pages/activity/activity?category=classroom | 0 | 📚 课堂图标 |
| 2 | 线下沙龙 | 1 | /pages/activity/activity?category=salon | 0 | 🤝 沙龙图标 |
| 3 | 试用官 | 1 | /pages/activity/activity?category=trial | 1 | 🎁 试用图标 |
| 4 | 签到打卡 | 1 | /pages/activity/activity?category=checkin | 1 | ✅ 签到图标 |

**注意事项**：
- 图标建议使用统一风格的 PNG 透明底图标
- `event_value` 中的 `category` 参数用于活动列表筛选，必须与 `sxo_activity.category` 的合法值一致
- 合法 category 值：`classroom` / `salon` / `lecture` / `trial` / `holiday` / `checkin`

---

## 3. 商品分类命名

**后台路径**：商品管理 → 商品分类

**数据表**：`sxo_goods_category`

**核心规则**：一级分类名必须包含阶段关键词，否则阶段筛选失效！

| 阶段参数 | 命中关键词 | 分类命名必须包含 |
|----------|-----------|----------------|
| `prepare` | 备孕、孕前 | "备孕" 或 "孕前" |
| `pregnancy` | 孕期、孕妇、孕中、孕妈、怀孕 | "孕期" 或 "孕妇" 等 |
| `postpartum` | 产后、月子、哺乳、新生儿、婴儿、宝宝 | "产后" 或 "月子" 等 |

**最小可用分类结构**：

```
├── 备孕好物            ← 命中 prepare（含"备孕"）
│   ├── 备孕营养
│   └── 孕前检测
├── 孕期必备            ← 命中 pregnancy（含"孕期"）
│   ├── 孕妇装
│   ├── 孕期营养
│   └── 护肤防纹
├── 产后恢复            ← 命中 postpartum（含"产后"）
│   ├── 产后护理
│   ├── 月子餐
│   └── 哺乳用品
├── 新生儿护理          ← 命中 postpartum（含"新生儿"）
│   ├── 婴儿服饰
│   └── 婴儿喂养
```

**后台操作步骤**：

1. 先创建一级分类（pid=0），名称必须含关键词
2. 再创建二级分类（pid=一级分类ID），名称无关键词要求
3. 每个一级分类下至少 2 个商品
4. 勾选"首页推荐"（`is_home_recommended=1`）可让分类出现在首页楼层

**验证分类是否命中**：

```sql
SELECT id, name FROM sxo_goods_category WHERE is_enable=1 AND (name LIKE '%备孕%' OR name LIKE '%孕前%');
SELECT id, name FROM sxo_goods_category WHERE is_enable=1 AND (name LIKE '%孕期%' OR name LIKE '%孕妇%' OR name LIKE '%孕中%' OR name LIKE '%孕妈%' OR name LIKE '%怀孕%');
SELECT id, name FROM sxo_goods_category WHERE is_enable=1 AND (name LIKE '%产后%' OR name LIKE '%月子%' OR name LIKE '%哺乳%' OR name LIKE '%新生儿%' OR name LIKE '%婴儿%' OR name LIKE '%宝宝%');
```

三个查询都必须有结果。

---

## 4. 孕育知识文章

**后台路径**：内容管理 → 文章分类 → 先创建分类 → 再添加文章

**数据表**：`sxo_article_category` + `sxo_article`

### 4.1 文章分类（必须先创建）

| 字段 | 值 |
|------|---|
| `name` | 孕育知识 |
| `pid` | 0 |
| `is_enable` | 1 |
| `sort` | 0 |

### 4.2 文章模板（最少 3 条）

每篇文章填写以下字段：

| 字段 | 说明 | 要求 |
|------|------|------|
| `title` | 标题 | 15字以内，吸引点击 |
| `describe` | 摘要 | 50字以内，首页列表展示 |
| `content` | 正文 | HTML 格式，支持图文混排 |
| `article_category_id` | 分类ID | 填上面创建的分类 ID |
| `is_enable` | 是否启用 | 1 |
| `is_home_recommended` | 首页推荐 | 1（首页展示需要） |
| `cover` | 封面图 | 建议尺寸 400×300px |

**文章标题参考**：

| 序号 | title | describe |
|------|-------|----------|
| 1 | 备孕期叶酸怎么吃？这份指南请收好 | 叶酸是备孕和孕早期最重要的营养素之一 |
| 2 | 孕期体重管理：长胎不长肉的科学方法 | 孕期体重增长有标准，过多过少都不好 |
| 3 | 产后42天复查到底查什么？ | 产后42天复查是妈妈恢复的重要节点 |

**正文模板**（HTML 格式）：

```html
<p>开头段落：1-2句话概括文章核心观点。</p>

<p><strong>一、小标题1</strong></p>
<p>正文内容，3-5句话。</p>

<p><strong>二、小标题2</strong></p>
<p>正文内容，3-5句话。</p>

<p><strong>温馨提示</strong></p>
<p>结尾总结或提醒，1-2句话。</p>
```

---

## 5. 活动内容

**后台路径**：运营 → 活动管理

**数据表**：`sxo_activity`

**也可直接执行 SQL**：`docs/sql/xiyun-init-activity-demo.sql`

### 5.1 活动字段填写模板

| 字段 | 说明 | 填写要求 |
|------|------|---------|
| `title` | 活动标题 | 10字以内，简洁有力 |
| `cover` | 封面图 | 建议尺寸 750×420px，必须上传 |
| `category` | 活动分类 | classroom/salon/lecture/trial/holiday/checkin |
| `stage` | 适用阶段 | prepare/pregnancy/postpartum/all |
| `description` | 活动简介 | 50字以内，列表页展示 |
| `content` | 活动详情 | HTML 格式，详情页展示 |
| `suitable_crowd` | 适合人群 | 如"孕12周以上准妈妈" |
| `address` | 活动地址 | 线下活动必填，线上填"线上直播" |
| `start_time` / `end_time` | 活动时间 | 后台选择日期，自动转时间戳 |
| `signup_start_time` / `signup_end_time` | 报名时间 | 报名截止应早于活动结束 |
| `max_count` | 最大人数 | 0=不限 |
| `is_free` | 是否免费 | 1=免费（推荐首批活动全免费） |
| `price` | 价格 | 免费活动填 0.00 |
| `contact_name` | 联系人 | 如"禧孕客服" |
| `contact_phone` | 联系电话 | 如"400-000-0000" |
| `is_enable` | 是否启用 | 1 |

### 5.2 首批活动建议

| 序号 | title | category | stage | is_free | 说明 |
|------|-------|----------|-------|:---:|------|
| 1 | 孕期营养课堂 | classroom | pregnancy | 1 | 免费线上课 |
| 2 | 产后修复沙龙 | salon | postpartum | 1 | 线下免费活动 |
| 3 | 备孕优生课堂 | classroom | prepare | 1 | 覆盖备孕阶段 |
| 4 | 新生儿护理讲座 | lecture | postpartum | 1 | 知识型活动 |
| 5 | 孕妈试用官招募 | trial | pregnancy | 1 | 试用活动 |
| 6 | 母婴好物签到打卡 | checkin | all | 1 | 通用签到 |

### 5.3 活动详情 HTML 模板

```html
<p>活动简介：1-2句话说明活动亮点。</p>

<p><strong>活动内容</strong></p>
<ul>
<li>内容要点1</li>
<li>内容要点2</li>
<li>内容要点3</li>
</ul>

<p><strong>适合人群</strong></p>
<p>描述目标参与者。</p>

<p><strong>报名须知</strong></p>
<p>报名截止时间、取消规则等。</p>
```

---

## 6. 妈妈说反馈

**后台路径**：运营 → 妈妈说管理

**数据表**：`sxo_muying_feedback`

**也可直接执行 SQL**：`docs/sql/xiyun-init-feedback-demo.sql`

| 字段 | 说明 | 填写要求 |
|------|------|---------|
| `nickname` | 昵称 | 2-6字，温暖亲切 |
| `avatar` | 头像 | 可留空，显示默认头像 |
| `content` | 反馈内容 | 20-50字，真实感强 |
| `stage` | 阶段 | prepare/pregnancy/postpartum |
| `sort_level` | 排序权重 | 数字越大越靠前 |
| `is_enable` | 是否启用 | 1 |

**正式运营后建议**：替换为真实用户反馈，演示数据可删除。

---

## 7. 邀请有礼配置

**后台路径**：系统设置 → 搜索 `muying_invite`

**数据表**：`sxo_config`

**也可直接执行 SQL**：`docs/sql/xiyun-init-config.sql`

| 配置项 | 推荐值 | 说明 |
|--------|--------|------|
| `muying_invite_register_reward` | 100 | 邀请注册奖励积分 |
| `muying_invite_first_order_reward` | 200 | 邀请首单奖励积分 |

**必须执行**：缺失则邀请奖励=0，严重伤害用户信任！

---

## 8. 执行顺序总览

| 步骤 | 操作 | 方式 | 文件 |
|------|------|------|------|
| 1 | 执行数据库迁移 | SQL | `docs/muying-final-migration.sql` |
| 2 | 插入自定义配置项 | SQL | `docs/sql/xiyun-init-config.sql` |
| 3 | 插入活动演示数据 | SQL | `docs/sql/xiyun-init-activity-demo.sql` |
| 4 | 插入妈妈说演示数据 | SQL | `docs/sql/xiyun-init-feedback-demo.sql` |
| 5 | 上传 Logo 图片 | 后台 | 附件管理 → 上传 |
| 6 | 配置首页轮播图 | 后台 | 手机管理 → 首页轮播 |
| 7 | 配置首页导航 | 后台 | 手机管理 → 首页导航 |
| 8 | 创建商品分类 | 后台 | 商品管理 → 商品分类 |
| 9 | 添加商品 | 后台 | 商品管理 → 添加商品 |
| 10 | 创建文章分类+文章 | 后台 | 内容管理 → 文章 |
| 11 | 验证首页展示 | 小程序 | 打开首页逐模块检查 |

---

## 9. 验收检查清单

| # | 检查项 | 验证方式 | 预期结果 |
|---|--------|---------|---------|
| 1 | 首页轮播 | 打开首页 | 至少3张轮播图，可点击跳转 |
| 2 | 首页导航 | 打开首页 | 至少4个导航图标，可点击跳转 |
| 3 | 推荐活动 | 打开首页 | 活动卡片展示，可点击进入详情 |
| 4 | 阶段推荐商品 | 切换备孕/孕期/产后标签 | 每个标签下有不同商品 |
| 5 | 孕育知识 | 打开首页 | 至少3篇文章，可点击阅读 |
| 6 | 妈妈说 | 打开首页 | 至少3条反馈内容 |
| 7 | 邀请有礼 | 打开首页/邀请页 | 显示奖励积分数值（非0） |
| 8 | 活动列表 | 进入活动页 | 至少6条活动，可按分类筛选 |
| 9 | 活动报名 | 进入活动详情 → 报名 | 可正常提交报名 |
| 10 | 空态检查 | 逐模块检查 | 无空白区块 |
