<?php
namespace app\service;

use think\facade\Db;
use app\service\ResourcesService;

class ActivityService
{
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
            $where[] = ['category', '=', $params['category']];
        }

        if (!empty($params['stage'])) {
            $where[] = ['stage', 'in', [$params['stage'], 'all']];
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
        ];
        $ret = ParamsChecked($params, $p);
        if ($ret !== true) {
            return DataReturn($ret, -1);
        }

        $activity_id = intval($params['activity_id']);
        $user_id = intval($params['user']['id']);

        $activity = Db::name('Activity')->where([
            ['id', '=', $activity_id],
            ['is_enable', '=', 1],
            ['is_delete_time', '=', 0],
        ])->find();
        if (empty($activity)) {
            return DataReturn('活动不存在或已下架', -1);
        }

        $now = time();
        if ($activity['signup_start_time'] > 0 && $now < $activity['signup_start_time']) {
            return DataReturn('报名尚未开始', -1);
        }
        if ($activity['signup_end_time'] > 0 && $now > $activity['signup_end_time']) {
            return DataReturn('报名已截止', -1);
        }

        $exists = Db::name('ActivitySignup')->where([
            ['activity_id', '=', $activity_id],
            ['user_id', '=', $user_id],
            ['status', 'in', [0, 1]],
            ['is_delete_time', '=', 0],
        ])->find();
        if (!empty($exists)) {
            return DataReturn('您已报名该活动', -1);
        }

        if ($activity['max_count'] > 0 && $activity['signup_count'] >= $activity['max_count']) {
            return DataReturn('报名人数已满', -1);
        }

        $data = [
            'activity_id'    => $activity_id,
            'user_id'        => $user_id,
            'name'           => $params['name'],
            'phone'          => $params['phone'],
            'stage'          => empty($params['stage']) ? '' : $params['stage'],
            'due_date'       => empty($params['due_date']) ? 0 : (is_numeric($params['due_date']) ? intval($params['due_date']) : strtotime($params['due_date'])),
            'baby_month_age' => empty($params['baby_month_age']) ? 0 : intval($params['baby_month_age']),
            'remark'         => empty($params['remark']) ? '' : $params['remark'],
            'status'         => 0,
            'add_time'       => time(),
            'upd_time'       => time(),
        ];

        $signup_id = Db::name('ActivitySignup')->insertGetId($data);
        if ($signup_id <= 0) {
            return DataReturn('报名失败', -100);
        }

        Db::name('Activity')->where(['id' => $activity_id])->inc('signup_count')->update();

        return DataReturn('报名成功', 0);
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

        $signup = Db::name('ActivitySignup')->where([
            ['id', '=', $id],
            ['user_id', '=', $user_id],
            ['status', 'in', [0, 1]],
            ['is_delete_time', '=', 0],
        ])->find();
        if (empty($signup)) {
            return DataReturn('报名记录不存在', -1);
        }

        $upd = Db::name('ActivitySignup')->where(['id' => $id])->update([
            'status'          => 2,
            'is_delete_time'  => time(),
            'upd_time'        => time(),
        ]);
        if ($upd !== false) {
            Db::name('Activity')->where(['id' => $signup['activity_id']])->dec('signup_count')->update();
            return DataReturn('取消报名成功', 0);
        }
        return DataReturn('取消报名失败', -100);
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
            $activities = Db::name('Activity')->where(['id' => $activity_ids])->column('title,cover,category,stage,start_time,end_time,address', 'id');

            foreach ($data as $k => &$v) {
                $v['data_index'] = $k + 1;
                $v['activity_info'] = isset($activities[$v['activity_id']]) ? $activities[$v['activity_id']] : null;
                if (!empty($v['activity_info']['cover'])) {
                    $v['activity_info']['cover'] = ResourcesService::AttachmentPathViewHandle($v['activity_info']['cover']);
                }
                if (!empty($v['activity_info']['start_time'])) {
                    $v['activity_info']['start_time_text'] = date('Y-m-d H:i:s', $v['activity_info']['start_time']);
                }
                if (!empty($v['activity_info']['end_time'])) {
                    $v['activity_info']['end_time_text'] = date('Y-m-d H:i:s', $v['activity_info']['end_time']);
                }
                $v['status_text'] = ['待确认', '已确认', '已取消'][$v['status']] ?? '';
                $v['add_time_text'] = empty($v['add_time']) ? '' : date('Y-m-d H:i:s', $v['add_time']);
            }
        }

        return DataReturn(MyLang('handle_success'), 0, $data);
    }

    public static function ActivityDetail($params = [])
    {
        $id = isset($params['id']) ? intval($params['id']) : 0;
        if ($id <= 0) {
            return DataReturn('活动ID不能为空', -1);
        }

        $data = Db::name('Activity')->where(['id' => $id])->find();
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

        $attachment = ResourcesService::AttachmentParams($params, ['cover']);
        $content = empty($params['content']) ? '' : str_replace("\n", '', ResourcesService::ContentStaticReplace(htmlspecialchars_decode($params['content']), 'add'));

        $data = [
            'title'              => $params['title'],
            'cover'              => $attachment['data']['cover'],
            'category'           => $params['category'],
            'stage'              => $params['stage'],
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
            if (!Db::name('Activity')->where(['id' => $activity_id])->update($data)) {
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

        if (Db::name('Activity')->where(['id' => $params['ids']])->update(['is_delete_time' => time(), 'upd_time' => time()])) {
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

        if (Db::name('Activity')->where(['id' => intval($params['id'])])->update([$params['field'] => intval($params['state']), 'upd_time' => time()])) {
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

        if (!empty($data)) {
            $activity_ids = array_unique(array_column($data, 'activity_id'));
            $activities = Db::name('Activity')->where(['id' => $activity_ids])->column('title,cover,category,stage,start_time,end_time,address', 'id');

            foreach ($data as $k => &$v) {
                $v['data_index'] = $k + 1;
                $v['activity_title'] = isset($activities[$v['activity_id']]) ? $activities[$v['activity_id']]['title'] : '';
                $v['activity_info'] = isset($activities[$v['activity_id']]) ? $activities[$v['activity_id']] : null;
                if (!empty($v['activity_info']['cover'])) {
                    $v['activity_info']['cover'] = ResourcesService::AttachmentPathViewHandle($v['activity_info']['cover']);
                }
                $v['status_text'] = ['待确认', '已确认', '已取消'][$v['status']] ?? '';
                $v['checkin_status_text'] = empty($v['checkin_status']) ? '未签到' : '已签到';
                $v['add_time_text'] = empty($v['add_time']) ? '' : date('Y-m-d H:i:s', $v['add_time']);
                $v['checkin_time_text'] = empty($v['checkin_time']) ? '' : date('Y-m-d H:i:s', $v['checkin_time']);
            }
        }

        return DataReturn(MyLang('handle_success'), 0, $data);
    }

    public static function AdminSignupTotal($where)
    {
        return (int) Db::name('ActivitySignup')->where($where)->count();
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
        $data['status_text'] = ['待确认', '已确认', '已取消'][$data['status']] ?? '';
        $data['checkin_status_text'] = empty($data['checkin_status']) ? '未签到' : '已签到';
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
        $signup = Db::name('ActivitySignup')->where([
            ['id', '=', $id],
            ['checkin_status', '=', 0],
        ])->find();
        if (empty($signup)) {
            return DataReturn('报名记录不存在或已签到', -1);
        }

        if (Db::name('ActivitySignup')->where(['id' => $id])->update([
            'checkin_status' => 1,
            'checkin_time'   => time(),
            'upd_time'       => time(),
        ])) {
            return DataReturn('签到成功', 0);
        }
        return DataReturn('签到失败', -100);
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

        $stage_map = [
            'prepare'    => '备孕',
            'pregnancy'  => '孕期',
            'postpartum' => '产后',
            'all'        => '通用',
        ];

        $status_map = ['待确认', '已确认', '已取消'];
        $checkin_map = ['未签到', '已签到'];

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
                'baby_month_age'    => empty($v['baby_month_age']) ? '' : $v['baby_month_age'].'个月',
                'status_text'      => $status_map[$v['status']] ?? '',
                'checkin_status_text' => $checkin_map[$v['checkin_status']] ?? '未签到',
                'add_time_text'    => empty($v['add_time']) ? '' : date('Y-m-d H:i:s', $v['add_time']),
                'checkin_time_text' => empty($v['checkin_time']) ? '' : date('Y-m-d H:i:s', $v['checkin_time']),
            ];
        }

        return DataReturn(MyLang('handle_success'), 0, $result);
    }
}
