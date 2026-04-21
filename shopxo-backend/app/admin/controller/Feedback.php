<?php
namespace app\admin\controller;

use app\admin\controller\Base;
use app\service\ApiService;
use app\service\FeedbackService;
use app\extend\muying\MuyingStage;

/**
 * 用户反馈管理
 */
class Feedback extends Base
{
    /**
     * 列表
     */
    public function Index()
    {
        $stage_list = [];
        foreach (MuyingStage::getList() as $value => $name) {
            $stage_list[] = ['value' => $value, 'name' => $name];
        }
        MyViewAssign(['common_service_muying_stage_list' => $stage_list]);
        return MyView();
    }

    /**
     * 数据列表
     */
    public function DataIndex()
    {
        $params = $this->data_request;
        $where = FeedbackService::FeedbackAdminWhere($params);
        $total = FeedbackService::FeedbackAdminTotal($where);
        $page_total = ceil($total / $this->page_size);
        $start = intval(($this->page - 1) * $this->page_size);

        $data_params = array_merge($params, [
            'm'     => $start,
            'n'     => $this->page_size,
            'where' => $where,
        ]);
        $data = FeedbackService::FeedbackAdminList($data_params);

        $result = [
            'total'      => $total,
            'page_total' => $page_total,
            'data'       => $data['data'],
        ];
        return ApiService::ApiDataReturn(SystemBaseService::DataReturn($result));
    }

    /**
     * 详情
     */
    public function Detail()
    {
        $params = $this->data_request;
        $id = isset($params['id']) ? intval($params['id']) : 0;
        if ($id <= 0) {
            return MyView();
        }

        $data = \think\facade\Db::name('MuyingFeedback')->where(['id' => $id])->find();
        if (!empty($data)) {
            $data['stage_text'] = \app\extend\muying\MuyingStage::getName(\app\extend\muying\MuyingStage::Normalize($data['stage'] ?? ''));
            $data['add_time_text'] = empty($data['add_time']) ? '' : date('Y-m-d H:i:s', $data['add_time']);
            $data['upd_time_text'] = empty($data['upd_time']) ? '' : date('Y-m-d H:i:s', $data['upd_time']);

            $user = \think\facade\Db::name('User')->where(['id' => $data['user_id']])->field('id,nickname,mobile')->find();
            $data['user_info'] = $user;
        }

        $assign = ['data' => $data];
        MyViewAssign($assign);
        return MyView();
    }

    /**
     * 状态更新（启用/禁用）
     */
    public function StatusUpdate()
    {
        $params = $this->data_request;
        $params['admin'] = $this->admin;
        return ApiService::ApiDataReturn(FeedbackService::FeedbackStatusUpdate($params));
    }

    /**
     * 删除
     */
    public function Delete()
    {
        $params = $this->data_request;
        $params['admin'] = $this->admin;
        return ApiService::ApiDataReturn(FeedbackService::FeedbackDelete($params));
    }
}
?>
