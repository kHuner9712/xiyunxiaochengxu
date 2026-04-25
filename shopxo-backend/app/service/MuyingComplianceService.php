<?php
namespace app\service;

use app\extend\muying\MuyingStage;

class MuyingComplianceService
{
    const QUALIFICATION_ICP_COMMERCIAL = 'qualification_icp_commercial';
    const QUALIFICATION_EDI = 'qualification_edi';
    const QUALIFICATION_MEDICAL = 'qualification_medical';
    const QUALIFICATION_LIVE = 'qualification_live';
    const QUALIFICATION_PAYMENT = 'qualification_payment';

    private static $QUALIFICATION_DEFAULTS = [
        self::QUALIFICATION_ICP_COMMERCIAL => 0,
        self::QUALIFICATION_EDI => 0,
        self::QUALIFICATION_MEDICAL => 0,
        self::QUALIFICATION_LIVE => 0,
        self::QUALIFICATION_PAYMENT => 0,
    ];

    private static $PHASE_ONE_ALLOWED_PLUGINS = [
        'brand', 'delivery', 'express',
    ];

    private static $PHASE_ONE_BLOCKED_PLUGINS = [
        'distribution', 'wallet', 'coin', 'shop', 'realstore',
        'ask', 'blog', 'membershiplevelvip', 'seckill', 'video',
        'hospital', 'giftcard', 'givegift', 'complaint', 'invoice',
        'certificate', 'scanpay', 'weixinliveplayer', 'intellectstools',
        'coupon', 'signin', 'points',
    ];

