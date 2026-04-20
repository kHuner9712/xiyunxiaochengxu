-- ============================================================
-- 母婴商城 演示数据
-- 创建时间: 2026-04-17
-- 说明: 插入最小可演示数据，包含活动、报名、邀请奖励
-- 依赖: 先执行 muying-final-migration.sql (唯一入口，含建表+补丁+索引)
-- 注意: 使用 INSERT IGNORE 避免重复插入，时间使用 UNIX_TIMESTAMP()+偏移量确保活动在未来
-- ============================================================

-- -----------------------------------------------------------
-- 1. 活动演示数据（6种类型各1条）
-- -----------------------------------------------------------
INSERT IGNORE INTO `sxo_activity` (
  `title`, `cover`, `images`, `category`, `stage`, `description`, `content`,
  `address`, `start_time`, `end_time`, `signup_start_time`, `signup_end_time`,
  `max_count`, `signup_count`, `is_free`, `price`,
  `contact_name`, `contact_phone`, `access_count`, `sort_level`,
  `is_enable`, `is_delete_time`, `add_time`, `upd_time`
) VALUES
-- 1. 孕妈课堂 (classroom) / 孕期
('孕期瑜伽课堂', '', '[]', 'classroom', 'pregnancy',
 '专业瑜伽老师带领，缓解孕期不适，助力顺产',
 '<p>专业瑜伽老师带领，缓解孕期不适，助力顺产。课程时长60分钟，请穿着宽松衣物。</p>',
 '云栖母婴中心3楼瑜伽室',
 UNIX_TIMESTAMP() + 864000, UNIX_TIMESTAMP() + 864000 + 7200,
 UNIX_TIMESTAMP(), UNIX_TIMESTAMP() + 691200,
 20, 8, 1, 0.00,
 '李老师', '13800000001', 156, 100,
 1, 0, UNIX_TIMESTAMP(), UNIX_TIMESTAMP()),

-- 2. 线下沙龙 (salon) / 产后
('新手妈妈交流沙龙', '', '[]', 'salon', 'postpartum',
 '产后妈妈经验分享，专家答疑，结交同阶段好友',
 '<p>产后妈妈经验分享，专家答疑，结交同阶段好友。提供茶歇，可带宝宝参加。</p>',
 '云栖母婴中心2楼多功能厅',
 UNIX_TIMESTAMP() + 1728000, UNIX_TIMESTAMP() + 1728000 + 10800,
 UNIX_TIMESTAMP(), UNIX_TIMESTAMP() + 1555200,
 30, 12, 1, 0.00,
 '王老师', '13800000002', 89, 90,
 1, 0, UNIX_TIMESTAMP(), UNIX_TIMESTAMP()),

-- 3. 讲座报名 (lecture) / 备孕
('科学备孕知识讲座', '', '[]', 'lecture', 'prepare',
 '三甲医院妇产科主任主讲，科学备孕全攻略',
 '<p>三甲医院妇产科主任主讲，涵盖孕前检查、营养补充、生活习惯调整等核心内容。</p>',
 '云栖母婴中心1楼报告厅',
 UNIX_TIMESTAMP() + 2592000, UNIX_TIMESTAMP() + 2592000 + 7200,
 UNIX_TIMESTAMP(), UNIX_TIMESTAMP() + 2419200,
 100, 45, 1, 0.00,
 '张主任', '13800000003', 230, 80,
 1, 0, UNIX_TIMESTAMP(), UNIX_TIMESTAMP()),

-- 4. 试用活动 (trial) / 孕期
('孕期护肤品试用体验', '', '[]', 'trial', 'pregnancy',
 '安全成分孕期护肤套装试用，专业顾问1对1指导',
 '<p>安全成分孕期护肤套装试用，专业顾问1对1指导，适合孕期敏感肌。</p>',
 '云栖母婴中心1楼体验区',
 UNIX_TIMESTAMP() + 3456000, UNIX_TIMESTAMP() + 3456000 + 14400,
 UNIX_TIMESTAMP(), UNIX_TIMESTAMP() + 3283200,
 15, 6, 1, 0.00,
 '陈顾问', '13800000004', 67, 70,
 1, 0, UNIX_TIMESTAMP(), UNIX_TIMESTAMP()),

-- 5. 节日活动 (holiday) / 通用
('母亲节特别活动', '', '[]', 'holiday', 'all',
 '母亲节专属活动，亲子互动+精美礼品',
 '<p>母亲节专属活动，亲子互动游戏+手工DIY+精美礼品，欢迎全家参与。</p>',
 '云栖母婴中心户外花园',
 UNIX_TIMESTAMP() + 4320000, UNIX_TIMESTAMP() + 4320000 + 18000,
 UNIX_TIMESTAMP(), UNIX_TIMESTAMP() + 4147200,
 50, 28, 1, 0.00,
 '赵老师', '13800000005', 312, 60,
 1, 0, UNIX_TIMESTAMP(), UNIX_TIMESTAMP()),

