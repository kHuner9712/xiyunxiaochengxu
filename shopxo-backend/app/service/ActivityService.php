<?php
namespace app\service;

use app\service\MuyingLogService;

// [MUYING-二开] 活动报名、收藏、核销服务 - 二开新增文件

use think\facade\Db;
use think\facade\Log;
use app\service\ResourcesService;
use app\extend\muying\MuyingStage;
use app\extend\muying\MuyingActivityCategory;

class ActivityService
{
    const SIGNUP_STATUS_PENDING  = 0;
    const SIGNUP_STATUS_CONFIRMED = 1;
    const SIGNUP_STATUS_CANCELLED = 2;

    const CHECKIN_STATUS_NO  = 0;
    const CHECKIN_STATUS_YES = 1;

    public static function SignupStatusList()
    {
        return [
            self::SIGNUP_STATUS_PENDING   => '待确认',
            self::SIGNUP_STATUS_CONFIRMED => '已确认',
            self::SIGNUP_STATUS_CANCELLED => '已取消',
        ];
    }

    public static function CheckinStatusList()
    {
        return [
            self::CHECKIN_STATUS_NO  => '未签到',
            self::CHECKIN_STATUS_YES => '已签到',
        ];
    }

    public static function SignupStatusText($status)
    {
        $list = self::SignupStatusList();
        return isset($list[$status]) ? $list[$status] : '';
    }

    public static function CheckinStatusText($status)
    {
        $list = self::CheckinStatusList();
        return isset($list[$status]) ? $list[$status] : '未签到';
    }
    public static function ActivityList($params)
    {
        $where = empty($params['where']) ? [] : $params['where'];
        $field = empty($params['field']) ? '*' : $params['field'];
        $order_by = empty($params['order_by']) ? 'sort_level desc, id desc' : trim($params['order_by']);
        $m = isset($params['m']) ? intval($params['m']) : 0;
        $n = isset($params['n']) ? intval($params['n']) : 10;

        $data = Db::name('Activity')->field($field)->where($where)->order($order_by)->limit($m, $n)->select()->toArray();
        return DataReturn(MyLang('handle_success'), 0, self::ActivityListHandle($data, $params));
    }

    public static function ActivityListHandle($data, $params = [])
    {
        if (!empty($data)) {
            foreach ($data as $k => &$v) {
                $v['data_index'] = $k + 1;

                if (isset($v['cover'])) {
                    $v['cover'] = ResourcesService::AttachmentPathViewHandle($v['cover']);
                }

                if (!empty($v['images'])) {
                    $images = json_decode($v['images'], true);
                    if (!empty($images) && is_array($images)) {
                        foreach ($images as $ik => $iv) {
                            $images[$ik] = ResourcesService::AttachmentPathViewHandle($iv);
                        }
                        $v['images'] = $images;
                    }
                }

                if (isset($v['content'])) {
                    $v['content'] = ResourcesService::ContentStaticReplace($v['content'], 'get');
                }

                if (isset($v['start_time'])) {
                    $v['start_time_text'] = empty($v['start_time']) ? '' : date('Y-m-d H:i:s', $v['start_time']);
                }
                if (isset($v['end_time'])) {
                    $v['end_time_text'] = empty($v['end_time']) ? '' : date('Y-m-d H:i:s', $v['end_time']);
                }
                if (isset($v['signup_start_time'])) {
                    $v['signup_start_time_text'] = empty($v['signup_start_time']) ? '' : date('Y-m-d H:i:s', $v['signup_start_time']);
                }
                if (isset($v['signup_end_time'])) {
                    $v['signup_end_time_text'] = empty($v['signup_end_time']) ? '' : date('Y-m-d H:i:s', $v['signup_end_time']);
                }

                if (isset($v['add_time'])) {
                    $v['add_time'] = date('Y-m-d H:i:s', $v['add_time']);
                }
                if (isset($v['upd_time'])) {
                    $v['upd_time'] = empty($v['upd_time']) ? '' : date('Y-m-d H:i:s', $v['upd_time']);
                }

                $now = time();
                $v['signup_status'] = 'ended';
                if ($v['signup_start_time'] > 0 && $now < $v['signup_start_time']) {
                    $v['signup_status'] = 'not_started';
                } elseif ($v['signup_end_time'] > 0 && $now > $v['signup_end_time']) {
                    $v['signup_status'] = 'ended';
                } else {
                    $v['signup_status'] = 'ongoing';
                }

                if (isset($v['max_count']) && $v['max_count'] > 0 && $v['signup_count'] >= $v['max_count']) {
                    $v['signup_status'] = 'full';
                }

                if (isset($v['stage'])) {
                    $v['stage'] = MuyingStage::Normalize($v['stage']);
                    $v['stage_name'] = MuyingStage::getName($v['stage']);
                    $v['stage_class'] = MuyingStage::getStageClass($v['stage']);
                }

                if (isset($v['category'])) {
                    $v['category'] = MuyingActivityCategory::Normalize($v['category']);
                    $v['category_text'] = MuyingActivityCategory::getName($v['category']);
                    $v['category_name'] = $v['category_text'];
                }

                if (isset($v['start_time']) && isset($v['end_time'])) {
                    $start_text = empty($v['start_time']) ? '' : date('Y-m-d H:i', $v['start_time']);
                    $end_text = empty($v['end_time']) ? '' : date('Y-m-d H:i', $v['end_time']);
                    $v['time_text'] = $start_text . ($end_text ? (' ~ ' . $end_text) : '');
                    $v['time'] = $v['time_text'];
                }

                if (isset($v['signup_end_time'])) {
                    $v['signup_deadline'] = empty($v['signup_end_time']) ? '' : date('Y-m-d H:i', $v['signup_end_time']);
                    $v['signup_deadline_text'] = $v['signup_deadline'];
                }

                if (isset($v['contact_name'])) {
                    $v['organizer_name'] = $v['contact_name'];
                    $v['organizer'] = $v['contact_name'];
                }
                if (isset($v['contact_phone'])) {
                    $v['organizer_phone'] = $v['contact_phone'];
                }

                if (!isset($v['suitable_crowd'])) {
                    $v['suitable_crowd'] = '';
                }
            }
        }
        return $data;
    }

