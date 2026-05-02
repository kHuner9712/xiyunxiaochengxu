<?php
namespace app\service;

use think\facade\Db;
use think\facade\Log;

class MuyingDataAnonymizeService
{
    const SCENE_DATA_ANONYMIZE = 'data_anonymize';

    const ORDER_STATUS_PENDING = 0;
    const ORDER_STATUS_CONFIRMED = 1;
    const ORDER_STATUS_PAID = 2;
    const ORDER_STATUS_SHIPPED = 3;
    const ORDER_STATUS_COMPLETED = 4;
    const ORDER_STATUS_CANCELLED = 5;
    const ORDER_STATUS_CLOSED = 6;

    const ACTIVE_ORDER_STATUSES = [0, 1, 2, 3];

    public static function SearchUser($params = [])
    {
        $keyword = trim($params['keyword'] ?? '');
        $search_type = trim($params['search_type'] ?? 'id');

        if (empty($keyword)) {
            return DataReturn('请输入搜索关键词', -1);
        }

        $where = [];
        switch ($search_type) {
            case 'id':
                $where[] = ['id', '=', intval($keyword)];
                break;
            case 'mobile':
                $where[] = ['mobile', 'like', '%' . $keyword . '%'];
                break;
            case 'openid':
                $where[] = ['wxalipayuser_openid', 'like', '%' . $keyword . '%'];
                break;
            default:
                $where[] = ['id', '=', intval($keyword)];
        }

        $user = Db::name('User')->where($where)->where('is_delete_time', 0)->find();
        if (empty($user)) {
            return DataReturn('未找到用户', -1);
        }

        $user_id = intval($user['id']);

        $signups = Db::name('ActivitySignup')
            ->alias('s')
            ->leftJoin('activity a', 's.activity_id = a.id')
            ->where('s.user_id', $user_id)
            ->field('s.id,s.activity_id,s.name,s.phone,s.phone_hash,s.stage,s.status,s.add_time,a.title as activity_title')
            ->order('s.add_time desc')
            ->select()
            ->toArray();

        $feedbacks = Db::name('MuyingFeedback')
            ->where('user_id', $user_id)
            ->where('is_delete_time', 0)
            ->field('id,content,contact,contact_hash,stage,review_status,add_time')
            ->order('add_time desc')
            ->select()
            ->toArray();

        $invite_as_inviter = Db::name('InviteReward')
            ->where('inviter_id', $user_id)
            ->count();
        $invite_as_invitee = Db::name('InviteReward')
            ->where('invitee_id', $user_id)
            ->count();

        $orders = Db::name('Order')
            ->where('user_id', $user_id)
            ->field('id,order_no,status,total_price,pay_price,add_time')
            ->order('add_time desc')
            ->limit(20)
            ->select()
            ->toArray();

        $order_addresses = Db::name('OrderAddress')
            ->where('user_id', $user_id)
            ->field('id,order_id,name,tel,address,province_name,city_name,county_name')
            ->order('id desc')
            ->limit(20)
            ->select()
            ->toArray();

        $user_addresses = Db::name('UserAddress')
            ->where('user_id', $user_id)
            ->field('id,name,tel,address,province,city,county,is_default')
            ->order('id desc')
            ->select()
            ->toArray();

        $active_order_count = Db::name('Order')
            ->where('user_id', $user_id)
            ->where('status', 'in', self::ACTIVE_ORDER_STATUSES)
            ->count();

        $masked_user = [
            'id'              => $user['id'],
            'nickname'        => $user['nickname'] ?? '',
            'mobile'          => MuyingPrivacyService::MaskPhone($user['mobile'] ?? ''),
            'current_stage'   => $user['current_stage'] ?? '',
            'due_date'        => $user['due_date'] ?? 0,
            'baby_birthday'   => $user['baby_birthday'] ?? 0,
            'invite_code'     => $user['invite_code'] ?? '',
            'add_time'        => $user['add_time'] ?? 0,
        ];

        foreach ($signups as &$s) {
            $s['name'] = MuyingPrivacyService::MaskName(MuyingPrivacyService::DecryptIfEncrypted($s['name']));
            $s['phone'] = MuyingPrivacyService::MaskPhone(MuyingPrivacyService::DecryptIfEncrypted($s['phone']));
        }
        unset($s);

        foreach ($feedbacks as &$f) {
            $f['contact'] = MuyingPrivacyService::MaskPhone(MuyingPrivacyService::DecryptIfEncrypted($f['contact']));
        }
        unset($f);

        foreach ($order_addresses as &$oa) {
            $oa['name'] = MuyingPrivacyService::MaskName($oa['name']);
            $oa['tel'] = MuyingPrivacyService::MaskPhone($oa['tel']);
            $oa['address'] = mb_substr($oa['address'], 0, 2) . '***';
        }
        unset($oa);

        foreach ($user_addresses as &$ua) {
            $ua['name'] = MuyingPrivacyService::MaskName($ua['name']);
            $ua['tel'] = MuyingPrivacyService::MaskPhone($ua['tel']);
            $ua['address'] = mb_substr($ua['address'], 0, 2) . '***';
        }
        unset($ua);

        return DataReturn(MyLang('handle_success'), 0, [
            'user'               => $masked_user,
            'signups'            => $signups,
            'feedbacks'          => $feedbacks,
            'invite_as_inviter'  => $invite_as_inviter,
            'invite_as_invitee'  => $invite_as_invitee,
            'orders'             => $orders,
            'order_addresses'    => $order_addresses,
            'user_addresses'     => $user_addresses,
            'active_order_count' => $active_order_count,
        ]);
    }