-- 6. 打卡活动 (checkin) / 产后
('产后康复21天打卡', '', '[]', 'checkin', 'postpartum',
 '21天产后康复打卡计划，专业指导每日训练',
 '<p>21天产后康复打卡计划，专业康复师每日发布训练任务，坚持打卡赢积分。</p>',
 '线上活动',
 UNIX_TIMESTAMP() + 5184000, UNIX_TIMESTAMP() + 5184000 + 1814400,
 UNIX_TIMESTAMP(), UNIX_TIMESTAMP() + 5011200,
 200, 76, 1, 0.00,
 '孙老师', '13800000006', 198, 50,
 1, 0, UNIX_TIMESTAMP(), UNIX_TIMESTAMP());


-- -----------------------------------------------------------
-- 2. 报名演示数据（5条）
-- -----------------------------------------------------------
-- 使用变量存储活动ID，确保引用正确
SET @act_classroom = (SELECT `id` FROM `sxo_activity` WHERE `category`='classroom' AND `is_delete_time`=0 LIMIT 1);
SET @act_salon     = (SELECT `id` FROM `sxo_activity` WHERE `category`='salon'     AND `is_delete_time`=0 LIMIT 1);
SET @act_lecture   = (SELECT `id` FROM `sxo_activity` WHERE `category`='lecture'   AND `is_delete_time`=0 LIMIT 1);
SET @act_trial     = (SELECT `id` FROM `sxo_activity` WHERE `category`='trial'     AND `is_delete_time`=0 LIMIT 1);
SET @act_holiday   = (SELECT `id` FROM `sxo_activity` WHERE `category`='holiday'   AND `is_delete_time`=0 LIMIT 1);

INSERT IGNORE INTO `sxo_activity_signup` (
  `activity_id`, `user_id`, `name`, `phone`, `stage`,
  `due_date`, `baby_month_age`, `remark`,
  `status`, `checkin_status`, `checkin_time`,
  `is_delete_time`, `add_time`, `upd_time`
) VALUES
-- 1. 孕期用户报名课堂，已确认，已签到
(@act_classroom, 1, '张小花', '13900000001', 'pregnancy',
 UNIX_TIMESTAMP() + 12096000, 0, '孕28周',
 1, 1, UNIX_TIMESTAMP() + 864000,
 0, UNIX_TIMESTAMP() - 86400, UNIX_TIMESTAMP() + 864000),

-- 2. 产后用户报名沙龙，已确认，未签到
(@act_salon, 2, '李美美', '13900000002', 'postpartum',
 0, 6, '宝宝6个月',
 1, 0, 0,
 0, UNIX_TIMESTAMP() - 43200, UNIX_TIMESTAMP() - 43200),

-- 3. 备孕用户报名讲座，待确认，未签到
(@act_lecture, 3, '王备备', '13900000003', 'prepare',
 0, 0, '备孕3个月',
 0, 0, 0,
 0, UNIX_TIMESTAMP() - 3600, UNIX_TIMESTAMP() - 3600),

-- 4. 孕期用户报名试用，已取消，未签到
(@act_trial, 4, '赵孕孕', '13900000004', 'pregnancy',
 UNIX_TIMESTAMP() + 7776000, 0, '孕16周，想试用护肤品',
 2, 0, 0,
 0, UNIX_TIMESTAMP() - 7200, UNIX_TIMESTAMP() - 3600),

-- 5. 产后用户报名节日活动，已确认，已签到
(@act_holiday, 5, '刘妈妈', '13900000005', 'postpartum',
 0, 3, '宝宝3个月，想参加亲子活动',
 1, 1, UNIX_TIMESTAMP() + 4320000,
 0, UNIX_TIMESTAMP() - 86400, UNIX_TIMESTAMP() + 4320000);


-- -----------------------------------------------------------
-- 3. 邀请关系演示数据（3条）
-- -----------------------------------------------------------
INSERT IGNORE INTO `sxo_invite_reward` (
  `inviter_id`, `invitee_id`, `reward_type`, `reward_value`,
  `trigger_event`, `status`, `add_time`, `upd_time`
) VALUES
-- 1. 用户1邀请用户3注册，积分奖励，已发放
(1, 3, 'integral', 100, 'register', 1, UNIX_TIMESTAMP() - 86400, UNIX_TIMESTAMP() - 86400),

-- 2. 用户1邀请用户4注册，优惠券奖励，待发放
(1, 4, 'coupon', 1, 'register', 0, UNIX_TIMESTAMP() - 43200, UNIX_TIMESTAMP() - 43200),

-- 3. 用户2邀请用户5首单完成，积分奖励，已发放
(2, 5, 'integral', 200, 'first_order', 1, UNIX_TIMESTAMP() - 172800, UNIX_TIMESTAMP() - 86400);
