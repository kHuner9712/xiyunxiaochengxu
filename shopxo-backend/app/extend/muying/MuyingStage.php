<?php
namespace app\extend\muying;

// [MUYING-二开] 母婴阶段枚举 - 后端唯一权威定义
// 前端对应文件：shopxo-uniapp/common/js/config/muying-enum.js
// 修改枚举时前后端必须同步

class MuyingStage
{
    const PREPARE = 'prepare';
    const PREGNANCY = 'pregnancy';
    const POSTPARTUM = 'postpartum';
    const ALL = 'all';

    private static $legacy_map = [
        'pregnant' => 'pregnancy',
        'newborn'  => 'postpartum',
        'infant'   => 'postpartum',
    ];

    public static function getList()
    {
        return [
            self::PREPARE => '备孕',
            self::PREGNANCY => '孕期',
            self::POSTPARTUM => '产后',
            self::ALL => '通用',
        ];
    }

    public static function getName($value)
    {
        $list = self::getList();
        return isset($list[$value]) ? $list[$value] : '';
    }

    public static function isValid($value)
    {
        return in_array($value, [self::PREPARE, self::PREGNANCY, self::POSTPARTUM, self::ALL]);
    }

    public static function Normalize($value)
    {
        if (empty($value)) {
            return '';
        }
        if (isset(self::$legacy_map[$value])) {
            return self::$legacy_map[$value];
        }
        return self::isValid($value) ? $value : '';
    }

    public static function getStageClass($value)
    {
        $map = [
            self::PREPARE    => 'muying-stage-tag--prepare',
            self::PREGNANCY  => 'muying-stage-tag--pregnancy',
            self::POSTPARTUM => 'muying-stage-tag--postpartum',
            self::ALL        => 'muying-stage-tag--common',
        ];
        return isset($map[$value]) ? $map[$value] : 'muying-stage-tag--common';
    }
}

class MuyingActivityCategory
{
    const CLASSROOM = 'classroom';
    const SALON = 'salon';
    const LECTURE = 'lecture';
    const TRIAL = 'trial';
    const HOLIDAY = 'holiday';
    const CHECKIN = 'checkin';

    private static $legacy_map = [
        'maternity' => 'classroom',
        'parenting' => 'lecture',
        'early_edu' => 'lecture',
        'activity'  => 'holiday',
        'other'     => 'classroom',
        'class'     => 'classroom',
    ];

    public static function getList()
    {
        return [
            self::CLASSROOM => '孕妈课堂',
            self::SALON => '线下沙龙',
            self::LECTURE => '育儿讲座',
            self::TRIAL => '试用官招募',
            self::HOLIDAY => '节日活动',
            self::CHECKIN => '签到打卡',
        ];
    }

    public static function getName($value)
    {
        $list = self::getList();
        return isset($list[$value]) ? $list[$value] : '';
    }

    public static function isValid($value)
    {
        return in_array($value, [self::CLASSROOM, self::SALON, self::LECTURE, self::TRIAL, self::HOLIDAY, self::CHECKIN]);
    }

    public static function Normalize($value)
    {
        if (empty($value)) {
            return '';
        }
        if (isset(self::$legacy_map[$value])) {
            return self::$legacy_map[$value];
        }
        return self::isValid($value) ? $value : '';
    }
}
