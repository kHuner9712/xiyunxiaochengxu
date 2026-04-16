<?php
namespace app\service;

use think\facade\Db;
use app\service\IntegralService;
use app\service\ResourcesService;

class InviteService
{
    public static function InviteInfo($params = [])
    {
        $user_id = intval($params['user']['id']);

        $invite_count = Db::name('InviteReward')->where([
            ['inviter_id', '=', $user_id],
        ])->group('invitee_id')->count();

        $reward_total = Db::name('InviteReward')->where([
            ['inviter_id', '=', $user_id],
            ['status', '=', 1],
            ['reward_type', '=', 'integral'],
        ])->sum('reward_value');

        $pending_count = Db::name('InviteReward')->where([
            ['inviter_id', '=', $user_id],
            ['status', '=', 0],
        ])->count();

        return [
            'invite_count' => $invite_count,
            'reward_total' => intval($reward_total),
            'pending_count' => $pending_count,
            'invite_code'  => md5($user_id . 'muying_invite'),
        ];
    }

    public static function RewardListWhere($params = [])
    {
        $where = [
            ['inviter_id', '=', intval($params['user']['id'])],
        ];

        if (isset($params['status']) && $params['status'] !== '') {
            $where[] = ['status', '=', intval($params['status'])];
        }

        if (!empty($params['reward_type'])) {
            $where[] = ['reward_type', '=', $params['reward_type']];
        }

        if (!empty($params['trigger_event'])) {
            $where[] = ['trigger_event', '=', $params['trigger_event']];
        }

        return $where;
    }

    public static function RewardListTotal($where)
    {
        return (int) Db::name('InviteReward')->where($where)->count();
    }

    public static function RewardList($params)
    {
        $where = empty($params['where']) ? [] : $params['where'];
        $field = empty($params['field']) ? '*' : $params['field'];
        $order_by = empty($params['order_by']) ? 'id desc' : trim($params['order_by']);
        $m = isset($params['m']) ? intval($params['m']) : 0;
        $n = isset($params['n']) ? intval($params['n']) : 10;

        $data = Db::name('InviteReward')->field($field)->where($where)->order($order_by)->limit($m, $n)->select()->toArray();

        if (!empty($data)) {
            $invitee_ids = array_unique(array_column($data, 'invitee_id'));
            $users = Db::name('User')->where(['id' => $invitee_ids])->column('id,nickname,avatar', 'id');

            foreach ($data as $k => &$v) {
                $v['data_index'] = $k + 1;
                $v['invitee_info'] = isset($users[$v['invitee_id']]) ? $users[$v['invitee_id']] : null;
                if (!empty($v['invitee_info']['avatar'])) {
                    $v['invitee_info']['avatar'] = ResourcesService::AttachmentPathViewHandle($v['invitee_info']['avatar']);
                }
                $v['status_text'] = ['待发放', '已发放', '已取消'][$v['status']] ?? '';
                $v['reward_type_text'] = ['integral' => '积分', 'coupon' => '优惠券'][$v['reward_type']] ?? $v['reward_type'];
                $v['trigger_event_text'] = ['register' => '注册', 'first_order' => '首单'][$v['trigger_event']] ?? $v['trigger_event'];
                $v['add_time_text'] = empty($v['add_time']) ? '' : date('Y-m-d H:i:s', $v['add_time']);
            }
        }

        return DataReturn(MyLang('handle_success'), 0, $data);
    }

    public static function Poster($params = [])
    {
        $user_id = intval($params['user']['id']);
        $user = Db::name('User')->where(['id' => $user_id])->find();
        if (empty($user)) {
            return DataReturn('用户不存在', -1);
        }

        $invite_code = md5($user_id . 'muying_invite');
        $poster_data = [
            'user_id'      => $user_id,
            'nickname'     => $user['nickname'],
            'avatar'       => ResourcesService::AttachmentPathViewHandle($user['avatar']),
            'invite_code'  => $invite_code,
            'invite_url'   => MyUrl('index/user/register', ['invite_code' => $invite_code]),
        ];

        return DataReturn('success', 0, $poster_data);
    }