    public static function ActivityTotal($where)
    {
        return (int) Db::name('Activity')->where($where)->count();
    }

    public static function ActivityWhere($params = [])
    {
        $where = [
            ['is_enable', '=', 1],
            ['is_delete_time', '=', 0],
        ];

        if (!empty($params['category'])) {
            $normalized = MuyingActivityCategory::Normalize($params['category']);
            if (!empty($normalized)) {
                $where[] = ['category', 'in', [$normalized, $params['category']]];
            } else {
                $where[] = ['category', '=', $params['category']];
            }
        }

        if (!empty($params['stage'])) {
            $normalized = MuyingStage::Normalize($params['stage']);
            $stage_values = [$normalized, MuyingStage::ALL];
            if ($normalized !== $params['stage']) {
                $stage_values[] = $params['stage'];
            }
            $where[] = ['stage', 'in', array_unique($stage_values)];
        }

        if (!empty($params['awd'])) {
            $where[] = ['title', 'like', '%' . $params['awd'] . '%'];
        }

        if (isset($params['is_free']) && $params['is_free'] !== '') {
            $where[] = ['is_free', '=', intval($params['is_free'])];
        }

        return $where;
    }

    public static function ActivityAccessCountInc($params = [])
    {
        if (!empty($params['id'])) {
            return Db::name('Activity')->where(['id' => intval($params['id'])])->inc('access_count')->update();
        }
        return false;
    }

    public static function ActivityFavorToggle($params = [])
    {
        if (empty($params['id'])) {
            return DataReturn('活动ID参数有误', -1);
        }
        if (empty($params['user']) || empty($params['user']['id'])) {
            return DataReturn(MyLang('user_info_incorrect_tips'), -1);
        }

        $id = intval($params['id']);
        $user_id = intval($params['user']['id']);

        $activity = Db::name('Activity')->where([
            ['id', '=', $id],
            ['is_enable', '=', 1],
            ['is_delete_time', '=', 0],
        ])->find();
        if (empty($activity)) {
            return DataReturn('活动不存在或已下架', -1);
        }

        Db::startTrans();
        try {
            $exists = Db::name('GoodsFavor')->where([
                ['user_id', '=', $user_id],
                ['goods_id', '=', $id],
                ['type', '=', 'activity'],
            ])->lock(true)->find();

            if (!empty($exists)) {
                Db::name('GoodsFavor')->where([
                    ['user_id', '=', $user_id],
                    ['goods_id', '=', $id],
                    ['type', '=', 'activity'],
                ])->delete();
                Db::commit();
                return DataReturn('取消收藏成功', 0, ['is_favored' => false]);
            } else {
                Db::name('GoodsFavor')->insert([
                    'user_id'   => $user_id,
                    'goods_id'  => $id,
                    'type'      => 'activity',
                    'add_time'  => time(),
                ]);
                Db::commit();
                return DataReturn('收藏成功', 0, ['is_favored' => true]);
            }
        } catch (\Exception $e) {
            Db::rollback();
            Log::error('活动收藏切换异常 activity_id=' . $id . ' user_id=' . $user_id . ' error=' . $e->getMessage());
            return DataReturn('操作失败，请稍后重试', -1);
        }
    }

