# my-invite.vue 奖励单位与错误处理修正 Spec

## Why
my-invite.vue 中奖励单位显示为"元"，但后端 InviteService 奖励主逻辑是 integral（积分），单位不一致会误导用户。get_reward_list() 缺少错误处理，copy_invite_code 未校验邀请码是否为空。

## What Changes
- "获得奖励(元)" 改为 "获得积分"
- 奖励记录 amount 不再拼接"元"，改为拼接"积分"
- get_reward_list() 补齐 code!=0 和 fail 错误处理
- copy_invite_code() 增加空邀请码校验

## Impact
- Affected code: shopxo-uniapp/pages/my-invite/my-invite.vue

## ADDED Requirements

### Requirement: 奖励单位与后端一致
系统 SHALL 显示与后端奖励类型一致的单位标签。

#### Scenario: 统计区域显示
- **WHEN** 用户查看邀请统计
- **THEN** 奖励统计标签显示"获得积分"而非"获得奖励(元)"

#### Scenario: 奖励记录显示
- **WHEN** 用户查看奖励记录列表
- **THEN** 金额后缀显示"积分"而非"元"

### Requirement: 邀请码复制安全
系统 SHALL 不允许复制空邀请码。

#### Scenario: 邀请码为空时点击复制
- **WHEN** invite_code 为空时用户点击复制
- **THEN** 提示"邀请码加载中，请稍后"而非复制空字符串

## MODIFIED Requirements
无

## REMOVED Requirements
无
