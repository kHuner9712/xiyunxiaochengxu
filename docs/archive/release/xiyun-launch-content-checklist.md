# 禧孕首批上线内容与后台初始化清单

## 1. 首页初始化清单

### 1.1 轮播图（后台：手机管理 → 首页轮播）

| 项目 | 要求 |
|------|------|
| 最少数量 | **3 张** |
| 推荐数量 | 3-5 张 |
| 必填字段 | name, images_url, event_type, event_value, platform(weixin), is_enable(1), sort |

建议首批内容：

| 序号 | 名称 | 跳转 |
|------|------|------|
| 1 | 新人专享福利 | `/pages/activity/activity` |
| 2 | 孕妈课堂免费报名 | `/pages/activity-detail/activity-detail?id={课堂活动ID}` |
| 3 | 邀请有礼 积分翻倍 | `/pages/invite/invite` |

### 1.2 首页导航（后台：手机管理 → 首页导航）

| 项目 | 要求 |
|------|------|
| 最少数量 | **4 个** |
| 推荐数量 | 4-8 个 |
| 必填字段 | name, images_url, event_type, event_value, platform(weixin), is_enable(1), sort |

建议首批导航：

| 序号 | 名称 | 跳转 |
|------|------|------|
| 1 | 孕妈课堂 | `/pages/activity/activity?category=classroom` |
| 2 | 线下沙龙 | `/pages/activity/activity?category=salon` |
| 3 | 试用官 | `/pages/activity/activity?category=trial` |
| 4 | 签到打卡 | `/pages/activity/activity?category=checkin` |

### 1.3 推荐活动（`sxo_activity`）

| 项目 | 要求 |
|------|------|
| 最少数量 | **4 条**（首页取前4条） |
| 推荐数量 | 6-8 条 |
| 阶段覆盖 | 至少覆盖 pregnancy 和 postpartum 各1条，建议含1条 stage=all |

### 1.4 推荐商品（依赖 `sxo_goods_category` + `sxo_goods`）

| 项目 | 要求 |
|------|------|
| 最少分类数 | **3 个一级分类**（名称必须含关键词，见第3节） |
| 最少商品数 | 每个分类下至少 **2 个商品**，总计 ≥6 |

### 1.5 孕育知识（后台：内容管理 → 文章）

| 项目 | 要求 |
|------|------|
| 最少数量 | **3 条**（首页取前3条） |
| 必填字段 | title, describe, article_category_id, is_enable(1) |
| 分类要求 | 至少创建1个文章分类（如"孕育知识"） |

### 1.6 妈妈说（`sxo_muying_feedback`）

| 项目 | 要求 |
|------|------|
| 最少数量 | **3 条**（首页取前3条） |
| 必填字段 | nickname, content, stage, is_enable(1) |

### 1.7 邀请有礼

| 项目 | 要求 |
|------|------|
| 首页展示 | 无需后台配置，硬编码始终显示 |
| 后台配置 | `muying_invite_register_reward` 和 `muying_invite_first_order_reward` 必须插入 `sxo_config` |

---

## 2. 活动初始化清单

### 2.1 最少活动数据

| 序号 | title | stage | category | is_free | 说明 |
|------|-------|-------|----------|---------|------|
| 1 | 孕期营养课堂 | pregnancy | classroom | 1 | 免费线上课 |
| 2 | 产后修复沙龙 | postpartum | salon | 1 | 线下免费活动 |
| 3 | 备孕优生课堂 | prepare | classroom | 1 | 覆盖备孕阶段 |
| 4 | 新生儿护理讲座 | postpartum | lecture | 1 | 知识型活动 |
| 5 | 孕妈试用官招募 | pregnancy | trial | 1 | 试用活动 |
| 6 | 母婴好物签到打卡 | all | checkin | 1 | 通用签到 |

### 2.2 stage / category 合法值

**stage（阶段）**：

| 值 | 中文名 | 说明 |
|----|--------|------|
| `prepare` | 备孕 | — |
| `pregnancy` | 孕期 | — |
| `postpartum` | 产后 | — |
| `all` | 通用 | 所有阶段筛选下都可见 |

**category（分类）**：

| 值 | 中文名 |
|----|--------|
| `classroom` | 孕妈课堂 |
| `salon` | 线下沙龙 |
| `lecture` | 育儿讲座 |
| `trial` | 试用官招募 |
| `holiday` | 节日活动 |
| `checkin` | 签到打卡 |

### 2.3 必填字段

| 字段 | 必填 | 说明 |
|------|------|------|
| `title` | ✅ | 活动标题 |
| `cover` | ✅ | 封面图 |
| `stage` | ✅ | 阶段标签 |
| `category` | ✅ | 分类标签 |
| `start_time` | ✅ | 活动开始时间（int时间戳） |
| `end_time` | ✅ | 活动结束时间 |
| `signup_start_time` | ✅ | 报名开始时间 |
| `signup_end_time` | ✅ | 报名截止时间 |
| `max_count` | ✅ | 最大报名人数（0=不限） |
| `is_enable` | ✅ | 必须为1 |
| `is_free` | ✅ | 0=收费/1=免费 |
| `address` | 推荐 | 线下活动必填 |
| `content` | 推荐 | 详情页富文本 |
| `contact_name` | 推荐 | 组织者 |
| `contact_phone` | 推荐 | 联系电话 |