    public static function IsActivityFavored($activity_id, $user_id)
    {
        if (empty($activity_id) || empty($user_id)) {
            return false;
        }
        $favor_exists = Db::name('GoodsFavor')->where([
            ['user_id', '=', intval($user_id)],
            ['goods_id', '=', intval($activity_id)],
            ['type', '=', 'activity'],
        ])->find();
        return !empty($favor_exists);
    }

    public static function IsUserSignedUp($activity_id, $user_id)
    {
        if (empty($activity_id) || empty($user_id)) {
            return false;
        }
        $signup_exists = Db::name('ActivitySignup')->where([
            ['activity_id', '=', intval($activity_id)],
            ['user_id', '=', intval($user_id)],
            ['status', 'in', [0, 1]],
            ['is_delete_time', '=', 0],
        ])->find();
        return !empty($signup_exists);
    }

    public static function RecalculateSignupCount($activity_id)
    {
        if (empty($activity_id)) {
            return false;
        }
        $activity_id = intval($activity_id);

        $real_count = Db::name('ActivitySignup')->where([
            ['activity_id', '=', $activity_id],
            ['status', 'in', [0, 1]],
            ['is_delete_time', '=', 0],
        ])->count();

        Db::name('Activity')->where(['id' => $activity_id])->update([
            'signup_count' => $real_count,
            'upd_time'     => time(),
        ]);

        return $real_count;
    }

