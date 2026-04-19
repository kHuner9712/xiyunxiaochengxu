<?php
namespace app\api\controller;

use app\service\ApiService;
use app\service\SystemBaseService;
use app\service\ActivityService;
use app\service\ResourcesService;

class Activity extends Common
{
    public function __construct()
    {
        parent::__construct();
    }

    public function Index()
    {
        $params = $this->data_request;
        $where = ActivityService::ActivityWhere($params);
        $total = ActivityService::ActivityTotal($where);
        $page_total = ceil($total / $this->page_size);
        $start = intval(($this->page - 1) * $this->page_size);

        $data_params = array_merge($params, [
            'm'     => $start,
            'n'     => $this->page_size,
            'where' => $where,
        ]);
        $data = ActivityService::ActivityList($data_params);

        $result = [
            'total'      => $total,
            'page_total' => $page_total,
            'data'       => $data['data'],
        ];
        return ApiService::ApiDataReturn(SystemBaseService::DataReturn($result));
    }

    public function Detail()
    {
        if (empty($this->data_request['id'])) {
            return ApiService::ApiDataReturn(DataReturn('活动ID参数有误', -1));
        }

        $params = $this->data_request;
        $result = ActivityService::ActivityDetail($params);
        if ($result['code'] != 0) {
            return ApiService::ApiDataReturn($result);
        }

        $id = intval($this->data_request['id']);
        ActivityService::ActivityAccessCountInc(['id' => $id]);

        $activity = $result['data'];
        $activity['content'] = ResourcesService::ApMiniRichTextContentHandle($activity['content']);

        $is_favored = false;
        $is_signed_up = false;
        if (!empty($this->user)) {
            $is_favored = ActivityService::IsActivityFavored($id, $this->user['id']);
            $is_signed_up = ActivityService::IsUserSignedUp($id, $this->user['id']);
        }

        $detail = [
            'activity'      => $activity,
            'is_favored'    => $is_favored,
            'is_signed_up'  => $is_signed_up,
            'signup_status' => isset($activity['signup_status']) ? $activity['signup_status'] : 'ongoing',
        ];
        return ApiService::ApiDataReturn(SystemBaseService::DataReturn($detail));
    }

    public function Favor()
    {
        $this->IsLogin();
        $params = $this->data_request;
        $params['user'] = $this->user;
        return ApiService::ApiDataReturn(ActivityService::ActivityFavorToggle($params));
    }

    public function Signup()
    {
        $this->IsLogin();
        $params = $this->data_request;
        $params['user'] = $this->user;
        return ApiService::ApiDataReturn(ActivityService::ActivitySignup($params));
    }

    public function SignupCancel()
    {
        $this->IsLogin();
        $params = $this->data_request;
        $params['user'] = $this->user;
        return ApiService::ApiDataReturn(ActivityService::SignupCancel($params));
    }

    public function MySignup()
    {
        $this->IsLogin();
        $params = $this->data_request;
        $params['user'] = $this->user;
        $where = ActivityService::MySignupWhere($params);
        $total = ActivityService::MySignupTotal($where);
        $page_total = ceil($total / $this->page_size);
        $start = intval(($this->page - 1) * $this->page_size);

        $data_params = array_merge($params, [
            'm'     => $start,
            'n'     => $this->page_size,
            'where' => $where,
        ]);
        $data = ActivityService::MySignupList($data_params);

        $result = [
            'total'      => $total,
            'page_total' => $page_total,
            'data'       => $data['data'],
        ];
        return ApiService::ApiDataReturn(SystemBaseService::DataReturn($result));
    }
}
