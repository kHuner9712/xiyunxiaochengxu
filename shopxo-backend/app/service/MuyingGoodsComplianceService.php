<?php
namespace app\service;

use app\extend\muying\MuyingStage;

class MuyingGoodsComplianceService
{
    const RISK_NORMAL = 'normal';
    const RISK_FOOD = 'food';
    const RISK_SPECIAL_FOOD = 'special_food';
    const RISK_MEDICAL_DEVICE = 'medical_device';
    const RISK_MEDICINE = 'medicine';
    const RISK_SERVICE = 'service';

    const QUAL_NONE_REQUIRED = 'none_required';
    const QUAL_PENDING = 'pending';
    const QUAL_APPROVED = 'approved';
    const QUAL_REJECTED = 'rejected';
    const QUAL_FORBIDDEN = 'forbidden';

    private static $RISK_LIST = [
        ['value' => 'normal', 'name' => '普通母婴用品', 'desc' => '无特殊资质要求，可上架'],
        ['value' => 'food', 'name' => '普通食品', 'desc' => '需后台确认资质approved才能上架'],
        ['value' => 'special_food', 'name' => '特殊食品（婴幼儿配方奶粉、保健食品）', 'desc' => '一期默认forbidden，不允许上架'],
        ['value' => 'medical_device', 'name' => '医疗器械', 'desc' => '一期默认forbidden，不允许上架'],
        ['value' => 'medicine', 'name' => '药品', 'desc' => '一期禁止，不允许上架'],
        ['value' => 'service', 'name' => '服务类', 'desc' => '涉及医疗/产康/问诊一期禁止；普通线下活动应走Activity'],
    ];

    private static $QUAL_STATUS_LIST = [
        ['value' => 'none_required', 'name' => '无需资质'],
        ['value' => 'pending', 'name' => '资质审核中'],
        ['value' => 'approved', 'name' => '资质已通过'],
        ['value' => 'rejected', 'name' => '资质未通过'],
        ['value' => 'forbidden', 'name' => '禁止上架'],
    ];

    private static $FOCUS_AREA_LIST = [
        ['value' => 'nutrition', 'name' => '营养喂养'],
        ['value' => 'care', 'name' => '日常护理'],
        ['value' => 'safety', 'name' => '安全防护'],
        ['value' => 'education', 'name' => '早教启蒙'],
        ['value' => 'comfort', 'name' => '舒适睡眠'],
        ['value' => 'recovery', 'name' => '产后恢复'],
        ['value' => 'beauty', 'name' => '孕期美护'],
    ];

    public static function GetRiskList()
    {
        return self::$RISK_LIST;
    }

    public static function GetRiskName($value)
    {
        foreach (self::$RISK_LIST as $item) {
            if ($item['value'] === $value) return $item['name'];
        }
        return '';
    }

    public static function GetQualStatusList()
    {
        return self::$QUAL_STATUS_LIST;
    }

    public static function GetQualStatusName($value)
    {
        foreach (self::$QUAL_STATUS_LIST as $item) {
            if ($item['value'] === $value) return $item['name'];
        }
        return '';
    }

    public static function GetFocusAreaList()
    {
        return self::$FOCUS_AREA_LIST;
    }

    public static function GetFocusAreaNames($focus_areas_str)
    {
        if (empty($focus_areas_str)) return [];
        $values = array_filter(array_map('trim', explode(',', $focus_areas_str)));
        $result = [];
        foreach ($values as $v) {
            foreach (self::$FOCUS_AREA_LIST as $item) {
                if ($item['value'] === $v) {
                    $result[] = $item['name'];
                    break;
                }
            }
        }
        return $result;
    }

    public static function CanShelves($risk_category, $qualification_status)
    {
        $risk = strtolower(trim($risk_category));
        $qual = strtolower(trim($qualification_status));

        if ($risk === self::RISK_NORMAL) {
            return true;
        }

        if ($risk === self::RISK_FOOD) {
            return $qual === self::QUAL_APPROVED;
        }

        if (in_array($risk, [self::RISK_SPECIAL_FOOD, self::RISK_MEDICAL_DEVICE, self::RISK_MEDICINE])) {
            return false;
        }

        if ($risk === self::RISK_SERVICE) {
            return $qual === self::QUAL_APPROVED;
        }

        return true;
    }

