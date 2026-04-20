# MVP联调与演示路径

## 一、环境准备

### 1.1 Docker启动

```powershell
cd c:\Users\15864\Desktop\yunxixiaochengxu
docker compose up -d
```

验证容器状态：

```powershell
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
```

应看到三个容器均为 `Up`：
- shopxo-nginx: 0.0.0.0:8080->80/tcp
- shopxo-php: 9000/tcp
- shopxo-mysql: 0.0.0.0:3306->3306/tcp

### 1.2 数据库迁移

> **唯一入口**：使用 `docs/muying-final-migration.sql`（旧脚本已废弃，不要单独执行）。

```powershell
# 执行最终迁移（包含建表+补丁+索引+菜单权限）
docker exec -i shopxo-mysql mysql -uroot -proot123456 shopxo < docs/muying-final-migration.sql
```

验证表是否创建成功：

```powershell
docker exec shopxo-mysql mysql -uroot -proot123456 -e "SHOW TABLES LIKE 'sxo_activity%'; SHOW TABLES LIKE 'sxo_invite%';" shopxo
```

应返回：
- sxo_activity
- sxo_activity_signup
- sxo_invite_reward

### 1.3 演示数据导入

```powershell
# 导入演示活动数据
docker exec -i shopxo-mysql mysql -uroot -proot123456 shopxo <<'EOF'
INSERT INTO `sxo_activity` (`title`, `cover`, `category`, `stage`, `suitable_crowd`, `description`, `content`, `address`, `start_time`, `end_time`, `signup_start_time`, `signup_end_time`, `max_count`, `signup_count`, `is_free`, `price`, `contact_name`, `contact_phone`, `access_count`, `sort_level`, `is_enable`, `is_delete_time`, `add_time`, `upd_time`) VALUES
('孕妈瑜伽课堂·第二期', '', 'classroom', 'pregnancy', '孕12周以上的准妈妈，无高危妊娠指征', '专业孕产瑜伽导师授课，温和运动课程', '<p>孕妈瑜伽是专为孕期妈妈设计的温和运动课程。</p>', '云禧母婴中心3楼瑜伽室', UNIX_TIMESTAMP()+86400*3, UNIX_TIMESTAMP()+86400*3+5400, UNIX_TIMESTAMP(), UNIX_TIMESTAMP()+86400*2, 30, 18, 1, 0.00, '李老师', '138****6789', 156, 100, 1, 0, UNIX_TIMESTAMP(), UNIX_TIMESTAMP()),
('新生儿护理沙龙', '', 'salon', 'postpartum', '产后0-6个月的新手妈妈', '专业护士分享新生儿护理技巧', '<p>新生儿护理沙龙，手把手教你宝宝护理。</p>', '云禧母婴中心2楼活动室', UNIX_TIMESTAMP()+86400*5, UNIX_TIMESTAMP()+86400*5+7200, UNIX_TIMESTAMP(), UNIX_TIMESTAMP()+86400*4, 20, 8, 1, 0.00, '王护士', '139****1234', 89, 90, 1, 0, UNIX_TIMESTAMP(), UNIX_TIMESTAMP()),
('备孕营养讲座', '', 'lecture', 'prepare', '计划怀孕的准爸妈', '营养师讲解备孕期间的饮食调理', '<p>科学备孕，营养先行。</p>', '云禧母婴中心1楼报告厅', UNIX_TIMESTAMP()+86400*7, UNIX_TIMESTAMP()+86400*7+5400, UNIX_TIMESTAMP(), UNIX_TIMESTAMP()+86400*6, 50, 22, 1, 0.00, '张营养师', '137****5678', 67, 80, 1, 0, UNIX_TIMESTAMP(), UNIX_TIMESTAMP()),
('母婴好物试用官招募', '', 'trial', 'all', '所有阶段的妈妈', '免费试用新品，分享使用体验', '<p>成为试用官，抢先体验新品。</p>', '线上活动', UNIX_TIMESTAMP()+86400*10, UNIX_TIMESTAMP()+86400*20, UNIX_TIMESTAMP(), UNIX_TIMESTAMP()+86400*8, 100, 45, 1, 0.00, '客服小云', '136****9012', 234, 70, 1, 0, UNIX_TIMESTAMP(), UNIX_TIMESTAMP()),
('母亲节特别活动', '', 'holiday', 'all', '所有妈妈', '母亲节专属福利活动', '<p>感恩母亲节，好礼送不停。</p>', '云禧母婴中心全馆', UNIX_TIMESTAMP()+86400*15, UNIX_TIMESTAMP()+86400*15+14400, UNIX_TIMESTAMP(), UNIX_TIMESTAMP()+86400*14, 200, 0, 1, 0.00, '活动组', '135****3456', 0, 60, 1, 0, UNIX_TIMESTAMP(), UNIX_TIMESTAMP()),
('每日签到打卡', '', 'checkin', 'all', '所有用户', '每日签到领积分', '<p>坚持签到，积分翻倍。</p>', '线上活动', UNIX_TIMESTAMP(), UNIX_TIMESTAMP()+86400*365, UNIX_TIMESTAMP(), UNIX_TIMESTAMP()+86400*365, 0, 0, 1, 0.00, '系统', '', 0, 50, 1, 0, UNIX_TIMESTAMP(), UNIX_TIMESTAMP());
EOF
```