    public static function ActivitySignup($params = [])
    {
        $p = [
            [
                'checked_type' => 'empty',
                'key_name'     => 'activity_id',
                'error_msg'    => '活动ID不能为空',
            ],
            [
                'checked_type' => 'length',
                'key_name'     => 'name',
                'checked_data' => '1,60',
                'error_msg'    => '姓名格式有误',
            ],
            [
                'checked_type' => 'length',
                'key_name'     => 'phone',
                'checked_data' => '1,30',
                'error_msg'    => '联系电话格式有误',
            ],
            [
                'checked_type' => 'empty',
                'key_name'     => 'stage',
                'error_msg'    => '请选择孕育阶段',
            ],
        ];
        $ret = ParamsChecked($params, $p);
        if ($ret !== true) {
            return DataReturn($ret, -1);
        }

        if (!preg_match('/^1[3-9]\d{9}$/', $params['phone'])) {
            return DataReturn('手机号格式有误', -1);
        }

        $normalized = MuyingStage::Normalize($params['stage']);
        if (empty($normalized) || $normalized === MuyingStage::ALL) {
            return DataReturn('请选择有效的孕育阶段', -1);
        }

        if ($normalized === 'pregnancy' && empty($params['due_date'])) {
            return DataReturn('孕期阶段请选择预产期', -1);
        }

        if ($normalized === 'postpartum') {
            if (empty($params['baby_birthday'])) {
                return DataReturn('产后阶段请选择宝宝生日', -1);
            }
            if (empty($params['baby_month_age'])) {
                return DataReturn('产后阶段请选择宝宝月龄', -1);
            }
            $month_age = intval($params['baby_month_age']);
            if ($month_age < 1 || $month_age > 36) {
                return DataReturn('宝宝月龄应在1-36个月之间', -1);
            }
        }

        $privacy_val = isset($params['privacy_agreed']) ? $params['privacy_agreed'] : null;
        if (!in_array($privacy_val, [true, 1, '1'], true)) {
            return DataReturn('请阅读并同意隐私告知', -1);
        }

        if (!empty($params['remark']) && mb_strlen($params['remark']) > 200) {
            return DataReturn('备注信息不能超过200字', -1);
        }

        $activity_id = intval($params['activity_id']);
        $user_id = intval($params['user']['id']);

        Db::startTrans();
        try {
            $activity = Db::name('Activity')->where([
                ['id', '=', $activity_id],
                ['is_enable', '=', 1],
                ['is_delete_time', '=', 0],
            ])->lock(true)->find();
            if (empty($activity)) {
                Db::rollback();
                return DataReturn('活动不存在或已下架', -1);
            }

            $now = time();
            if ($activity['signup_start_time'] > 0 && $now < $activity['signup_start_time']) {
                Db::rollback();
                return DataReturn('报名尚未开始', -1);
            }
            if ($activity['signup_end_time'] > 0 && $now > $activity['signup_end_time']) {
                Db::rollback();
                return DataReturn('报名已截止', -1);
            }

            $exists = Db::name('ActivitySignup')->where([
                ['activity_id', '=', $activity_id],
                ['user_id', '=', $user_id],
                ['status', 'in', [0, 1]],
                ['is_delete_time', '=', 0],
            ])->find();
            if (!empty($exists)) {
                Db::rollback();
                return DataReturn('您已报名该活动', -1);
            }

            $phone_exists = Db::name('ActivitySignup')->where([
                ['activity_id', '=', $activity_id],
                ['phone', '=', $params['phone']],
                ['status', 'in', [0, 1]],
                ['is_delete_time', '=', 0],
            ])->find();
            if (!empty($phone_exists)) {
                Db::rollback();
                return DataReturn('该手机号已报名此活动', -1);
            }

            if ($activity['max_count'] > 0 && $activity['signup_count'] >= $activity['max_count']) {
                Db::rollback();
                return DataReturn('报名人数已满', -1);
            }

            $data = [
                'activity_id'         => $activity_id,
                'user_id'             => $user_id,
                'name'                => strip_tags(trim($params['name'])),
                'phone'               => trim($params['phone']),
                'stage'               => $normalized,
                'due_date'            => empty($params['due_date']) ? 0 : (is_numeric($params['due_date']) ? intval($params['due_date']) : strtotime($params['due_date'])),
                'baby_month_age'      => empty($params['baby_month_age']) ? 0 : intval($params['baby_month_age']),
                'baby_birthday'       => empty($params['baby_birthday']) ? 0 : (is_numeric($params['baby_birthday']) ? intval($params['baby_birthday']) : strtotime($params['baby_birthday'])),
                'remark'              => empty($params['remark']) ? '' : strip_tags(trim($params['remark'])),
                'privacy_agreed_time' => time(),
                'status'              => 0,
                'add_time'            => time(),
                'upd_time'            => time(),
            ];

            $signup_id = Db::name('ActivitySignup')->insertGetId($data);
            if ($signup_id <= 0) {
                Db::rollback();
                return DataReturn('报名失败', -100);
            }

            Db::name('Activity')->where(['id' => $activity_id])->inc('signup_count')->update();

            // 回填用户画像：补充用户缺失的画像字段
            $user_row = Db::name('User')->where(['id' => $user_id])->find();
            if (!empty($user_row)) {
                $user_update = ['upd_time' => time()];
                $need_update = false;

                if (empty($user_row['current_stage']) && !empty($normalized)) {
                    $user_update['current_stage'] = $normalized;
                    $need_update = true;
                }

                if ($normalized === 'pregnancy' && !empty($data['due_date']) && empty($user_row['due_date'])) {
                    $user_update['due_date'] = $data['due_date'];
                    $need_update = true;
                }

                if ($normalized === 'postpartum' && !empty($params['baby_birthday']) && empty($user_row['baby_birthday'])) {
                    $baby_birthday_ts = is_numeric($params['baby_birthday']) ? intval($params['baby_birthday']) : strtotime($params['baby_birthday']);
                    if ($baby_birthday_ts > 0) {
                        $user_update['baby_birthday'] = $baby_birthday_ts;
                        $need_update = true;
                    }
                }

                if ($need_update) {
                    try {
                        Db::name('User')->where(['id' => $user_id])->update($user_update);
                    } catch (\Exception $e) {
                        Log::warning('报名回填用户画像失败 user_id=' . $user_id . ' error=' . $e->getMessage());
                    }
                }
            }

            MuyingLogService::LogSuccess(MuyingLogService::TYPE_ACTIVITY_SIGNUP, 'create', $user_id, $activity_id, '活动报名成功');
            Db::commit();
            return DataReturn('报名成功', 0);
        } catch (\Exception $e) {
            Db::rollback();
            Log::error('活动报名异常 activity_id=' . $activity_id . ' user_id=' . $user_id . ' error=' . $e->getMessage());
            return DataReturn('报名失败，请稍后重试', -100);
        }
    }

    public static function SignupCancel($params = [])
    {
        $p = [
            [
                'checked_type' => 'empty',
                'key_name'     => 'id',
                'error_msg'    => '报名记录ID不能为空',
            ],
        ];
        $ret = ParamsChecked($params, $p);
        if ($ret !== true) {
            return DataReturn($ret, -1);
        }

        $id = intval($params['id']);
        $user_id = intval($params['user']['id']);

        Db::startTrans();
        try {
            $signup = Db::name('ActivitySignup')->where([
                ['id', '=', $id],
                ['user_id', '=', $user_id],
                ['status', 'in', [self::SIGNUP_STATUS_PENDING, self::SIGNUP_STATUS_CONFIRMED]],
                ['is_delete_time', '=', 0],
            ])->lock(true)->find();
            if (empty($signup)) {
                Db::rollback();
                return DataReturn('报名记录不存在或已取消', -1);
            }

            if ($signup['checkin_status'] == self::CHECKIN_STATUS_YES) {
                Db::rollback();
                return DataReturn('已签到的报名不能取消', -1);
            }

            $upd = Db::name('ActivitySignup')->where(['id' => $id])->update([
                'status'          => self::SIGNUP_STATUS_CANCELLED,
                'upd_time'        => time(),
            ]);
            if ($upd === false) {
                Db::rollback();
                return DataReturn('取消报名失败', -100);
            }

            Db::name('Activity')->where(['id' => $signup['activity_id']])->dec('signup_count')->update();

            Db::commit();
            return DataReturn('取消报名成功', 0);
        } catch (\Exception $e) {
            Db::rollback();
            Log::error('取消报名异常 id=' . $id . ' user_id=' . $user_id . ' error=' . $e->getMessage());
            return DataReturn('取消报名失败，请稍后重试', -100);
        }
    }

