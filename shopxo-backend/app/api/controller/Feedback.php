<?php
namespace app\api\controller;

use app\service\ApiService;
use app\service\SystemBaseService;
use app\service\FeedbackService;

class Feedback extends Common
{
    private static $FEATURE_FLAG_KEY = 'feature_feedback_enabled';

    public function __construct()
    {
        parent::__construct();
        self::CheckFeatureEnabled(self::$FEATURE_FLAG_KEY);
    }

    public function Index()
    {
        $params = $this->data_request;
        $where = FeedbackService::FeedbackWhere($params);
        $total = FeedbackService::FeedbackTotal($where);
        $page_total = ceil($total / $this->page_size);
        $start = intval(($this->page - 1) * $this->page_size);

        $data_params = array_merge($params, [
            'm'     => $start,
            'n'     => $this->page_size,
            'where' => $where,
        ]);
        $data = FeedbackService::FeedbackList($data_params);

        $result = [
            'total'      => $total,
            'page_total' => $page_total,
            'items'      => $data['data'],
        ];
        return ApiService::ApiDataReturn(SystemBaseService::DataReturn($result));
    }

    public function Create()
    {
        $this->IsLogin();
        $params = $this->data_request;
        $params['user'] = $this->user;
        return ApiService::ApiDataReturn(FeedbackService::FeedbackCreate($params));
    }
}
