<?php
namespace app\admin\controller;

use app\admin\controller\Base;
use app\service\ApiService;
use app\service\ActivityService;
use app\service\MuyingPrivacyService;
use app\service\ResourcesService;
use think\facade\Db;

class Activity extends Base
{
    public function Index()
    {
        return MyView();
    }

    public function Detail()
    {
        $data = $this->data_detail;
        $signup_list = [];
        $signup_total = 0;
        $signup_confirmed_count = 0;
        $waitlist_count = 0;
        $checkin_count = 0;
        if (!empty($data) && !empty($data['id'])) {
            $signup_list = Db::name('ActivitySignup')
                ->where(['activity_id' => $data['id'], 'is_delete_time' => 0])
                ->order('is_waitlist asc, id desc')
                ->limit(50)
                ->select()
                ->toArray();
            $signup_total = Db::name('ActivitySignup')
                ->where(['activity_id' => $data['id'], 'is_delete_time' => 0])
                ->count();
            $signup_confirmed_count = Db::name('ActivitySignup')
                ->where(['activity_id' => $data['id'], 'is_delete_time' => 0, 'status' => 1])
                ->count();
            $waitlist_count = Db::name('ActivitySignup')
                ->where(['activity_id' => $data['id'], 'is_delete_time' => 0, 'is_waitlist' => 1])
                ->where('status', 'in', [0, 1])
                ->count();
            $checkin_count = Db::name('ActivitySignup')
                ->where(['activity_id' => $data['id'], 'is_delete_time' => 0, 'checkin_status' => 1])
                ->count();
            $can_view_sensitive = !empty($this->admin) && MuyingPrivacyService::CanViewSensitive($this->admin);
            foreach ($signup_list as $k => &$v) {
                $v['status_text'] = ActivityService::SignupStatusText($v['status']);
                $v['checkin_status_text'] = ActivityService::CheckinStatusText($v['checkin_status']);
                $v['is_waitlist_text'] = empty($v['is_waitlist']) ? '' : '候补';
                $v['stage_text'] = \app\extend\muying\MuyingStage::getName(\app\extend\muying\MuyingStage::Normalize($v['stage']));
                $v['add_time_text'] = empty($v['add_time']) ? '' : date('Y-m-d H:i:s', $v['add_time']);
                $v = MuyingPrivacyService::MaskSignupRow($v, $can_view_sensitive);
            }
        }
        MyViewAssign([
            'data'                   => $data,
            'signup_list'            => $signup_list,
            'signup_total'           => $signup_total,
            'signup_confirmed_count' => $signup_confirmed_count,
            'waitlist_count'         => $waitlist_count,
            'checkin_count'          => $checkin_count,
            'can_view_sensitive'     => !empty($this->admin) && MuyingPrivacyService::CanViewSensitive($this->admin),
            'can_export_sensitive'   => !empty($this->admin) && MuyingPrivacyService::CanExportSensitive($this->admin),
        ]);
        return MyView();
    }

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

    public function Save()
    {
        $params = $this->data_request;
        $params['admin'] = $this->admin;
        return ApiService::ApiDataReturn(ActivityService::ActivitySave($params));
    }

    public function Delete()
    {
        $params = $this->data_request;
        $params['admin'] = $this->admin;
        return ApiService::ApiDataReturn(ActivityService::ActivityDelete($params));
    }

    public function StatusUpdate()
    {
        $params = $this->data_request;
        $params['admin'] = $this->admin;
        return ApiService::ApiDataReturn(ActivityService::ActivityStatusUpdate($params));
    }

    public function Review()
    {
        $params = $this->data_request;
        $params['admin'] = $this->admin;
        return ApiService::ApiDataReturn(ActivityService::ActivityReview($params));
    }
}
