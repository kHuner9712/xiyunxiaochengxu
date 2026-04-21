<?php
namespace app\service;

use think\facade\Db;
use think\facade\Log;
use app\service\IntegralService;
use app\service\ResourcesService;
use app\service\MuyingLogService;

class InviteService
{
    public static function GenerateInviteCode()
    {
        $max_attempts = 100;
        for ($i = 0; $i < $max_attempts; $i++) {
            $code = strtoupper(substr(md5(uniqid(mt_rand(), true) . microtime(true) . $i), 0, 8));
            $exists = Db::name('User')->where(['invite_code' => $code])->find();
            if (empty($exists)) {
                return $code;
            }
            Log::info('邀请码碰撞重试 attempt=' . ($i + 1) . ' code=' . $code);
        }
        Log::error('邀请码生成失败：连续' . $max_attempts . '次碰撞');
        throw new \Exception('邀请码生成失败，请重试');
    }

    public static function InviteInfo($params = [])
    {
        $user_id = intval($params['user']['id']);

        $user = Db::name('User')->where(['id' => $user_id])->find();
        $invite_code = !empty($user['invite_code']) ? $user['invite_code'] : '';

        if (empty($invite_code)) {
            try {
                $invite_code = self::GenerateInviteCode();
            } catch (\Exception $e) {
                return DataReturn('邀请码生成失败', -1);
            }
            Db::name('User')->where(['id' => $user_id])->update(['invite_code' => $invite_code]);
        }

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

        return DataReturn(MyLang('handle_success'), 0, [
            'invite_count' => $invite_count,
            'reward_total' => intval($reward_total),
            'pending_count' => $pending_count,
            'invite_code'  => $invite_code,
        ]);
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

        $invite_code = !empty($user['invite_code']) ? $user['invite_code'] : '';
        if (empty($invite_code)) {
            try {
                $invite_code = self::GenerateInviteCode();
            } catch (\Exception $e) {
                return DataReturn('邀请码生成失败', -1);
            }
            Db::name('User')->where(['id' => $user_id])->update(['invite_code' => $invite_code]);
        }

        $poster_data = [
            'user_id'      => $user_id,
            'nickname'     => $user['nickname'],
            'avatar'       => ResourcesService::AttachmentPathViewHandle($user['avatar']),
            'invite_code'  => $invite_code,
            'invite_url'   => MyUrl('index/user/register', ['invite_code' => $invite_code]),
        ];

        return DataReturn('success', 0, $poster_data);
    }

    public static function RewardConfig()
    {
        return [
            'register_reward'    => intval(MyC('muying_invite_register_reward', 0, true)),
            'first_order_reward' => intval(MyC('muying_invite_first_order_reward', 0, true)),
        ];
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

        Db::startTrans();
        try {
            $id = Db::name('InviteReward')->insertGetId($data);

            if ($id > 0 && $register_reward > 0) {
                $grant_result = self::GrantRewardInner($id);
                if (!$grant_result) {
                    Db::rollback();
                    Log::error('邀请注册奖励发放失败，回滚 inviter_id=' . $inviter_id . ' invitee_id=' . $params['user_id']);
                    return DataReturn('邀请注册奖励处理失败', -1);
                }
            }

            MuyingLogService::LogSuccess(MuyingLogService::TYPE_INVITE_REWARD, 'create', $inviter_id, $id, '注册邀请奖励 inviter_id=' . $inviter_id . ' invitee_id=' . $params['user_id']);
            Db::commit();
            return DataReturn('邀请注册奖励记录已创建', 0);
        } catch (\Exception $e) {
            Db::rollback();
            $msg = $e->getMessage();
            if (self::IsDuplicateEntryError($msg)) {
                Log::info('邀请注册奖励重复插入拦截(唯一约束) inviter_id=' . $inviter_id . ' invitee_id=' . $params['user_id']);
                return DataReturn('已存在注册邀请记录', 0);
            }
            Log::error('邀请注册奖励插入异常 inviter_id=' . $inviter_id . ' invitee_id=' . $params['user_id'] . ' error=' . $msg);
            return DataReturn('邀请注册奖励处理失败', -1);
        }
    }

