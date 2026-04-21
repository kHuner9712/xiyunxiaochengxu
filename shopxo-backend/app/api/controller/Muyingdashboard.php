<?php
namespace app\api\controller;

use app\service\ApiService;
use app\service\DashboardService;

class Muyingdashboard extends Common
{
    public function Overview()
    {
        return ApiService::ApiDataReturn(DashboardService::Overview());
    }

    public function Trend()
    {
        $params = $this->data_request;
        return ApiService::ApiDataReturn(DashboardService::Trend($params));
    }
}
