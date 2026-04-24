<?php
namespace app\admin\controller;

use app\admin\controller\Base;
use app\service\ApiService;
use app\service\ConfigService;
use app\service\MuyingComplianceService;

class Featureswitch extends Base
{
    public function Index()
    {
        $assign = [
            'feature_list' => self::GetFeatureList(),
        ];
        MyViewAssign($assign);
        return MyView();
    }

    public function Save()
    {
        $params = $this->data_request;
        $feature_list = self::GetFeatureList();

        $field_list = [];
        foreach ($feature_list as $group) {
            foreach ($group['items'] as $item) {
                $field_list[] = $item['key'];
            }
        }

        $save_params = [];
        $blocked_keys = [];
        foreach ($field_list as $field) {
            $value = isset($params[$field]) ? intval($params[$field]) : 0;
            if ($value === 1) {
                $ret = MuyingComplianceService::TryToggleFeature($field, 1, $this->admin);
                if ($ret['code'] != 0) {
                    $blocked_keys[] = ['key' => $field, 'reason' => $ret['msg']];
                    continue;
                }
            }
            $save_params[$field] = $value;
        }

        if (!empty($blocked_keys)) {
            $reasons = [];
            foreach ($blocked_keys as $bk) {
                $reasons[] = $bk['key'] . ': ' . $bk['reason'];
            }
            if (empty($save_params)) {
                return ApiService::ApiDataReturn(DataReturn('所有开启操作被合规拦截：' . implode('；', $reasons), -10001));
            }
        }

        $result = ConfigService::ConfigSave($save_params);
        if ($result) {
            $msg = '保存成功';
            if (!empty($blocked_keys)) {
                $msg .= '（部分功能被合规拦截：' . implode('；', array_column($blocked_keys, 'reason')) . '）';
            }
            return ApiService::ApiDataReturn(DataReturn($msg, 0));
        }
        return ApiService::ApiDataReturn(DataReturn('保存失败', -1));
    }

    public static function GetFeatureList()
    {
        return [
            [
                'group_name' => '平台型功能（一期不开放）',
                'items' => [
                    ['key' => 'feature_shop_enabled', 'name' => '多商户/商家入驻', 'desc' => '控制多商户、商家入驻、店铺中心功能是否开放'],
                    ['key' => 'feature_realstore_enabled', 'name' => '多门店', 'desc' => '控制多门店功能是否开放'],
                    ['key' => 'feature_distribution_enabled', 'name' => '分销', 'desc' => '控制分销/多级分佣功能是否开放'],
                    ['key' => 'feature_wallet_enabled', 'name' => '钱包/余额', 'desc' => '控制钱包、余额、充值、提现功能是否开放'],
                    ['key' => 'feature_coin_enabled', 'name' => '积分商城/虚拟币', 'desc' => '控制积分商城、虚拟币兑换功能是否开放'],
                    ['key' => 'feature_ugc_enabled', 'name' => '问答/博客/社区', 'desc' => '控制用户生成内容（问答、博客、发帖）功能是否开放'],
                    ['key' => 'feature_membership_enabled', 'name' => '会员高级付费', 'desc' => '控制会员等级VIP付费功能是否开放'],
                ],
            ],
            [
                'group_name' => '营销功能（一期不开放）',
                'items' => [
                    ['key' => 'feature_seckill_enabled', 'name' => '限时秒杀', 'desc' => '控制限时秒杀功能是否开放'],
                    ['key' => 'feature_coupon_enabled', 'name' => '优惠券中心', 'desc' => '控制优惠券领取/使用功能是否开放'],
                    ['key' => 'feature_signin_enabled', 'name' => '签到打卡', 'desc' => '控制签到打卡功能是否开放'],
                    ['key' => 'feature_points_enabled', 'name' => '积分兑换', 'desc' => '控制积分兑换功能是否开放'],
                    ['key' => 'feature_giftcard_enabled', 'name' => '礼品卡', 'desc' => '控制礼品卡功能是否开放'],
                    ['key' => 'feature_givegift_enabled', 'name' => '送礼', 'desc' => '控制送礼功能是否开放'],
                ],
            ],
            [
                'group_name' => '内容与工具（一期不开放）',
                'items' => [
                    ['key' => 'feature_video_enabled', 'name' => '视频模块', 'desc' => '控制视频内容功能是否开放'],
                    ['key' => 'feature_live_enabled', 'name' => '微信直播', 'desc' => '控制微信直播功能是否开放'],
                    ['key' => 'feature_intellectstools_enabled', 'name' => '智能工具', 'desc' => '控制智能工具功能是否开放'],
                ],
            ],
            [
                'group_name' => '资质相关功能（一期不开放）',
                'items' => [
                    ['key' => 'feature_hospital_enabled', 'name' => '互联网医院', 'desc' => '控制互联网医院功能是否开放（需医疗资质）'],
                    ['key' => 'feature_invoice_enabled', 'name' => '发票', 'desc' => '控制发票功能是否开放'],
                    ['key' => 'feature_certificate_enabled', 'name' => '实名认证', 'desc' => '控制实名认证功能是否开放'],
                    ['key' => 'feature_scanpay_enabled', 'name' => '扫码支付', 'desc' => '控制扫码支付功能是否开放'],
                    ['key' => 'feature_complaint_enabled', 'name' => '投诉', 'desc' => '控制投诉功能是否开放'],
                ],
            ],
            [
                'group_name' => '一期核心功能（默认开启）',
                'items' => [
                    ['key' => 'feature_activity_enabled', 'name' => '活动报名', 'desc' => '控制活动报名功能是否开放'],
                    ['key' => 'feature_invite_enabled', 'name' => '邀请裂变', 'desc' => '控制邀请裂变功能是否开放'],
                    ['key' => 'feature_content_enabled', 'name' => '官方内容', 'desc' => '控制文章/资讯等官方内容功能是否开放'],
                    ['key' => 'feature_feedback_enabled', 'name' => '用户反馈', 'desc' => '控制用户反馈/妈妈说功能是否开放'],
                ],
            ],
            [
                'group_name' => '二期扩展功能（默认关闭，按需开启）',
                'items' => [
                    ['key' => 'feature_coupon_v2_enabled', 'name' => '优惠券二期', 'desc' => '控制优惠券领取/使用功能是否开放（二期扩展）'],
                    ['key' => 'feature_points_v2_enabled', 'name' => '积分体系二期', 'desc' => '控制积分兑换/积分商城功能是否开放（二期扩展）'],
                    ['key' => 'feature_membership_v2_enabled', 'name' => '会员等级二期', 'desc' => '控制会员等级/付费VIP功能是否开放（二期扩展）'],
                    ['key' => 'feature_wallet_v2_enabled', 'name' => '钱包余额二期', 'desc' => '控制钱包/余额/充值/提现功能是否开放（二期扩展）'],
                ],
            ],
        ];
    }
}
