# 孕禧 V1.0 运营 Dashboard 指标定义

本文档明确每个 Dashboard 指标的公式、数据来源、刷新频率、适用限制。

---

## 一、今日指标卡片

| 指标 | API 字段 | 公式 | 数据来源 | 单位 |
|------|---------|------|---------|------|
| 今日新增用户 | today.new_users | COUNT(sxo_user WHERE add_time ∈ 今日) | sxo_user | 人 |
| 今日订单数 | today.orders | COUNT(sxo_order WHERE add_time ∈ 今日) | sxo_order | 单 |
| 今日销售额 | today.sales | SUM(sxo_order.total_price WHERE add_time ∈ 今日 AND status=4) | sxo_order | 元 |
| 今日活动报名 | today.activity_signups | COUNT(sxo_activity_signup WHERE add_time ∈ 今日 AND status IN (0,1)) | sxo_activity_signup | 人 |
| 今日邀请首单 | today.invite_first_order | COUNT(DISTINCT invitee_id FROM sxo_invite_reward WHERE add_time ∈ 今日 AND trigger_event='first_order' AND status=1) | sxo_invite_reward | 人 |
| 今日反馈 | today.feedback_count | COUNT(sxo_muying_feedback WHERE add_time ∈ 今日 AND is_delete_time=0) | sxo_muying_feedback | 条 |

**说明**：
- 今日销售额仅统计 `status=4`（已完成）的订单，不含待付款/待发货/已取消
- 今日邀请首单统计的是当日触发首单奖励且已发放的去重被邀请人数，不是积分奖励数
- 今日活动报名排除已取消（status=2）的报名

---

## 二、汇总数据

| 指标 | API 字段 | 公式 | 数据来源 | 单位 |
|------|---------|------|---------|------|
| 总用户 | total.users | COUNT(sxo_user) | sxo_user | 人 |
| 总已完成订单 | total.orders | COUNT(sxo_order WHERE status=4) | sxo_order | 单 |
| 总已完成销售额 | total.sales | SUM(sxo_order.total_price WHERE status=4) | sxo_order | 元 |
| 上架活动 | total.activities | COUNT(sxo_activity WHERE is_enable=1 AND is_delete_time=0) | sxo_activity | 个 |
| 总报名数 | total.signups | COUNT(sxo_activity_signup WHERE status IN (0,1)) | sxo_activity_signup | 人 |
| 邀请首单人数 | total.invites | COUNT(DISTINCT invitee_id FROM sxo_invite_reward WHERE trigger_event='first_order' AND status=1) | sxo_invite_reward | 人 |

**说明**：
- 总订单和总销售额仅统计已完成订单（status=4），不含进行中/已取消
- ShopXO 订单状态：0=待确认, 1=待付款, 2=待发货, 3=待收货, **4=已完成**, 5=已取消, 6=已关闭

---

## 三、运营指标

### 3.1 活动报名密度

| 属性 | 值 |
|------|---|
| API 字段 | conversion.activity_signup_density |
| 快照 metric_key | activity_signup_density |
| 公式 | 当日报名数 / 上架活动数 |
| 单位 | 人/活动 |
| 刷新频率 | 实时（Overview 接口）+ 每日快照 |
| 适用限制 | **不是转化率**。没有活动浏览日志，无法计算报名转化率。此指标反映每个上架活动平均获得多少报名，用于评估活动整体吸引力 |

**计算逻辑**：
```
signup_count = COUNT(sxo_activity_signup WHERE add_time ∈ 当日)
active_activities = COUNT(sxo_activity WHERE is_enable=1 AND is_delete_time=0)
result = signup_count / active_activities（保留2位小数）
```

**分母说明**：分母是全量上架活动数（不区分当日是否有人浏览），因此当活动数量多但报名集中时，密度值可能偏低。

**旧 metric_key 兼容**：快照趋势查询时，如新 key `activity_signup_density` 无数据，会自动回退查询旧 key `signup_conversion`。

### 3.2 邀请注册占比

| 属性 | 值 |
|------|---|
| API 字段 | conversion.invite_register_ratio |
| 快照 metric_key | invite_register_ratio |
| 公式 | 通过邀请注册的用户数 / 当日新用户数 × 100% |
| 单位 | % |
| 刷新频率 | 实时（Overview 接口）+ 每日快照 |
| 适用限制 | 分子是 trigger_event='register' 且 status=1 的去重 invitee_id，即成功绑定邀请关系的被邀请人数。不含仅触发首单但未注册绑定的记录 |

**计算逻辑**：
```
invited_user_count = COUNT(DISTINCT invitee_id FROM sxo_invite_reward
                           WHERE add_time ∈ 当日 AND trigger_event='register' AND status=1)
new_users = COUNT(sxo_user WHERE add_time ∈ 当日)
result = invited_user_count / new_users × 100（保留2位小数）
```

**与旧口径的区别**：
- 旧口径 `invite_conversion`：统计所有 status=1 的 InviteReward 记录数（包含 register 和 first_order），未去重，不是"邀请人数"
- 新口径 `invite_register_ratio`：仅统计 trigger_event='register' 且 group(invitee_id) 去重，是"通过邀请注册的用户数"

**旧 metric_key 兼容**：快照趋势查询时，如新 key `invite_register_ratio` 无数据，会自动回退查询旧 key `invite_conversion`。

### 3.3 复购率

