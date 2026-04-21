<?php
namespace app\api\controller;

use app\service\ApiService;
use app\service\UserTagService;
use app\service\DashboardService;

class Muyinguser extends Common
{
    public function TagList()
    {
        $data = UserTagService::TagList(['is_enable' => 1, 'n' => 100]);
        return ApiService::ApiDataReturn($data);
    }

    public function UserTags()
    {
        $this->IsLogin();
        $tags = UserTagService::UserTags($this->user['id']);
        return ApiService::ApiDataReturn(DataReturn(MyLang('handle_success'), 0, $tags));
    }

    public function UserTagSet()
    {
        $this->IsLogin();
        $params = $this->data_request;
        $params['user_id'] = $this->user['id'];
        return ApiService::ApiDataReturn(UserTagService::UserTagSet($params));
    }

    public function AdminRemark()
    {
        $this->IsLogin();
        if (empty($this->admin)) {
            return ApiService::ApiDataReturn(DataReturn('无权限', -1));
        }
        $params = $this->data_request;
        return ApiService::ApiDataReturn(UserTagService::AdminUserRemark($params));
    }
}
