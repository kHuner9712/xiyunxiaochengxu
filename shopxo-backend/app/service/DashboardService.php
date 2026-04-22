<?php
namespace app\service;

use think\facade\Db;
use think\facade\Log;

class DashboardService
{
    public static function Overview()
    {
        $today_start = strtotime(date('Y-m-d'));
        $yesterday_start = $today_start - 86400;

        $new_users_today = Db::name('User')->where(['add_time' => [['>=', $today_start], ['<', $today_start + 86400]]])->count();
        $new_users_yesterday = Db::name('User')->where(['add_time' => [['>=', $yesterday_start], ['<', $today_start]]])->count();

        $activity_signup_today = Db::name('ActivitySignup')->where([
            ['add_time', '>=', $today_start],
            ['add_time', '<', $today_start + 86400],
            ['status', 'in', [0, 1]],
        ])->count();

        $invite_reward_today = Db::name('InviteReward')->where([
            ['add_time', '>=', $today_start],
            ['add_time', '<', $today_start + 86400],
            ['status', '=', 1],
        ])->sum('reward_value');

        $feedback_today = Db::name('MuyingFeedback')->where([
            ['add_time', '>=', $today_start],
            ['add_time', '<', $today_start + 86400],
            ['is_delete_time', '=', 0],
        ])->count();

        $total_users = Db::name('User')->count();
        $total_activities = Db::name('Activity')->where(['is_enable' => 1, 'is_delete_time' => 0])->count();
        $total_signups = Db::name('ActivitySignup')->where([['status', 'in', [0, 1]]])->count();
        $total_invites = Db::name('InviteReward')->where(['status' => 1])->group('invitee_id')->count();

        $total_orders = Db::name('Order')->where(['status' => 4])->count();
        $total_sales = Db::name('Order')->where(['status' => 4])->sum('total_price');
        $today_orders = Db::name('Order')->where([
            ['add_time', '>=', $today_start],
            ['add_time', '<', $today_start + 86400],
        ])->count();
        $today_sales = Db::name('Order')->where([
            ['add_time', '>=', $today_start],
            ['add_time', '<', $today_start + 86400],
            ['status', '>=', 4],
        ])->sum('total_price');

        $stage_distribution = [];
        $stage_list = \app\extend\muying\MuyingStage::getList();
        foreach ($stage_list as $value => $name) {
            if ($value === 'all') continue;
            $count = Db::name('User')->where(['current_stage' => $value])->count();
            $stage_distribution[] = ['stage' => $value, 'name' => $name, 'count' => $count];
        }

        return DataReturn(MyLang('handle_success'), 0, [
            'today' => [
                'new_users'          => $new_users_today,
                'activity_signups'   => $activity_signup_today,
                'invite_rewards'     => intval($invite_reward_today),
                'feedback_count'     => $feedback_today,
                'orders'             => $today_orders,
                'sales'              => round(floatval($today_sales), 2),
            ],
            'yesterday' => [
                'new_users' => $new_users_yesterday,
            ],
            'total' => [
                'users'      => $total_users,
                'activities' => $total_activities,
                'signups'    => $total_signups,
                'invites'    => $total_invites,
                'orders'     => $total_orders,
                'sales'      => round(floatval($total_sales), 2),
            ],
            'stage_distribution' => $stage_distribution,
        ]);
    }

    public static function Trend($params = [])
    {
        $days = isset($params['days']) ? intval($params['days']) : 7;
        if ($days <= 0 || $days > 30) {
            $days = 7;
        }
        $metric_key = isset($params['metric_key']) ? trim($params['metric_key']) : '';

        $start_date = date('Y-m-d', strtotime("-{$days} days"));

        if (!empty($metric_key)) {
            $data = Db::name('MuyingStatSnapshot')->where([
                ['metric_key', '=', $metric_key],
                ['stat_date', '>=', $start_date],
            ])->order('stat_date asc')->field('stat_date,metric_value')->select()->toArray();

            $items = [];
            foreach ($data as $row) {
                $items[] = [
                    'date'  => $row['stat_date'],
                    'value' => floatval($row['metric_value']),
                ];
            }

            return DataReturn(MyLang('handle_success'), 0, [
                'metric_key' => $metric_key,
                'items'      => $items,
            ]);
        }

        $metrics = ['registration_conversion', 'activity_signup_conversion', 'invite_referral', 'repurchase', 'stage_completion'];
        $result = [];
        foreach ($metrics as $key) {
            $snapshots = Db::name('MuyingStatSnapshot')->where([
                ['metric_key', '=', $key],
                ['stat_date', '>=', $start_date],
            ])->order('stat_date asc')->field('stat_date,metric_value')->select()->toArray();

            $items = [];
            foreach ($snapshots as $row) {
                $items[] = [
                    'date'  => $row['stat_date'],
                    'value' => floatval($row['metric_value']),
                ];
            }
            $result[$key] = $items;
        }

        return DataReturn(MyLang('handle_success'), 0, $result);
    }

    public static function GenerateDailySnapshot()
    {
        $today = date('Y-m-d');
        $yesterday_start = strtotime("-1 day");
        $yesterday_end = strtotime("today");

        $metrics = [];

        $total_new = Db::name('User')->where(['add_time' => [['>=', $yesterday_start], ['<', $yesterday_end]]])->count();
        $with_stage = Db::name('User')->where([
            ['add_time', '>=', $yesterday_start],
            ['add_time', '<', $yesterday_end],
            ['current_stage', '<>', ''],
        ])->count();
        $metrics['stage_completion'] = $total_new > 0 ? round($with_stage / $total_new * 100, 2) : 0;

        $activity_views = Db::name('Activity')->where(['is_enable' => 1, 'is_delete_time' => 0])->sum('access_count');
        $activity_signups = Db::name('ActivitySignup')->where([
            ['add_time', '>=', $yesterday_start],
            ['add_time', '<', $yesterday_end],
        ])->count();
        $metrics['activity_signup_conversion'] = $activity_views > 0 ? round($activity_signups / $activity_views * 100, 4) : 0;

        $invite_count = Db::name('InviteReward')->where([
            ['add_time', '>=', $yesterday_start],
            ['add_time', '<', $yesterday_end],
        ])->group('invitee_id')->count();
        $metrics['invite_referral'] = $total_new > 0 ? round($invite_count / $total_new * 100, 4) : 0;

        $metrics['registration_conversion'] = 0;
        $metrics['repurchase'] = 0;

        foreach ($metrics as $key => $value) {
            Db::name('MuyingStatSnapshot')->save([
                'stat_date'    => $today,
                'metric_key'   => $key,
                'metric_value' => $value,
                'add_time'     => time(),
            ]);
        }

        Log::info('仪表盘每日快照生成完成 date=' . $today);
        return DataReturn('快照生成完成', 0);
    }
}
