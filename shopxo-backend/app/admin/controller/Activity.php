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
use app\service\ResourcesService;
use think\facade\Db;

/**
 * 活动管理
 * @author   Devil
 * @blog     http://gong.gg/
 * @version  0.0.1
 * @datetime 2016-12-01T21:51:08+0800
 */
class Activity extends Base
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
        $data = $this->data_detail;
        $signup_list = [];
        $signup_total = 0;
        $signup_confirmed_count = 0;
        if (!empty($data) && !empty($data['id'])) {
            $signup_list = Db::name('ActivitySignup')
                ->where(['activity_id' => $data['id'], 'is_delete_time' => 0])
                ->order('id desc')
                ->limit(50)
                ->select()
                ->toArray();
            $signup_total = Db::name('ActivitySignup')
                ->where(['activity_id' => $data['id'], 'is_delete_time' => 0])
                ->count();
            $signup_confirmed_count = Db::name('ActivitySignup')
                ->where(['activity_id' => $data['id'], 'is_delete_time' => 0, 'status' => 1])
                ->count();
            foreach ($signup_list as $k => &$v) {
                $v['status_text'] = ActivityService::SignupStatusText($v['status']);
                $v['checkin_status_text'] = ActivityService::CheckinStatusText($v['checkin_status']);
                $v['stage_text'] = \app\extend\muying\MuyingStage::getName(\app\extend\muying\MuyingStage::Normalize($v['stage']));
                $v['add_time_text'] = empty($v['add_time']) ? '' : date('Y-m-d H:i:s', $v['add_time']);
            }
        }
        MyViewAssign([
            'data'                   => $data,
            'signup_list'            => $signup_list,
            'signup_total'           => $signup_total,
            'signup_confirmed_count' => $signup_confirmed_count,
        ]);
        return MyView();
    }

    /**
     * 添加/编辑页面
     * @author   Devil
     * @blog     http://gong.gg/
     * @version  0.0.1
     * @datetime 2016-12-14T21:37:02+0800
     */
    public function SaveInfo()
    {
        $assign = [
            'editor_path_type' => ResourcesService::EditorPathTypeValue('activity'),
        ];

        $params = $this->data_request;
        $data = $this->data_detail;

        unset($params['id']);
        $assign['data'] = $data;
        $assign['params'] = $params;

        MyViewAssign($assign);
        return MyView();
    }

    /**
     * 添加/编辑
     * @author   Devil
     * @blog     http://gong.gg/
     * @version  0.0.1
     * @datetime 2016-12-14T21:37:02+0800
     */
    public function Save()
    {
        $params = $this->data_request;
        return ApiService::ApiDataReturn(ActivityService::ActivitySave($params));
    }

    /**
     * 删除
     * @author   Devil
     * @blog     http://gong.gg/
     * @version  0.0.1
     * @datetime 2016-12-15T11:03:30+0800
     */
    public function Delete()
    {
        $params = $this->data_request;
        $params['admin'] = $this->admin;
        return ApiService::ApiDataReturn(ActivityService::ActivityDelete($params));
    }

    /**
     * 状态更新
     * @author   Devil
     * @blog     http://gong.gg/
     * @version  0.0.1
     * @datetime 2017-01-12T22:23:06+0800
     */
    public function StatusUpdate()
    {
        $params = $this->data_request;
        $params['admin'] = $this->admin;
        return ApiService::ApiDataReturn(ActivityService::ActivityStatusUpdate($params));
    }
}
?>
