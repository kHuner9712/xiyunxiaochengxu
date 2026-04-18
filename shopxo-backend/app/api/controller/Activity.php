<?php
namespace app\api\controller;

use app\service\ApiService;
use app\service\SystemBaseService;
use app\service\ActivityService;
use app\service\ResourcesService;
use think\facade\Db;

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
        if (!empty($this->user)) {
            $favor_exists = Db::name('GoodsFavor')->where([
                ['user_id', '=', $this->user['id']],
                ['goods_id', '=', $id],
                ['type', '=', 'activity'],
            ])->find();
            $is_favored = !empty($favor_exists);
        }

        $is_signed_up = false;
        if (!empty($this->user)) {
            $signup_exists = Db::name('ActivitySignup')->where([
                ['activity_id', '=', $id],
                ['user_id', '=', $this->user['id']],
                ['status', 'in', [0, 1]],
                ['is_delete_time', '=', 0],
            ])->find();
            $is_signed_up = !empty($signup_exists);
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
        if (empty($this->data_request['id'])) {
            return ApiService::ApiDataReturn(DataReturn('活动ID参数有误', -1));
        }

        $id = intval($this->data_request['id']);
        $user_id = intval($this->user['id']);

        $exists = Db::name('GoodsFavor')->where([
            ['user_id', '=', $user_id],
            ['goods_id', '=', $id],
            ['type', '=', 'activity'],
        ])->find();

        if (!empty($exists)) {
            Db::name('GoodsFavor')->where([
                ['user_id', '=', $user_id],
                ['goods_id', '=', $id],
                ['type', '=', 'activity'],
            ])->delete();
            return ApiService::ApiDataReturn(DataReturn('取消收藏成功', 0, ['is_favored' => false]));
        } else {
            Db::name('GoodsFavor')->insert([
                'user_id'   => $user_id,
                'goods_id'  => $id,
                'type'      => 'activity',
                'add_time'  => time(),
            ]);
            return ApiService::ApiDataReturn(DataReturn('收藏成功', 0, ['is_favored' => true]));
        }
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