| 属性 | 值 |
|------|---|
| API 字段 | conversion.repurchase_rate |
| 快照 metric_key | repurchase_rate |
| 公式 | 有≥2笔已完成订单的用户数 / 有已完成订单的用户数 × 100% |
| 单位 | % |
| 刷新频率 | 实时（Overview 接口）+ 每日快照 |
| 适用限制 | 仅统计 status=4（已完成）的订单。user_id=0 的订单排除。全量计算（非当日） |

**计算逻辑**：
```sql
-- 重复购买用户数
SELECT COUNT(*) FROM (
    SELECT user_id FROM sxo_order
    WHERE status = 4 AND user_id > 0
    GROUP BY user_id HAVING COUNT(*) > 1
) t

-- 总购买用户数
SELECT COUNT(*) FROM (
    SELECT user_id FROM sxo_order
    WHERE status = 4 AND user_id > 0
    GROUP BY user_id
) t

result = repeat_buyers / total_buyers × 100（保留2位小数）
```

**ShopXO 订单状态说明**：
- status=4 是"已完成"终态，表示订单已确认收货
- status=5（已取消）和 status=6（已关闭）不计入
- 使用原生 SQL 子查询计算，避免 ThinkPHP `group()->count()` 语义歧义

---

## 四、阶段与母婴指标

### 4.1 阶段分布

| 属性 | 值 |
|------|---|
| API 字段 | stage_distribution |
| 公式 | 按 current_stage 分组 COUNT |
| 数据来源 | sxo_user |
| 阶段值 | prepare（备孕）/ pregnancy（孕期）/ postpartum（产后） |

**说明**：占比 = 该阶段用户数 / 有阶段标识的用户总数 × 100%。未设置阶段的用户不计入分母。

### 4.2 预产期窗口

| 属性 | 值 |
|------|---|
| API 字段 | due_soon_count |
| 公式 | COUNT(sxo_user WHERE current_stage='pregnancy' AND due_date > 0 AND due_date ≤ now+30天) |
| 数据来源 | sxo_user |

### 4.3 宝宝月龄分布

| 属性 | 值 |
|------|---|
| API 字段 | baby_age_buckets |
| 公式 | 按 baby_birthday 范围分组 COUNT（仅 current_stage='postpartum' 且 baby_birthday > 0） |
| 数据来源 | sxo_user |
| 分组 | 0-3月 / 3-6月 / 6-12月 |

### 4.4 阶段完善率

| 属性 | 值 |
|------|---|
| 快照 metric_key | stage_completion |
| 公式 | 当日新用户中已设置 current_stage 的比例 × 100% |
| 刷新频率 | 每日快照 |

---

## 五、快照表

### 5.1 表结构

表名：`sxo_muying_stat_snapshot`

| 字段 | 类型 | 说明 |
|------|------|------|
| id | int unsigned | 自增主键 |
| stat_date | char(10) | 统计日期 YYYY-MM-DD |
| metric_key | char(60) | 指标标识 |
| metric_value | decimal(15,2) | 指标值 |
| add_time | int unsigned | 创建时间 |

唯一索引：`uk_date_metric(stat_date, metric_key)`

### 5.2 metric_key 清单

| metric_key | 说明 | 单位 |
|------------|------|------|
| new_users | 当日新增用户数 | 人 |
| activity_signups | 当日活动报名数 | 人 |
| orders | 当日订单数 | 单 |
| sales | 当日已完成销售额 | 元 |
| feedback_count | 当日反馈数 | 条 |
| stage_completion | 当日新用户阶段完善率 | % |
| activity_signup_density | 活动报名密度 | 人/活动 |
| invite_register_ratio | 邀请注册占比 | % |
| repurchase_rate | 复购率 | % |

### 5.3 旧 metric_key 迁移

| 旧 key | 新 key | 迁移方式 |
|--------|--------|---------|
| signup_conversion | activity_signup_density | 趋势查询自动回退旧 key；新快照使用新 key |
| invite_conversion | invite_register_ratio | 趋势查询自动回退旧 key；新快照使用新 key |

**可选迁移 SQL**（非必须，趋势查询已兼容）：
```sql
UPDATE sxo_muying_stat_snapshot SET metric_key = 'activity_signup_density' WHERE metric_key = 'signup_conversion';
UPDATE sxo_muying_stat_snapshot SET metric_key = 'invite_register_ratio' WHERE metric_key = 'invite_conversion';
```

### 5.4 幂等性

`GenerateDailySnapshot` 同一天同一 metric_key 不重复插入：
- 已存在 → UPDATE metric_value
- 不存在 → INSERT

---

## 六、刷新频率

| 指标类型 | 刷新方式 | 说明 |
|---------|---------|------|
| 今日指标 | 实时 | 每次 Overview API 调用时重新查询 |
| 汇总数据 | 实时 | 每次 Overview API 调用时重新查询 |
| 运营指标 | 实时 | 每次 Overview API 调用时重新计算 |
| 趋势数据 | 快照 | 从 sxo_muying_stat_snapshot 读取，需定时或手动生成 |
| 快照生成 | 手动/定时 | 后台"手动生成今日快照"按钮或 cron 调用 |

---

## 七、已知限制

1. **无活动浏览日志** — 无法计算真正的活动报名转化率（报名/浏览UV），当前使用报名密度替代
2. **复购率全量计算** — 不是按日增量，反映的是历史累计复购情况
3. **邀请注册占比依赖 register 事件** — 如果注册绑定链路异常（如旧数据中 register 记录被撤销），占比可能偏低
4. **销售额仅含已完成订单** — 不含待付款/待发货/待收货的金额，与"GMV"口径不同
5. **阶段分布不含空值** — 未设置 current_stage 的用户不计入阶段分布的分母
