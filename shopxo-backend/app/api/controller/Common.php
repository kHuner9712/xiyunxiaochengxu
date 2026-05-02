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
namespace app\api\controller;

use app\BaseController;
use app\module\FormTableHandleModule;
use app\service\ApiService;
use app\service\SystemService;
use app\service\UserService;
use app\service\ConfigService;
use app\service\MuyingComplianceService;

/**
 * 接口公共控制器
 * @author   Devil
 * @blog     http://gong.gg/
 * @version  0.0.1
 * @datetime 2016-12-01T21:51:08+0800
 */
class Common extends BaseController
{
    // [MUYING-二开] 集中式控制器→功能开关映射安全网
    // 任何新增的受控控制器必须在此注册，确保即使子类忘记调用 CheckFeatureEnabled 也不会绕过合规
    private static $CONTROLLER_FEATURE_MAP = [
        'activity'          => 'feature_activity_enabled',
        'article'           => 'feature_content_enabled',
        'feedback'          => 'feature_feedback_enabled',
        'invite'            => 'feature_invite_enabled',
        'muyinguser'        => 'feature_membership_enabled',
        'userintegral'      => 'feature_points_enabled',
        'coupon'            => 'feature_coupon_enabled',
        'signin'            => 'feature_signin_enabled',
        'points'            => 'feature_points_enabled',
        'seckill'           => 'feature_seckill_enabled',
        'shop'              => 'feature_shop_enabled',
        'realstore'         => 'feature_realstore_enabled',
        'distribution'      => 'feature_distribution_enabled',
        'wallet'            => 'feature_wallet_enabled',
        'coin'              => 'feature_coin_enabled',
        'video'             => 'feature_video_enabled',
        'hospital'          => 'feature_hospital_enabled',
        'membershiplevelvip'=> 'feature_membership_enabled',
        'giftcard'          => 'feature_giftcard_enabled',
        'givegift'          => 'feature_givegift_enabled',
        'certificate'       => 'feature_certificate_enabled',
        'scanpay'           => 'feature_scanpay_enabled',
        'weixinliveplayer'  => 'feature_live_enabled',
        'intellectstools'   => 'feature_intellectstools_enabled',
        'complaint'         => 'feature_complaint_enabled',
        'invoice'           => 'feature_invoice_enabled',
        'ask'               => 'feature_ugc_enabled',
        'blog'              => 'feature_ugc_enabled',
        'cashier'           => 'feature_payment_enabled',
        'paylog'            => 'feature_payment_enabled',
        'forminput'         => 'feature_dynamic_page_enabled',
        'diy'               => 'feature_dynamic_page_enabled',
        'design'            => 'feature_dynamic_page_enabled',
    ];

	// 用户信息
	protected $user;

    // 输入参数 post|get|request
    protected $data_post;
    protected $data_get;
    protected $data_request;

    // 当前系统操作名称
    protected $module_name;
    protected $controller_name;
    protected $action_name;

    // 当前插件操作名称
    protected $plugins_module_name;
    protected $plugins_controller_name;
    protected $plugins_action_name;

    // 动态表格
    protected $form_table_data;
    protected $form_table;
    protected $form_where;
    protected $form_params;
    protected $form_md5_key;
    protected $form_user_fields;
    protected $form_order_by;
    protected $form_error;

    // 列表数据
    protected $data_total;
    protected $data_list;
    protected $data_detail;

    // 分页信息
    protected $page;
    protected $page_start;
    protected $page_size;

	/**
     * 构造方法
     * @author   Devil
     * @blog    http://gong.gg/
     * @version 1.0.0
     * @date    2018-11-30
     * @desc    description
     */
    public function __construct()
    {
        // 检测是否是新安装
        SystemService::SystemInstallCheck();

        // 系统初始化
        $this->SystemInit();

        // 系统运行开始
        SystemService::SystemBegin($this->data_request);

        // 网站状态
        $this->SiteStstusCheck();

        // 动态表格初始化
        $this->FormTableInit();

		// 公共数据初始化
		$this->CommonInit();
    }