### 2.4 首批样例活动 SQL

```sql
INSERT INTO `sxo_activity` (`title`, `cover`, `category`, `stage`, `description`, `address`, `start_time`, `end_time`, `signup_start_time`, `signup_end_time`, `max_count`, `is_free`, `price`, `contact_name`, `contact_phone`, `is_enable`, `is_delete_time`, `add_time`, `upd_time`) VALUES
('孕期营养课堂', '', 'classroom', 'pregnancy', '专业营养师讲解孕期饮食搭配', '线上直播', UNIX_TIMESTAMP(), UNIX_TIMESTAMP()+86400*30, UNIX_TIMESTAMP(), UNIX_TIMESTAMP()+86400*25, 50, 1, 0.00, '禧孕客服', '{{CONTACT_PHONE}}', 1, 0, UNIX_TIMESTAMP(), UNIX_TIMESTAMP()),
('产后修复沙龙', '', 'salon', 'postpartum', '产后身体恢复指导', '禧孕体验中心', UNIX_TIMESTAMP()+86400*3, UNIX_TIMESTAMP()+86400*33, UNIX_TIMESTAMP(), UNIX_TIMESTAMP()+86400*28, 20, 1, 0.00, '禧孕客服', '{{CONTACT_PHONE}}', 1, 0, UNIX_TIMESTAMP(), UNIX_TIMESTAMP()),
('备孕优生课堂', '', 'classroom', 'prepare', '备孕注意事项与优生优育知识', '线上直播', UNIX_TIMESTAMP()+86400*5, UNIX_TIMESTAMP()+86400*35, UNIX_TIMESTAMP(), UNIX_TIMESTAMP()+86400*30, 100, 1, 0.00, '禧孕客服', '{{CONTACT_PHONE}}', 1, 0, UNIX_TIMESTAMP(), UNIX_TIMESTAMP()),
('母婴好物签到打卡', '', 'checkin', 'all', '每日签到领积分', '线上', UNIX_TIMESTAMP(), UNIX_TIMESTAMP()+86400*90, UNIX_TIMESTAMP(), UNIX_TIMESTAMP()+86400*85, 0, 1, 0.00, '禧孕客服', '{{CONTACT_PHONE}}', 1, 0, UNIX_TIMESTAMP(), UNIX_TIMESTAMP());
```

---

## 3. 商品分类初始化清单

### 3.1 阶段筛选映射关系

后端通过分类名称关键词 LIKE 匹配实现阶段筛选：

| 阶段参数 | 命中关键词 |
|----------|-----------|
| `prepare` | 备孕、孕前 |
| `pregnancy` | 孕期、孕妇、孕中、孕妈、怀孕 |
| `postpartum` | 产后、月子、哺乳、新生儿、婴儿、宝宝 |

### 3.2 最小可用分类建议

```
├── 备孕好物          ← 命中 prepare（含"备孕"）
│   ├── 备孕营养
│   └── 孕前检测
├── 孕期必备          ← 命中 pregnancy（含"孕期"）
│   ├── 孕妇装
│   ├── 孕期营养
│   └── 护肤防纹
├── 产后恢复          ← 命中 postpartum（含"产后"）
│   ├── 产后护理
│   ├── 月子餐
│   └── 哺乳用品
├── 新生儿护理        ← 命中 postpartum（含"新生儿"）
│   ├── 婴儿服饰
│   └── 婴儿喂养
```

### 3.3 分类命名铁律

- 一级分类名必须含关键词，否则该阶段筛选返回空
- 不要用"母婴用品"这种泛词，不匹配任何阶段关键词
- 子分类名不需要含关键词，父分类命中后子分类自动递归包含

### 3.4 验证分类是否命中

```sql
SELECT id, name FROM sxo_goods_category WHERE is_enable=1 AND (name LIKE '%备孕%' OR name LIKE '%孕前%');
SELECT id, name FROM sxo_goods_category WHERE is_enable=1 AND (name LIKE '%孕期%' OR name LIKE '%孕妇%' OR name LIKE '%孕中%' OR name LIKE '%孕妈%' OR name LIKE '%怀孕%');
SELECT id, name FROM sxo_goods_category WHERE is_enable=1 AND (name LIKE '%产后%' OR name LIKE '%月子%' OR name LIKE '%哺乳%' OR name LIKE '%新生儿%' OR name LIKE '%婴儿%' OR name LIKE '%宝宝%');
```

三个查询都必须有结果。

---

## 4. 邀请奖励初始化清单

### 4.1 配置项

| 配置项 | 推荐值 | 说明 |
|--------|--------|------|
| `muying_invite_register_reward` | 100 | 邀请注册奖励积分 |
| `muying_invite_first_order_reward` | 200 | 邀请首单奖励积分 |

### 4.2 插入 SQL