    public static function MySignupWhere($params = [])
    {
        $where = [
            ['user_id', '=', intval($params['user']['id'])],
            ['is_delete_time', '=', 0],
        ];

        if (isset($params['status']) && $params['status'] !== '') {
            $where[] = ['status', '=', intval($params['status'])];
        }

        if (!empty($params['activity_id'])) {
            $where[] = ['activity_id', '=', intval($params['activity_id'])];
        }

        return $where;
    }

    public static function MySignupTotal($where)
    {
        return (int) Db::name('ActivitySignup')->where($where)->count();
    }

    public static function MySignupList($params)
    {
        $where = empty($params['where']) ? [] : $params['where'];
        $field = empty($params['field']) ? '*' : $params['field'];
        $order_by = empty($params['order_by']) ? 'id desc' : trim($params['order_by']);
        $m = isset($params['m']) ? intval($params['m']) : 0;
        $n = isset($params['n']) ? intval($params['n']) : 10;

        $data = Db::name('ActivitySignup')->field($field)->where($where)->order($order_by)->limit($m, $n)->select()->toArray();

        if (!empty($data)) {
            $activity_ids = array_unique(array_column($data, 'activity_id'));
            $activities = Db::name('Activity')->where(['id' => $activity_ids])->column('title,cover,category,stage,start_time,end_time,signup_end_time,address,contact_name,contact_phone,is_free,price', 'id');

            foreach ($data as $k => &$v) {
                $v['data_index'] = $k + 1;
                $v['activity_info'] = isset($activities[$v['activity_id']]) ? $activities[$v['activity_id']] : null;
                if (!empty($v['activity_info'])) {
                    self::FormatActivityInfo($v['activity_info']);
                }
                $v['status_text'] = self::SignupStatusText($v['status']);
                $v['add_time_text'] = empty($v['add_time']) ? '' : date('Y-m-d H:i:s', $v['add_time']);
            }
        }

        return DataReturn(MyLang('handle_success'), 0, $data);
    }

    private static function FormatActivityInfo(&$info)
    {
        if (empty($info)) {
            return;
        }
        if (!empty($info['cover'])) {
            $info['cover'] = ResourcesService::AttachmentPathViewHandle($info['cover']);
        }
        $info['stage'] = MuyingStage::Normalize($info['stage'] ?? '');
        $info['stage_name'] = MuyingStage::getName($info['stage']);
        $info['stage_class'] = MuyingStage::getStageClass($info['stage']);
        $info['category'] = MuyingActivityCategory::Normalize($info['category'] ?? '');
        $info['category_name'] = MuyingActivityCategory::getName($info['category']);
        $info['category_text'] = $info['category_name'];
        $start_text = empty($info['start_time']) ? '' : date('Y-m-d H:i', $info['start_time']);
        $end_text = empty($info['end_time']) ? '' : date('Y-m-d H:i', $info['end_time']);
        $info['time_text'] = $start_text . ($end_text ? (' ~ ' . $end_text) : '');
        $info['time'] = $info['time_text'];
        $info['signup_deadline'] = empty($info['signup_end_time']) ? '' : date('Y-m-d H:i', $info['signup_end_time']);
        $info['signup_deadline_text'] = $info['signup_deadline'];
        $info['organizer_name'] = empty($info['contact_name']) ? '' : $info['contact_name'];
        $info['organizer'] = $info['organizer_name'];
        $info['organizer_phone'] = empty($info['contact_phone']) ? '' : $info['contact_phone'];
        if (!isset($info['suitable_crowd'])) {
            $info['suitable_crowd'] = '';
        }
    }

    public static function ActivityDetail($params = [])
    {
        $id = isset($params['id']) ? intval($params['id']) : 0;
        if ($id <= 0) {
            return DataReturn('活动ID不能为空', -1);
        }

        $data = Db::name('Activity')->where([
            ['id', '=', $id],
            ['is_enable', '=', 1],
            ['is_delete_time', '=', 0],
        ])->find();
        if (empty($data)) {
            return DataReturn('活动不存在', -1);
        }

        $list = self::ActivityListHandle([$data], $params);
        return DataReturn(MyLang('handle_success'), 0, isset($list[0]) ? $list[0] : null);
    }

