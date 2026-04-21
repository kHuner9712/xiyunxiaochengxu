<?php
namespace app\admin\controller;

use app\admin\controller\Base;
use app\service\ApiService;

class Inviteconfig extends Base
{
    public function Index()
    {
        $config_keys = [
            'muying_invite_register_reward',
            'muying_invite_first_order_reward',
            'muying_invite_register_auto_grant',
            'muying_invite_first_order_auto_grant',
            'muying_invite_daily_limit',
            'muying_invite_slogan',
        ];

        $config_data = [];
        foreach ($config_keys as $key) {
            $config_data[$key] = MyC($key, '', true);
        }

        $total_invites = \think\facade\Db::name('InviteReward')->group('invitee_id')->count();
        $total_reward_value = \think\facade\Db::name('InviteReward')->where(['status' => 1])->sum('reward_value');
        $pending_count = \think\facade\Db::name('InviteReward')->where(['status' => 0])->count();

        MyViewAssign([
            'config_data'        => $config_data,
            'total_invites'      => $total_invites,
            'total_reward_value' => intval($total_reward_value),
            'pending_count'      => $pending_count,
        ]);

        return MyView();
    }

    public function Save()
    {
        $params = $this->data_request;

        $config_keys = [
            'muying_invite_register_reward',
            'muying_invite_first_order_reward',
            'muying_invite_register_auto_grant',
            'muying_invite_first_order_auto_grant',
            'muying_invite_daily_limit',
            'muying_invite_slogan',
        ];

        foreach ($config_keys as $key) {
            if (isset($params[$key])) {
                MyC($key, $params[$key], true);
            }
        }

        return ApiService::ApiDataReturn(DataReturn('保存成功', 0));
    }
}
