# 邀请页演示数据清理 Spec

## Why
my-invite.vue 和 invite.vue 中仍残留硬编码演示数据（假邀请码、假统计、假奖励列表），页面初始状态展示假数据而非空态/加载态，接口失败时回退到演示数据，分享功能标注"开发中"而非"暂未开放"。需要彻底清理，使邀请页完全以真实接口数据驱动。

## What Changes
- my-invite.vue：删除 data() 中硬编码的 invite_code/invite_stats/reward_list 演示数据，改为空值默认；增加接口请求获取真实数据；增加加载态/空态/错误态处理；分享按钮改为"暂未开放"
- invite.vue：删除 data() 中硬编码的 invite_code/invite_list 演示数据，改为空值默认；接口回调不再回退到 self.xxx 演示数据；分享按钮改为"暂未开放"；增加加载态/错误态处理

## Impact
- Affected code: shopxo-uniapp/pages/my-invite/my-invite.vue, shopxo-uniapp/pages/invite/invite.vue
- 后端接口无需修改（InviteService.InviteInfo 和 RewardList 已可用）

## ADDED Requirements

### Requirement: 邀请页无演示数据
系统 SHALL 不在邀请页 data() 中保留任何硬编码演示数据。

#### Scenario: 页面首次加载
- **WHEN** 用户打开邀请页
- **THEN** 页面显示空态或加载态，不展示假邀请码、假统计、假奖励记录

#### Scenario: 接口成功
- **WHEN** 接口返回成功
- **THEN** 页面展示真实数据

#### Scenario: 接口失败
- **WHEN** 接口请求失败
- **THEN** 页面显示错误提示或空态，不回退到演示数据

### Requirement: 未实现功能诚实标注
系统 SHALL 对未实现的分享功能标注"暂未开放"，不使用"开发中"等模糊措辞。

#### Scenario: 点击分享按钮
- **WHEN** 用户点击分享按钮
- **THEN** 显示"分享功能暂未开放"提示

## MODIFIED Requirements
无

## REMOVED Requirements
无
