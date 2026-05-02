<?php
namespace app\admin\controller;

use app\admin\controller\Base;
use app\service\ApiService;
use app\service\ActivityService;
use app\service\MuyingPrivacyService;
use app\service\MuyingAuditLogService;

class Activitysignup extends Base
{
    public function Index()
    {
        return MyView();
    }

    public function Detail()
    {
        $params = $this->data_request;
        $params['admin'] = $this->admin;
        $ret = ActivityService::AdminSignupDetail($params);
        $data = ($ret['code'] == 0) ? $ret['data'] : [];
        $can_view_sensitive = !empty($this->admin) && MuyingPrivacyService::CanViewSensitive($this->admin);
        $can_export_sensitive = !empty($this->admin) && MuyingPrivacyService::CanExportSensitive($this->admin);
        MyViewAssign([
            'data'                => $data,
            'can_view_sensitive'  => $can_view_sensitive,
            'can_export_sensitive' => $can_export_sensitive,
        ]);
        return MyView();
    }

    public function Checkin()
    {
        $params = $this->data_request;
        $params['admin'] = $this->admin;
        return ApiService::ApiDataReturn(ActivityService::SignupCheckin($params));
    }

    public function Confirm()
    {
        $params = $this->data_request;
        $params['admin'] = $this->admin;
        return ApiService::ApiDataReturn(ActivityService::SignupConfirm($params));
    }

    public function Cancel()
    {
        $params = $this->data_request;
        $params['admin'] = $this->admin;
        return ApiService::ApiDataReturn(ActivityService::SignupAdminCancel($params));
    }

    public function BatchConfirm()
    {
        $params = $this->data_request;
        $params['admin'] = $this->admin;
        return ApiService::ApiDataReturn(ActivityService::SignupBatchConfirm($params));
    }

    public function WaitlistToNormal()
    {
        $params = $this->data_request;
        $params['admin'] = $this->admin;
        return ApiService::ApiDataReturn(ActivityService::WaitlistToNormal($params));
    }

    public function CodeCheckin()
    {
        $params = $this->data_request;
        $params['admin'] = $this->admin;
        return ApiService::ApiDataReturn(ActivityService::CodeCheckin($params));
    }

    public function Delete()
    {
        $params = $this->data_request;
        $params['admin'] = $this->admin;
        return ApiService::ApiDataReturn(ActivityService::SignupDelete($params));
    }

    public function Export()
    {
        $params = $this->data_request;
        $params['admin'] = $this->admin;

        if (empty($this->admin) || empty($this->admin['id'])) {
            return ApiService::ApiDataReturn(DataReturn('无导出权限', -1));
        }

        $can_export_sensitive = MuyingPrivacyService::CanExportSensitive($this->admin);

        $where = [];
        if (!empty($params['activity_id'])) {
            $where[] = ['activity_id', '=', intval($params['activity_id'])];
        }
        if (isset($params['status']) && $params['status'] !== '') {
            $where[] = ['status', '=', intval($params['status'])];
        }
        if (isset($params['checkin_status']) && $params['checkin_status'] !== '') {
            $where[] = ['checkin_status', '=', intval($params['checkin_status'])];
        }
        if (isset($params['is_waitlist']) && $params['is_waitlist'] !== '') {
            $where[] = ['is_waitlist', '=', intval($params['is_waitlist'])];
        }
        if (!empty($params['stage'])) {
            $where[] = ['stage', '=', trim($params['stage'])];
        }
        if (!empty($params['phone'])) {
            if (!MuyingPrivacyService::IsKeyAvailable()) {
                return ApiService::ApiDataReturn(DataReturn('隐私密钥未配置，无法按手机号查询，请联系管理员配置 MUYING_PRIVACY_KEY', -500));
            }
            $phone_hash = MuyingPrivacyService::HashPhone(trim($params['phone']));
            $where[] = ['phone_hash', '=', $phone_hash];
        }
        if (!empty($params['start_time'])) {
            $start_ts = strtotime($params['start_time']);
            if ($start_ts !== false) {
                $where[] = ['add_time', '>=', $start_ts];
            }
        }
        if (!empty($params['end_time'])) {
            $end_ts = strtotime($params['end_time']);
            if ($end_ts !== false) {
                $where[] = ['add_time', '<=', $end_ts];
            }
        }
        $where[] = ['is_delete_time', '=', 0];

        $params['where'] = $where;
        $ret = ActivityService::SignupExport($params);
        if ($ret['code'] != 0) {
            return ApiService::ApiDataReturn($ret);
        }

        $headers = [
            '报名ID', '活动标题', '姓名', '手机', '阶段', '预产期', '宝宝生日', '宝宝月龄', '报名类型', '签到码', '备注', '报名状态', '签到状态', '报名时间', '签到时间'
        ];

        $filename = 'activity_signup_' . date('YmdHis') . '.csv';
        header('Content-Type: text/csv; charset=utf-8');
        header('Content-Disposition: attachment; filename=' . $filename);
        header('Pragma: no-cache');
        header('Expires: 0');

        $output = fopen('php://output', 'w');
        fprintf($output, chr(0xEF).chr(0xBB).chr(0xBF));
        fputcsv($output, $headers);

        if (!empty($ret['data']) && is_array($ret['data'])) {
            foreach ($ret['data'] as $row) {
                fputcsv($output, [
                    $row['id'],
                    $row['activity_title'],
                    $row['name'],
                    $row['phone'],
                    $row['stage'],
                    $row['due_date'],
                    $row['baby_birthday'],
                    $row['baby_month_age'],
                    $row['is_waitlist'],
                    $row['signup_code'],
                    $row['remark'],
                    $row['status_text'],
                    $row['checkin_status_text'],
                    $row['add_time_text'],
                    $row['checkin_time_text'],
                ]);
            }
        }
        fclose($output);
        exit;
    }
}