    /**
     * 析构函数
     * @author   Devil
     * @blog    http://gong.gg/
     * @version 1.0.0
     * @date    2019-03-18
     * @desc    description
     */
    public function __destruct()
    {
        // 系统运行结束
        SystemService::SystemEnd($this->data_request);
    }

    /**
     * 系统初始化
     * @author   Devil
     * @blog    http://gong.gg/
     * @version 1.0.0
     * @date    2018-12-07
     * @desc    description
     */
    private function SystemInit()
    {
        // 输入参数
        $this->data_post = input('post.');
        $this->data_get = input('get.');
        $this->data_request = input();

        // 配置信息初始化
        ConfigService::ConfigInit();
    }

    /**
     * 网站状态
     * @author   Devil
     * @blog     http://gong.gg/
     * @version  1.0.0
     * @datetime 2018-04-18T16:20:58+0800
     */
    private function SiteStstusCheck()
    {
        $data = MyC('home_site_app_state', [], true);
        if(!empty($data) && is_array($data) && in_array(APPLICATION_CLIENT_TYPE, $data))
        {
            exit(json_encode(DataReturn(MyC('home_site_close_reason', MyLang('upgrading_tips')), -10000)));
        }
    }

	/**
	 * 登录校验
	 * @author   Devil
	 * @blog     http://gong.gg/
	 * @version  0.0.1
	 * @datetime 2017-03-09T11:43:48+0800
	 */
	protected function IsLogin()
	{
		if(empty($this->user))
		{
			exit(json_encode(DataReturn(MyLang('login_failure_tips'), -400)));
		}
    }

    protected function CheckFeatureEnabled($feature_flag_key)
    {
        if (intval(MyC($feature_flag_key, 0)) === 0) {
            $this->ExitFeatureDisabled($feature_flag_key, '该功能暂未开放');
        }

        if (MuyingComplianceService::IsHighRiskFeatureKey($feature_flag_key)) {
            $plugin_name = MuyingComplianceService::GetPluginNameByFeatureKey($feature_flag_key);
            if (!empty($plugin_name) && !MuyingComplianceService::IsQualificationMetForPlugin($plugin_name)) {
                $missing = MuyingComplianceService::GetMissingQualifications($plugin_name);
                $reason = '当前资质暂不支持该功能，缺少：' . implode('、', $missing);
                $this->ExitFeatureDisabled($feature_flag_key, $reason);
            }
        }
    }

    private function ExitFeatureDisabled($feature_flag_key, $reason)
    {
        $controller = '';
        $action = '';
        $user_id = 0;
        $ip = '';
        try {
            $controller = request()->controller();
            $action = request()->action();
            $ip = !empty($_SERVER['REMOTE_ADDR']) ? $_SERVER['REMOTE_ADDR'] : '';
        } catch (\Exception $e) {}
        if (!empty($this->user) && !empty($this->user['id'])) {
            $user_id = intval($this->user['id']);
        }

        try {
            \think\facade\Db::name('MuyingComplianceLog')->insert([
                'admin_id'       => 0,
                'admin_username' => '',
                'feature_key'    => $feature_flag_key,
                'action'         => 'api_blocked',
                'reason'         => $reason,
                'controller'     => $controller,
                'api_action'     => $action,
                'user_id'        => $user_id,
                'ip'             => $ip,
                'add_time'       => time(),
            ]);
        } catch (\Exception $e) {}

        try {
            \think\facade\Log::write('[MUYING] API feature blocked: key=' . $feature_flag_key . ' ctrl=' . $controller . '/' . $action . ' uid=' . $user_id . ' ip=' . $ip . ' reason=' . $reason, 'warning');
        } catch (\Exception $e) {}
        $this->ApiExit(DataReturn($reason, -403));
    }