    public static function OnUserRegister($params = [])
    {
        if (empty($params['user_id'])) {
            return DataReturn('用户ID不能为空', -1);
        }

        $invite_code = empty($params['invite_code']) ? '' : $params['invite_code'];
        if (empty($invite_code)) {
            return DataReturn('无邀请码', 0);
        }

        $inviter_id = self::GetInviterByCode($invite_code);
        if (empty($inviter_id)) {
            return DataReturn('邀请码无效', 0);
        }

        if ($inviter_id == $params['user_id']) {
            return DataReturn('不能邀请自己', 0);
        }

        $exists = Db::name('InviteReward')->where([
            ['inviter_id', '=', $inviter_id],
            ['invitee_id', '=', $params['user_id']],
            ['trigger_event', '=', 'register'],
        ])->find();
        if (!empty($exists)) {
            return DataReturn('已存在注册邀请记录', 0);
        }

        $register_reward = intval(MyC('muying_invite_register_reward', 0, true));

        $data = [
            'inviter_id'    => $inviter_id,
            'invitee_id'    => $params['user_id'],
            'reward_type'   => 'integral',
            'reward_value'  => $register_reward,
            'trigger_event' => 'register',
            'status'        => ($register_reward > 0) ? 0 : 1,
            'add_time'      => time(),
            'upd_time'      => time(),
        ];

        $id = Db::name('InviteReward')->insertGetId($data);
        if ($id > 0 && $register_reward > 0) {
            self::GrantReward($id);
        }

        return DataReturn('邀请注册奖励记录已创建', 0);
    }

    public static function OnFirstOrder($params = [])
    {
        if (empty($params['user_id'])) {
            return DataReturn('用户ID不能为空', -1);
        }

        $invitee_id = intval($params['user_id']);

        $register_reward = Db::name('InviteReward')->where([
            ['invitee_id', '=', $invitee_id],
            ['trigger_event', '=', 'register'],
        ])->find();
        if (empty($register_reward)) {
            return DataReturn('无邀请记录', 0);
        }

        $inviter_id = $register_reward['inviter_id'];

        $exists = Db::name('InviteReward')->where([
            ['inviter_id', '=', $inviter_id],
            ['invitee_id', '=', $invitee_id],
            ['trigger_event', '=', 'first_order'],
        ])->find();
        if (!empty($exists)) {
            return DataReturn('已存在首单邀请记录', 0);
        }

        $first_order_reward = intval(MyC('muying_invite_first_order_reward', 0, true));

        $data = [
            'inviter_id'    => $inviter_id,
            'invitee_id'    => $invitee_id,
            'reward_type'   => 'integral',
            'reward_value'  => $first_order_reward,
            'trigger_event' => 'first_order',
            'status'        => ($first_order_reward > 0) ? 0 : 1,
            'add_time'      => time(),
            'upd_time'      => time(),
        ];

        $id = Db::name('InviteReward')->insertGetId($data);
        if ($id > 0 && $first_order_reward > 0) {
            self::GrantReward($id);
        }

        return DataReturn('首单邀请奖励记录已创建', 0);
    }

