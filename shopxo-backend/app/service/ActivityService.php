<?php
namespace app\service;

use app\service\MuyingLogService;
use app\service\MuyingPrivacyService;
use app\service\MuyingAuditLogService;

use think\facade\Db;
use think\facade\Log;
use app\service\ResourcesService;
use app\extend\muying\MuyingStage;
use app\extend\muying\MuyingActivityCategory;
use app\extend\muying\MuyingActivityType;
use app\extend\muying\MuyingActivityStatus;

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

                $v = self::ComputeSignupStatus($v);

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

                if (isset($v['activity_type'])) {
                    $v['activity_type'] = MuyingActivityType::Normalize($v['activity_type']);
                    $v['activity_type_text'] = MuyingActivityType::getName($v['activity_type']);
                }

                if (isset($v['activity_status'])) {
                    $v['activity_status'] = MuyingActivityStatus::Normalize($v['activity_status']);
                    $v['activity_status_text'] = MuyingActivityStatus::getName($v['activity_status']);
                    $v['activity_status_class'] = MuyingActivityStatus::getStatusClass($v['activity_status']);
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

                $v['remain_count'] = 0;
                if (isset($v['max_count']) && $v['max_count'] > 0 && isset($v['signup_count'])) {
                    $v['remain_count'] = max(0, $v['max_count'] - $v['signup_count']);
                }

                $v['waitlist_remain'] = 0;
                if (isset($v['waitlist_count']) && $v['waitlist_count'] > 0 && isset($v['waitlist_signup_count'])) {
                    $v['waitlist_remain'] = max(0, $v['waitlist_count'] - $v['waitlist_signup_count']);
                }

                $v['is_signed_up'] = false;
                if (!empty($params['user_id']) && !empty($v['id'])) {
                    $v['is_signed_up'] = self::IsUserSignedUp($v['id'], $params['user_id']);
                }
            }
        }
        return $data;
    }

    private static function ComputeSignupStatus($v)
    {
        $now = time();
        $v['signup_status'] = 'ended';

        if (isset($v['activity_status']) && in_array($v['activity_status'], [MuyingActivityStatus::DRAFT, MuyingActivityStatus::CANCELLED])) {
            $v['signup_status'] = 'ended';
            return $v;
        }

        if (isset($v['signup_start_time']) && $v['signup_start_time'] > 0 && $now < $v['signup_start_time']) {
            $v['signup_status'] = 'not_started';
        } elseif (isset($v['signup_end_time']) && $v['signup_end_time'] > 0 && $now > $v['signup_end_time']) {
            $v['signup_status'] = 'ended';
        } else {
            $v['signup_status'] = 'ongoing';
        }

        if (isset($v['max_count']) && $v['max_count'] > 0 && isset($v['signup_count']) && $v['signup_count'] >= $v['max_count']) {
            if (!empty($v['allow_waitlist']) && isset($v['waitlist_count']) && $v['waitlist_count'] > 0 && isset($v['waitlist_signup_count']) && $v['waitlist_signup_count'] < $v['waitlist_count']) {
                $v['signup_status'] = 'waitlist';
            } else {
                $v['signup_status'] = 'full';
            }
        }

        return $v;
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
                $where[] = ['category', '=', $normalized];
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

        if (!empty($params['activity_type'])) {
            $normalized = MuyingActivityType::Normalize($params['activity_type']);
            $where[] = ['activity_type', '=', $normalized];
        }

        if (!empty($params['activity_status'])) {
            $normalized = MuyingActivityStatus::Normalize($params['activity_status']);
            $where[] = ['activity_status', '=', $normalized];
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
            ['is_waitlist', '=', 0],
            ['is_delete_time', '=', 0],
        ])->count();

        $waitlist_count = Db::name('ActivitySignup')->where([
            ['activity_id', '=', $activity_id],
            ['status', 'in', [0, 1]],
            ['is_waitlist', '=', 1],
            ['is_delete_time', '=', 0],
        ])->count();

        Db::name('Activity')->where(['id' => $activity_id])->update([
            'signup_count'          => $real_count,
            'waitlist_signup_count' => $waitlist_count,
            'upd_time'              => time(),
        ]);

        self::AutoUpdateActivityStatus($activity_id);

        return $real_count;
    }

    public static function AutoUpdateActivityStatus($activity_id)
    {
        if (empty($activity_id)) {
            return false;
        }
        $activity_id = intval($activity_id);

        $activity = Db::name('Activity')->where(['id' => $activity_id])->find();
        if (empty($activity)) {
            return false;
        }

        if (in_array($activity['activity_status'], [MuyingActivityStatus::DRAFT, MuyingActivityStatus::CANCELLED])) {
            return false;
        }

        $now = time();
        $new_status = $activity['activity_status'];

        if ($activity['end_time'] > 0 && $now > $activity['end_time']) {
            $new_status = MuyingActivityStatus::ENDED;
        } elseif ($activity['max_count'] > 0 && $activity['signup_count'] >= $activity['max_count']) {
            if (empty($activity['allow_waitlist']) || $activity['waitlist_count'] <= 0 || $activity['waitlist_signup_count'] >= $activity['waitlist_count']) {
                $new_status = MuyingActivityStatus::FULL;
            } else {
                $new_status = MuyingActivityStatus::SIGNING;
            }
        } elseif ($activity['signup_start_time'] > 0 && $now < $activity['signup_start_time']) {
            $new_status = MuyingActivityStatus::PUBLISHED;
        } else {
            $new_status = MuyingActivityStatus::SIGNING;
        }

        if ($new_status !== $activity['activity_status']) {
            Db::name('Activity')->where(['id' => $activity_id])->update([
                'activity_status' => $new_status,
                'upd_time'        => time(),
            ]);
        }

        return $new_status;
    }

    private static function GenerateSignupCode($activity_id, $user_id)
    {
        $attempts = 0;
        while ($attempts < 20) {
            $code = strtoupper(substr(md5($activity_id . '_' . $user_id . '_' . time() . '_' . mt_rand()), 0, 8));
            $exists = Db::name('ActivitySignup')->where(['signup_code' => $code])->find();
            if (empty($exists)) {
                return $code;
            }
            $attempts++;
        }
        return strtoupper(substr(md5(uniqid(mt_rand(), true)), 0, 8));
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

        // [MUYING-二开] 画像同步授权：可选，默认不同意
        $profile_sync_val = isset($params['profile_sync_agreed']) ? $params['profile_sync_agreed'] : 0;
        $profile_sync_agreed = in_array($profile_sync_val, [true, 1, '1'], true) ? 1 : 0;

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

            if (in_array($activity['activity_status'], [MuyingActivityStatus::DRAFT, MuyingActivityStatus::CANCELLED])) {
                Db::rollback();
                return DataReturn('该活动暂不可报名', -1);
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

            $phone_hash = MuyingPrivacyService::HashPhone($params['phone']);
            $phone_exists = Db::name('ActivitySignup')->where([
                ['activity_id', '=', $activity_id],
                ['phone_hash', '=', $phone_hash],
                ['status', 'in', [0, 1]],
                ['is_delete_time', '=', 0],
            ])->find();
            if (empty($phone_exists)) {
                $phone_exists = Db::name('ActivitySignup')->where([
                    ['activity_id', '=', $activity_id],
                    ['phone', '=', $params['phone']],
                    ['status', 'in', [0, 1]],
                    ['is_delete_time', '=', 0],
                ])->find();
            }
            if (!empty($phone_exists)) {
                Db::rollback();
                return DataReturn('该手机号已报名此活动', -1);
            }

            $is_waitlist = 0;
            $is_full = false;
            if ($activity['max_count'] > 0 && $activity['signup_count'] >= $activity['max_count']) {
                $is_full = true;
                if (!empty($activity['allow_waitlist']) && $activity['waitlist_count'] > 0) {
                    if ($activity['waitlist_signup_count'] >= $activity['waitlist_count']) {
                        Db::rollback();
                        return DataReturn('报名人数及候补名额已满', -1);
                    }
                    $is_waitlist = 1;
                } else {
                    Db::rollback();
                    return DataReturn('报名人数已满', -1);
                }
            }

            $signup_code = self::GenerateSignupCode($activity_id, $user_id);

            $data = [
                'activity_id'         => $activity_id,
                'user_id'             => $user_id,
                'name'                => MuyingPrivacyService::EncryptSensitive(strip_tags(trim($params['name']))),
                'phone'               => MuyingPrivacyService::EncryptSensitive(trim($params['phone'])),
                'phone_hash'          => $phone_hash,
                'stage'               => $normalized,
                'due_date'            => empty($params['due_date']) ? 0 : self::SafeStrtotime($params['due_date']),
                'baby_month_age'      => empty($params['baby_month_age']) ? 0 : intval($params['baby_month_age']),
                'baby_birthday'       => empty($params['baby_birthday']) ? 0 : self::SafeStrtotime($params['baby_birthday']),
                'remark'              => empty($params['remark']) ? '' : strip_tags(trim($params['remark'])),
                'privacy_agreed_time' => time(),
                'privacy_version'     => 1,
                'profile_sync_agreed' => $profile_sync_agreed,
                'profile_sync_agreed_time' => $profile_sync_agreed ? time() : 0,
                'is_waitlist'         => $is_waitlist,
                'waitlist_to_normal_time' => 0,
                'signup_code'         => $signup_code,
                'status'              => 0,
                'add_time'            => time(),
                'upd_time'            => time(),
            ];

            $signup_id = Db::name('ActivitySignup')->insertGetId($data);
            if ($signup_id <= 0) {
                Db::rollback();
                return DataReturn('报名失败', -100);
            }

            if ($is_waitlist) {
                Db::name('Activity')->where(['id' => $activity_id])->inc('waitlist_signup_count')->update();
            } else {
                Db::name('Activity')->where(['id' => $activity_id])->inc('signup_count')->update();
            }

            self::AutoUpdateActivityStatus($activity_id);

            // [MUYING-二开] 画像同步：仅在用户明确同意时更新，且保证阶段一致性
            if ($profile_sync_agreed) {
                $user_row = Db::name('User')->where(['id' => $user_id])->find();
                if (!empty($user_row)) {
                    $user_update = ['upd_time' => time()];

                    if ($normalized === 'pregnancy') {
                        $user_update['current_stage'] = 'pregnancy';
                        $user_update['due_date'] = empty($data['due_date']) ? 0 : $data['due_date'];
                        $user_update['baby_birthday'] = 0;
                    } elseif ($normalized === 'postpartum') {
                        $user_update['current_stage'] = 'postpartum';
                        $user_update['due_date'] = 0;
                        $user_update['baby_birthday'] = empty($data['baby_birthday']) ? 0 : $data['baby_birthday'];
                    } else {
                        $user_update['current_stage'] = $normalized;
                        $user_update['due_date'] = 0;
                        $user_update['baby_birthday'] = 0;
                    }

                    try {
                        Db::name('User')->where(['id' => $user_id])->update($user_update);
                    } catch (\Exception $e) {
                        Log::warning('报名回填用户画像失败 user_id=' . $user_id . ' error=' . $e->getMessage());
                    }
                }
            }

            $log_msg = $is_waitlist ? '活动候补报名成功' : '活动报名成功';
            MuyingLogService::LogSuccess(MuyingLogService::TYPE_ACTIVITY_SIGNUP, 'create', $user_id, $activity_id, $log_msg);
            Db::commit();

            $result_msg = $is_waitlist ? '候补报名成功，有名额时将自动通知您' : '报名成功';
            return DataReturn($result_msg, 0, ['is_waitlist' => $is_waitlist, 'signup_code' => $signup_code]);
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
                'status'   => self::SIGNUP_STATUS_CANCELLED,
                'upd_time' => time(),
            ]);
            if ($upd === false) {
                Db::rollback();
                return DataReturn('取消报名失败', -100);
            }

            Db::commit();
            self::RecalculateSignupCount($signup['activity_id']);
            self::ProcessWaitlistAutoPromote($signup['activity_id']);

            return DataReturn('取消报名成功', 0);
        } catch (\Exception $e) {
            Db::rollback();
            Log::error('取消报名异常 id=' . $id . ' user_id=' . $user_id . ' error=' . $e->getMessage());
            return DataReturn('取消报名失败，请稍后重试', -100);
        }
    }

    public static function ProcessWaitlistAutoPromote($activity_id)
    {
        if (empty($activity_id)) {
            return false;
        }
        $activity_id = intval($activity_id);

        $activity = Db::name('Activity')->where(['id' => $activity_id])->find();
        if (empty($activity)) {
            return false;
        }

        if ($activity['max_count'] <= 0) {
            return false;
        }

        $current_real = Db::name('ActivitySignup')->where([
            ['activity_id', '=', $activity_id],
            ['status', 'in', [0, 1]],
            ['is_waitlist', '=', 0],
            ['is_delete_time', '=', 0],
        ])->count();

        $available = $activity['max_count'] - $current_real;
        if ($available <= 0) {
            return false;
        }

        $waitlist_signups = Db::name('ActivitySignup')->where([
            ['activity_id', '=', $activity_id],
            ['status', 'in', [0, 1]],
            ['is_waitlist', '=', 1],
            ['is_delete_time', '=', 0],
        ])->order('add_time asc')->limit($available)->select()->toArray();

        if (empty($waitlist_signups)) {
            return false;
        }

        foreach ($waitlist_signups as $ws) {
            Db::name('ActivitySignup')->where(['id' => $ws['id']])->update([
                'is_waitlist'             => 0,
                'waitlist_to_normal_time' => time(),
                'upd_time'                => time(),
            ]);
        }

        self::RecalculateSignupCount($activity_id);

        return count($waitlist_signups);
    }

    public static function WaitlistToNormal($params = [])
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
                ['is_waitlist', '=', 1],
                ['status', 'in', [0, 1]],
                ['is_delete_time', '=', 0],
            ])->lock(true)->find();
            if (empty($signup)) {
                Db::rollback();
                return DataReturn('候补记录不存在或已转正', -1);
            }

            $activity = Db::name('Activity')->where(['id' => $signup['activity_id']])->lock(true)->find();
            if (empty($activity)) {
                Db::rollback();
                return DataReturn('活动不存在', -1);
            }

            if ($activity['max_count'] > 0 && $activity['signup_count'] >= $activity['max_count']) {
                Db::rollback();
                return DataReturn('正式名额已满，无法转正', -1);
            }

            $upd_result = Db::name('ActivitySignup')->where(['id' => $id])->update([
                'is_waitlist'             => 0,
                'waitlist_to_normal_time' => time(),
                'upd_time'                => time(),
            ]);
            if ($upd_result === false) {
                Db::rollback();
                return DataReturn('候补转正失败', -100);
            }

            $admin_id = isset($params['admin']['id']) ? intval($params['admin']['id']) : 0;
            MuyingLogService::LogSuccess(MuyingLogService::TYPE_ACTIVITY_CONFIRM, 'waitlist_to_normal', $signup['user_id'], $id, '候补转正 admin_id=' . $admin_id);

            Db::commit();
            self::RecalculateSignupCount($signup['activity_id']);

            return DataReturn('候补转正成功', 0);
        } catch (\Exception $e) {
            Db::rollback();
            Log::error('候补转正异常 id=' . $id . ' error=' . $e->getMessage());
            return DataReturn('候补转正操作失败，请稍后重试', -100);
        }
    }

    public static function CodeCheckin($params = [])
    {
        $p = [
            [
                'checked_type' => 'empty',
                'key_name'     => 'signup_code',
                'error_msg'    => '签到码不能为空',
            ],
        ];
        $ret = ParamsChecked($params, $p);
        if ($ret !== true) {
            return DataReturn($ret, -1);
        }

        $signup_code = trim($params['signup_code']);

        Db::startTrans();
        try {
            $signup = Db::name('ActivitySignup')->where([
                ['signup_code', '=', $signup_code],
                ['is_delete_time', '=', 0],
            ])->lock(true)->find();
            if (empty($signup)) {
                Db::rollback();
                return DataReturn('签到码无效', -1);
            }

            if ($signup['status'] == self::SIGNUP_STATUS_CANCELLED) {
                Db::rollback();
                return DataReturn('该报名已取消，无法签到', -1);
            }

            if ($signup['is_waitlist'] == 1) {
                Db::rollback();
                return DataReturn('候补状态无法签到，请先转正', -1);
            }

            if ($signup['checkin_status'] == self::CHECKIN_STATUS_YES) {
                Db::rollback();
                return DataReturn('已签到，请勿重复签到', -1);
            }

            $checkin_result = Db::name('ActivitySignup')->where(['id' => $signup['id']])->update([
                'checkin_status' => self::CHECKIN_STATUS_YES,
                'checkin_time'   => time(),
                'upd_time'       => time(),
            ]);
            if ($checkin_result !== false) {
                MuyingLogService::LogSuccess(MuyingLogService::TYPE_ACTIVITY_CHECKIN, 'code_checkin', $signup['user_id'], $signup['id'], '签到码核销成功');
                Db::commit();
                return DataReturn('签到成功', 0);
            }
            Db::rollback();
            return DataReturn('签到失败', -100);
        } catch (\Exception $e) {
            Db::rollback();
            Log::error('签到码核销异常 signup_code=' . $signup_code . ' error=' . $e->getMessage());
            return DataReturn('签到操作失败，请稍后重试', -100);
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
            $activities = Db::name('Activity')->where(['id' => $activity_ids])->column('title,cover,category,stage,activity_type,activity_status,start_time,end_time,signup_end_time,address,contact_name,contact_phone,is_free,price,max_count,signup_count,waitlist_count,waitlist_signup_count,allow_waitlist,signup_code_enabled', 'id');

            foreach ($data as $k => &$v) {
                $v['data_index'] = $k + 1;
                $v['activity_info'] = isset($activities[$v['activity_id']]) ? $activities[$v['activity_id']] : null;
                if (!empty($v['activity_info'])) {
                    self::FormatActivityInfo($v['activity_info']);
                }
                $v['status_text'] = self::SignupStatusText($v['status']);
                $v['is_waitlist_text'] = empty($v['is_waitlist']) ? '' : '候补';
                $v['add_time_text'] = empty($v['add_time']) ? '' : date('Y-m-d H:i:s', $v['add_time']);
                $v = MuyingPrivacyService::MaskSignupRow($v, false);
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
        $info['activity_type'] = MuyingActivityType::Normalize($info['activity_type'] ?? 'offline');
        $info['activity_type_text'] = MuyingActivityType::getName($info['activity_type']);
        $info['activity_status'] = MuyingActivityStatus::Normalize($info['activity_status'] ?? 'draft');
        $info['activity_status_text'] = MuyingActivityStatus::getName($info['activity_status']);
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
        $info['remain_count'] = 0;
        if (!empty($info['max_count']) && $info['max_count'] > 0 && isset($info['signup_count'])) {
            $info['remain_count'] = max(0, $info['max_count'] - $info['signup_count']);
        }
        $info['waitlist_remain'] = 0;
        if (!empty($info['waitlist_count']) && $info['waitlist_count'] > 0 && isset($info['waitlist_signup_count'])) {
            $info['waitlist_remain'] = max(0, $info['waitlist_count'] - $info['waitlist_signup_count']);
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

        // [MUYING-二开] 内容合规敏感词扫描
        $admin = isset($params['admin']) ? $params['admin'] : [];
        $content_compliance_ret = \app\service\MuyingContentComplianceService::ValidateBeforeSave(
            \app\service\MuyingContentComplianceService::CONTENT_TYPE_ACTIVITY,
            $params,
            $admin
        );
        if ($content_compliance_ret['code'] != 0) {
            return $content_compliance_ret;
        }

        $stage = MuyingStage::Normalize($params['stage']);
        if (empty($stage)) {
            return DataReturn('适用阶段值无效', -1);
        }

        $category = MuyingActivityCategory::Normalize($params['category']);
        if (empty($category)) {
            return DataReturn('活动分类值无效', -1);
        }

        $activity_type = MuyingActivityType::Normalize(isset($params['activity_type']) ? $params['activity_type'] : 'offline');

        $activity_status = MuyingActivityStatus::DRAFT;
        if (!empty($params['id'])) {
            $existing = Db::name('Activity')->where(['id' => intval($params['id'])])->find();
            if (!empty($existing)) {
                $activity_status = $existing['activity_status'];
            }
        }
        if (isset($params['activity_status']) && MuyingActivityStatus::isValid($params['activity_status'])) {
            $activity_status = $params['activity_status'];
        }

        $max_count = empty($params['max_count']) ? 0 : intval($params['max_count']);
        $waitlist_count = empty($params['waitlist_count']) ? 0 : intval($params['waitlist_count']);
        $allow_waitlist = (!empty($params['allow_waitlist']) || $waitlist_count > 0) ? 1 : 0;
        if ($max_count <= 0) {
            $allow_waitlist = 0;
            $waitlist_count = 0;
        }

        $attachment = ResourcesService::AttachmentParams($params, ['cover']);
        $content = empty($params['content']) ? '' : str_replace("\n", '', ResourcesService::ContentStaticReplace(htmlspecialchars_decode($params['content']), 'add'));

        $data = [
            'title'                   => $params['title'],
            'cover'                   => $attachment['data']['cover'],
            'category'                => $category,
            'activity_type'           => $activity_type,
            'activity_status'         => $activity_status,
            'stage'                   => $stage,
            'suitable_crowd'          => empty($params['suitable_crowd']) ? '' : $params['suitable_crowd'],
            'description'             => empty($params['description']) ? '' : strip_tags($params['description']),
            'content'                 => $content,
            'address'                 => empty($params['address']) ? '' : $params['address'],
            'start_time'              => empty($params['start_time']) ? 0 : strtotime($params['start_time']),
            'end_time'                => empty($params['end_time']) ? 0 : strtotime($params['end_time']),
            'signup_start_time'       => empty($params['signup_start_time']) ? 0 : strtotime($params['signup_start_time']),
            'signup_end_time'         => empty($params['signup_end_time']) ? 0 : strtotime($params['signup_end_time']),
            'max_count'               => $max_count,
            'waitlist_count'          => $waitlist_count,
            'allow_waitlist'          => $allow_waitlist,
            'signup_code_enabled'     => empty($params['signup_code_enabled']) ? 0 : 1,
            'require_location_checkin' => empty($params['require_location_checkin']) ? 0 : 1,
            'latitude'                => empty($params['latitude']) ? 0 : floatval($params['latitude']),
            'longitude'               => empty($params['longitude']) ? 0 : floatval($params['longitude']),
            'is_free'                 => isset($params['is_free']) ? intval($params['is_free']) : 0,
            'price'                   => empty($params['price']) ? '0.00' : $params['price'],
            'contact_name'            => empty($params['contact_name']) ? '' : $params['contact_name'],
            'contact_phone'           => empty($params['contact_phone']) ? '' : $params['contact_phone'],
            'sort_level'              => empty($params['sort_level']) ? 0 : intval($params['sort_level']),
            'is_enable'               => isset($params['is_enable']) ? intval($params['is_enable']) : 0,
        ];

        if (empty($params['id'])) {
            $data['add_time'] = time();
            $data['signup_count'] = 0;
            $data['waitlist_signup_count'] = 0;
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
            self::AutoUpdateActivityStatus($activity_id);
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

        $id = intval($params['id']);
        $activity = Db::name('Activity')->where(['id' => $id])->find();
        if (empty($activity)) {
            return DataReturn('活动不存在', -1);
        }

        $update_data = [$params['field'] => intval($params['state']), 'upd_time' => time()];

        if ($params['field'] === 'is_enable') {
            if (intval($params['state']) === 1) {
                if (in_array($activity['activity_status'], [MuyingActivityStatus::DRAFT, MuyingActivityStatus::CANCELLED])) {
                    $update_data['activity_status'] = MuyingActivityStatus::PUBLISHED;
                }
            } else {
                if (!in_array($activity['activity_status'], [MuyingActivityStatus::ENDED])) {
                    $update_data['activity_status'] = MuyingActivityStatus::CANCELLED;
                }
            }
        }

        $status_result = Db::name('Activity')->where(['id' => $id])->update($update_data);
        if ($status_result !== false) {
            if (isset($update_data['activity_status'])) {
                self::AutoUpdateActivityStatus($id);
            }
            return DataReturn(MyLang('edit_success'), 0);
        }
        return DataReturn(MyLang('edit_fail'), -100);
    }

    public static function ActivityReview($params = [])
    {
        $id = isset($params['id']) ? intval($params['id']) : 0;
        if ($id <= 0) {
            return DataReturn('活动ID不能为空', -1);
        }

        $activity = Db::name('Activity')->where(['id' => $id])->find();
        if (empty($activity)) {
            return DataReturn('活动不存在', -1);
        }

        $access_count = intval($activity['access_count']);

        $signup_total = Db::name('ActivitySignup')->where([
            ['activity_id', '=', $id],
            ['is_delete_time', '=', 0],
        ])->count();

        $real_signup_count = Db::name('ActivitySignup')->where([
            ['activity_id', '=', $id],
            ['status', 'in', [0, 1]],
            ['is_waitlist', '=', 0],
            ['is_delete_time', '=', 0],
        ])->count();

        $waitlist_count = Db::name('ActivitySignup')->where([
            ['activity_id', '=', $id],
            ['status', 'in', [0, 1]],
            ['is_waitlist', '=', 1],
            ['is_delete_time', '=', 0],
        ])->count();

        $checkin_count = Db::name('ActivitySignup')->where([
            ['activity_id', '=', $id],
            ['checkin_status', '=', 1],
            ['is_delete_time', '=', 0],
        ])->count();

        $cancelled_count = Db::name('ActivitySignup')->where([
            ['activity_id', '=', $id],
            ['status', '=', 2],
            ['is_delete_time', '=', 0],
        ])->count();

        $signup_conversion_rate = $access_count > 0 ? round(($real_signup_count / $access_count) * 100, 2) : 0;
        $attendance_rate = $real_signup_count > 0 ? round(($checkin_count / $real_signup_count) * 100, 2) : 0;

        $review = [
            'activity_id'            => $id,
            'activity_title'         => $activity['title'],
            'access_count'           => $access_count,
            'signup_count'           => $real_signup_count,
            'waitlist_count'         => $waitlist_count,
            'checkin_count'          => $checkin_count,
            'cancelled_count'        => $cancelled_count,
            'max_count'              => intval($activity['max_count']),
            'waitlist_total_count'   => intval($activity['waitlist_count']),
            'signup_conversion_rate' => $signup_conversion_rate,
            'attendance_rate'        => $attendance_rate,
        ];

        return DataReturn(MyLang('handle_success'), 0, $review);
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
            $activities = Db::name('Activity')->where(['id' => $activity_ids])->column('title,cover,category,stage,activity_type,activity_status,start_time,end_time,signup_end_time,address,contact_name,contact_phone,is_free,price', 'id');

            foreach ($data as $k => &$v) {
                $v['data_index'] = $k + 1;
                $v['activity_title'] = isset($activities[$v['activity_id']]) ? $activities[$v['activity_id']]['title'] : '';
                $v['activity_info'] = isset($activities[$v['activity_id']]) ? $activities[$v['activity_id']] : null;
                if (!empty($v['activity_info'])) {
                    self::FormatActivityInfo($v['activity_info']);
                }
                $v['status_text'] = self::SignupStatusText($v['status']);
                $v['checkin_status_text'] = self::CheckinStatusText($v['checkin_status']);
                $v['is_waitlist_text'] = empty($v['is_waitlist']) ? '' : '候补';
                $v['stage_text'] = MuyingStage::getName(MuyingStage::Normalize($v['stage']));
                $v['add_time_text'] = empty($v['add_time']) ? '' : date('Y-m-d H:i:s', $v['add_time']);
                $v['checkin_time_text'] = empty($v['checkin_time']) ? '' : date('Y-m-d H:i:s', $v['checkin_time']);
                $v = MuyingPrivacyService::MaskSignupRow($v, false);
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
        $data['is_waitlist_text'] = empty($data['is_waitlist']) ? '' : '候补';
        $data['stage_text'] = MuyingStage::getName(MuyingStage::Normalize($data['stage']));
        $data['due_date'] = empty($data['due_date']) ? '' : date('Y-m-d', $data['due_date']);
        $data['baby_birthday'] = empty($data['baby_birthday']) ? '' : date('Y-m-d', $data['baby_birthday']);
        $data['baby_month_age'] = empty($data['baby_month_age']) ? '' : intval($data['baby_month_age']);
        $data['add_time_text'] = empty($data['add_time']) ? '' : date('Y-m-d H:i:s', $data['add_time']);
        $data['checkin_time_text'] = empty($data['checkin_time']) ? '' : date('Y-m-d H:i:s', $data['checkin_time']);
        $data['privacy_agreed_time_text'] = empty($data['privacy_agreed_time']) ? '' : date('Y-m-d H:i:s', $data['privacy_agreed_time']);
        $data['waitlist_to_normal_time_text'] = empty($data['waitlist_to_normal_time']) ? '' : date('Y-m-d H:i:s', $data['waitlist_to_normal_time']);

        $show_full = !empty($params['admin']) && MuyingPrivacyService::CanViewSensitive($params['admin']);
        $data = MuyingPrivacyService::MaskSignupRow($data, $show_full);

        if ($show_full && !empty($params['admin'])) {
            MuyingAuditLogService::LogSensitiveView($params['admin'], MuyingAuditLogService::SCENE_SENSITIVE_VIEW, $id, '查看报名详情含敏感信息');
        }

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

            if ($signup['is_waitlist'] == 1) {
                Db::rollback();
                return DataReturn('候补状态无法签到，请先转正', -1);
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

    public static function SignupAdminCancel($params = [])
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
                return DataReturn('该报名已取消，请勿重复操作', -1);
            }

            if ($signup['checkin_status'] == self::CHECKIN_STATUS_YES) {
                Db::rollback();
                return DataReturn('已签到的报名不能取消', -1);
            }

            $upd_result = Db::name('ActivitySignup')->where(['id' => $id])->update([
                'status'   => self::SIGNUP_STATUS_CANCELLED,
                'upd_time' => time(),
            ]);
            if ($upd_result !== false) {
                Db::commit();
                self::RecalculateSignupCount($signup['activity_id']);
                self::ProcessWaitlistAutoPromote($signup['activity_id']);

                $admin_id = isset($params['admin']['id']) ? intval($params['admin']['id']) : 0;
                MuyingLogService::LogSuccess(MuyingLogService::TYPE_ACTIVITY_CONFIRM, 'cancel', $signup['user_id'], $id, '管理员取消报名 admin_id=' . $admin_id);
                return DataReturn('取消报名成功', 0);
            }
            Db::rollback();
            return DataReturn('取消报名失败', -100);
        } catch (\Exception $e) {
            Db::rollback();
            Log::error('管理员取消报名异常 id=' . $id . ' error=' . $e->getMessage());
            return DataReturn('取消操作失败，请稍后重试', -100);
        }
    }

    public static function SignupBatchConfirm($params = [])
    {
        $ids = empty($params['ids']) ? [] : $params['ids'];
        if (!is_array($ids)) {
            $ids = explode(',', $ids);
        }
        $ids = array_map('intval', array_filter($ids));
        if (empty($ids)) {
            return DataReturn('请选择要确认的报名记录', -1);
        }

        $success_count = 0;
        $skip_count = 0;
        $fail_count = 0;

        Db::startTrans();
        try {
            foreach ($ids as $id) {
                $signup = Db::name('ActivitySignup')->where([
                    ['id', '=', $id],
                    ['is_delete_time', '=', 0],
                ])->lock(true)->find();

                if (empty($signup)) {
                    $skip_count++;
                    continue;
                }

                if ($signup['status'] != self::SIGNUP_STATUS_PENDING) {
                    $skip_count++;
                    continue;
                }

                $upd_result = Db::name('ActivitySignup')->where(['id' => $id])->update([
                    'status'   => self::SIGNUP_STATUS_CONFIRMED,
                    'upd_time' => time(),
                ]);

                if ($upd_result !== false) {
                    $success_count++;
                } else {
                    $fail_count++;
                }
            }

            $admin_id = isset($params['admin']['id']) ? intval($params['admin']['id']) : 0;
            MuyingLogService::LogSuccess(MuyingLogService::TYPE_ACTIVITY_CONFIRM, 'batch_confirm', 0, 0, '批量确认报名 成功' . $success_count . '条 跳过' . $skip_count . '条 admin_id=' . $admin_id);
            Db::commit();
            return DataReturn('批量确认完成：成功 ' . $success_count . ' 条，跳过 ' . $skip_count . ' 条，失败 ' . $fail_count . ' 条', 0);
        } catch (\Exception $e) {
            Db::rollback();
            Log::error('批量确认报名异常 error=' . $e->getMessage());
            return DataReturn('批量确认操作失败，请稍后重试', -100);
        }
    }

    public static function SignupDelete($params = [])
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

        $signup = Db::name('ActivitySignup')->where([
            ['id', '=', $id],
            ['is_delete_time', '=', 0],
        ])->find();
        if (empty($signup)) {
            return DataReturn('报名记录不存在', -1);
        }

        $upd_result = Db::name('ActivitySignup')->where(['id' => $id])->update([
            'is_delete_time' => time(),
            'upd_time'       => time(),
        ]);
        if ($upd_result !== false) {
            self::RecalculateSignupCount($signup['activity_id']);
            self::ProcessWaitlistAutoPromote($signup['activity_id']);
            return DataReturn('删除成功', 0);
        }
        return DataReturn('删除失败', -100);
    }

    public static function SignupExport($params = [])
    {
        $where = empty($params['where']) ? [] : $params['where'];

        $can_export_sensitive = !empty($params['admin']) && MuyingPrivacyService::CanExportSensitive($params['admin']);
        $show_full = $can_export_sensitive;

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
            $v = MuyingPrivacyService::MaskSignupRow($v, $show_full);
            $result[] = [
                'id'                    => $v['id'],
                'activity_title'        => $activity_title,
                'name'                  => $v['name'],
                'phone'                 => $v['phone'],
                'stage'                 => $stage_map[$v['stage']] ?? $v['stage'],
                'due_date'              => empty($v['due_date']) ? '' : date('Y-m-d', $v['due_date']),
                'baby_birthday'         => empty($v['baby_birthday']) ? '' : date('Y-m-d', $v['baby_birthday']),
                'baby_month_age'        => empty($v['baby_month_age']) ? '' : $v['baby_month_age'].'个月',
                'is_waitlist'           => empty($v['is_waitlist']) ? '正式' : '候补',
                'signup_code'           => $v['signup_code'] ?? '',
                'remark'                => $v['remark'] ?? '',
                'status_text'           => $status_map[$v['status']] ?? '',
                'checkin_status_text'   => $checkin_map[$v['checkin_status']] ?? '未签到',
                'add_time_text'         => empty($v['add_time']) ? '' : date('Y-m-d H:i:s', $v['add_time']),
                'checkin_time_text'     => empty($v['checkin_time']) ? '' : date('Y-m-d H:i:s', $v['checkin_time']),
            ];
        }

        if (!empty($params['admin'])) {
            $export_type = $show_full ? '明文导出' : '脱敏导出';
            MuyingAuditLogService::LogExport($params['admin'], MuyingAuditLogService::SCENE_SIGNUP_EXPORT, array_merge($where, ['export_type' => $export_type]), count($result));
        }

        return DataReturn(MyLang('handle_success'), 0, $result);
    }

    public static function SafeStrtotime($value)
    {
        if (is_numeric($value)) {
            $ts = intval($value);
            return ($ts > 0) ? $ts : 0;
        }
        $ts = strtotime($value);
        return ($ts !== false && $ts > 0) ? $ts : 0;
    }
}