### 1.4 权限缓存清除

```powershell
docker exec shopxo-php rm -rf /var/www/html/runtime/cache/*
docker exec shopxo-php rm -rf /var/www/html/runtime/temp/*
```

### 1.5 管理员角色权限分配

1. 访问 `http://localhost:8080/adminwlmqhs.php`
2. 使用 admin / admin123456 登录
3. 进入：系统管理 → 角色管理 → 编辑管理员角色
4. 勾选"运营"及所有子权限
5. 保存

### 1.6 前端启动

1. 打开 HBuilderX
2. 打开 `shopxo-uniapp` 目录
3. 运行 → 运行到浏览器 → Chrome（H5模式）

或运行到微信开发者工具（需已安装并配置AppID）。

### 1.7 邀请奖励配置（可选）

```powershell
# 设置注册奖励50积分、首单奖励100积分
docker exec shopxo-mysql mysql -uroot -proot123456 shopxo <<'EOF'
INSERT INTO `sxo_config` (`only_tag`, `value`, `type`, `upd_time`) VALUES
('muying_invite_register_reward', '50', 'admin', UNIX_TIMESTAMP()),
('muying_invite_first_order_reward', '100', 'admin', UNIX_TIMESTAMP())
ON DUPLICATE KEY UPDATE `value`=VALUES(`value`), `upd_time`=VALUES(`upd_time`);
EOF
```

---

## 二、演示路径

### 路径1：后台登录 → 运营菜单 → 活动管理 → 创建活动

| 步骤 | 操作 | 预期结果 |
|------|------|----------|
| 1 | 访问 `http://localhost:8080/adminwlmqhs.php` | 显示管理后台登录页 |
| 2 | 输入 admin / admin123456，点击登录 | 进入后台首页 |
| 3 | 查看左侧菜单 | 可见"运营"一级菜单 |
| 4 | 展开"运营" | 可见：活动管理、报名管理、邀请管理、数据报表 |
| 5 | 点击"活动管理" | 显示活动列表，可看到导入的6条演示活动 |
| 6 | 点击"添加/编辑" | 进入活动编辑页面 |
| 7 | 填写活动信息：标题、分类、阶段、时间、地址等 | 表单可正常填写 |
| 8 | 点击保存 | 提示保存成功，列表刷新可见新活动 |
| 9 | 在列表中切换活动启用/禁用状态 | 状态切换成功 |

### 路径2：前端首页 → 活动列表 → 活动详情 → 报名

| 步骤 | 操作 | 预期结果 |
|------|------|----------|
| 1 | 访问前端首页 | 显示母婴风格首页，含活动模块 |
| 2 | 点击底部Tab"活动"或首页活动入口 | 进入活动列表页 |
| 3 | 查看活动列表 | 显示已启用的活动卡片，含封面、标题、阶段标签、时间 |
| 4 | 使用分类筛选（课堂/沙龙/讲座等） | 列表按分类过滤 |
| 5 | 使用阶段筛选（备孕/孕期/产后） | 列表按阶段过滤 |
| 6 | 点击某个活动 | 进入活动详情页 |
| 7 | 查看详情页 | 显示封面、标题、时间、地址、报名人数、价格、详情内容、适合人群 |
| 8 | 点击"立即报名" | 跳转到报名表单页 |
| 9 | 填写姓名、手机号 | 输入框正常 |
| 10 | 选择阶段"孕期" | 出现"预产期"选择器 |
| 11 | 选择阶段"产后" | 出现"宝宝月龄"选择器，预产期消失 |
| 12 | 填写完整表单，点击"提交报名" | 提示"报名成功"，自动返回详情页 |

