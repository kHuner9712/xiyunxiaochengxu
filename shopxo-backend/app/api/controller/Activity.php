<?php
namespace app\api\controller;

use app\service\ApiService;
use app\service\SystemBaseService;
use app\service\ActivityService;
use app\service\ResourcesService;

class Activity extends Common
{
    private static $FEATURE_FLAG_KEY = 'feature_activity_enabled';

    public function __construct()
    {
        parent::__construct();
        self::CheckFeatureEnabled(self::$FEATURE_FLAG_KEY);
    }

    public function Index()
    {
        $params = $this->data_request;
        $where = ActivityService::ActivityWhere($params);
        $total = ActivityService::ActivityTotal($where);
        $page_total = ceil($total / $this->page_size);
        $start = intval(($this->page - 1) * $this->page_size);

        $data_params = array_merge($params, [
            'm'       => $start,
            'n'       => $this->page_size,
            'where'   => $where,
            'user_id' => !empty($this->user) ? $this->user['id'] : 0,
        ]);
        $data = ActivityService::ActivityList($data_params);

        $result = [
            'total'      => $total,
            'page_total' => $page_total,
            'items'      => $data['data'],
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
        $my_signup = null;
        if (!empty($this->user)) {
            $is_favored = ActivityService::IsActivityFavored($id, $this->user['id']);
            $is_signed_up = ActivityService::IsUserSignedUp($id, $this->user['id']);
            if ($is_signed_up) {
                $my_signup = \think\facade\Db::name('ActivitySignup')->where([
                    ['activity_id', '=', $id],
                    ['user_id', '=', $this->user['id']],
                    ['status', 'in', [0, 1]],
                    ['is_delete_time', '=', 0],
                ])->field('id,status,is_waitlist,signup_code,checkin_status')->find();
            }
        }

        $detail = [
            'activity'      => $activity,
            'is_favored'    => $is_favored,
            'is_signed_up'  => $is_signed_up,
            'signup_status' => isset($activity['signup_status']) ? $activity['signup_status'] : 'ongoing',
            'my_signup'     => $my_signup,
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
            'items'      => $data['data'],
        ];
        return ApiService::ApiDataReturn(SystemBaseService::DataReturn($result));
    }
}
