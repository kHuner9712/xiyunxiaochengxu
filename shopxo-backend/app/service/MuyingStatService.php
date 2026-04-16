<?php
namespace app\service;

use think\facade\Db;

class MuyingStatService
{
    public static function RegistrationConversionRate()
    {
        $total_users = Db::name('User')->count();
        $users_with_stage = Db::name('User')->where('current_stage', '<>', '')->count();
        $value = ($total_users > 0) ? round(($users_with_stage / $total_users) * 100, 2) : 0;
        return [
            'value' => $value,
            'desc'  => '已填写阶段的用户数 / 总用户数 × 100',
        ];
    }

    public static function StageProfileCompletionRate()
    {
        $total_users = Db::name('User')->count();
        $users_with_stage = Db::name('User')->where('current_stage', '<>', '')->count();
        $value = ($total_users > 0) ? round(($users_with_stage / $total_users) * 100, 2) : 0;
        return [
            'value' => $value,
            'desc'  => 'current_stage 已填写的用户数 / 总用户数 × 100',
        ];
    }

    public static function ActivitySignupConversionRate()
    {
        $total_activity_views = Db::name('Activity')->sum('access_count');
        $total_signups = Db::name('ActivitySignup')->where('is_delete_time', 0)->count();
        if ($total_activity_views > 0) {
            $value = round(($total_signups / $total_activity_views) * 100, 2);
        } else {
            $activity_count = Db::name('Activity')->where('is_delete_time', 0)->count();
            $value = ($activity_count > 0) ? round(($total_signups / $activity_count) * 100, 2) : 0;
        }
        return [
            'value' => $value,
            'desc'  => '总报名数 / 活动总访问量 × 100（无访问量时按活动数计算）',
        ];
    }

    public static function ProductPaymentConversionRate()
    {
        $total_orders = Db::name('Order')->count();
        $paid_orders = Db::name('Order')->where('status', '>=', 2)->where('status', '<=', 5)->count();
        $value = ($total_orders > 0) ? round(($paid_orders / $total_orders) * 100, 2) : 0;
        return [
            'value' => $value,
            'desc'  => '已支付订单数 / 总订单数 × 100',
        ];
    }

    public static function RepurchaseRate()
    {
        $order_users = Db::name('Order')->group('user_id')->column('COUNT(*) as cnt', 'user_id');
        $users_with_orders = count($order_users);
        $users_with_2plus = count(array_filter($order_users, function ($cnt) { return $cnt >= 2; }));
        $value = ($users_with_orders > 0) ? round(($users_with_2plus / $users_with_orders) * 100, 2) : 0;
        return [
            'value' => $value,
            'desc'  => '下单≥2次的用户数 / 有订单的用户数 × 100',
        ];
    }

    public static function InviteReferralRate()
    {
        $total_users = Db::name('User')->count();
        $users_with_inviter = Db::name('InviteReward')->group('invitee_id')->count();
        $value = ($total_users > 0) ? round(($users_with_inviter / $total_users) * 100, 2) : 0;
        return [
            'value' => $value,
            'desc'  => '被邀请注册的用户数 / 总用户数 × 100',
        ];
    }
}
