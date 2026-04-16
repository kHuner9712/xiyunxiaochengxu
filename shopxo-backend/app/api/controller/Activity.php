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
        if (!empty($this->data_request['id'])) {
            $id = intval($this->data_request['id']);
            $params = [
                'where' => [
                    ['is_enable', '=', 1],
                    ['id', '=', $id],
                ],
                'm' => 0,
                'n' => 1,
            ];
            $data = ActivityService::ActivityList($params);
            if (!empty($data['data'][0])) {
                ActivityService::ActivityAccessCountInc(['id' => $id]);
                $data['data'][0]['content'] = ResourcesService::ApMiniRichTextContentHandle($data['data'][0]['content']);
                $result = [
                    'data' => $data['data'][0],
                ];
                $ret = SystemBaseService::DataReturn($result);
            } else {
                $ret = DataReturn('活动不存在', -1);
            }
        } else {
            $ret = DataReturn('活动ID参数有误', -1);
        }
        return ApiService::ApiDataReturn($ret);
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
