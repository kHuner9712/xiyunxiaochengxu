<?php
namespace app\admin\controller;

use app\admin\controller\Base;
use app\service\MuyingStatService;

class Muyingstat extends Base
{
    public function Index()
    {
        $assign = [
            'registration_conversion_rate'   => MuyingStatService::RegistrationConversionRate(),
            'stage_profile_completion_rate'  => MuyingStatService::StageProfileCompletionRate(),
            'activity_signup_conversion_rate' => MuyingStatService::ActivitySignupConversionRate(),
            'product_payment_conversion_rate' => MuyingStatService::ProductPaymentConversionRate(),
            'repurchase_rate'                => MuyingStatService::RepurchaseRate(),
            'invite_referral_rate'           => MuyingStatService::InviteReferralRate(),
        ];
        MyViewAssign($assign);
        return MyView();
    }
}
