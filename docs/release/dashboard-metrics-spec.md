# 禧孕数据看板 — 指标口径说明

> 最后更新：2026-04-25
> 本文档定义后台"禧孕数据看板"每个指标的计算口径，运营人员请务必阅读，避免误读。

---

## 时间范围说明

| 范围 | 含义 | 筛选字段 |
|------|------|---------|
| 今日 | 当日 00:00:00 至当前时刻 | 各指标的 add_time / pay_time / apply_time |
| 昨日 | 昨日 00:00:00 至 23:59:59 | 同上 |
| 近7天 | 7 天前 00:00:00 至当前时刻 | 同上 |
| 近30天 | 30 天前 00:00:00 至当前时刻 | 同上 |
| 自定义 | 用户指定起止日期（含首尾） | 同上 |

**注意**：部分指标为累计值，不受时间筛选影响，具体见各指标说明。

---

## 一、交易指标

| 指标 | 单位 | 口径 | 筛选方式 | 是否受时间筛选影响 |
|------|------|------|---------|:---:|
| GMV | 元 | `SUM(pay_price)` WHERE `pay_status=1` | 按 `pay_time` | 是 |
| 支付订单数 | 单 | `COUNT(*)` WHERE `pay_status=1` | 按 `pay_time` | 是 |
| 待发货订单 | 单 | `COUNT(*)` WHERE `status=2` | 按 `add_time` | 是 |
| 售后订单 | 单 | `COUNT(*)` FROM `sxo_order_aftersale` | 按 `apply_time` | 是 |
| 支付转化率 | % | 已支付订单数 / 总订单数 × 100 | 按 `add_time` | 是 |
| 复购率 | % | 筛选期内下单≥2次的用户数 / 有订单的用户数 × 100 | 按 `add_time` | 是 |

**订单状态说明**（sxo_order.status）：
- 0=待确认 / 1=已确认待支付 / 2=已支付待发货 / 3=已发货待收货 / 4=已完成 / 5=已取消 / 6=已关闭

**支付状态说明**（sxo_order.pay_status）：
- 0=未支付 / 1=已支付 / 2=已退款 / 3=部分退款

---

## 二、用户指标

| 指标 | 单位 | 口径 | 筛选方式 | 是否受时间筛选影响 |
|------|------|------|---------|:---:|
| 新增用户 | 人 | `COUNT(*)` FROM `sxo_user` | 按 `add_time` | 是 |
| 总用户 | 人 | `COUNT(*)` FROM `sxo_user` | 无 | 否（累计值） |
| 已填写阶段 | 人 | `COUNT(*)` WHERE `current_stage <> ''` | 无 | 否（累计值） |
| 画像完成率 | % | 已填写阶段用户数 / 总用户数 × 100 | 无 | 否（累计值） |
| 备孕用户 | 人 | `COUNT(*)` WHERE `current_stage='prepare'` | 无 | 否（累计值） |
| 孕期用户 | 人 | `COUNT(*)` WHERE `current_stage='pregnancy'` | 无 | 否（累计值） |
| 产后用户 | 人 | `COUNT(*)` WHERE `current_stage='postpartum'` | 无 | 否（累计值） |

**阶段枚举**：prepare=备孕 / pregnancy=孕期 / postpartum=产后 / all=通用（仅用于内容筛选，不作为用户阶段）

---

## 三、活动指标

| 指标 | 单位 | 口径 | 筛选方式 | 是否受时间筛选影响 |
|------|------|------|---------|:---:|
| 活动访问数 | 次 | `SUM(access_count)` WHERE `is_enable=1 AND is_delete_time=0` | 无 | 否（累计值） |
| 报名数 | 人 | `COUNT(*)` FROM `sxo_activity_signup` WHERE `is_delete_time=0` | 按 `add_time` | 是 |
| 候补/待确认 | 人 | 同上 + `status=0` | 按 `add_time` | 是 |
| 核销/签到数 | 人 | 同上 + `checkin_status=1` | 按 `add_time` | 是 |
| 到场率 | % | 核销数 / 报名数 × 100 | 按 `add_time` | 是 |
| 报名转化率 | % | 报名数 / 活动总访问量 × 100 | 混合 | 是 |

**报名状态说明**（sxo_activity_signup.status）：
- 0=待确认 / 1=已确认 / 2=已取消

**签到状态说明**（sxo_activity_signup.checkin_status）：
- 0=未签到 / 1=已签到

---

## 四、邀请指标

| 指标 | 单位 | 口径 | 筛选方式 | 是否受时间筛选影响 |
|------|------|------|---------|:---:|
| 邀请注册数 | 人 | `COUNT(*)` WHERE `trigger_event='register'` | 按 `add_time` | 是 |
| 一级邀请成功数 | 人 | `COUNT(*)` WHERE `trigger_event='first_order'` | 按 `add_time` | 是 |
| 邀请转化率 | % | 被邀请注册用户数 / 总用户数 × 100 | 无 | 否（累计值） |

**触发事件说明**（sxo_invite_reward.trigger_event）：
- register=被邀请人注册 / first_order=被邀请人首单完成

---

## 五、商品运营指标

| 指标 | 单位 | 口径 | 筛选方式 | 是否受时间筛选影响 |
|------|------|------|---------|:---:|
| 上架商品数 | 件 | `COUNT(*)` WHERE `is_shelves=1 AND is_delete_time=0` | 无 | 否（实时值） |
| 低库存商品 | 件 | 同上 + `inventory <= 10` | 无 | 否（实时值） |
| 高风险待资质 | 件 | 同上 + `stage <> '' AND (approval_number IS NULL OR approval_number='')` | 无 | 否（实时值） |
| 母婴推荐商品 | 件 | 同上 + `stage <> ''` | 无 | 否（实时值） |

**低库存阈值**：库存 ≤ 10，后续可在后台配置调整。

---

## 六、内容/合规指标

| 指标 | 单位 | 口径 | 筛选方式 | 是否受时间筛选影响 |
|------|------|------|---------|:---:|
| 待审核反馈 | 条 | `COUNT(*)` WHERE `review_status='pending' AND is_delete_time=0` | 无 | 否（实时值） |
| 已通过反馈 | 条 | `COUNT(*)` WHERE `review_status='approved' AND is_delete_time=0` | 按 `add_time` | 是 |
| 敏感词拦截 | 条 | `COUNT(*)` FROM `sxo_muying_sensitive_log`（如存在） | 按 `add_time` | 是 |

**审核状态说明**（sxo_muying_feedback.review_status）：
- pending=待审核 / approved=已通过 / rejected=已驳回

---

## 常见问题

| 问题 | 说明 |
|------|------|
| 所有指标显示 0 | 数据库无数据或时间范围选择有误，属正常现象 |
| GMV 与财务对不上 | GMV 按 `pay_price` 统计，不含退款；如需含退款请看售后订单数 |
| 活动访问数为累计值 | `access_count` 是全量累计，无法按时间拆分 |
| 邀请转化率偏高 | 分母是总用户数，初期用户少时单次邀请影响大 |
| 敏感词拦截为 0 | 日志表 `sxo_muying_sensitive_log` 可能尚未创建，系统会兼容返回 0 |
| 自定义时间范围无数据 | 确认起止日期格式为 YYYY-MM-DD，且开始日期 ≤ 结束日期 |