    public static function GetShelvesBlockReason($risk_category, $qualification_status)
    {
        if (self::CanShelves($risk_category, $qualification_status)) {
            return '';
        }
        $risk = strtolower(trim($risk_category));
        $risk_name = self::GetRiskName($risk);
        if (in_array($risk, [self::RISK_SPECIAL_FOOD, self::RISK_MEDICAL_DEVICE, self::RISK_MEDICINE])) {
            return $risk_name . '：一期不允许上架';
        }
        if ($risk === self::RISK_FOOD) {
            return $risk_name . '：需要资质审核通过后才能上架';
        }
        if ($risk === self::RISK_SERVICE) {
            return $risk_name . '：需要资质审核通过后才能上架';
        }
        return '当前资质状态不允许上架';
    }

    public static function ValidateGoodsSave($params)
    {
        $risk_category = isset($params['risk_category']) ? strtolower(trim($params['risk_category'])) : self::RISK_NORMAL;
        $qualification_status = isset($params['qualification_status']) ? strtolower(trim($params['qualification_status'])) : self::QUAL_NONE_REQUIRED;
        $is_shelves = isset($params['is_shelves']) ? intval($params['is_shelves']) : 1;

        if (!in_array($risk_category, [self::RISK_NORMAL, self::RISK_FOOD, self::RISK_SPECIAL_FOOD, self::RISK_MEDICAL_DEVICE, self::RISK_MEDICINE, self::RISK_SERVICE])) {
            return DataReturn('无效的风险类目：' . $risk_category, -1);
        }

        if (!in_array($qualification_status, [self::QUAL_NONE_REQUIRED, self::QUAL_PENDING, self::QUAL_APPROVED, self::QUAL_REJECTED, self::QUAL_FORBIDDEN])) {
            return DataReturn('无效的资质状态：' . $qualification_status, -1);
        }

        if ($is_shelves === 1 && !self::CanShelves($risk_category, $qualification_status)) {
            $reason = self::GetShelvesBlockReason($risk_category, $qualification_status);
            return DataReturn($reason, -1);
        }

        if ($risk_category === self::RISK_SERVICE) {
            $title = isset($params['title']) ? trim($params['title']) : '';
            $medical_keywords = ['医疗', '问诊', '医生', '产康', '产后修复', '体检', '诊断', '治疗', '处方'];
            foreach ($medical_keywords as $kw) {
                if (mb_strpos($title, $kw) !== false) {
                    return DataReturn('服务类商品标题包含医疗相关关键词"' . $kw . '"，一期不允许上架', -1);
                }
            }
        }

        return DataReturn('校验通过', 0);
    }

    public static function GoodsDataHandleExtend(&$v)
    {
        if (empty($v)) return;

        if (isset($v['risk_category'])) {
            $v['risk_category_name'] = self::GetRiskName($v['risk_category']);
        } else {
            $v['risk_category'] = self::RISK_NORMAL;
            $v['risk_category_name'] = '普通母婴用品';
        }

        if (isset($v['qualification_status'])) {
            $v['qualification_status_name'] = self::GetQualStatusName($v['qualification_status']);
        } else {
            $v['qualification_status'] = self::QUAL_NONE_REQUIRED;
            $v['qualification_status_name'] = '无需资质';
        }

        if (isset($v['focus_areas'])) {
            $v['focus_area_names'] = self::GetFocusAreaNames($v['focus_areas']);
        } else {
            $v['focus_area_names'] = [];
        }

        $v['can_shelves'] = self::CanShelves(
            isset($v['risk_category']) ? $v['risk_category'] : self::RISK_NORMAL,
            isset($v['qualification_status']) ? $v['qualification_status'] : self::QUAL_NONE_REQUIRED
        );

        if (isset($v['min_baby_month_age'])) {
            $v['min_baby_month_age'] = intval($v['min_baby_month_age']);
        }
        if (isset($v['max_baby_month_age'])) {
            $v['max_baby_month_age'] = intval($v['max_baby_month_age']);
        }

        if (!empty($v['min_baby_month_age']) || !empty($v['max_baby_month_age'])) {
            $min = intval($v['min_baby_month_age']);
            $max = intval($v['max_baby_month_age']);
            if ($min > 0 && $max > 0) {
                $v['month_age_text'] = $min . '-' . $max . '个月';
            } elseif ($min > 0) {
                $v['month_age_text'] = $min . '个月以上';
            } elseif ($max > 0) {
                $v['month_age_text'] = $max . '个月以内';
            } else {
                $v['month_age_text'] = '';
            }
        } else {
            $v['month_age_text'] = '';
        }
    }
}