### 路径3：后台报名管理 → 查看报名 → 签到核销 → 导出

| 步骤 | 操作 | 预期结果 |
|------|------|----------|
| 1 | 后台 → 运营 → 报名管理 | 显示报名列表 |
| 2 | 查看列表字段 | ID、活动标题、姓名、手机、报名状态、签到状态、报名时间 |
| 3 | 按活动筛选 | 选择某个活动，列表过滤 |
| 4 | 按报名状态筛选 | 待确认/已确认/已取消 |
| 5 | 按签到状态筛选 | 未签到/已签到 |
| 6 | 点击某条报名的"详情" | 显示报名详情（含活动信息、用户信息、签到状态） |
| 7 | 点击"签到"按钮 | 提示签到成功，签到状态变为"已签到"，签到时间显示当前时间 |
| 8 | 再次点击"签到" | 提示"报名记录不存在或已签到"（幂等） |
| 9 | 点击"导出"按钮 | 下载CSV文件，包含所有报名数据 |

### 路径4：前端邀请页面 → 复制邀请码

| 步骤 | 操作 | 预期结果 |
|------|------|----------|
| 1 | 前端 → 用户中心 → 点击"邀请有礼"入口 | 进入邀请页面 |
| 2 | 查看邀请统计 | 显示累计邀请人数、获得积分 |
| 3 | 查看奖励规则 | 规则1：邀请注册+50积分，规则2：首单+100积分 |
| 4 | 查看邀请码 | 显示当前用户的邀请码（MD5哈希值） |
| 5 | 点击"复制邀请码" | 提示"邀请码已复制"，剪贴板内容为邀请码 |
| 6 | 查看邀请记录列表 | 显示已邀请用户头像、昵称、注册时间、发放状态 |

### 路径5：后台邀请管理 → 查看邀请关系

| 步骤 | 操作 | 预期结果 |
|------|------|----------|
| 1 | 后台 → 运营 → 邀请管理 | 显示邀请奖励记录列表 |
| 2 | 查看列表字段 | ID、邀请人、被邀请人、触发事件、奖励类型、奖励值、状态、时间 |
| 3 | 按触发事件筛选 | 注册/首单 |
| 4 | 按状态筛选 | 待发放/已发放/已取消 |
| 5 | 按邀请人昵称搜索 | 输入昵称，列表过滤 |
| 6 | 点击某条记录"详情" | 显示完整邀请关系和奖励详情 |

### 路径6：后台数据报表 → 查看6个指标

| 步骤 | 操作 | 预期结果 |
|------|------|----------|
| 1 | 后台 → 运营 → 数据报表 | 进入数据报表页面 |
| 2 | 查看6个核心指标 | 见下方指标说明 |

**6个核心指标**：

| 指标 | 数据来源 | 说明 |
|------|----------|------|
| 总用户数 | sxo_user COUNT | 注册用户总数 |
| 孕期用户数 | sxo_user WHERE current_stage='pregnancy' | 当前阶段为孕期的用户数 |
| 产后用户数 | sxo_user WHERE current_stage='postpartum' | 当前阶段为产后的用户数 |
| 活动报名总数 | sxo_activity_signup WHERE is_delete_time=0 | 所有有效报名记录数 |
| 邀请注册数 | sxo_invite_reward WHERE trigger_event='register' | 通过邀请注册的用户数 |
| 邀请首单数 | sxo_invite_reward WHERE trigger_event='first_order' | 被邀请人完成首单的记录数 |

**注意**：当前 `Muyingstat` 表单定义为最小可用状态（仅ID字段），数据报表页面需要后续开发具体的数据查询和展示逻辑。

---

## 三、已知限制和mock点

### 3.1 前端Mock数据

