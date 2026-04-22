# 上线 Smoke Test 清单

> 面向：孕禧小程序一期部署后验收
> 执行时机：代码部署 + SQL迁移 + 缓存清理完成后

---

## 基础设施

| # | 测试项 | 操作 | 预期结果 | 实际 |
|---|--------|------|---------|------|
| 1 | 数据库连接 | 后台登录，查看首页 | 页面正常加载，无数据库错误 | |
| 2 | 配置读取 | 后台「系统→系统管理→配置管理」 | 配置列表正常显示 | |
| 3 | 缓存写入 | 后台修改任意配置并保存 | 保存成功，刷新后配置生效 | |

## 前台API

| # | 测试项 | 操作 | 预期结果 | 实际 |
|---|--------|------|---------|------|
| 4 | 首页接口 | `curl https://api.yunxi.com/api.php?s=index/index` | `{code:0, data:{...}}` | |
| 5 | 活动列表 | `curl https://api.yunxi.com/api.php?s=activity/index` | `{code:0, data:{total,page_total,items}}` | |
| 6 | 活动详情 | `curl https://api.yunxi.com/api.php?s=activity/detail&id=1` | `{code:0, data:{activity,...}}` | |
| 7 | 邀请信息 | `curl https://api.yunxi.com/api.php?s=invite/index`（需登录） | `{code:0, data:{invite_code,...}}` | |
| 8 | 邀请奖励配置 | `curl https://api.yunxi.com/api.php?s=invite/rewardconfigpublic` | `{code:0, data:{register_reward,...}}` | |
| 9 | 内容列表 | `curl https://api.yunxi.com/api.php?s=article/datalist` | `{code:0, data:{total,page_total,items}}` | |
| 10 | 标签列表 | `curl https://api.yunxi.com/api.php?s=muyinguser/taglist` | `{code:0, data:{total,page_total,items}}` | |

## 后台页面

| # | 测试项 | 操作 | 预期结果 | 实际 |
|---|--------|------|---------|------|
| 11 | 后台登录 | 访问 `adminwlmqhs.php`，输入账号密码 | 登录成功进入后台首页 | |
| 12 | 功能开关页 | 后台「运营→功能开关」 | 24个开关正常显示 | |
| 13 | 标签管理页 | 后台「运营→会员标签」 | 标签列表加载，可添加/编辑/删除 | |
| 14 | 邀请配置页 | 后台「运营→邀请配置」 | 配置项显示，可保存 | |
| 15 | 仪表盘页 | 后台「运营→数据仪表盘」 | 今日数据+阶段分布+汇总显示 | |
| 16 | 快照生成 | 点击「手动生成今日快照」 | 提示成功，重复点击不报错 | |

## 日志与审计

| # | 测试项 | 操作 | 预期结果 | 实际 |
|---|--------|------|---------|------|
| 17 | 日志写入 | 触发一次活动报名 | `runtime/log/` 下生成日志文件 | |
| 18 | 审计日志 | 报名成功后查 `sxo_muying_audit_log` | 有对应记录 | |

## Feature Flag 行为

| # | 测试项 | 操作 | 预期结果 | 实际 |
|---|--------|------|---------|------|
| 19 | 活动开关关闭 | 设 `feature_activity_enabled=0`，调 `activity/index` | `{code:-403, msg:"该功能暂未开放"}` | |
| 20 | 邀请开关关闭 | 设 `feature_invite_enabled=0`，调 `invite/index` | `{code:-403}` | |
| 21 | 内容开关关闭 | 设 `feature_content_enabled=0`，调 `article/datalist` | `{code:-403}` | |
| 22 | 会员开关关闭 | 设 `feature_membership_enabled=0`，调 `muyinguser/taglist` | `{code:-403}` | |

## 缓存恢复

| # | 测试项 | 操作 | 预期结果 | 实际 |
|---|--------|------|---------|------|
| 23 | 清缓存后恢复 | 后台清全部缓存，刷新首页 | 首页正常加载，配置重新读取 | |
| 24 | Opcache重载 | PHP重载后访问后台 | 页面正常，无白屏 | |

---

## 验收标准

- 全部 24 项通过 → 可进入测试号联调
- 1-3 项失败 → 修复后重新验收
- 4+ 项失败 → 回滚代码+数据库，排查后重新部署
