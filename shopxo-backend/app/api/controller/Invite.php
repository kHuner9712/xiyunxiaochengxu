<?php
namespace app\api\controller;

use app\service\ApiService;
use app\service\SystemBaseService;
use app\service\InviteService;

class Invite extends Common
{
    public function __construct()
    {
        parent::__construct();
        $action = strtolower(request_action());
        $public_actions = ['rewardconfigpublic'];
        if (!in_array($action, $public_actions)) {
            $this->IsLogin();
        }
    }

    public function Index()
    {
        $params = $this->data_request;
        $params['user'] = $this->user;
        $data = InviteService::InviteInfo($params);
        return ApiService::ApiDataReturn(SystemBaseService::DataReturn($data));
    }

    public function RewardList()
    {
        $params = $this->data_request;
        $params['user'] = $this->user;
        $where = InviteService::RewardListWhere($params);
        $total = InviteService::RewardListTotal($where);
        $page_total = ceil($total / $this->page_size);
        $start = intval(($this->page - 1) * $this->page_size);

        $data_params = array_merge($params, [
            'm'     => $start,
            'n'     => $this->page_size,
            'where' => $where,
        ]);
        $data = InviteService::RewardList($data_params);

        $result = [
            'total'      => $total,
            'page_total' => $page_total,
            'data'       => $data['data'],
        ];
        return ApiService::ApiDataReturn(SystemBaseService::DataReturn($result));
    }

    public function Poster()
    {
        $params = $this->data_request;
        $params['user'] = $this->user;
        return ApiService::ApiDataReturn(InviteService::Poster($params));
    }

    public function RewardConfig()
    {
        $data = InviteService::RewardConfig();
        return ApiService::ApiDataReturn(SystemBaseService::DataReturn($data));
    }

    public function RewardConfigPublic()
    {
        $data = InviteService::RewardConfig();
        return ApiService::ApiDataReturn(SystemBaseService::DataReturn($data));
    }
}