    /**
     * 动态表格初始化
     * @author  Devil
     * @blog    http://gong.gg/
     * @version 1.0.0
     * @date    2020-06-02
     * @desc    description
     */
    public function FormTableInit()
    {
        // 获取表格模型
        $module = FormModulePath($this->data_request);
        if(!empty($module))
        {
            // 调用表格处理
            $params = $this->data_request;
            $ret = (new FormTableHandleModule())->Run($module['module'], $module['action'], $params);
            if($ret['code'] == 0)
            {
                // 表格数据
                $this->form_table_data = $ret['data'];
                $this->form_table = $ret['data']['table'];
                $this->form_where = $ret['data']['where'];
                $this->form_params = $ret['data']['params'];
                $this->form_md5_key = $ret['data']['md5_key'];
                $this->form_user_fields = $ret['data']['user_fields'];
                $this->form_order_by = $ret['data']['order_by'];

                // 列表数据
                $this->data_total = $ret['data']['data_total'];
                $this->data_list = $ret['data']['data_list'];
                $this->data_detail = $ret['data']['data_detail'];

                // 分页数据
                $this->page = $ret['data']['page'];
                $this->page_start = $ret['data']['page_start'];
                $this->page_size = $ret['data']['page_size'];
            } else {
                $this->form_error = $ret['msg'];
            }
        }
    }

	/**
	 * 公共数据初始化
	 * @author   Devil
	 * @blog     http://gong.gg/
	 * @version  0.0.1
	 * @datetime 2017-03-09T11:43:48+0800
	 */
	private function CommonInit()
	{
		// 用户数据
		$this->user = UserService::LoginUserInfo();

        // 当前系统操作名称
        $this->module_name = RequestModule();
        $this->controller_name = RequestController();
        $this->action_name = RequestAction();

        // 当前插件操作名称, 兼容插件模块名称
        if(empty($this->data_request['pluginsname']))
        {
            $this->plugins_module_name = '';
            $this->plugins_controller_name = '';
            $this->plugins_action_name = '';
        } else {
            $this->plugins_module_name = $this->data_request['pluginsname'];
            $this->plugins_controller_name = empty($this->data_request['pluginscontrol']) ? 'index' : $this->data_request['pluginscontrol'];
            $this->plugins_action_name = empty($this->data_request['pluginsaction']) ? 'index' : $this->data_request['pluginsaction'];
        }

        // 分页信息
        // [MUYING-二开] page_size 上限从 ShopXO 原 1000 降至 200，防止小程序端被恶意拉取全量数据拖垮接口
        // 200 仍远超移动端每页合理展示量（通常 15-20），不影响正常列表使用
        $this->page = max(1, isset($this->data_request['page']) ? intval($this->data_request['page']) : 1);
        $this->page_size = min(empty($this->data_request['page_size']) ? MyC('common_page_size', 15, true) : intval($this->data_request['page_size']), 200);
        $this->page_start = intval(($this->page-1)*$this->page_size);

        // [MUYING-二开] 集中式合规安全网：自动检查当前控制器是否需要功能开关
        $ctrl = strtolower($this->controller_name);
        if (isset(self::$CONTROLLER_FEATURE_MAP[$ctrl])) {
            $this->CheckFeatureEnabled(self::$CONTROLLER_FEATURE_MAP[$ctrl]);
        }

        // [MUYING-二开] 集中式 action-level 支付门控
        $act = strtolower($this->action_name);
        $payment_check = MuyingComplianceService::AssertPaymentEnabledForAction($ctrl, $act);
        if ($payment_check !== true) {
            $this->ApiExit($payment_check);
        }
	}

    // [MUYING-二开] 统一 JSON 响应终止方法
    // 所有二开拦截点（功能关闭、支付拦截、隐私配置异常等）统一使用此方法响应
    protected function ApiExit($data_return, $http_code = 200)
    {
        if (!is_array($data_return) || !isset($data_return['code'])) {
            $data_return = DataReturn('操作失败', -1);
        }
        $response = response(json_encode($data_return, JSON_UNESCAPED_UNICODE), $http_code);
        $response->header([
            'Content-Type' => 'application/json; charset=utf-8',
        ]);
        throw new \think\exception\HttpResponseException($response);
    }

	/**
     * 空方法响应
     * @author   Devil
     * @blog    http://gong.gg/
     * @version 1.0.0
     * @date    2018-11-30
     * @desc    description
     * @param   [string]         $method [方法名称]
     * @param   [array]          $args   [参数]
     */
    public function __call($method, $args)
    {
        return ApiService::ApiDataReturn(DataReturn(MyLang('illegal_access_tips').'('.$method.')', -1000));
    }
}
?>