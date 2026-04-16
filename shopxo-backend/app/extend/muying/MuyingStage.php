<?php
namespace app\extend\muying;

class MuyingStage
{
    const PREPARE = 'prepare';
    const PREGNANCY = 'pregnancy';
    const POSTPARTUM = 'postpartum';
    const ALL = 'all';

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
}

class MuyingActivityCategory
{
    const CLASSROOM = 'classroom';
    const SALON = 'salon';
    const LECTURE = 'lecture';
    const TRIAL = 'trial';
    const HOLIDAY = 'holiday';
    const CHECKIN = 'checkin';

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
}