    public static function AnonymizeUser($params = [])
    {
        $user_id = intval($params['user_id'] ?? 0);
        if ($user_id <= 0) {
            return DataReturn('用户ID无效', -1);
        }

        $user = Db::name('User')->where('id', $user_id)->where('is_delete_time', 0)->find();
        if (empty($user)) {
            return DataReturn('用户不存在', -1);
        }

        $admin = AdminService::LoginInfo();
        if (empty($admin)) {
            return DataReturn('管理员信息获取失败', -1);
        }

        if (!self::CanAnonymize($admin)) {
            return DataReturn('当前权限不允许执行数据匿名化操作', -403);
        }

        // [MUYING-二开] fail-closed：数据匿名化涉及 EncryptSensitive/HashPhone，密钥缺失时阻断
        try {
            MuyingPrivacyService::AssertPrivacyKeyReady();
        } catch (\RuntimeException $e) {
            return DataReturn('系统隐私配置异常，匿名化操作暂不可用，请联系管理员', -500);
        }

        $stats = [
            'user_updated'          => 0,
            'signups_updated'       => 0,
            'feedbacks_updated'     => 0,
            'invites_disabled'      => 0,
            'user_addresses_cleared' => 0,
            'order_addresses_masked' => 0,
            'orders_retained'       => 0,
            'mobile_action'         => '',
            'retained_reason'       => '',
        ];

        Db::startTrans();
        try {
            $anonymized_name = '已注销用户';
            $anonymized_phone_hash = MuyingPrivacyService::HashPhone('ANONYMIZED_' . $user_id);

            Db::name('User')->where('id', $user_id)->update([
                'nickname'       => $anonymized_name,
                'current_stage'  => '',
                'due_date'       => 0,
                'baby_birthday'  => 0,
                'address'        => '',
                'province'       => '',
                'city'           => '',
                'county'         => '',
                'upd_time'       => time(),
            ]);
            $stats['user_updated'] = 1;

            $signups = Db::name('ActivitySignup')
                ->where('user_id', $user_id)
                ->select()
                ->toArray();

            foreach ($signups as $signup) {
                $update = [
                    'name'       => MuyingPrivacyService::EncryptSensitive($anonymized_name),
                    'phone'      => MuyingPrivacyService::EncryptSensitive('ANONYMIZED'),
                    'phone_hash' => $anonymized_phone_hash,
                    'upd_time'   => time(),
                ];
                Db::name('ActivitySignup')->where('id', $signup['id'])->update($update);
                $stats['signups_updated']++;
            }

            $feedback_count = Db::name('MuyingFeedback')
                ->where('user_id', $user_id)
                ->where('is_delete_time', 0)
                ->update([
                    'contact'      => '',
                    'contact_hash' => '',
                    'upd_time'     => time(),
                ]);
            $stats['feedbacks_updated'] = $feedback_count;

            $invite_count = Db::name('InviteReward')
                ->where('invitee_id', $user_id)
                ->where('trigger_event', 'register')
                ->update([
                    'status'   => 2,
                    'upd_time' => time(),
                ]);
            $stats['invites_disabled'] = $invite_count;

            Db::name('UserAddress')
                ->where('user_id', $user_id)
                ->update([
                    'name'    => $anonymized_name,
                    'tel'     => '',
                    'address' => '',
                    'alias'   => '',
                    'upd_time' => time(),
                ]);
            $stats['user_addresses_cleared'] = Db::name('UserAddress')
                ->where('user_id', $user_id)->count();

            $active_orders = Db::name('Order')
                ->where('user_id', $user_id)
                ->where('status', 'in', self::ACTIVE_ORDER_STATUSES)
                ->count();

            $completed_orders = Db::name('Order')
                ->where('user_id', $user_id)
                ->where('status', 'in', [self::ORDER_STATUS_COMPLETED, self::ORDER_STATUS_CANCELLED, self::ORDER_STATUS_CLOSED])
                ->count();

            if ($active_orders > 0) {
                $stats['mobile_action'] = 'retained';
                $stats['retained_reason'] = '用户存在进行中订单(' . $active_orders . '个)，mobile保留以保障履约/售后';
            } else {
                $has_login_binding = !empty($user['mobile']) && (empty($user['username']) || $user['username'] === $user['mobile']);
                if ($has_login_binding) {
                    Db::name('User')->where('id', $user_id)->update([
                        'mobile'   => '',
                        'upd_time' => time(),
                    ]);
                    $stats['mobile_action'] = 'cleared';
                    $stats['retained_reason'] = '无进行中订单，mobile已清空';
                } else {
                    Db::name('User')->where('id', $user_id)->update([
                        'mobile'   => '',
                        'upd_time' => time(),
                    ]);
                    $stats['mobile_action'] = 'cleared';
                    $stats['retained_reason'] = '无进行中订单，mobile已清空';
                }
            }

            $completed_order_ids = Db::name('Order')
                ->where('user_id', $user_id)
                ->where('status', 'in', [self::ORDER_STATUS_COMPLETED, self::ORDER_STATUS_CANCELLED, self::ORDER_STATUS_CLOSED])
                ->column('id');

            if (!empty($completed_order_ids)) {
                Db::name('OrderAddress')
                    ->where('order_id', 'in', $completed_order_ids)
                    ->where('user_id', $user_id)
                    ->update([
                        'name'                        => $anonymized_name,
                        'tel'                         => '',
                        'address'                     => '',
                        'extraction_contact_name'     => '',
                        'extraction_contact_tel'      => '',
                        'idcard_name'                 => '',
                        'idcard_number'               => '',
                        'upd_time'                    => time(),
                    ]);
                $stats['order_addresses_masked'] = Db::name('OrderAddress')
                    ->where('order_id', 'in', $completed_order_ids)
                    ->where('user_id', $user_id)
                    ->count();
            }

            $stats['orders_retained'] = $active_orders + $completed_orders;

            Db::commit();

            $log_remark = '用户数据匿名化 UID=' . $user_id
                . ' signups=' . $stats['signups_updated']
                . ' feedbacks=' . $stats['feedbacks_updated']
                . ' invites=' . $stats['invites_disabled']
                . ' mobile=' . $stats['mobile_action']
                . ' reason=' . $stats['retained_reason']
                . ' order_addr_masked=' . $stats['order_addresses_masked'];

            MuyingAuditLogService::Log([
                'admin_id'   => $admin['id'],
                'scene'      => self::SCENE_DATA_ANONYMIZE,
                'target_id'  => $user_id,
                'remark'     => $log_remark,
                'ip'         => request()->ip(),
            ]);

            Log::info('[MuyingDataAnonymize] 用户数据匿名化完成 user_id=' . $user_id . ' admin_id=' . $admin['id']);

            return DataReturn('匿名化处理完成', 0, $stats);
        } catch (\Exception $e) {
            Db::rollback();
            Log::error('[MuyingDataAnonymize] 匿名化失败 user_id=' . $user_id . ' error=' . $e->getMessage());
            return DataReturn('匿名化处理失败: ' . $e->getMessage(), -1);
        }
    }

    public static function CanAnonymize($admin)
    {
        if (AdminIsPower('muyingprivacy', 'delete')) {
            return true;
        }
        if (!empty($admin) && isset($admin['id']) && $admin['id'] == 1) {
            return true;
        }
        return false;
    }
}
