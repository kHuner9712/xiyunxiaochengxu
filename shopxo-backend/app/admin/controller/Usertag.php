<?php
namespace app\admin\controller;

use app\admin\controller\Base;
use app\service\ApiService;
use app\service\UserTagService;

class Usertag extends Base
{
    public function Index()
    {
        return MyView();
    }

    public function DataIndex()
    {
        $params = $this->data_request;
        $where = [];
        if (!empty($params['name'])) {
            $where[] = ['name', 'like', '%' . $params['name'] . '%'];
        }
        if (isset($params['is_enable']) && $params['is_enable'] !== '') {
            $where[] = ['is_enable', '=', intval($params['is_enable'])];
        }

        $total = UserTagService::TagTotal($where);
        $page_total = ceil($total / $this->page_size);
        $start = intval(($this->page - 1) * $this->page_size);

        $data_params = array_merge($params, [
            'm'       => $start,
            'n'       => $this->page_size,
            'where'   => $where,
        ]);
        $data = UserTagService::TagList($data_params);

        $result = [
            'total'      => $total,
            'page_total' => $page_total,
            'items'      => $data['data'],
        ];
        return ApiService::ApiDataReturn(SystemBaseService::DataReturn($result));
    }

    public function Detail()
    {
        $params = $this->data_request;
        $id = isset($params['id']) ? intval($params['id']) : 0;
        $data = [];
        if ($id > 0) {
            $tag = \think\facade\Db::name('MuyingUserTag')->where(['id' => $id])->find();
            if (!empty($tag)) {
                $data = $tag;
                $data['user_count'] = \think\facade\Db::name('MuyingUserTagRel')->where(['tag_id' => $id])->count();
            }
        }
        MyViewAssign(['data' => $data]);
        return MyView();
    }

    public function Save()
    {
        $params = $this->data_request;
        $params['admin'] = $this->admin;
        return ApiService::ApiDataReturn(UserTagService::TagSave($params));
    }

    public function Delete()
    {
        $params = $this->data_request;
        $params['admin'] = $this->admin;
        return ApiService::ApiDataReturn(UserTagService::TagDelete($params));
    }

    public function StatusUpdate()
    {
        $params = $this->data_request;
        $params['admin'] = $this->admin;
        return ApiService::ApiDataReturn(UserTagService::TagStatusUpdate($params));
    }
}
