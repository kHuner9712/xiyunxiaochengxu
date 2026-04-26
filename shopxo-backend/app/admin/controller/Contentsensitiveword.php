<?php
namespace app\admin\controller;

use app\admin\controller\Base;
use app\service\ApiService;
use app\service\MuyingContentComplianceService;

class Contentsensitiveword extends Base
{
    public function Index()
    {
        $default_words = MuyingContentComplianceService::GetDefaultWords();
        $custom_result = MuyingContentComplianceService::GetSensitiveWordList([]);
        $log_result = MuyingContentComplianceService::GetComplianceLogList([]);
        $log_count = MuyingContentComplianceService::GetComplianceLogCount([]);

        MyViewAssign([
            'default_words' => $default_words,
            'custom_words'  => $custom_result['data'] ?? [],
            'log_list'      => $log_result['data'] ?? [],
            'log_count'     => $log_count,
        ]);
        return MyView();
    }

    public function Save()
    {
        $params = $this->data_request;
        return ApiService::ApiDataReturn(MuyingContentComplianceService::SaveSensitiveWord($params));
    }

    public function Delete()
    {
        $params = $this->data_request;
        return ApiService::ApiDataReturn(MuyingContentComplianceService::DeleteSensitiveWord($params));
    }

    public function LogList()
    {
        $params = $this->data_request;
        return ApiService::ApiDataReturn(MuyingContentComplianceService::GetComplianceLogList($params));
    }
}
