<?php
namespace app\admin\controller;

use app\admin\controller\Base;
use app\service\ApiService;
use app\service\DashboardService;

class Dashboard extends Base
{
    public function Index()
    {
        $overview = DashboardService::Overview();
        $metrics_config = MyC('muying_dashboard_metrics', 'registration_conversion,activity_signup_conversion,invite_referral,repurchase,stage_completion', true);
        $trend_days = MyC('muying_dashboard_trend_days', 7, true);

        MyViewAssign([
            'overview'       => $overview['code'] == 0 ? $overview['data'] : [],
            'metrics_config' => $metrics_config,
            'trend_days'     => $trend_days,
        ]);

        return MyView();
    }

    public function Overview()
    {
        return ApiService::ApiDataReturn(DashboardService::Overview());
    }

    public function Trend()
    {
        $params = $this->data_request;
        return ApiService::ApiDataReturn(DashboardService::Trend($params));
    }

    public function GenerateSnapshot()
    {
        return ApiService::ApiDataReturn(DashboardService::GenerateDailySnapshot());
    }
}