> 以下 SQL 也可通过执行 `docs/sql/xiyun-init-config.sql` 完成（已做幂等处理，可重复执行）。

```sql
INSERT INTO `sxo_config` (`value`, `name`, `describe`, `error_tips`, `type`, `only_tag`, `upd_time`) VALUES
('100', '邀请注册奖励积分', '邀请人获得的积分奖励', '请填写邀请注册奖励积分', 'common', 'muying_invite_register_reward', UNIX_TIMESTAMP()),
('200', '邀请首单奖励积分', '被邀请人首单后邀请人获得的积分奖励', '请填写邀请首单奖励积分', 'common', 'muying_invite_first_order_reward', UNIX_TIMESTAMP())
ON DUPLICATE KEY UPDATE `value`=VALUES(`value`), `upd_time`=UNIX_TIMESTAMP();
```

### 4.3 邀请页文案

邀请页文案为前端硬编码，不需要后台配置。如需修改需改 `pages/invite/invite.vue`。

### 4.4 验证奖励"看得见"

| 步骤 | 操作 | 预期 |
|------|------|------|
| 1 | 用户A登录 → 邀请页 | 显示邀请码和"已邀请X人，获得Y积分" |
| 2 | 用户B用A的邀请码注册 | 用户A邀请数+1 |
| 3 | 用户B完成首单 | 用户A积分+200 |

---

## 5. 首批内容模板

### 5.1 妈妈说（`sxo_muying_feedback`）

```sql
INSERT INTO `sxo_muying_feedback` (`user_id`, `nickname`, `avatar`, `content`, `stage`, `sort_level`, `is_enable`, `is_delete_time`, `add_time`, `upd_time`) VALUES
(0, '小雨妈妈', '', '孕晚期每天坚持散步，顺产恢复特别快，姐妹们加油！', 'pregnancy', 100, 1, 0, UNIX_TIMESTAMP(), UNIX_TIMESTAMP()),
(0, '糖糖妈', '', '产后修复真的不能偷懒，出了月子就开始做凯格尔运动，效果很明显', 'postpartum', 90, 1, 0, UNIX_TIMESTAMP(), UNIX_TIMESTAMP()),
(0, '备孕中的小鹿', '', '开始吃叶酸了，调整作息，期待好孕到来~', 'prepare', 80, 1, 0, UNIX_TIMESTAMP(), UNIX_TIMESTAMP());
```

### 5.2 孕育知识（`sxo_article`）

**第一步**：后台 → 内容管理 → 文章分类 → 新增"孕育知识"分类

**第二步**：插入文章（替换 `article_category_id` 为实际ID）

```sql
INSERT INTO `sxo_article` (`title`, `describe`, `content`, `article_category_id`, `is_enable`, `is_delete_time`, `add_time`, `upd_time`) VALUES
('备孕期叶酸怎么吃？这份指南请收好', '叶酸是备孕和孕早期最重要的营养素之一', '<p>备孕女性应从计划怀孕前3个月开始每天补充0.4mg叶酸，持续至孕早期结束。</p>', 1, 1, 0, UNIX_TIMESTAMP(), UNIX_TIMESTAMP()),
('孕期体重管理：长胎不长肉的科学方法', '孕期体重增长有标准，过多过少都不好', '<p>根据孕前BMI不同，孕期推荐增重范围也不同。BMI正常的孕妇，整个孕期增重11.5-16kg为宜。</p>', 1, 1, 0, UNIX_TIMESTAMP(), UNIX_TIMESTAMP()),
('产后42天复查到底查什么？', '产后42天复查是妈妈恢复的重要节点', '<p>主要包括：子宫恢复检查、盆底肌评估、伤口愈合检查、血压血糖检测、乳腺检查等。</p>', 1, 1, 0, UNIX_TIMESTAMP(), UNIX_TIMESTAMP());
```

---

## 6. 没有这些内容时前台会出现什么表现

| 模块 | 缺失内容 | 前台表现 | 用户感知 |
|------|----------|----------|----------|
| 轮播图 | 0条 | 轮播区域完全消失 | 首页顶部空旷 |
| 首页导航 | 0条 | 导航区域完全消失 | 缺少快捷入口 |
| 推荐活动 | 0条 | 区块完全消失 | 首页缺少核心内容 |
| 阶段推荐商品 | 分类名不含关键词 | 显示"该阶段暂无推荐商品" | 切换标签无变化 |
| 孕育知识 | 0条 | 区块完全消失 | 首页内容单薄 |
| 妈妈说 | 0条 | 区块完全消失 | 缺少社区氛围 |
| 邀请有礼 | 配置项未插入 | 区块显示但奖励=0 | **严重伤害信任** |
| 活动列表 | 0条 | 显示"暂无相关数据" | 活动页完全空白 |
| 商品分类 | 无分类或名不含关键词 | 阶段筛选返回所有商品 | 切换标签无差异 |

**最严重的3个空态风险**：

1. **邀请奖励=0**：用户完成邀请流程后获得0积分，感觉被骗
2. **商品分类名不含关键词**：阶段推荐完全失效
3. **活动数据为0**：活动页和首页推荐活动区块都空白
