<?php
namespace app\api\controller;

use app\service\ApiService;
use app\service\InviteService;
use app\service\ActivityService;

class Muyingtest extends Common
{
    public function __construct()
    {
        parent::__construct();
    }

    public function FirstOrder()
    {
        $user_id = input('user_id', 0, 'intval');
        if ($user_id <= 0) {
            return ApiService::ApiDataReturn(DataReturn('user_id参数必填', -1));
        }

        $before = \think\facade\Db::name('InviteReward')->where([
            ['invitee_id', '=', $user_id],
            ['trigger_event', '=', 'first_order'],
        ])->find();

        $result = InviteService::OnFirstOrder(['user_id' => $user_id]);

        $after = \think\facade\Db::name('InviteReward')->where([
            ['invitee_id', '=', $user_id],
            ['trigger_event', '=', 'first_order'],
        ])->find();

        return ApiService::ApiDataReturn(DataReturn(MyLang('handle_success'), 0, [
            'before' => $before,
            'result' => $result,
            'after'  => $after,
        ]));
    }

    public function Checkin()
    {
        $id = input('id', 0, 'intval');
        if ($id <= 0) {
            return ApiService::ApiDataReturn(DataReturn('报名记录ID必填', -1));
        }

        $before = \think\facade\Db::name('ActivitySignup')->where('id', $id)->find();
        if (empty($before)) {
            return ApiService::ApiDataReturn(DataReturn('报名记录不存在', -1));
        }

        $result = ActivityService::SignupCheckin(['id' => $id]);

        $after = \think\facade\Db::name('ActivitySignup')->where('id', $id)->find();

        return ApiService::ApiDataReturn(DataReturn(MyLang('handle_success'), 0, [
            'before' => [
                'id'             => $before['id'],
                'name'           => $before['name'],
                'checkin_status' => $before['checkin_status'],
                'checkin_time'   => $before['checkin_time'],
            ],
            'result' => $result,
            'after'  => [
                'id'             => $after['id'],
                'name'           => $after['name'],
                'checkin_status' => $after['checkin_status'],
                'checkin_time'   => $after['checkin_time'],
                'checkin_time_text' => empty($after['checkin_time']) ? '' : date('Y-m-d H:i:s', $after['checkin_time']),
            ],
        ]));
    }

    public function Export()
    {
        $where = [['is_delete_time', '=', 0]];
        $activity_id = input('activity_id', 0, 'intval');
        if ($activity_id > 0) {
            $where[] = ['activity_id', '=', $activity_id];
        }

        $ret = ActivityService::SignupExport(['where' => $where]);
        if ($ret['code'] != 0) {
            return ApiService::ApiDataReturn($ret);
        }

        $csv_headers = '报名ID,活动标题,姓名,手机,阶段,预产期,宝宝月龄,报名状态,签到状态,报名时间,签到时间';
        $csv_rows = [];
        if (!empty($ret['data']) && is_array($ret['data'])) {
            foreach ($ret['data'] as $row) {
                $csv_rows[] = implode(',', [
                    $row['id'],
                    $row['activity_title'],
                    $row['name'],
                    $row['phone'],
                    $row['stage'],
                    $row['due_date'],
                    $row['baby_month_age'],
                    $row['status_text'],
                    $row['checkin_status_text'],
                    $row['add_time_text'],
                    $row['checkin_time_text'],
                ]);
            }
        }

        return ApiService::ApiDataReturn(DataReturn(MyLang('handle_success'), 0, [
            'total'       => is_array($ret['data']) ? count($ret['data']) : 0,
            'headers'     => $csv_headers,
            'first_row'   => !empty($ret['data']) && is_array($ret['data']) ? $ret['data'][0] : null,
            'last_row'    => !empty($ret['data']) && is_array($ret['data']) ? $ret['data'][count($ret['data']) - 1] : null,
            'csv_preview' => !empty($csv_rows) ? implode("\n", array_slice($csv_rows, 0, 5)) : '',
        ]));
    }

    public function FullFlow()
    {
        $inviter_id = input('inviter_id', 1, 'intval');
        $invitee_id = input('invitee_id', 4, 'intval');

        $invite_code = md5($inviter_id . 'muying_invite');

        $inviter_integral_before = \think\facade\Db::name('User')->where('id', $inviter_id)->value('integral');

        \think\facade\Db::name('InviteReward')->where('invitee_id', $invitee_id)->delete();

        $register_result = InviteService::OnUserRegister(['user_id' => $invitee_id, 'invite_code' => $invite_code]);

        $register_reward = \think\facade\Db::name('InviteReward')->where([
            ['invitee_id', '=', $invitee_id],
            ['trigger_event', '=', 'register'],
        ])->find();

        $first_order_result = InviteService::OnFirstOrder(['user_id' => $invitee_id]);

        $first_order_reward = \think\facade\Db::name('InviteReward')->where([
            ['invitee_id', '=', $invitee_id],
            ['trigger_event', '=', 'first_order'],
        ])->find();

        $inviter_integral_after = \think\facade\Db::name('User')->where('id', $inviter_id)->value('integral');

        return ApiService::ApiDataReturn(DataReturn(MyLang('handle_success'), 0, [
            'invite_code'              => $invite_code,
            'inviter_integral_before'  => $inviter_integral_before,
            'register_result'          => $register_result,
            'register_reward'          => $register_reward ? [
                'id'           => $register_reward['id'],
                'reward_type'  => $register_reward['reward_type'],
                'reward_value' => $register_reward['reward_value'],
                'status'       => $register_reward['status'],
            ] : null,
            'first_order_result'       => $first_order_result,
            'first_order_reward'       => $first_order_reward ? [
                'id'           => $first_order_reward['id'],
                'reward_type'  => $first_order_reward['reward_type'],
                'reward_value' => $first_order_reward['reward_value'],
                'status'       => $first_order_reward['status'],
            ] : null,
            'inviter_integral_after'   => $inviter_integral_after,
            'integral_change'          => $inviter_integral_after - $inviter_integral_before,
        ]));
    }

    public function SignupList()
    {
        $data = \think\facade\Db::name('ActivitySignup')
            ->where('is_delete_time', 0)
            ->order('id desc')
            ->limit(20)
            ->select()
            ->toArray();

        $result = [];
        foreach ($data as $row) {
            $result[] = [
                'id'               => $row['id'],
                'activity_id'      => $row['activity_id'],
                'name'             => $row['name'],
                'phone'            => $row['phone'],
                'stage'            => $row['stage'],
                'checkin_status'   => $row['checkin_status'],
                'checkin_time'     => empty($row['checkin_time']) ? '' : date('Y-m-d H:i:s', $row['checkin_time']),
                'add_time'         => date('Y-m-d H:i:s', $row['add_time']),
            ];
        }

        return ApiService::ApiDataReturn(DataReturn(MyLang('handle_success'), 0, $result));
    }
}
