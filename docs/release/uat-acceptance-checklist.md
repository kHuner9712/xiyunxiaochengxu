# 孕禧一期正式发布前验收测试清单

> 版本：v1.0  
> 日期：2026-04-24  
> 适用环境：测试 / 预发布 / 生产  
> 通过标准：所有 P0 项 PASS，P1 项无 FAIL（允许 WARN 附说明）

---

## 目录

1. [用户注册登录](#1-用户注册登录)
2. [阶段设置与资料保存](#2-阶段设置与资料保存)
3. [首页阶段推荐](#3-首页阶段推荐)
4. [活动列表 / 详情 / 报名 / 取消 / 核销](#4-活动列表--详情--报名--取消--核销)
5. [商品浏览 / 下单 / 支付后状态流转](#5-商品浏览--下单--支付后状态流转)
6. [邀请关系绑定 / 首单奖励发放](#6-邀请关系绑定--首单奖励发放)
7. [妈妈说提交 / 审核 / 展示](#7-妈妈说提交--审核--展示)
8. [后台关键操作](#8-后台关键操作)
9. [MySQL 5.7.44 环境回归](#9-mysql-5744-环境回归)
10. [生产配置检查](#10-生产配置检查)
11. [小程序提审前自查](#11-小程序提审前自查)
12. [自动化/半自动化检查脚本](#12-自动化半自动化检查脚本)

---

## 通用前置条件

- 后端服务已部署并可访问
- 微信小程序已编译并上传到体验版
- 测试账号已准备（至少 2 个：普通用户 A / B，后台管理员 1 个）
- 后台已配置：客服电话、隐私弹窗文案、功能开关（activity/invite/feedback/content 开启）
- 数据库已有测试数据：至少 1 个已发布活动、2 个已上架商品、1 篇已发布文章

---

## 1. 用户注册登录

| 编号 | 测试项 | 优先级 | 前置条件 | 操作步骤 | 预期结果 | 建议自动化 |
|------|--------|--------|----------|----------|----------|------------|
| 1.1 | 微信授权登录 | P0 | 小程序体验版已部署 | 1. 打开小程序 2. 点击"我的"触发登录 3. 点击"微信一键登录"按钮 4. 同意隐私协议 5. 授权登录 | 成功跳转至首页，用户中心显示微信头像和昵称 | 半自动（API 层可自动化） |
| 1.2 | 隐私协议勾选校验 | P0 | 未登录状态 | 1. 不勾选协议 2. 点击登录 | 提示"请先同意隐私协议"，登录请求不发出 | 手动 |
| 1.3 | 隐私协议/用户协议跳转 | P0 | 登录页 | 1. 点击"用户协议"链接 2. 返回 3. 点击"隐私政策"链接 | 分别跳转至对应协议页面，内容正确展示 | 手动 |
| 1.4 | 一键获取手机号 | P0 | 已登录但未绑定手机号 | 1. 在 user-base 弹窗中点击"一键获取手机号" 2. 同意授权 | 手机号绑定成功，弹窗关闭 | 半自动 |
| 1.5 | 验证码绑定手机号 | P1 | 已登录但未绑定手机号 | 1. 输入手机号 2. 点击发送验证码 3. 输入验证码 4. 提交 | 验证码发送成功，绑定成功 | 半自动 |
| 1.6 | 退出登录 | P0 | 已登录 | 1. 设置页点击"退出登录" 2. 确认 | 返回登录页，用户信息清除 | 手动 |
| 1.7 | 登录态过期处理 | P1 | 登录态已过期 | 1. 清除本地 token 2. 触发任意需登录操作 | 自动跳转登录页，提示"登录已过期" | 半自动 |
| 1.8 | 邀请码携带注册 | P0 | 有邀请链接 | 1. 通过邀请链接打开小程序 2. 完成注册 | 注册成功，邀请关系自动绑定（验证 DB sxo_muying_invite_reward 表） | 半自动 |

---

## 2. 阶段设置与资料保存

| 编号 | 测试项 | 优先级 | 前置条件 | 操作步骤 | 预期结果 | 建议自动化 |
|------|--------|--------|----------|----------|----------|------------|
| 2.1 | 首次登录阶段引导弹窗 | P0 | 新用户首次登录 | 1. 登录后观察首页 | 弹出阶段引导弹窗，显示备孕/孕期/产后选项 | 手动 |
| 2.2 | 选择阶段并保存 | P0 | 阶段引导弹窗展示中 | 1. 选择"孕期" 2. 选择预产期 3. 确认 | 阶段保存成功，弹窗关闭，首页推荐内容按孕期阶段展示 | 半自动 |
| 2.3 | 修改个人资料 | P0 | 已登录 | 1. 进入个人中心 2. 点击头像/昵称 3. 修改昵称 4. 保存 | 修改成功，用户中心即时更新 | 半自动 |
| 2.4 | 修改孕育阶段 | P1 | 已设置阶段 | 1. 进入活动报名页 2. 修改阶段为"产后" 3. 填写宝宝生日 4. 提交报名 | 阶段更新成功，后续推荐按新阶段展示 | 手动 |
| 2.5 | 头像上传（微信端） | P1 | 已登录 | 1. 个人中心点击头像 2. 选择 chooseAvatar 授权 3. 选择新头像 | 头像更新成功 | 手动 |
| 2.6 | 必填字段校验 | P0 | user-base 弹窗展示 | 1. 不填昵称直接提交 | 提示"请输入昵称" | 半自动 |

---

## 3. 首页阶段推荐

| 编号 | 测试项 | 优先级 | 前置条件 | 操作步骤 | 预期结果 | 建议自动化 |
|------|--------|--------|----------|----------|----------|------------|
| 3.1 | 按阶段推荐活动 | P0 | 用户阶段为"孕期"，后台有孕期标签活动 | 1. 进入首页 2. 查看"推荐活动"区块 | 展示带有孕期标签的活动 | 半自动（API 验证） |
| 3.2 | 按阶段推荐商品 | P0 | 用户阶段为"产后"，后台有产后标签商品 | 1. 进入首页 2. 切换阶段标签 3. 查看商品列表 | 商品按阶段标签过滤展示 | 半自动 |
| 3.3 | 阶段标签切换 | P0 | 首页已加载 | 1. 点击不同阶段标签（备孕/孕期/产后） | 商品列表按选中标签刷新 | 手动 |
| 3.4 | 孕育知识展示 | P1 | 后台有已发布文章 | 1. 首页下滑至"孕育知识"区块 | 展示最新 3 篇文章 | 半自动 |
| 3.5 | 妈妈说展示 | P1 | 后台有已审核通过的反馈 | 1. 首页下滑至"妈妈说"区块 | 仅展示审核通过的反馈，最多 3 条 | 半自动 |
| 3.6 | 功能开关控制 | P1 | 后台关闭 feature_activity_enabled | 1. 刷新首页 | 活动区块不展示 | 半自动 |
| 3.7 | 未登录状态首页 | P0 | 未登录 | 1. 打开首页 | 首页正常展示，不报错，不强制弹登录 | 手动 |

---

## 4. 活动列表 / 详情 / 报名 / 取消 / 栠销

| 编号 | 测试项 | 优先级 | 前置条件 | 操作步骤 | 预期结果 | 建议自动化 |
|------|--------|--------|----------|----------|----------|------------|
| 4.1 | 活动列表加载 | P0 | 后台有已发布活动 | 1. 点击底部"活动"Tab | 活动列表正常展示，含封面/标题/时间/状态 | 半自动 |
| 4.2 | 活动详情页 | P0 | 活动列表已加载 | 1. 点击任一活动卡片 | 跳转活动详情页，展示完整信息（标题/时间/地点/费用/已报名人数/描述） | 手动 |
| 4.3 | 活动报名 | P0 | 活动状态为"报名中"，用户已登录 | 1. 点击"立即报名" 2. 填写姓名/手机号 3. 勾选隐私同意 4. 提交 | 报名成功，提示"报名成功"，按钮变为"已报名" | 半自动 |
| 4.4 | 报名必填校验 | P0 | 报名页面 | 1. 不填姓名提交 2. 不填手机号提交 3. 不勾选隐私提交 | 分别提示对应必填项错误 | 半自动 |
| 4.5 | 重复报名拦截 | P0 | 用户已报名该活动 | 1. 再次点击"立即报名" | 提示"您已报名该活动"，不重复创建记录 | 半自动 |
| 4.6 | 取消报名 | P0 | 用户已报名 | 1. 活动详情页点击"取消报名" 2. 确认 | 报名取消成功，按钮恢复为"立即报名" | 半自动 |
| 4.7 | 活动收藏 | P1 | 活动详情页 | 1. 点击收藏按钮 2. 再次点击取消收藏 | 收藏状态正确切换 | 手动 |
| 4.8 | 后台核销/签到 | P0 | 用户已报名，后台管理员登录 | 1. 后台进入活动报名列表 2. 找到报名记录 3. 点击"核销/签到" | 核销成功，报名记录状态更新为已签到，签到时间记录 | 半自动 |
| 4.9 | 重复核销拦截 | P0 | 报名记录已核销 | 1. 再次点击"核销/签到" | 提示"该用户已签到"，不重复核销 | 半自动 |
| 4.10 | 活动名额满 | P1 | 活动已报满 | 1. 尝试报名 | 提示"活动名额已满"，无法提交 | 手动 |
| 4.11 | 活动已结束 | P1 | 活动状态为"已结束" | 1. 查看活动详情 | 报名按钮不可点击或隐藏 | 手动 |
| 4.12 | 隐私告知展示 | P0 | 报名页面 | 1. 查看报名页底部隐私告知区块 | 展示隐私说明卡片，含《隐私政策》可点击链接，勾选框 | 手动 |

---

## 5. 商品浏览 / 下单 / 支付后状态流转

| 编号 | 测试项 | 优先级 | 前置条件 | 操作步骤 | 预期结果 | 建议自动化 |
|------|--------|--------|----------|----------|----------|------------|
| 5.1 | 商品列表浏览 | P0 | 后台有已上架商品 | 1. 进入分类页 2. 浏览商品列表 | 商品列表正常展示，含图片/标题/价格 | 半自动 |
| 5.2 | 商品详情页 | P0 | 商品列表已加载 | 1. 点击任一商品 | 跳转商品详情页，展示完整信息 | 手动 |
| 5.3 | 加入购物车 | P0 | 商品详情页 | 1. 选择规格（如有） 2. 点击"加入购物车" | 提示添加成功，购物车数量+1 | 半自动 |
| 5.4 | 购物车操作 | P0 | 购物车有商品 | 1. 修改数量 2. 删除商品 3. 全选/取消全选 | 操作正确响应，金额计算正确 | 手动 |
| 5.5 | 提交订单 | P0 | 购物车已选商品 | 1. 点击结算 2. 选择收货地址 3. 确认订单 | 跳转支付页面 | 半自动 |
| 5.6 | 微信支付 | P0 | 订单已创建，微信支付已配置 | 1. 选择微信支付 2. 完成支付 | 支付成功，订单状态变为"已支付" | 手动 |
| 5.7 | 支付后订单状态 | P0 | 支付完成 | 1. 进入"我的订单" 2. 查看订单详情 | 订单状态为"已支付"，可查看物流/申请售后 | 半自动 |
| 5.8 | 订单取消 | P1 | 订单未支付 | 1. 在订单列表点击"取消订单" 2. 确认 | 订单状态变为"已取消" | 半自动 |
| 5.9 | 收货地址管理 | P0 | 已登录 | 1. 新增收货地址 2. 编辑 3. 删除 4. 设为默认 | 地址 CRUD 正常 | 手动 |
| 5.10 | 收货地址选择位置 | P1 | 地址编辑页 | 1. 点击"选择位置" 2. 授权定位 3. 选择地址 | 地址信息自动填充 | 手动 |

---

## 6. 邀请关系绑定 / 首单奖励发放

| 编号 | 测试项 | 优先级 | 前置条件 | 操作步骤 | 预期结果 | 建议自动化 |
|------|--------|--------|----------|----------|----------|------------|
| 6.1 | 邀请码生成 | P0 | 用户已登录 | 1. 进入"邀请有礼"页面 | 展示用户专属邀请码和分享按钮 | 半自动 |
| 6.2 | 分享邀请链接 | P0 | 邀请页面已加载 | 1. 点击"分享给好友" 2. 选择分享对象 | 分享卡片携带 invite_code 参数 | 手动 |
| 6.3 | 新用户通过邀请码注册 | P0 | 有邀请链接 | 1. 新用户打开邀请链接 2. 完成注册 | 注册成功，sxo_invite_reward 表创建记录，trigger_event='register'，reward_value=0，status=1(GRANTED，仅绑定关系不发放积分) | 半自动（DB 验证） |
| 6.4 | 首单奖励自动发放 | P0 | 被邀请人已注册且完成首单支付，auto_grant=1 | 1. 被邀请人下单并支付成功 2. 查看邀请人积分 | 邀请人积分增加，sxo_invite_reward 表新增 trigger_event='first_order' 记录，status=1(GRANTED) | 半自动（DB 验证） |
| 6.5 | 首单奖励配置读取 | P1 | 后台配置 muying_invite_first_order_reward=100 | 1. 查看邀请页奖励说明 | 展示"+100积分" | 半自动 |
| 6.6 | 每日上限控制 | P1 | 后台配置 muying_invite_daily_limit=2 | 1. 同一邀请人当日第3次触发首单奖励 | 超限后不创建新奖励记录，接口返回"邀请人今日已达奖励上限"（不产生daily_limited状态记录） | 半自动（DB 验证） |
| 6.7 | 奖励记录列表 | P0 | 有奖励记录 | 1. 进入"我的邀请"页面 2. 查看奖励记录 | 展示奖励列表，含状态/时间/积分 | 手动 |
| 6.8 | 后台手动补发 | P1 | 有 PENDING(0) 状态的奖励记录 | 1. 后台进入邀请奖励列表 2. 点击"补发" | 奖励发放成功，状态变为 GRANTED(1) | 半自动 |
| 6.9 | 后台撤销奖励 | P1 | 有 GRANTED(1) 状态的奖励记录 | 1. 后台点击"撤销" | 奖励撤销，积分扣回，状态变为 REVOKED(3) | 半自动 |
| 6.10 | 无邀请码注册 | P0 | 直接打开小程序注册 | 1. 不带邀请码注册 2. 查看数据库 | 注册成功，无 invite_reward 记录 | 半自动（DB 验证） |
| 6.11 | 首单奖励手动发放 | P1 | auto_grant=0，有 PENDING(0) 状态记录 | 1. 被邀请人完成首单 2. 后台查看奖励列表 3. 手动补发 | 记录创建为 PENDING(0)，后台补发后变为 GRANTED(1) | 半自动 |

---

## 7. 妈妈说提交 / 审核 / 展示

| 编号 | 测试项 | 优先级 | 前置条件 | 操作步骤 | 预期结果 | 建议自动化 |
|------|--------|--------|----------|----------|----------|------------|
| 7.1 | 提交反馈 | P0 | 已登录，feature_feedback_enabled=1 | 1. 用户中心点击"意见反馈" 2. 输入内容 3. 选择阶段 4. 提交 | 提交成功，提示"审核通过后将在首页展示" | 半自动 |
| 7.2 | 反馈内容必填校验 | P0 | 反馈提交页面 | 1. 不输入内容直接提交 | 提示"请输入反馈内容" | 半自动 |
| 7.3 | 反馈内容长度限制 | P1 | 反馈提交页面 | 1. 输入超过 500 字内容 | 字数计数器正确，超长内容被截断 | 手动 |
| 7.4 | 敏感词拦截 | P0 | 后台配置了敏感词 | 1. 提交包含敏感词的反馈 | 提示"内容包含敏感词，请修改" | 半自动 |
| 7.5 | 联系方式检测 | P0 | 反馈内容中包含手机号/微信号 | 1. 在反馈内容中输入手机号 2. 提交 | 提示"内容中不能包含联系方式" | 半自动 |
| 7.6 | 后台审核通过 | P0 | 有待审核反馈 | 1. 后台进入反馈列表 2. 点击"审核" 3. 选择"通过" | 审核成功，is_enable=1，首页妈妈说区块展示该条 | 半自动 |
| 7.7 | 后台审核拒绝 | P0 | 有待审核反馈 | 1. 后台点击"审核" 2. 选择"拒绝" 3. 填写拒绝原因 | 审核成功，is_enable=0，首页不展示 | 半自动 |
| 7.8 | 首页仅展示已审核 | P0 | 有多条反馈（含待审核和已通过） | 1. 查看首页妈妈说区块 | 仅展示审核通过的反馈，待审核的不展示 | 半自动 |
| 7.9 | 反馈功能开关 | P1 | feature_feedback_enabled=0 | 1. 尝试访问反馈页面 | 提示"该功能暂未开放"或入口不展示 | 半自动 |
| 7.10 | 未登录提交反馈 | P1 | 未登录 | 1. 点击"意见反馈" | 跳转登录页 | 手动 |

---

## 8. 后台关键操作

| 编号 | 测试项 | 优先级 | 前置条件 | 操作步骤 | 预期结果 | 建议自动化 |
|------|--------|--------|----------|----------|----------|------------|
| 8.1 | 后台登录 | P0 | 管理员账号已创建 | 1. 访问后台地址 2. 输入账号密码 3. 登录 | 登录成功，进入管理后台 | 手动 |
| 8.2 | 运营工作台数据展示 | P0 | 后台已登录 | 1. 查看工作台 | 展示今日订单数/销售额/新增用户/活动报名数/邀请首单奖励数/待审核反馈数 | 手动 |
| 8.3 | 活动创建与发布 | P0 | 后台已登录 | 1. 进入活动管理 2. 新建活动 3. 填写信息 4. 发布 | 活动创建成功，前台活动列表可见 | 半自动 |
| 8.4 | 活动编辑 | P1 | 有已创建活动 | 1. 点击编辑 2. 修改信息 3. 保存 | 修改成功，前台同步更新 | 手动 |
| 8.5 | 活动报名列表导出 | P1 | 有报名数据 | 1. 进入报名列表 2. 点击导出 | 导出 Excel 文件，数据正确 | 手动 |
| 8.6 | 功能开关配置 | P0 | 后台已登录 | 1. 进入功能开关页面 2. 切换开关 3. 保存 | 配置保存成功，前台即时生效 | 半自动 |
| 8.7 | 邀请奖励配置 | P0 | 后台已登录 | 1. 修改首单奖励积分 2. 保存 | 配置保存成功，前台展示更新 | 半自动 |
| 8.8 | 反馈审核 | P0 | 有待审核反馈 | 1. 进入反馈管理 2. 审核通过/拒绝 | 审核操作成功，状态正确更新 | 半自动 |
| 8.9 | 商品上下架 | P0 | 有已创建商品 | 1. 商品管理 2. 上架/下架 | 操作成功，前台同步 | 半自动 |
| 8.10 | 订单管理 | P0 | 有订单数据 | 1. 进入订单列表 2. 查看详情 3. 修改状态 | 操作正确 | 手动 |
| 8.11 | 后台入口安全性 | P0 | 后台已部署 | 1. 确认后台入口文件名非默认 admin.php 2. 确认 install.php 已删除 | 后台入口已重命名，安装文件已删除 | 半自动（脚本检查） |

---

## 9. MySQL 5.7.44 环境回归

| 编号 | 测试项 | 优先级 | 前置条件 | 操作步骤 | 预期结果 | 建议自动化 |
|------|--------|--------|----------|----------|----------|------------|
| 9.1 | 数据库连接 | P0 | MySQL 5.7.44 已部署 | 1. 后端启动 2. 访问任意 API | 数据库连接正常，无报错 | 自动（脚本） |
| 9.2 | 全量 SQL 执行 | P0 | MySQL 5.7.44 环境 | 1. 依次执行 docs/sql/ 下所有迁移脚本 | 全部执行成功，无语法错误 | 自动（脚本） |
| 9.3 | 字符集验证 | P0 | 数据库已初始化 | 1. 执行 `SHOW VARIABLES LIKE 'character_set%'` | character_set_database=utf8mb4，collation 为 utf8mb4_general_ci | 自动（脚本） |
| 9.4 | JSON 字段兼容 | P1 | 有 JSON 类型字段 | 1. 读写 JSON 字段 | MySQL 5.7 JSON 类型正常工作 | 自动（脚本） |
| 9.5 | 全文索引兼容 | P1 | 有 FULLTEXT 索引 | 1. 执行全文搜索查询 | 查询正常返回 | 自动（脚本） |
| 9.6 | only_full_group_by 兼容 | P0 | MySQL 5.7 默认开启 ONLY_FULL_GROUP_BY | 1. 执行含 GROUP BY 的业务查询 | 查询不报错 | 自动（脚本） |
| 9.7 | 数据完整性 | P0 | 全量数据已导入 | 1. 运行 check-db.sql | 所有检查项 PASS | 自动（脚本） |

---

## 10. 生产配置检查

| 编号 | 测试项 | 优先级 | 前置条件 | 操作步骤 | 预期结果 | 建议自动化 |
|------|--------|--------|----------|----------|----------|------------|
| 10.1 | APP_DEBUG 关闭 | P0 | 生产环境 | 1. 检查 .env 文件 APP_DEBUG=false | APP_DEBUG 为 false | 自动（脚本） |
| 10.2 | 数据库密码非弱密码 | P0 | 生产环境 | 1. 检查 .env 中 DB_PASS | 非默认密码(root/123456等) | 自动（脚本） |
| 10.3 | 后台入口重命名 | P0 | 生产环境 | 1. 确认后台入口文件名 | 非 admin.php 默认名 | 自动（脚本） |
| 10.4 | install.php 已删除 | P0 | 生产环境 | 1. 检查 public/install.php 是否存在 | 文件不存在 | 自动（脚本） |
| 10.5 | HTTPS 强制 | P0 | 生产环境 | 1. HTTP 访问任意页面 | 301/302 跳转到 HTTPS | 自动（脚本） |
| 10.6 | 敏感信息不暴露 | P0 | 生产环境 | 1. 访问错误页面 2. 查看响应头 | 无 PHP 版本/框架信息泄露，无堆栈信息 | 自动（脚本） |
| 10.7 | 微信 AppID/AppSecret 配置 | P0 | 生产环境 | 1. 检查 manifest.json 和后台配置 | AppID 已填写，AppSecret 非空 | 半自动 |
| 10.8 | 支付配置正确 | P0 | 生产环境 | 1. 后台检查微信支付配置 | 商户号/密钥已配置 | 手动 |
| 10.9 | 定时任务配置 | P1 | 生产环境 | 1. 检查 crontab | ShopXO 定时任务已配置 | 半自动 |
| 10.10 | 文件权限 | P0 | 生产环境 | 1. 检查 runtime/upload 等目录权限 | 可写，非 777 | 自动（脚本） |
| 10.11 | 占位符残留 | P0 | 生产环境 | 1. 运行 check-placeholders.sh | 无占位符残留 | 自动（脚本） |
| 10.12 | Nginx 配置 | P0 | 生产环境 | 1. 检查 Nginx 配置 2. 测试 rewrite 规则 | URL 重写正常，静态资源可访问 | 半自动 |

---

## 11. 小程序提审前自查

| 编号 | 测试项 | 优先级 | 前置条件 | 操作步骤 | 预期结果 | 建议自动化 |
|------|--------|--------|----------|----------|----------|------------|
| 11.1 | requiredPrivateInfos 最小化 | P0 | manifest.json 已修改 | 1. 检查 mp-weixin.requiredPrivateInfos | 仅含 chooseLocation 和 getLocation | 自动（脚本） |
| 11.2 | 位置权限 desc 文案 | P0 | manifest.json 已修改 | 1. 检查 permission.scope.userLocation.desc | 包含具体使用场景说明 | 半自动 |
| 11.3 | 隐私弹窗文案 | P0 | 后台已配置 | 1. 检查 common_app_mini_weixin_privacy_content | 文案清晰说明收集目的和用途 | 半自动 |
| 11.4 | 隐私政策完整性 | P0 | agreement.vue | 1. 查看隐私政策内容 | 包含：手机号/位置/相册/摄像头收集说明，拒绝授权不影响说明 | 手动 |
| 11.5 | 用户协议完整性 | P0 | agreement.vue | 1. 查看用户协议内容 | 包含服务范围/账号规范/免责声明/争议解决 | 手动 |
| 11.6 | 隐私政策入口 | P0 | 小程序运行中 | 1. 登录页 2. 用户中心 3. 活动报名页 | 三处均有隐私政策入口 | 手动 |
| 11.7 | 客服入口 | P0 | 小程序运行中 | 1. 用户中心 2. 设置页 3. 商品详情页 | 至少一处有客服入口 | 手动 |
| 11.8 | 反馈入口 | P0 | 小程序运行中 | 1. 用户中心 | 有"意见反馈"入口 | 手动 |
| 11.9 | 权限按需申请 | P0 | 小程序运行中 | 1. 首页加载 2. 不操作任何需权限功能 | 不弹出任何权限授权弹窗 | 手动 |
| 11.10 | 位置权限申请时机 | P0 | 小程序运行中 | 1. 点击"选择位置"或地址选择 | 此时才弹出位置授权弹窗 | 手动 |
| 11.11 | 相册权限申请时机 | P0 | 小程序运行中 | 1. 点击更换头像 | 此时才弹出相册授权 | 手动 |
| 11.12 | 手机号授权申请时机 | P0 | 小程序运行中 | 1. 点击"一键获取手机号"按钮 | 此时才弹出手机号授权 | 手动 |
| 11.13 | 无测试/调试内容 | P0 | 小程序全页面 | 1. 逐页检查 | 无"测试"/"TODO"/"占位"等字样 | 半自动（脚本扫描） |
| 11.14 | 无 console.log 残留 | P1 | 编译产物 | 1. 检查编译后代码 | 无 console.log/console.error 残留 | 半自动 |
| 11.15 | 微信后台隐私协议同步 | P0 | 微信后台 | 1. 登录 mp.weixin.qq.com 2. 检查隐私协议 | 与前端隐私政策内容一致 | 手动 |
| 11.16 | 版本号正确 | P0 | manifest.json | 1. 检查 versionName/versionCode | 版本号正确，非 0.0.1 等测试版本 | 半自动 |
| 11.17 | 体验版全流程走通 | P0 | 体验版已上传 | 1. 体验版完成注册→设置阶段→浏览→报名→下单全流程 | 全流程无阻断性 bug | 手动 |

---

## 12. 自动化/半自动化检查脚本

### 12.1 已有脚本（scripts/preflight/）

| 脚本 | 功能 | 用法 |
|------|------|------|
| `release-gate.sh` | 一键发布门禁（串联占位符+服务器+数据库检查） | `bash scripts/preflight/release-gate.sh --env .env.production` |
| `check-server.sh` | 服务器环境预检（PHP/MySQL/扩展/权限/安全） | `bash scripts/preflight/check-server.sh` |
| `check-placeholders.sh` | 占位符残留扫描 | `bash scripts/preflight/check-placeholders.sh` |
| `check-db.sql` | 数据库结构/数据完整性检查 | `mysql -u root -p db_name < scripts/preflight/check-db.sql` |
| `lib-env.sh` | .env 解析公共库 | 被 check-server.sh 等引用 |

### 12.2 新增：提审前自动化检查脚本

新增 `scripts/preflight/check-wechat-review.sh`，用于提审前自动检查：

```bash
#!/bin/bash
# 小程序提审前自动化检查
# 用法: bash scripts/preflight/check-wechat-review.sh [项目根目录]

set -euo pipefail
ROOT_DIR="${1:-$(cd "$(dirname "$0")/../.." && pwd)}"
UNIAPP_DIR="$ROOT_DIR/shopxo-uniapp"
MANIFEST="$UNIAPP_DIR/manifest.json"
PASS=0
FAIL=0
WARN=0

check_pass() { echo "  ✅ PASS: $1"; ((PASS++)); }
check_fail() { echo "  ❌ FAIL: $1"; ((FAIL++)); }
check_warn() { echo "  ⚠️  WARN: $1"; ((WARN++)); }

echo "========================================="
echo "  小程序提审前自动化检查"
echo "  项目: $ROOT_DIR"
echo "========================================="

# 1. requiredPrivateInfos 检查
echo ""
echo "[1] requiredPrivateInfos 检查"
if command -v python3 &>/dev/null; then
    RPI=$(python3 -c "
import json,sys
with open('$MANIFEST','r',encoding='utf-8') as f:
    d=json.load(f)
rpi=d.get('mp-weixin',{}).get('requiredPrivateInfos',[])
print(','.join(rpi))
" 2>/dev/null)
    if [ "$RPI" = "chooseLocation,getLocation" ]; then
        check_pass "requiredPrivateInfos 仅含 chooseLocation,getLocation"
    else
        check_fail "requiredPrivateInfos=$RPI, 预期仅 chooseLocation,getLocation"
    fi
else
    check_warn "python3 不可用，跳过 JSON 解析"
fi

# 2. 位置权限 desc 检查
echo ""
echo "[2] 位置权限 desc 文案检查"
if command -v python3 &>/dev/null; then
    DESC=$(python3 -c "
import json
with open('$MANIFEST','r',encoding='utf-8') as f:
    d=json.load(f)
desc=d.get('mp-weixin',{}).get('permission',{}).get('scope.userLocation',{}).get('desc','')
print(desc)
" 2>/dev/null)
    if echo "$DESC" | grep -qiE "活动|签到|地址"; then
        check_pass "位置权限 desc 包含具体场景说明"
    else
        check_fail "位置权限 desc 缺少具体场景说明: $DESC"
    fi
else
    check_warn "python3 不可用，跳过"
fi

# 3. __usePrivacyCheck__ 检查
echo ""
echo "[3] 隐私检查开关"
if command -v python3 &>/dev/null; then
    PRIVACY=$(python3 -c "
import json
with open('$MANIFEST','r',encoding='utf-8') as f:
    d=json.load(f)
print(d.get('mp-weixin',{}).get('__usePrivacyCheck__',False))
" 2>/dev/null)
    if [ "$PRIVACY" = "True" ]; then
        check_pass "__usePrivacyCheck__ 已开启"
    else
        check_fail "__usePrivacyCheck__ 未开启"
    fi
else
    check_warn "python3 不可用，跳过"
fi

# 4. iOS 后台定位声明检查
echo ""
echo "[4] iOS 后台定位声明检查"
if command -v python3 &>/dev/null; then
    ALWAYS_DESC=$(python3 -c "
import json
with open('$MANIFEST','r',encoding='utf-8') as f:
    d=json.load(f)
pd=d.get('app-plus',{}).get('distribute',{}).get('ios',{}).get('privacyDescription',{})
print(pd.get('NSLocationAlwaysUsageDescription','NOT_FOUND'))
" 2>/dev/null)
    if [ "$ALWAYS_DESC" = "NOT_FOUND" ]; then
        check_pass "iOS 后台定位声明已移除"
    else
        check_fail "iOS 后台定位声明仍存在，提审可能被拒"
    fi
else
    check_warn "python3 不可用，跳过"
fi

# 5. Android 高敏感权限检查
echo ""
echo "[5] Android 高敏感权限检查"
DANGEROUS_PERMS="READ_CONTACTS|WRITE_CONTACTS|READ_PHONE_STATE|CALL_PHONE|RECORD_AUDIO|READ_LOGS"
if grep -qE "$DANGEROUS_PERMS" "$MANIFEST" 2>/dev/null; then
    check_fail "manifest.json 仍包含高敏感 Android 权限"
else
    check_pass "无高敏感 Android 权限"
fi

# 6. 代码中 startLocationUpdate/onLocationChange 检查（微信编译产物）
echo ""
echo "[6] 微信端位置监听 API 残留检查"
# 检查源码中是否有未加条件编译的 startLocationUpdate
if grep -rn "uni\.startLocationUpdate\|uni\.onLocationChange\|uni\.startLocationUpdateBackground" \
    "$UNIAPP_DIR/App.vue" 2>/dev/null | grep -v "#ifndef MP-WEIXIN" | grep -v "// #"; then
    check_warn "App.vue 中存在未加 MP-WEIXIN 条件编译守卫的位置监听 API（需确认编译后是否排除）"
else
    check_pass "App.vue 中位置监听 API 已加条件编译守卫"
fi

# 7. 隐私政策内容检查
echo ""
echo "[7] 隐私政策内容完整性检查"
AGREEMENT="$UNIAPP_DIR/pages/agreement/agreement.vue"
if [ -f "$AGREEMENT" ]; then
    for keyword in "位置信息" "相册" "摄像头" "拒绝授权"; do
        if grep -q "$keyword" "$AGREEMENT"; then
            check_pass "隐私政策包含'$keyword'说明"
        else
            check_fail "隐私政策缺少'$keyword'说明"
        fi
    done
else
    check_fail "agreement.vue 文件不存在"
fi

# 8. 测试/调试内容扫描
echo ""
echo "[8] 测试/调试内容扫描"
TEST_KEYWORDS="TODO:|FIXME:|HACK:|占位|测试数据|test123"
FOUND=0
for ext in vue js; do
    while IFS= read -r line; do
        echo "  ⚠️  $line"
        ((FOUND++))
    done < <(grep -rn -iE "$TEST_KEYWORDS" "$UNIAPP_DIR/pages/" --include="*.$ext" 2>/dev/null | head -20)
done
if [ "$FOUND" -eq 0 ]; then
    check_pass "页面代码中未发现测试/调试内容"
else
    check_warn "发现 $FOUND 处疑似测试/调试内容，请人工确认"
fi

# 9. 版本号检查
echo ""
echo "[9] 版本号检查"
if command -v python3 &>/dev/null; then
    VER=$(python3 -c "
import json
with open('$MANIFEST','r',encoding='utf-8') as f:
    d=json.load(f)
print(d.get('versionName',''))
" 2>/dev/null)
    if [ -n "$VER" ] && [ "$VER" != "0.0.1" ] && [ "$VER" != "0.0.0" ]; then
        check_pass "版本号: $VER"
    else
        check_fail "版本号异常: $VER"
    fi
else
    check_warn "python3 不可用，跳过"
fi

# 10. AppID 非空检查
echo ""
echo "[10] AppID 检查"
if command -v python3 &>/dev/null; then
    APPID=$(python3 -c "
import json
with open('$MANIFEST','r',encoding='utf-8') as f:
    d=json.load(f)
print(d.get('mp-weixin',{}).get('appid',''))
" 2>/dev/null)
    if [ -n "$APPID" ] && [ "$APPID" != "" ]; then
        check_pass "微信 AppID 已配置"
    else
        check_fail "微信 AppID 未配置"
    fi
else
    check_warn "python3 不可用，跳过"
fi

# 汇总
echo ""
echo "========================================="
echo "  检查结果汇总"
echo "  ✅ PASS: $PASS"
echo "  ❌ FAIL: $FAIL"
echo "  ⚠️  WARN: $WARN"
echo "========================================="
if [ "$FAIL" -gt 0 ]; then
    echo "  结论: ❌ 不通过，请修复 FAIL 项后重新检查"
    exit 1
elif [ "$WARN" -gt 0 ]; then
    echo "  结论: ⚠️  有警告项，请人工确认后决定是否继续"
    exit 0
else
    echo "  结论: ✅ 全部通过"
    exit 0
fi
```

### 12.3 新增：API 健康检查脚本

新增 `scripts/preflight/check-api-health.sh`，用于验收时快速验证核心 API：

```bash
#!/bin/bash
# API 健康检查脚本
# 用法: bash scripts/preflight/check-api-health.sh [BASE_URL]
# 示例: bash scripts/preflight/check-api-health.sh https://your-domain.com/api.php

set -euo pipefail
BASE_URL="${1:-http://localhost:8080/api.php}"
PASS=0
FAIL=0

check_pass() { echo "  ✅ PASS: $1"; ((PASS++)); }
check_fail() { echo "  ❌ FAIL: $1 - $2"; ((FAIL++)); }

echo "========================================="
echo "  API 健康检查"
echo "  BASE_URL: $BASE_URL"
echo "========================================="

# 1. 首页配置接口
echo ""
echo "[1] 首页配置接口"
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL?s=common.index.index" 2>/dev/null || echo "000")
if [ "$HTTP_CODE" = "200" ]; then
    check_pass "首页配置接口返回 200"
else
    check_fail "首页配置接口" "HTTP $HTTP_CODE"
fi

# 2. 活动列表接口
echo ""
echo "[2] 活动列表接口"
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL?s=activity.index.index&n=4" 2>/dev/null || echo "000")
if [ "$HTTP_CODE" = "200" ]; then
    check_pass "活动列表接口返回 200"
else
    check_fail "活动列表接口" "HTTP $HTTP_CODE"
fi

# 3. 商品搜索接口
echo ""
echo "[3] 商品搜索接口"
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL?s=search.datalist&n=5" 2>/dev/null || echo "000")
if [ "$HTTP_CODE" = "200" ]; then
    check_pass "商品搜索接口返回 200"
else
    check_fail "商品搜索接口" "HTTP $HTTP_CODE"
fi

# 4. 文章列表接口
echo ""
echo "[4] 文章列表接口"
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL?s=article.datalist&n=3" 2>/dev/null || echo "000")
if [ "$HTTP_CODE" = "200" ]; then
    check_pass "文章列表接口返回 200"
else
    check_fail "文章列表接口" "HTTP $HTTP_CODE"
fi

# 5. 反馈列表接口
echo ""
echo "[5] 反馈列表接口"
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL?s=feedback.index&n=3" 2>/dev/null || echo "000")
if [ "$HTTP_CODE" = "200" ]; then
    check_pass "反馈列表接口返回 200"
else
    check_fail "反馈列表接口" "HTTP $HTTP_CODE"
fi

# 6. 邀请配置接口
echo ""
echo "[6] 邀请配置接口"
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL?s=invite.rewardconfigpublic" 2>/dev/null || echo "000")
if [ "$HTTP_CODE" = "200" ]; then
    check_pass "邀请配置接口返回 200"
else
    check_fail "邀请配置接口" "HTTP $HTTP_CODE"
fi

# 7. 协议接口
echo ""
echo "[7] 协议接口"
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL?s=agreement.index&document=userprivacy" 2>/dev/null || echo "000")
if [ "$HTTP_CODE" = "200" ]; then
    check_pass "隐私协议接口返回 200"
else
    check_fail "隐私协议接口" "HTTP $HTTP_CODE"
fi

# 汇总
echo ""
echo "========================================="
echo "  API 健康检查结果"
echo "  ✅ PASS: $PASS"
echo "  ❌ FAIL: $FAIL"
echo "========================================="
if [ "$FAIL" -gt 0 ]; then
    echo "  结论: ❌ 有接口不可用，请排查"
    exit 1
else
    echo "  结论: ✅ 全部接口正常"
    exit 0
fi
```

---

## 附录 A：验收通过标准

| 等级 | 要求 |
|------|------|
| P0 项 | 必须 100% PASS，不允许 FAIL |
| P1 项 | 允许 WARN（附说明和修复计划），不允许 FAIL |
| 自动化脚本 | release-gate.sh + check-wechat-review.sh + check-api-health.sh 全部 PASS |
| 体验版全流程 | 注册→阶段设置→浏览→报名→下单→支付 至少走通 1 次 |

## 附录 B：验收签字

| 角色 | 姓名 | 签字 | 日期 |
|------|------|------|------|
| 产品负责人 | | | |
| 开发负责人 | | | |
| 测试负责人 | | | |
| 运维负责人 | | | |
