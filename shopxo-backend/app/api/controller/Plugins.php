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

use app\service\ApiService;
use app\service\PluginsService;

/**
 * 应用调用入口
 * @author   Devil
 * @blog     http://gong.gg/
 * @version  0.0.1
 * @datetime 2016-12-01T21:51:08+0800
 */
class Plugins extends Common
{
    // [MUYING-二开] 一期高风险插件黑名单 — 未取得 ICP 经营许可证阶段，服务端强制拦截
    private static $PHASE_ONE_BLOCKED_PLUGINS = [
        'distribution', 'wallet', 'coin', 'shop', 'realstore',
        'ask', 'blog', 'membershiplevelvip', 'seckill', 'video',
        'hospital', 'giftcard', 'givegift', 'complaint', 'invoice',
        'certificate', 'scanpay', 'weixinliveplayer', 'intellectstools',
    ];

    // [MUYING-二开] 功能开关注解到插件名的映射 — 开关启用时从黑名单中移除
    private static $FEATURE_FLAG_PLUGIN_MAP = [
        'feature_shop_enabled'              => 'shop',
        'feature_realstore_enabled'         => 'realstore',
        'feature_distribution_enabled'      => 'distribution',
        'feature_wallet_enabled'            => 'wallet',
        'feature_coin_enabled'              => 'coin',
        'feature_ugc_enabled'               => ['ask', 'blog'],
        'feature_membership_enabled'        => 'membershiplevelvip',
        'feature_seckill_enabled'           => 'seckill',
        'feature_giftcard_enabled'          => 'giftcard',
        'feature_givegift_enabled'          => 'givegift',
        'feature_video_enabled'             => 'video',
        'feature_hospital_enabled'          => 'hospital',
        'feature_complaint_enabled'         => 'complaint',
        'feature_invoice_enabled'           => 'invoice',
        'feature_certificate_enabled'       => 'certificate',
        'feature_scanpay_enabled'           => 'scanpay',
        'feature_live_enabled'              => 'weixinliveplayer',
        'feature_intellectstools_enabled'   => 'intellectstools',
    ];

    /**
     * [MUYING-二开] 获取当前生效的拦截黑名单
     * 逻辑：以 $PHASE_ONE_BLOCKED_PLUGINS 为基础，逐个检查 MyC 功能开关；
     *       开关值为 1 时，将对应插件从黑名单中移除（即允许访问）。
     *       默认高风险插件关闭，无需任何配置即可生效。
     */
    private static function GetEffectiveBlockedPlugins()
    {
        $blocked = self::$PHASE_ONE_BLOCKED_PLUGINS;
        foreach (self::$FEATURE_FLAG_PLUGIN_MAP as $flag_key => $plugin_names) {
            $enabled = MyC($flag_key, 0);
            if ($enabled == 1) {
                $plugin_names = is_array($plugin_names) ? $plugin_names : [$plugin_names];
                $blocked = array_diff($blocked, $plugin_names);
            }
        }
        return array_values($blocked);
    }

    /**
     * [MUYING-二开] 检查插件名是否被一期拦截
     * @param  string $pluginsname 插件名
     * @return bool
     */
    private static function IsPluginBlocked($pluginsname)
    {
        $blocked = self::GetEffectiveBlockedPlugins();
        return in_array(strtolower($pluginsname), $blocked);
    }

    /**
     * 构造方法
     * @author   Devil
     * @blog    http://gong.gg/
     * @version 1.0.0
     * @date    2020-01-02
     * @desc    description
     */
    public function __construct()
    {
        parent::__construct();
    }
    
    /**
     * 首页
     * @author  Devil
     * @blog    http://gong.gg/
     * @version 1.0.0
     * @date    2020-01-02
     * @desc    description
     */
    public function Index()
    {
        // 参数
        $params = $this->GetClassVars();

        // 请求参数校验
        $p = [
            [
                'checked_type'      => 'empty',
                'key_name'          => 'pluginsname',
                'error_msg'         => MyLang('plugins_name_tips'),
            ],
            [
                'checked_type'      => 'empty',
                'key_name'          => 'pluginscontrol',
                'error_msg'         => MyLang('plugins_control_tips'),
            ],
            [
                'checked_type'      => 'empty',
                'key_name'          => 'pluginsaction',
                'error_msg'         => MyLang('plugins_action_tips'),
            ],
        ];
        $ret = ParamsChecked($params['data_request'], $p);
        if($ret === true)
        {
            // [MUYING-二开] 一期插件级功能拦截 — 服务端强制拦截高风险插件 API 访问
            $pluginsname = $params['data_request']['pluginsname'];
            if (self::IsPluginBlocked($pluginsname)) {
                return ApiService::ApiDataReturn(DataReturn('该功能暂未开放', -10000));
            }

            // 应用名称/控制器/方法
            $pluginscontrol = strtolower($params['data_request']['pluginscontrol']);
            $pluginsaction = strtolower($params['data_request']['pluginsaction']);

            // 调用
            $ret = PluginsService::PluginsControlCall($pluginsname, $pluginscontrol, $pluginsaction, 'api', $params);
            if($ret['code'] == 0)
            {
                $ret = $ret['data'];
            }
        } else {
            $ret = DataReturn($ret, -5000);
        }
        return ApiService::ApiDataReturn($ret);
    }

    /**
     * 获取类属性数据
     * @author  Devil
     * @blog    http://gong.gg/
     * @version 1.0.0
     * @date    2020-06-07
     * @desc    description
     */
    public function GetClassVars()
    {
        $data = [];
        $vers = get_class_vars(get_class($this));
        foreach($vers as $k=>$v)
        {
            if(property_exists($this, $k))
            {
                $data[$k] = $this->$k;
            }
        }
        return $data;
    }
}
?>