    private static $PERMANENTLY_BLOCKED_PLUGINS = [
        'excellentbuyreturntocash', 'exchangerate', 'goodscompare',
        'orderfeed', 'ordergoodsform', 'orderresources',
        'antifakecode', 'form', 'binding', 'label',
    ];

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
        'feature_coupon_enabled'            => 'coupon',
        'feature_signin_enabled'            => 'signin',
        'feature_points_enabled'            => 'points',
    ];

    private static $QUALIFICATION_REQUIRED_MAP = [
        'shop'              => [self::QUALIFICATION_ICP_COMMERCIAL, self::QUALIFICATION_EDI],
        'realstore'         => [self::QUALIFICATION_ICP_COMMERCIAL, self::QUALIFICATION_EDI],
        'distribution'      => [self::QUALIFICATION_ICP_COMMERCIAL],
        'wallet'            => [self::QUALIFICATION_PAYMENT],
        'coin'              => [self::QUALIFICATION_PAYMENT],
        'ask'               => [self::QUALIFICATION_ICP_COMMERCIAL],
        'blog'              => [self::QUALIFICATION_ICP_COMMERCIAL],
        'membershiplevelvip'=> [self::QUALIFICATION_ICP_COMMERCIAL],
        'seckill'           => [self::QUALIFICATION_ICP_COMMERCIAL],
        'giftcard'          => [self::QUALIFICATION_PAYMENT],
        'givegift'          => [self::QUALIFICATION_PAYMENT],
        'video'             => [self::QUALIFICATION_LIVE],
        'hospital'          => [self::QUALIFICATION_MEDICAL],
        'complaint'         => [self::QUALIFICATION_ICP_COMMERCIAL],
        'invoice'           => [self::QUALIFICATION_ICP_COMMERCIAL],
        'certificate'       => [self::QUALIFICATION_ICP_COMMERCIAL],
        'scanpay'           => [self::QUALIFICATION_PAYMENT],
        'weixinliveplayer'  => [self::QUALIFICATION_LIVE],
        'intellectstools'   => [self::QUALIFICATION_ICP_COMMERCIAL],
    ];

    public static function GetQualificationValue($key)
    {
        $default = isset(self::$QUALIFICATION_DEFAULTS[$key]) ? self::$QUALIFICATION_DEFAULTS[$key] : 0;
        return intval(MyC($key, $default));
    }

    public static function GetAllQualifications()
    {
        $result = [];
        foreach (self::$QUALIFICATION_DEFAULTS as $key => $default) {
            $result[$key] = self::GetQualificationValue($key);
        }
        return $result;
    }

    public static function IsPluginAllowed($pluginsname)
    {
        $name = strtolower(trim($pluginsname));
        if (empty($name)) {
            return false;
        }

        if (in_array($name, self::$PERMANENTLY_BLOCKED_PLUGINS)) {
            return false;
        }

        if (in_array($name, self::$PHASE_ONE_BLOCKED_PLUGINS)) {
            $feature_enabled = self::IsFeatureEnabledForPlugin($name);
            if (!$feature_enabled) {
                return false;
            }
            $qualification_met = self::IsQualificationMetForPlugin($name);
            if (!$qualification_met) {
                return false;
            }
            return true;
        }

        return true;
    }

    public static function IsPluginBlocked($pluginsname)
    {
        return !self::IsPluginAllowed($pluginsname);
    }

    public static function GetBlockReason($pluginsname)
    {
        $name = strtolower(trim($pluginsname));
        if (empty($name)) {
            return '无效的插件标识';
        }

        if (in_array($name, self::$PERMANENTLY_BLOCKED_PLUGINS)) {
            return '该功能暂未开放';
        }

        if (in_array($name, self::$PHASE_ONE_BLOCKED_PLUGINS)) {
            $feature_enabled = self::IsFeatureEnabledForPlugin($name);
            if (!$feature_enabled) {
                return '该功能暂未开放';
            }
            $qualification_met = self::IsQualificationMetForPlugin($name);
            if (!$qualification_met) {
                return '当前资质暂不支持该功能';
            }
        }

        return '';
    }

    public static function GetEffectiveBlockedPlugins()
    {
        $blocked = array_merge(self::$PHASE_ONE_BLOCKED_PLUGINS, self::$PERMANENTLY_BLOCKED_PLUGINS);
        $result = [];
        foreach ($blocked as $plugin) {
            if (self::IsPluginBlocked($plugin)) {
                $result[] = $plugin;
            }
        }
        return $result;
    }

    public static function GetPhaseOneAllowedPlugins()
    {
        return self::$PHASE_ONE_ALLOWED_PLUGINS;
    }

    public static function GetPhaseOneBlockedPlugins()
    {
        return self::$PHASE_ONE_BLOCKED_PLUGINS;
    }

    public static function GetPermanentlyBlockedPlugins()
    {
        return self::$PERMANENTLY_BLOCKED_PLUGINS;
    }

    public static function GetFeatureFlagPluginMap()
    {
        return self::$FEATURE_FLAG_PLUGIN_MAP;
    }

    public static function GetQualificationRequiredMap()
    {
        return self::$QUALIFICATION_REQUIRED_MAP;
    }

    public static function IsFeatureEnabledForPlugin($pluginsname)
    {
        $name = strtolower(trim($pluginsname));
        foreach (self::$FEATURE_FLAG_PLUGIN_MAP as $flag_key => $plugin_names) {
            $plugin_names = is_array($plugin_names) ? $plugin_names : [$plugin_names];
            if (in_array($name, $plugin_names)) {
                return intval(MyC($flag_key, 0)) === 1;
            }
        }
        return true;
    }

    public static function IsQualificationMetForPlugin($pluginsname)
    {
        $name = strtolower(trim($pluginsname));
        if (!isset(self::$QUALIFICATION_REQUIRED_MAP[$name])) {
            return true;
        }
        $required = self::$QUALIFICATION_REQUIRED_MAP[$name];
        foreach ($required as $qual_key) {
            if (self::GetQualificationValue($qual_key) !== 1) {
                return false;
            }
        }
        return true;
    }

    public static function GetAllFeatureFlags()
    {
        $result = [];
        $all_keys = array_keys(self::$FEATURE_FLAG_PLUGIN_MAP);
        $phase_one_keys = [
            'feature_activity_enabled',
            'feature_invite_enabled',
            'feature_content_enabled',
            'feature_feedback_enabled',
            'feature_coupon_enabled',
            'feature_signin_enabled',
            'feature_points_enabled',
        ];
        $v2_keys = [
            'feature_coupon_v2_enabled',
            'feature_points_v2_enabled',
            'feature_membership_v2_enabled',
            'feature_wallet_v2_enabled',
        ];
        $all_keys = array_merge($all_keys, $phase_one_keys, $v2_keys);
        foreach ($all_keys as $key) {
            $result[$key] = intval(MyC($key, 0));
        }
        return $result;
    }

    public static function GetComplianceStatus()
    {
        return [
            'qualifications' => self::GetAllQualifications(),
            'feature_flags' => self::GetAllFeatureFlags(),
            'blocked_plugins' => self::GetEffectiveBlockedPlugins(),
            'allowed_plugins' => self::$PHASE_ONE_ALLOWED_PLUGINS,
        ];
    }

    private static $QUALIFICATION_LABELS = [
        self::QUALIFICATION_ICP_COMMERCIAL => 'ICP经营许可证',
        self::QUALIFICATION_EDI => 'EDI许可证',
        self::QUALIFICATION_MEDICAL => '医疗机构执业许可证',
        self::QUALIFICATION_LIVE => '网络文化经营许可证',
        self::QUALIFICATION_PAYMENT => '支付牌照',
    ];

    private static $ICP_FILING_KEY = 'qualification_icp_filing';

    public static function GetQualificationLabels()
    {
        return self::$QUALIFICATION_LABELS;
    }

    public static function GetIcpFilingStatus()
    {
        return intval(MyC(self::$ICP_FILING_KEY, 0));
    }

    public static function SetIcpFilingStatus($value)
    {
        return MyC(self::$ICP_FILING_KEY, intval($value), true);
    }

    public static function GetQualificationDetailList()
    {
        $result = [];
        foreach (self::$QUALIFICATION_DEFAULTS as $key => $default) {
            $result[] = [
                'key'    => $key,
                'label'  => isset(self::$QUALIFICATION_LABELS[$key]) ? self::$QUALIFICATION_LABELS[$key] : $key,
                'value'  => self::GetQualificationValue($key),
                'status' => self::GetQualificationValue($key) === 1 ? '已取得' : '未取得',
            ];
        }
        $result[] = [
            'key'    => self::$ICP_FILING_KEY,
            'label'  => 'ICP备案',
            'value'  => self::GetIcpFilingStatus(),
            'status' => self::GetIcpFilingStatus() === 1 ? '已备案' : '备案中',
        ];
        return $result;
    }

    public static function GetFeatureSwitchDetailList()
    {
        $feature_list = \app\admin\controller\Featureswitch::GetFeatureList();
        $result = [];
        foreach ($feature_list as $group) {
            $group_name = $group['group_name'];
            foreach ($group['items'] as $item) {
                $key = $item['key'];
                $current_value = intval(MyC($key, 0));
                $is_high_risk = self::IsHighRiskFeatureKey($key);
                $qualification_allowed = true;
                $qualification_reason = '';
                $phase_one_allowed = self::IsPhaseOneFeatureKey($key);

                if ($is_high_risk) {
                    $plugin_name = self::GetPluginNameByFeatureKey($key);
                    if (!empty($plugin_name)) {
                        $qualification_allowed = self::IsQualificationMetForPlugin($plugin_name);
                        if (!$qualification_allowed) {
                            $missing = self::GetMissingQualifications($plugin_name);
                            $qualification_reason = '缺少资质：' . implode('、', $missing);
                        }
                    }
                }

                $can_toggle = $phase_one_allowed || $qualification_allowed;

                $result[] = [
                    'key'                   => $key,
                    'name'                  => $item['name'],
                    'desc'                  => $item['desc'],
                    'group'                 => $group_name,
                    'current_value'         => $current_value,
                    'is_high_risk'          => $is_high_risk,
                    'phase_one_allowed'     => $phase_one_allowed,
                    'qualification_allowed' => $qualification_allowed,
                    'qualification_reason'  => $qualification_reason,
                    'can_toggle'            => $can_toggle,
                    'block_reason'          => (!$can_toggle && $current_value === 1) ? $qualification_reason : '',
                ];
            }
        }
        return $result;
    }

    public static function IsHighRiskFeatureKey($key)
    {
        return isset(self::$FEATURE_FLAG_PLUGIN_MAP[$key]);
    }

    public static function IsPhaseOneFeatureKey($key)
    {
        $phase_one_keys = [
            'feature_activity_enabled',
            'feature_invite_enabled',
            'feature_content_enabled',
            'feature_feedback_enabled',
        ];
        return in_array($key, $phase_one_keys);
    }

    public static function GetPluginNameByFeatureKey($key)
    {
        if (!isset(self::$FEATURE_FLAG_PLUGIN_MAP[$key])) {
            return '';
        }
        $val = self::$FEATURE_FLAG_PLUGIN_MAP[$key];
        return is_array($val) ? $val[0] : $val;
    }

    public static function GetMissingQualifications($plugin_name)
    {
        $name = strtolower(trim($plugin_name));
        if (!isset(self::$QUALIFICATION_REQUIRED_MAP[$name])) {
            return [];
        }
        $missing = [];
        $required = self::$QUALIFICATION_REQUIRED_MAP[$name];
        foreach ($required as $qual_key) {
            if (self::GetQualificationValue($qual_key) !== 1) {
                $missing[] = isset(self::$QUALIFICATION_LABELS[$qual_key]) ? self::$QUALIFICATION_LABELS[$qual_key] : $qual_key;
            }
        }
        return $missing;
    }

    public static function TryToggleFeature($key, $value, $admin = [])
    {
        $value = intval($value);
        $current = intval(MyC($key, 0));

        if ($value === 0) {
            return DataReturn('关闭成功', 0, ['key' => $key, 'value' => 0]);
        }

        $is_high_risk = self::IsHighRiskFeatureKey($key);
        $phase_one_allowed = self::IsPhaseOneFeatureKey($key);

        if ($phase_one_allowed) {
            return DataReturn('开启成功', 0, ['key' => $key, 'value' => 1]);
        }

        if ($is_high_risk) {
            $plugin_name = self::GetPluginNameByFeatureKey($key);
            if (!empty($plugin_name)) {
                $qualification_allowed = self::IsQualificationMetForPlugin($plugin_name);
                if (!$qualification_allowed) {
                    $missing = self::GetMissingQualifications($plugin_name);
                    $reason = '当前资质不允许开启此功能，缺少：' . implode('、', $missing);
                    self::LogComplianceBlock($admin, $key, $reason);
                    return DataReturn($reason, -403);
                }
            }
            self::LogComplianceToggle($admin, $key);
            return DataReturn('开启成功', 0, ['key' => $key, 'value' => 1]);
        }

        return DataReturn('开启成功', 0, ['key' => $key, 'value' => 1]);
    }

    public static function LogComplianceBlock($admin, $feature_key, $reason)
    {
        $admin_id = 0;
        $admin_username = '';
        if (!empty($admin) && !empty($admin['id'])) {
            $admin_id = intval($admin['id']);
            $admin_username = isset($admin['username']) ? $admin['username'] : '';
        }
        $ip = !empty($_SERVER['REMOTE_ADDR']) ? $_SERVER['REMOTE_ADDR'] : '';
        $controller = '';
        $action = '';
        try {
            $controller = request()->controller();
            $action = request()->action();
        } catch (\Exception $e) {}

        try {
            \think\facade\Db::name('MuyingComplianceLog')->insert([
                'admin_id'       => $admin_id,
                'admin_username' => $admin_username,
                'feature_key'    => $feature_key,
                'action'         => 'toggle_blocked',
                'reason'         => $reason,
                'controller'     => $controller,
                'api_action'     => $action,
                'ip'             => $ip,
                'add_time'       => time(),
            ]);
        } catch (\Exception $e) {
        }
    }

    public static function LogComplianceToggle($admin, $feature_key)
    {
        $admin_id = 0;
        $admin_username = '';
        if (!empty($admin) && !empty($admin['id'])) {
            $admin_id = intval($admin['id']);
            $admin_username = isset($admin['username']) ? $admin['username'] : '';
        }
        $ip = !empty($_SERVER['REMOTE_ADDR']) ? $_SERVER['REMOTE_ADDR'] : '';
        $controller = '';
        $action = '';
        try {
            $controller = request()->controller();
            $action = request()->action();
        } catch (\Exception $e) {}

        try {
            \think\facade\Db::name('MuyingComplianceLog')->insert([
                'admin_id'       => $admin_id,
                'admin_username' => $admin_username,
                'feature_key'    => $feature_key,
                'action'         => 'toggle_allowed',
                'reason'         => '资质已满足，允许开启',
                'controller'     => $controller,
                'api_action'     => $action,
                'ip'             => $ip,
                'add_time'       => time(),
            ]);
        } catch (\Exception $e) {
        }
    }

    public static function GetComplianceBlockLogList($params = [])
    {
        $m = isset($params['m']) ? intval($params['m']) : 0;
        $n = isset($params['n']) ? intval($params['n']) : 20;
        try {
            $data = \think\facade\Db::name('MuyingComplianceLog')
                ->order('id desc')
                ->limit($m, $n)
                ->select()
                ->toArray();
            foreach ($data as $k => &$v) {
                $v['add_time_text'] = empty($v['add_time']) ? '' : date('Y-m-d H:i:s', $v['add_time']);
            }
            return $data;
        } catch (\Exception $e) {
            return [];
        }
    }

    public static function GetComplianceBlockLogCount()
    {
        try {
            return (int) \think\facade\Db::name('MuyingComplianceLog')->count();
        } catch (\Exception $e) {
            return 0;
        }
    }

    public static function GetDashboardSummary()
    {
        $qualifications = self::GetQualificationDetailList();
        $feature_details = self::GetFeatureSwitchDetailList();
        $high_risk_count = 0;
        $high_risk_locked = 0;
        $phase_one_count = 0;
        $phase_one_enabled = 0;
        foreach ($feature_details as $item) {
            if ($item['is_high_risk']) {
                $high_risk_count++;
                if (!$item['qualification_allowed']) {
                    $high_risk_locked++;
                }
            }
            if ($item['phase_one_allowed']) {
                $phase_one_count++;
                if ($item['current_value'] === 1) {
                    $phase_one_enabled++;
                }
            }
        }

        $block_log_count = self::GetComplianceBlockLogCount();
        $recent_blocks = self::GetComplianceBlockLogList(['m' => 0, 'n' => 5]);

        $pending_feedback = 0;
        try {
            $pending_feedback = (int) \think\facade\Db::name('MuyingFeedback')->where(['review_status' => 'pending', 'is_enable' => 1])->count();
        } catch (\Exception $e) {
        }

        $export_log_count = 0;
        try {
            $export_log_count = (int) \think\facade\Db::name('MuyingAuditLog')->count();
        } catch (\Exception $e) {
        }

        return [
            'phase_mode'         => '一期合规模式',
            'qualifications'     => $qualifications,
            'high_risk_count'    => $high_risk_count,
            'high_risk_locked'   => $high_risk_locked,
            'phase_one_count'    => $phase_one_count,
            'phase_one_enabled'  => $phase_one_enabled,
            'block_log_count'    => $block_log_count,
            'recent_blocks'      => $recent_blocks,
            'pending_feedback'   => $pending_feedback,
            'export_log_count'   => $export_log_count,
        ];
    }
}
