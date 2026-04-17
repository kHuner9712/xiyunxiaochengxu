# Tasks

- [x] Task 1: 修正 my-invite.vue 奖励单位和错误处理
  - [x] 1.1 模板第15行 "获得奖励(元)" 改为 "获得积分"
  - [x] 1.2 模板第49行 amount 后缀从 "元" 改为 "积分"
  - [x] 1.3 get_reward_list() success 回调增加 else 分支：showToast(错误信息)
  - [x] 1.4 get_reward_list() fail 回调从空函数改为 showToast('网络异常，请重试')
  - [x] 1.5 copy_invite_code() 增加 invite_code 为空时的校验提示
