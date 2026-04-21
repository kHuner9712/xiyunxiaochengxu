<?php
namespace app\service;

use think\facade\Db;
use app\service\ResourcesService;
use app\extend\muying\MuyingStage;

class FeedbackService
{
    public static function FeedbackWhere($params = [])
    {
        $where = [
            ['is_enable', '=', 1],
            ['is_delete_time', '=', 0],
        ];

        if (!empty($params['stage'])) {
            $where[] = ['stage', '=', MuyingStage::Normalize($params['stage'])];
        }

        return $where;
    }

    public static function FeedbackCreate($params = [])
    {
        $p = [
            [
                'checked_type' => 'empty',
                'key_name'     => 'content',
                'error_msg'    => '反馈内容不能为空',
            ],
        ];
        $ret = ParamsChecked($params, $p);
        if ($ret !== true) {
            return DataReturn($ret, -1);
        }

        if (empty($params['user']) || empty($params['user']['id'])) {
            return DataReturn(MyLang('user_info_incorrect_tips'), -1);
        }

        if (!empty($params['content']) && mb_strlen($params['content']) > 500) {
            return DataReturn('反馈内容不能超过500字', -1);
        }

        $normalized = '';
        if (!empty($params['stage'])) {
            $normalized = MuyingStage::Normalize($params['stage']);
        }

        $user_id = intval($params['user']['id']);
        $user_row = Db::name('User')->where(['id' => $user_id])->find();

        $data = [
            'user_id'    => $user_id,
            'nickname'   => !empty($user_row['nickname']) ? strip_tags(trim($user_row['nickname'])) : '用户' . $user_id,
            'avatar'     => !empty($user_row['avatar']) ? trim($user_row['avatar']) : '',
            'content'    => strip_tags(trim($params['content'])),
            'stage'      => $normalized,
            'contact'    => !empty($params['contact']) ? strip_tags(trim($params['contact'])) : '',
            'is_enable'  => 1,
            'add_time'   => time(),
            'upd_time'   => time(),
        ];

        $id = Db::name('MuyingFeedback')->insertGetId($data);
        if ($id <= 0) {
            return DataReturn('提交失败，请重试', -100);
        }

        return DataReturn('提交成功', 0);
    }

    public static function FeedbackTotal($where)
    {
        return (int) Db::name('MuyingFeedback')->where($where)->count();
    }

    public static function FeedbackList($params)
    {
        $where = empty($params['where']) ? [] : $params['where'];
        $field = empty($params['field']) ? '*' : $params['field'];
        $order_by = empty($params['order_by']) ? 'sort_level desc, id desc' : trim($params['order_by']);
        $m = isset($params['m']) ? intval($params['m']) : 0;
        $n = isset($params['n']) ? intval($params['n']) : 10;

        $data = Db::name('MuyingFeedback')->field($field)->where($where)->order($order_by)->limit($m, $n)->select()->toArray();

        if (!empty($data)) {
            foreach ($data as $k => &$v) {
                $v['data_index'] = $k + 1;
                if (!empty($v['avatar'])) {
                    $v['avatar'] = ResourcesService::AttachmentPathViewHandle($v['avatar']);
                }
                $v['stage_text'] = MuyingStage::getName(MuyingStage::Normalize($v['stage'] ?? ''));
                $v['add_time_text'] = empty($v['add_time']) ? '' : date('Y-m-d H:i:s', $v['add_time']);
            }
        }

        return DataReturn(MyLang('handle_success'), 0, $data);
    }

    public static function FeedbackAdminWhere($params = [])
    {
        $where = [
            ['is_delete_time', '=', 0],
        ];

        if (isset($params['is_enable']) && $params['is_enable'] !== '') {
            $where[] = ['is_enable', '=', intval($params['is_enable'])];
        }

        if (!empty($params['stage'])) {
            $where[] = ['stage', '=', MuyingStage::Normalize($params['stage'])];
        }

        if (!empty($params['awd'])) {
            $where[] = ['content', 'like', '%' . trim($params['awd']) . '%'];
        }

        return $where;
    }

    public static function FeedbackAdminTotal($where)
    {
        return (int) Db::name('MuyingFeedback')->where($where)->count();
    }

    public static function FeedbackAdminList($params)
    {
        $where = empty($params['where']) ? [] : $params['where'];
        $field = empty($params['field']) ? '*' : $params['field'];
        $order_by = empty($params['order_by']) ? 'id desc' : trim($params['order_by']);
        $m = isset($params['m']) ? intval($params['m']) : 0;
        $n = isset($params['n']) ? intval($params['n']) : 10;

        $data = Db::name('MuyingFeedback')->field($field)->where($where)->order($order_by)->limit($m, $n)->select()->toArray();

        if (!empty($data)) {
            foreach ($data as $k => &$v) {
                $v['data_index'] = $k + 1;
                $v['stage_text'] = MuyingStage::getName(MuyingStage::Normalize($v['stage'] ?? ''));
                $v['add_time_text'] = empty($v['add_time']) ? '' : date('Y-m-d H:i:s', $v['add_time']);
                $v['is_enable_text'] = $v['is_enable'] == 1 ? '显示' : '隐藏';
            }
        }

        return DataReturn(MyLang('handle_success'), 0, $data);
    }

    public static function FeedbackAdminListHandle($data, $params = [])
    {
        if (!empty($data)) {
            foreach ($data as $k => &$v) {
                $v['data_index'] = $k + 1;
                $v['stage_text'] = MuyingStage::getName(MuyingStage::Normalize($v['stage'] ?? ''));
                $v['add_time_text'] = empty($v['add_time']) ? '' : date('Y-m-d H:i:s', $v['add_time']);
                $v['is_enable_text'] = $v['is_enable'] == 1 ? '显示' : '隐藏';
            }
        }
        return $data;
    }

    public static function FeedbackStatusUpdate($params = [])
    {
        $p = [
            [
                'checked_type' => 'empty',
                'key_name'     => 'id',
                'error_msg'    => MyLang('data_id_error_tips'),
            ],
            [
                'checked_type' => 'in',
                'key_name'     => 'state',
                'checked_data' => [0, 1],
                'error_msg'    => MyLang('form_status_range_message'),
            ],
        ];
        $ret = ParamsChecked($params, $p);
        if ($ret !== true) {
            return DataReturn($ret, -1);
        }

        $status_result = Db::name('MuyingFeedback')->where(['id' => intval($params['id'])])->update([
            'is_enable' => intval($params['state']),
            'upd_time'  => time(),
        ]);
        if ($status_result !== false) {
            return DataReturn(MyLang('edit_success'), 0);
        }
        return DataReturn(MyLang('edit_fail'), -100);
    }

    public static function FeedbackDelete($params = [])
    {
        if (empty($params['ids'])) {
            return DataReturn(MyLang('data_id_error_tips'), -1);
        }
        if (!is_array($params['ids'])) {
            $params['ids'] = explode(',', $params['ids']);
        }

        $del_result = Db::name('MuyingFeedback')->where(['id' => $params['ids']])->update([
            'is_delete_time' => time(),
            'upd_time'       => time(),
        ]);
        if ($del_result !== false) {
            return DataReturn(MyLang('delete_success'), 0);
        }
        return DataReturn(MyLang('delete_fail'), -100);
    }
}