| 页面 | Mock内容 | 对接状态 |
|------|----------|----------|
| 首页（index.vue） | 活动列表、文章资讯、用户反馈 | Mock，API已实现但前端未对接 |
| 活动列表（activity.vue） | 活动数据 | Mock，API已实现但前端未对接 |
| 活动详情（activity-detail.vue） | 活动详情、用户晒单、互动数据 | Mock，API已实现但前端未对接 |
| 邀请页（invite.vue） | 邀请码、统计、邀请记录 | Mock，API已实现但前端未对接 |
| 我的活动（my-activity.vue） | 报名记录 | Mock，API已实现但前端未对接 |
| 我的邀请（my-invite.vue） | 邀请数据 | Mock，API已实现但前端未对接 |

### 3.2 后端未实现功能

| 功能 | 说明 |
|------|------|
| 报名表单 due_date 时间戳转换 | 前端传日期字符串，后端 ActivitySignup 未做 strtotime 转换 |
| 报名表单 baby_month_age 存储 | 前端传字符串如"6个月"，后端需提取数字 |
| 优惠券奖励（reward_type=coupon） | InviteService 预留枚举但未实现发放逻辑 |
| 数据报表页面 | Muyingstat 表单仅占位，无实际数据查询 |
| 活动收藏/点赞 | 前端有UI但后端无对应API |
| 活动评论 | 前端提示"评论功能开发中" |
| 邀请海报生成 | Poster 接口返回数据但前端未实现海报渲染 |
| 邀请分享 | 前端提示"分享功能开发中" |

### 3.3 后台视图模板

| 缺失项 | 说明 |
|--------|------|
| 活动管理视图模板 | admin/view/activity/ 目录下需要创建 index.html、detail.html、saveinfo.html |
| 报名管理视图模板 | admin/view/activitysignup/ 目录下需要创建 index.html、detail.html |
| 邀请管理视图模板 | admin/view/invite/ 目录下需要创建 index.html、detail.html |
| 数据报表视图模板 | admin/view/muyingstat/ 目录下需要创建 index.html |
| 模块组件模板 | activity/module/info.html、activity/module/time.html、activity/module/operate.html 等 |
| 邀请模块模板 | invite/module/inviter.html、invite/module/invitee.html、invite/module/operate.html |
| 报名模块模板 | activitysignup/module/operate.html |

### 3.4 性能限制

| 项目 | 说明 |
|------|------|
| 邀请码反查 | GetInviterByCode 遍历全表，用户量大时性能差 |
| 报名人数计数 | signup_count 非事务更新，高并发下可能不一致 |
| 导出无分页 | SignupExport 一次性查询所有数据，数据量大时可能超时 |

---

## 四、下一步优化方向

### 4.1 P0 - 必须完成（MVP可用性）

1. **后台视图模板开发**：创建所有缺失的 admin/view 模板文件，使后台管理页面可正常渲染
2. **前端API对接**：将所有Mock数据替换为真实API调用
3. **报名表单字段处理**：后端 ActivitySignup 补充 due_date 日期→时间戳转换、baby_month_age 字符串→数字提取
4. **权限缓存自动清除**：在迁移SQL末尾添加缓存清除命令

### 4.2 P1 - 重要优化

5. **邀请码性能优化**：新增 `sxo_user.invite_code` 字段，注册时生成并存储，反查改为索引查询
6. **数据报表实现**：Muyingstat 页面实现6个核心指标的查询和展示
7. **报名人数事务一致性**：使用数据库事务或 `INSERT ... SELECT` 保证 signup_count 准确
8. **导出分页/异步**：大数据量导出改为分批查询或异步任务

### 4.3 P2 - 体验提升

9. **活动收藏/点赞**：实现收藏和点赞API，对接前端
10. **邀请海报渲染**：前端使用 Canvas 绘制邀请海报
11. **微信分享对接**：实现小程序分享卡片和H5分享
12. **优惠券奖励**：实现 `reward_type=coupon` 的发放逻辑
13. **防刷加固**：注册IP限制、设备指纹、奖励延迟发放
14. **活动图片上传**：封面图和相册图片的上传和管理

### 4.4 P3 - 长期规划

15. **活动评价系统**：用户参加活动后可评价
16. **活动推荐算法**：根据用户阶段和偏好推荐活动
17. **消息通知**：报名成功/活动提醒/签到提醒的微信模板消息
18. **多级邀请**：如业务需要，扩展为二级/三级邀请链路
19. **数据看板**：可视化图表展示运营数据趋势