    public static function ActivitySave($params = [])
    {
        $p = [
            [
                'checked_type'      => 'length',
                'key_name'          => 'title',
                'checked_data'      => '2,80',
                'error_msg'         => '活动标题格式有误',
            ],
            [
                'checked_type'      => 'empty',
                'key_name'          => 'category',
                'error_msg'         => '请选择活动分类',
            ],
            [
                'checked_type'      => 'empty',
                'key_name'          => 'stage',
                'error_msg'         => '请选择适用阶段',
            ],
        ];
        $ret = ParamsChecked($params, $p);
        if ($ret !== true) {
            return DataReturn($ret, -1);
        }

        $stage = MuyingStage::Normalize($params['stage']);
        if (empty($stage)) {
            return DataReturn('适用阶段值无效', -1);
        }

        $category = MuyingActivityCategory::Normalize($params['category']);
        if (empty($category)) {
            return DataReturn('活动分类值无效', -1);
        }

        $attachment = ResourcesService::AttachmentParams($params, ['cover']);
        $content = empty($params['content']) ? '' : str_replace("\n", '', ResourcesService::ContentStaticReplace(htmlspecialchars_decode($params['content']), 'add'));

        $data = [
            'title'              => $params['title'],
            'cover'              => $attachment['data']['cover'],
            'category'           => $category,
            'stage'              => $stage,
            'suitable_crowd'     => empty($params['suitable_crowd']) ? '' : $params['suitable_crowd'],
            'description'        => empty($params['description']) ? '' : strip_tags($params['description']),
            'content'            => $content,
            'address'            => empty($params['address']) ? '' : $params['address'],
            'start_time'         => empty($params['start_time']) ? 0 : strtotime($params['start_time']),
            'end_time'           => empty($params['end_time']) ? 0 : strtotime($params['end_time']),
            'signup_start_time'  => empty($params['signup_start_time']) ? 0 : strtotime($params['signup_start_time']),
            'signup_end_time'    => empty($params['signup_end_time']) ? 0 : strtotime($params['signup_end_time']),
            'max_count'          => empty($params['max_count']) ? 0 : intval($params['max_count']),
            'is_free'            => isset($params['is_free']) ? intval($params['is_free']) : 0,
            'price'              => empty($params['price']) ? '0.00' : $params['price'],
            'contact_name'       => empty($params['contact_name']) ? '' : $params['contact_name'],
            'contact_phone'      => empty($params['contact_phone']) ? '' : $params['contact_phone'],
            'sort_level'         => empty($params['sort_level']) ? 0 : intval($params['sort_level']),
            'is_enable'          => isset($params['is_enable']) ? intval($params['is_enable']) : 0,
        ];

        if (empty($params['id'])) {
            $data['add_time'] = time();
            $data['signup_count'] = 0;
            $data['access_count'] = 0;
            $activity_id = Db::name('Activity')->insertGetId($data);
            if ($activity_id <= 0) {
                return DataReturn(MyLang('insert_fail'), -100);
            }
        } else {
            $data['upd_time'] = time();
            $activity_id = intval($params['id']);
            $upd_result = Db::name('Activity')->where(['id' => $activity_id])->update($data);
            if ($upd_result === false) {
                return DataReturn(MyLang('edit_fail'), -100);
            }
        }

        return DataReturn(MyLang('operate_success'), 0);
    }

    public static function ActivityDelete($params = [])
    {
        if (empty($params['ids'])) {
            return DataReturn(MyLang('data_id_error_tips'), -1);
        }
        if (!is_array($params['ids'])) {
            $params['ids'] = explode(',', $params['ids']);
        }

        $del_result = Db::name('Activity')->where(['id' => $params['ids']])->update(['is_delete_time' => time(), 'upd_time' => time()]);
        if ($del_result !== false) {
            return DataReturn(MyLang('delete_success'), 0);
        }

        return DataReturn(MyLang('delete_fail'), -100);
    }

    public static function ActivityStatusUpdate($params = [])
    {
        $p = [
            [
                'checked_type'      => 'empty',
                'key_name'          => 'id',
                'error_msg'         => MyLang('data_id_error_tips'),
            ],
            [
                'checked_type'      => 'empty',
                'key_name'          => 'field',
                'error_msg'         => MyLang('operate_field_error_tips'),
            ],
            [
                'checked_type'      => 'in',
                'key_name'          => 'state',
                'checked_data'      => [0, 1],
                'error_msg'         => MyLang('form_status_range_message'),
            ],
        ];
        $ret = ParamsChecked($params, $p);
        if ($ret !== true) {
            return DataReturn($ret, -1);
        }

        $status_result = Db::name('Activity')->where(['id' => intval($params['id'])])->update([$params['field'] => intval($params['state']), 'upd_time' => time()]);
        if ($status_result !== false) {
            return DataReturn(MyLang('edit_success'), 0);
        }
        return DataReturn(MyLang('edit_fail'), -100);
    }