    public static function OnFirstOrder($params = [])
    {
        if (empty($params['user_id'])) {
            return DataReturn('用户ID不能为空', -1);
        }

        $invitee_id = intval($params['user_id']);

        Db::startTrans();
        try {
            $register_reward = Db::name('InviteReward')->where([
                ['invitee_id', '=', $invitee_id],
                ['trigger_event', '=', 'register'],
            ])->lock(true)->find();
            if (empty($register_reward)) {
                Db::rollback();
                return DataReturn('无邀请记录', 0);
            }

            $inviter_id = $register_reward['inviter_id'];

            $exists = Db::name('InviteReward')->where([
                ['inviter_id', '=', $inviter_id],
                ['invitee_id', '=', $invitee_id],
                ['trigger_event', '=', 'first_order'],
            ])->lock(true)->find();
            if (!empty($exists)) {
                Db::commit();
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

            try {
                $id = Db::name('InviteReward')->insertGetId($data);
            } catch (\Exception $e) {
                $msg = $e->getMessage();
                if (self::IsDuplicateEntryError($msg)) {
                    Db::commit();
                    Log::info('首单邀请奖励重复插入拦截(唯一约束) inviter_id=' . $inviter_id . ' invitee_id=' . $invitee_id);
                    return DataReturn('已存在首单邀请记录', 0);
                }
                Db::rollback();
                Log::error('首单邀请奖励插入异常 inviter_id=' . $inviter_id . ' invitee_id=' . $invitee_id . ' error=' . $msg);
                return DataReturn('首单邀请奖励处理失败', -1);
            }

            if ($id > 0 && $first_order_reward > 0) {
                $grant_result = self::GrantRewardInner($id);
                if (!$grant_result) {
                    Db::rollback();
                    Log::error('首单邀请奖励发放失败，回滚 reward_id=' . $id . ' inviter_id=' . $inviter_id . ' invitee_id=' . $invitee_id);
                    return DataReturn('首单邀请奖励处理失败', -1);
                }
            }

            MuyingLogService::LogSuccess(MuyingLogService::TYPE_INVITE_REWARD, 'create', $inviter_id, $id, '首单邀请奖励 inviter_id=' . $inviter_id . ' invitee_id=' . $invitee_id);

            Db::commit();

            return DataReturn('首单邀请奖励记录已创建', 0);
        } catch (\Exception $e) {
            Db::rollback();
            Log::error('首单邀请奖励异常 invitee_id=' . $invitee_id . ' error=' . $e->getMessage());
            return DataReturn('首单邀请奖励处理失败', -1);
        }
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
        $user = Db::name('User')->where(['invite_code' => $code])->find();
        if (empty($user)) {
            Log::info('邀请码无效 code=' . $code);
        }
        return !empty($user) ? intval($user['id']) : 0;
    }

    private static function IsDuplicateEntryError($msg)
    {
        return (stripos($msg, 'Duplicate entry') !== false || stripos($msg, '1062') !== false);
    }

    private static function GrantReward($reward_id)
    {
        Db::startTrans();
        try {
            $result = self::GrantRewardInner($reward_id);
            if ($result) {
                Db::commit();
            } else {
                Db::rollback();
            }
            return $result;
        } catch (\Exception $e) {
            Db::rollback();
            Log::error('邀请奖励发放失败 reward_id=' . $reward_id . ' error=' . $e->getMessage());
            return false;
        }
    }

    private static function GrantRewardInner($reward_id)
    {
        $reward = Db::name('InviteReward')->where(['id' => $reward_id, 'status' => 0])->lock(true)->find();
        if (empty($reward)) {
            return false;
        }

        if ($reward['reward_type'] === 'integral' && $reward['reward_value'] > 0) {
            $user = Db::name('User')->where(['id' => $reward['inviter_id']])->find();
            if (empty($user)) {
                return false;
            }

            $original_integral = intval($user['integral']);

            Db::name('User')->where(['id' => $reward['inviter_id']])->inc('integral', $reward['reward_value'])->update();

            if (class_exists('app\service\IntegralService')) {
                IntegralService::UserIntegralLogAdd(
                    $reward['inviter_id'],
                    $original_integral,
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
