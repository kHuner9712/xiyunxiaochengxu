<?php
namespace app\admin\controller;

use app\admin\controller\Base;
use app\service\InviteService;

class Invite extends Base
{
    public function Index()
    {
        return MyView();
    }

    public function Detail()
    {
        $params = $this->data_request;
        $id = isset($params['id']) ? intval($params['id']) : 0;
        if ($id <= 0) {
            return $this->error('参数错误');
        }

        $result = InviteService::AdminInviteRewardDetail($params);
        $this->assign('data', $result['data'] ?? []);
        return MyView();
    }
}