    public static function AdminSignupList($params)
    {
        $where = empty($params['where']) ? [] : $params['where'];
        $field = empty($params['field']) ? '*' : $params['field'];
        $order_by = empty($params['order_by']) ? 'id desc' : trim($params['order_by']);
        $m = isset($params['m']) ? intval($params['m']) : 0;
        $n = isset($params['n']) ? intval($params['n']) : 10;

        $data = Db::name('ActivitySignup')->field($field)->where($where)->order($order_by)->limit($m, $n)->select()->toArray();
        $data = self::AdminSignupListHandle($data, $params);

        return DataReturn(MyLang('handle_success'), 0, $data);
    }

    public static function AdminSignupTotal($where)
    {
        return (int) Db::name('ActivitySignup')->where($where)->count();
    }

    public static function AdminSignupListHandle($data, $params = [])
    {
        if (!empty($data)) {
            $activity_ids = array_unique(array_column($data, 'activity_id'));
            $activities = Db::name('Activity')->where(['id' => $activity_ids])->column('title,cover,category,stage,start_time,end_time,signup_end_time,address,contact_name,contact_phone,is_free,price', 'id');

            foreach ($data as $k => &$v) {
                $v['data_index'] = $k + 1;
                $v['activity_title'] = isset($activities[$v['activity_id']]) ? $activities[$v['activity_id']]['title'] : '';
                $v['activity_info'] = isset($activities[$v['activity_id']]) ? $activities[$v['activity_id']] : null;
                if (!empty($v['activity_info'])) {
                    self::FormatActivityInfo($v['activity_info']);
                }
                $v['status_text'] = self::SignupStatusText($v['status']);
                $v['checkin_status_text'] = self::CheckinStatusText($v['checkin_status']);
                $v['stage_text'] = MuyingStage::getName(MuyingStage::Normalize($v['stage']));
                $v['add_time_text'] = empty($v['add_time']) ? '' : date('Y-m-d H:i:s', $v['add_time']);
                $v['checkin_time_text'] = empty($v['checkin_time']) ? '' : date('Y-m-d H:i:s', $v['checkin_time']);
            }
        }
        return $data;
    }

    public static function AdminSignupDetail($params = [])
    {
        $id = isset($params['id']) ? intval($params['id']) : 0;
        if ($id <= 0) {
            return DataReturn('报名记录ID不能为空', -1);
        }

        $data = Db::name('ActivitySignup')->where(['id' => $id])->find();
        if (empty($data)) {
            return DataReturn('报名记录不存在', -1);
        }

        $activity = Db::name('Activity')->where(['id' => $data['activity_id']])->find();
        $data['activity_info'] = $activity;
        $data['status_text'] = self::SignupStatusText($data['status']);
        $data['checkin_status_text'] = self::CheckinStatusText($data['checkin_status']);
        $data['stage_text'] = MuyingStage::getName(MuyingStage::Normalize($data['stage']));
        $data['add_time_text'] = empty($data['add_time']) ? '' : date('Y-m-d H:i:s', $data['add_time']);
        $data['checkin_time_text'] = empty($data['checkin_time']) ? '' : date('Y-m-d H:i:s', $data['checkin_time']);

        return DataReturn(MyLang('handle_success'), 0, $data);
    }

    public static function SignupCheckin($params = [])
    {
        $p = [
            [
                'checked_type' => 'empty',
                'key_name'     => 'id',
                'error_msg'    => '报名记录ID不能为空',
            ],
        ];
        $ret = ParamsChecked($params, $p);
        if ($ret !== true) {
            return DataReturn($ret, -1);
        }

        $id = intval($params['id']);

        Db::startTrans();
        try {
            $signup = Db::name('ActivitySignup')->where([
                ['id', '=', $id],
                ['is_delete_time', '=', 0],
            ])->lock(true)->find();
            if (empty($signup)) {
                Db::rollback();
                return DataReturn('报名记录不存在', -1);
            }

            if ($signup['status'] == self::SIGNUP_STATUS_CANCELLED) {
                Db::rollback();
                return DataReturn('已取消的报名不能签到', -1);
            }

            if ($signup['checkin_status'] == self::CHECKIN_STATUS_YES) {
                Db::rollback();
                return DataReturn('已签到，请勿重复签到', -1);
            }

            $checkin_result = Db::name('ActivitySignup')->where(['id' => $id])->update([
                'checkin_status' => self::CHECKIN_STATUS_YES,
                'checkin_time'   => time(),
                'upd_time'       => time(),
            ]);
            if ($checkin_result !== false) {
                MuyingLogService::LogSuccess(MuyingLogService::TYPE_ACTIVITY_CHECKIN, 'update', $signup['user_id'], $id, '签到成功');
                Db::commit();
                return DataReturn('签到成功', 0);
            }
            Db::rollback();
            return DataReturn('签到失败', -100);
        } catch (\Exception $e) {
            Db::rollback();
            Log::error('签到异常 id=' . $id . ' error=' . $e->getMessage());
            return DataReturn('签到操作失败，请稍后重试', -100);
        }
    }

