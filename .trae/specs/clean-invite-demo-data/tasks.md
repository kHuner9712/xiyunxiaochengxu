# Tasks

- [x] Task 1: 清理 my-invite.vue 演示数据，改为接口驱动
  - [x] 1.1 data() 中 invite_code 改为空字符串，invite_stats 改为 { total_invites: 0, total_rewards: 0 }，reward_list 改为空数组
  - [x] 1.2 增加 loading 状态变量
  - [x] 1.3 onShow 中调用 get_invite_info 和 get_reward_list 接口
  - [x] 1.4 新增 get_invite_info 方法
  - [x] 1.5 新增 get_reward_list 方法
  - [x] 1.6 接口失败时显示错误提示，不回退到演示数据
  - [x] 1.7 share_event 改为显示"分享功能暂未开放"
  - [x] 1.8 增加加载态 UI

- [x] Task 2: 清理 invite.vue 演示数据，修复接口回退逻辑
  - [x] 2.1 data() 中 invite_code 改为空字符串，invite_list 改为空数组
  - [x] 2.2 get_invite_index 回调中 invite_code 不再回退到 self.invite_code
  - [x] 2.3 get_invite_rewardlist 回调中 invite_list 不再回退到 self.invite_list
  - [x] 2.4 接口失败时显示错误提示
  - [x] 2.5 share_event 改为显示"分享功能暂未开放"
  - [x] 2.6 增加加载态 UI

- [x] Task 3: 验证清理结果
  - [x] 3.1 grep 搜索确认无硬编码邀请码示例值
  - [x] 3.2 确认页面首次进入不展示假数据
