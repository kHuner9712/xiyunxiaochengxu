<?php
// +----------------------------------------------------------------------
// | ShopXO 国内领先企业级B2C免费开源电商系统
// +----------------------------------------------------------------------
// | Copyright (c) 2011~2099 http://shopxo.net All rights reserved.
// +----------------------------------------------------------------------
// | Licensed ( https://opensource.org/licenses/mit-license.php )
// +----------------------------------------------------------------------
// | Author: Devil
// +----------------------------------------------------------------------
namespace app\admin\controller;

use app\admin\controller\Base;
use app\service\ApiService;
use app\service\ActivityService;

/**
 * 活动报名管理
 * @author   Devil
 * @blog     http://gong.gg/
 * @version  0.0.1
 * @datetime 2016-12-01T21:51:08+0800
 */
class Activitysignup extends Base
{
    /**
     * 列表
     * @author   Devil
     * @blog     http://gong.gg/
     * @version  0.0.1
     * @datetime 2016-12-06T21:31:53+0800
     */
    public function Index()
    {
        return MyView();
    }

    /**
     * 详情
     * @author   Devil
     * @blog     http://gong.gg/
     * @version  1.0.0
     * @datetime 2019-08-05T08:21:54+0800
     */
    public function Detail()
    {
        return MyView();
    }

    /**
     * 签到
     * @author   Devil
     * @blog     http://gong.gg/
     * @version  0.0.1
     * @datetime 2017-01-12T22:23:06+0800
     */
    public function Checkin()
    {
        $params = $this->data_request;
        $params['admin'] = $this->admin;
        return ApiService::ApiDataReturn(ActivityService::SignupCheckin($params));
    }

    /**
     * 确认报名
     */
    public function Confirm()
    {
        $params = $this->data_request;
        $params['admin'] = $this->admin;
        return ApiService::ApiDataReturn(ActivityService::SignupConfirm($params));
    }

    /**
     * 导出
     * @author   Devil
     * @blog     http://gong.gg/
     * @version  0.0.1
     * @datetime 2017-01-12T22:23:06+0800
     */
    public function Export()
    {
        $params = $this->data_request;
        $params['admin'] = $this->admin;

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
        $where[] = ['is_delete_time', '=', 0];

        $params['where'] = $where;
        $ret = ActivityService::SignupExport($params);
        if ($ret['code'] != 0) {
            return ApiService::ApiDataReturn($ret);
        }

        $headers = [
            '报名ID', '活动标题', '姓名', '手机', '阶段', '预产期', '宝宝月龄', '报名状态', '签到状态', '报名时间', '签到时间'
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
                    $row['baby_month_age'],
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
?>