    public static function SignupConfirm($params = [])
    {
        $p = [
            [
                'checked_type' => 'empty',
                'key_name'     => 'id',
                'error_msg'    => '报名记录ID不能为空',
            ],
        ];
        $ret = ParamsChecked($params, $p);
        if ($ret !== true) {
            return DataReturn($ret, -1);
        }

        $id = intval($params['id']);

        Db::startTrans();
        try {
            $signup = Db::name('ActivitySignup')->where([
                ['id', '=', $id],
                ['is_delete_time', '=', 0],
            ])->lock(true)->find();
            if (empty($signup)) {
                Db::rollback();
                return DataReturn('报名记录不存在', -1);
            }

            if ($signup['status'] == self::SIGNUP_STATUS_CONFIRMED) {
                Db::rollback();
                return DataReturn('该报名已确认，请勿重复确认', -1);
            }

            if ($signup['status'] == self::SIGNUP_STATUS_CANCELLED) {
                Db::rollback();
                return DataReturn('已取消的报名不能确认', -1);
            }

            $upd_result = Db::name('ActivitySignup')->where(['id' => $id])->update([
                'status'   => self::SIGNUP_STATUS_CONFIRMED,
                'upd_time' => time(),
            ]);
            if ($upd_result !== false) {
                MuyingLogService::LogSuccess(MuyingLogService::TYPE_ACTIVITY_CONFIRM, 'update', $signup['user_id'], $id, '确认报名成功');
                Db::commit();
                return DataReturn('确认成功', 0);
            }
            Db::rollback();
            return DataReturn('确认失败', -100);
        } catch (\Exception $e) {
            Db::rollback();
            Log::error('确认报名异常 id=' . $id . ' error=' . $e->getMessage());
            return DataReturn('确认操作失败，请稍后重试', -100);
        }
    }

    public static function SignupExport($params = [])
    {
        $where = empty($params['where']) ? [] : $params['where'];

        $data = Db::name('ActivitySignup')->where($where)->order('id desc')->select()->toArray();
        if (empty($data)) {
            return DataReturn('没有可导出的数据', -1);
        }

        $activity_ids = array_unique(array_column($data, 'activity_id'));
        $activities = Db::name('Activity')->where(['id' => $activity_ids])->column('title,stage', 'id');

        $stage_map = MuyingStage::getList();
        $status_map = self::SignupStatusList();
        $checkin_map = self::CheckinStatusList();

        $result = [];
        foreach ($data as $v) {
            $activity_title = isset($activities[$v['activity_id']]) ? $activities[$v['activity_id']]['title'] : '';
            $activity_stage = isset($activities[$v['activity_id']]) ? $stage_map[$activities[$v['activity_id']]['stage']] ?? $activities[$v['activity_id']]['stage'] : '';
            $result[] = [
                'id'               => $v['id'],
                'activity_title'   => $activity_title,
                'name'             => $v['name'],
                'phone'            => $v['phone'],
                'stage'            => $stage_map[$v['stage']] ?? $v['stage'],
                'due_date'          => empty($v['due_date']) ? '' : date('Y-m-d', $v['due_date']),
                'baby_birthday'     => empty($v['baby_birthday']) ? '' : date('Y-m-d', $v['baby_birthday']),
                'baby_month_age'    => empty($v['baby_month_age']) ? '' : $v['baby_month_age'].'个月',
                'remark'            => $v['remark'] ?? '',
                'status_text'      => $status_map[$v['status']] ?? '',
                'checkin_status_text' => $checkin_map[$v['checkin_status']] ?? '未签到',
                'add_time_text'    => empty($v['add_time']) ? '' : date('Y-m-d H:i:s', $v['add_time']),
                'checkin_time_text' => empty($v['checkin_time']) ? '' : date('Y-m-d H:i:s', $v['checkin_time']),
            ];
        }

        return DataReturn(MyLang('handle_success'), 0, $result);
    }
}
