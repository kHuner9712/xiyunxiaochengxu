<?php
namespace app\admin\controller;

use app\admin\controller\Base;
use app\service\ApiService;
use app\service\MuyingComplianceService;
use app\service\ConfigService;

class Muyingcompliance extends Base
{
    public function Index()
    {
        $summary = MuyingComplianceService::GetDashboardSummary();
        $assign = [
            'phase_mode'         => $summary['phase_mode'],
            'qualifications'     => $summary['qualifications'],
            'high_risk_count'    => $summary['high_risk_count'],
            'high_risk_locked'   => $summary['high_risk_locked'],
            'phase_one_count'    => $summary['phase_one_count'],
            'phase_one_enabled'  => $summary['phase_one_enabled'],
            'block_log_count'    => $summary['block_log_count'],
            'recent_blocks'      => $summary['recent_blocks'],
            'pending_feedback'   => $summary['pending_feedback'],
            'export_log_count'   => $summary['export_log_count'],
        ];
        MyViewAssign($assign);
        return MyView();
    }

    public function Features()
    {
        $feature_details = MuyingComplianceService::GetFeatureSwitchDetailList();
        $assign = [
            'feature_details' => $feature_details,
        ];
        MyViewAssign($assign);
        return MyView();
    }

    public function Toggle()
    {
        $params = $this->data_request;
        $key = isset($params['key']) ? trim($params['key']) : '';
        $value = isset($params['value']) ? intval($params['value']) : 0;

        if (empty($key)) {
            return ApiService::ApiDataReturn(DataReturn('参数错误', -1));
        }

        $ret = MuyingComplianceService::TryToggleFeature($key, $value, $this->admin);
        if ($ret['code'] != 0) {
            return ApiService::ApiDataReturn($ret);
        }

        $save_result = ConfigService::ConfigSave([$key => $value]);
        if (!$save_result) {
            return ApiService::ApiDataReturn(DataReturn('保存失败', -1));
        }

        return ApiService::ApiDataReturn(DataReturn('操作成功', 0));
    }

    public function SaveQualification()
    {
        $params = $this->data_request;
        $qual_keys = [
            'qualification_icp_commercial',
            'qualification_edi',
            'qualification_medical',
            'qualification_live',
            'qualification_payment',
            'qualification_icp_filing',
        ];

        $save_params = [];
        foreach ($qual_keys as $key) {
            if (isset($params[$key])) {
                $save_params[$key] = intval($params[$key]);
            }
        }

        if (empty($save_params)) {
            return ApiService::ApiDataReturn(DataReturn('无更新数据', -1));
        }

        $result = ConfigService::ConfigSave($save_params);
        if ($result) {
            return ApiService::ApiDataReturn(DataReturn('保存成功', 0));
        }
        return ApiService::ApiDataReturn(DataReturn('保存失败', -1));
    }

    public function Blocklogs()
    {
        $params = $this->data_request;
        $m = isset($params['page']) ? (intval($params['page']) - 1) * 20 : 0;
        $logs = MuyingComplianceService::GetComplianceBlockLogList(['m' => $m, 'n' => 20]);
        $total = MuyingComplianceService::GetComplianceBlockLogCount();

        $assign = [
            'logs'  => $logs,
            'total' => $total,
        ];
        MyViewAssign($assign);
        return MyView();
    }
}
