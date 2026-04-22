<?php
// +----------------------------------------------------------------------
// | ShopXO 国内领先企业级B2C免费开源电商系统
// +----------------------------------------------------------------------
// | Copyright (c) 2011~2099 http://shopxo.net All rights reserved.
// +----------------------------------------------------------------------
// | Licensed ( https://opensource.org/licenses/mit-license.php )
// +----------------------------------------------------------------------
// | Author: Devil
// +----------------------------------------------------------------------
namespace app\admin\controller;

use app\admin\controller\Base;
use app\service\ApiService;
use app\service\UserService;
use app\extend\muying\MuyingStage;

/**
 * 用户管理
 * @author   Devil
 * @blog     http://gong.gg/
 * @version  0.0.1
 * @datetime 2016-12-01T21:51:08+0800
 */
class User extends Base
{
	/**
     * 列表
     * @author   Devil
     * @blog     http://gong.gg/
     * @version  0.0.1
     * @datetime 2016-12-06T21:31:53+0800
     */
	public function Index()
	{
		return MyView();
	}

	/**
     * 详情
     * @author   Devil
     * @blog     http://gong.gg/
     * @version  1.0.0
     * @datetime 2019-08-05T08:21:54+0800
     */
    public function Detail()
    {
        $data = $this->data_detail;
        if (!empty($data) && !empty($data['id'])) {
            $data['muying_tags'] = \app\service\UserTagService::UserTags($data['id']);
            $invite_count = \think\facade\Db::name('InviteReward')->where([
                ['inviter_id', '=', $data['id']],
                ['status', '=', 1],
            ])->group('invitee_id')->count();
            $reward_total = \think\facade\Db::name('InviteReward')->where([
                ['inviter_id', '=', $data['id']],
                ['status', '=', 1],
            ])->sum('reward_value');
            if ($invite_count > 0) {
                $data['invite_info'] = [
                    'invite_count' => $invite_count,
                    'reward_total' => intval($reward_total),
                ];
            }
            // 母婴画像字段格式化
            $data['current_stage_text'] = MuyingStage::getName($data['current_stage'] ?? '');
            $data['due_date'] = !empty($data['due_date']) ? date('Y-m-d', $data['due_date']) : '';
            $data['baby_birthday'] = !empty($data['baby_birthday']) ? date('Y-m-d', $data['baby_birthday']) : '';
            $data['baby_month_age'] = UserService::CalcBabyMonthAge(intval($data['baby_birthday'] ?? 0));
            MyViewAssign(['data' => $data]);
        }
        return MyView();
    }

	/**
	 * 添加/编辑页面
	 * @author   Devil
	 * @blog     http://gong.gg/
	 * @version  0.0.1
	 * @datetime 2016-12-14T21:37:02+0800
	 */
	public function SaveInfo()
	{
		// 参数
		$params = $this->data_request;

		// 数据
		$data = $this->data_detail;
		if(!empty($params['id']) && empty($data))
		{
			return ViewError(MyLang('no_data'), MyUrl('admin/user/index'));
		}

		// 模板数据
		$assign = [
			// 静态数据
			'common_gender_list' => MyConst('common_gender_list'),
		];

		// 用户编辑页面钩子
		$hook_name = 'plugins_view_admin_user_save';
        $assign[$hook_name.'_data'] = MyEventTrigger($hook_name,
        [
            'hook_name'    	=> $hook_name,
            'is_backend'   	=> true,
            'user_id'      	=> isset($params['id']) ? $params['id'] : 0,
            'data'			=> &$data,
            'params'       	=> &$params,
        ]);

		// 数据/参数
		unset($params['id']);
        $assign['data'] = $data;
		$assign['params'] = $params;

		// 数据赋值
		MyViewAssign($assign);
		return MyView();
	}


	/**
	 * 用户添加/编辑
	 * @author   Devil
	 * @blog     http://gong.gg/
	 * @version  0.0.1
	 * @datetime 2016-12-14T21:37:02+0800
	 */
	public function Save()
	{
		$params = $this->data_request;
		$params['admin'] = $this->admin;
		return ApiService::ApiDataReturn(UserService::UserSave($params));
	}

	/**
	 * 用户删除
	 * @author   Devil
	 * @blog     http://gong.gg/
	 * @version  0.0.1
	 * @datetime 2016-12-15T11:03:30+0800
	 */
	public function Delete()
	{
		$params = $this->data_request;
		$params['admin'] = $this->admin;
		return ApiService::ApiDataReturn(UserService::UserDelete($params));
	}
}
?>