    public static function AdminInviteRewardListHandle($data, $params = [])
    {
        if (!empty($data)) {
            $inviter_ids = array_unique(array_column($data, 'inviter_id'));
            $invitee_ids = array_unique(array_column($data, 'invitee_id'));
            $user_ids = array_unique(array_merge($inviter_ids, $invitee_ids));
            $users = Db::name('User')->where(['id' => $user_ids])->column('id,nickname,username,avatar', 'id');

            foreach ($data as $k => &$v) {
                $v['inviter_info'] = isset($users[$v['inviter_id']]) ? $users[$v['inviter_id']] : null;
                if (!empty($v['inviter_info']['avatar'])) {
                    $v['inviter_info']['avatar'] = ResourcesService::AttachmentPathViewHandle($v['inviter_info']['avatar']);
                }
                $v['invitee_info'] = isset($users[$v['invitee_id']]) ? $users[$v['invitee_id']] : null;
                if (!empty($v['invitee_info']['avatar'])) {
                    $v['invitee_info']['avatar'] = ResourcesService::AttachmentPathViewHandle($v['invitee_info']['avatar']);
                }
                $v['status_text'] = ['待发放', '已发放', '已取消'][$v['status']] ?? '';
                $v['reward_type_text'] = ['integral' => '积分', 'coupon' => '优惠券'][$v['reward_type']] ?? $v['reward_type'];
                $v['trigger_event_text'] = ['register' => '注册', 'first_order' => '首单'][$v['trigger_event']] ?? $v['trigger_event'];
                $v['add_time_text'] = empty($v['add_time']) ? '' : date('Y-m-d H:i:s', $v['add_time']);
                $v['upd_time_text'] = empty($v['upd_time']) ? '' : date('Y-m-d H:i:s', $v['upd_time']);
            }
        }
        return DataReturn(MyLang('handle_success'), 0, $data);
    }

    public static function AdminInviteRewardDetail($params = [])
    {
        $id = isset($params['id']) ? intval($params['id']) : 0;
        if ($id <= 0) {
            return DataReturn('记录ID不能为空', -1);
        }

        $data = Db::name('InviteReward')->where(['id' => $id])->find();
        if (empty($data)) {
            return DataReturn('记录不存在', -1);
        }

        $inviter = Db::name('User')->where(['id' => $data['inviter_id']])->field('id,nickname,username,avatar')->find();
        $invitee = Db::name('User')->where(['id' => $data['invitee_id']])->field('id,nickname,username,avatar')->find();

        $data['inviter_info'] = $inviter;
        $data['invitee_info'] = $invitee;
        $data['trigger_event_text'] = ['register' => '注册', 'first_order' => '首单'][$data['trigger_event']] ?? $data['trigger_event'];
        $data['reward_type_text'] = ['integral' => '积分', 'coupon' => '优惠券'][$data['reward_type']] ?? $data['reward_type'];
        $data['status_text'] = ['待发放', '已发放', '已取消'][$data['status']] ?? '';
        $data['add_time_text'] = empty($data['add_time']) ? '' : date('Y-m-d H:i:s', $data['add_time']);
        $data['upd_time_text'] = empty($data['upd_time']) ? '' : date('Y-m-d H:i:s', $data['upd_time']);

        return DataReturn(MyLang('handle_success'), 0, $data);
    }

    private static function GetInviterByCode($code)
    {
        $users = Db::name('User')->column('id', 'id');
        foreach ($users as $uid) {
            if (md5($uid . 'muying_invite') === $code) {
                return $uid;
            }
        }
        return 0;
    }

    private static function GrantReward($reward_id)
    {
        $reward = Db::name('InviteReward')->where(['id' => $reward_id, 'status' => 0])->find();
        if (empty($reward)) {
            return false;
        }

        if ($reward['reward_type'] === 'integral' && $reward['reward_value'] > 0) {
            $user = Db::name('User')->where(['id' => $reward['inviter_id']])->find();
            if (empty($user)) {
                return false;
            }

            Db::name('User')->where(['id' => $reward['inviter_id']])->inc('integral', $reward['reward_value'])->update();

            if (class_exists('app\service\IntegralService')) {
                $inviter_integral = Db::name('User')->where(['id' => $reward['inviter_id']])->value('integral');
                IntegralService::UserIntegralLogAdd(
                    $reward['inviter_id'],
                    intval($inviter_integral),
                    $reward['reward_value'],
                    '邀请奖励(用户ID:' . $reward['invitee_id'] . ')',
                    1,
                    0
                );
            }
        }

        Db::name('InviteReward')->where(['id' => $reward_id])->update([
            'status'   => 1,
            'upd_time' => time(),
        ]);

        return true;
    }
}
