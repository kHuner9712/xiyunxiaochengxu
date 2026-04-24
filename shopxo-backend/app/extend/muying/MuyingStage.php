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
    const PREGNANCY_CLASS = 'pregnancy_class';
    const PARENT_CHILD = 'parent_child';
    const PRODUCT_TRIAL = 'product_trial';
    const MEMBER_DAY = 'member_day';
    const SALON = 'salon';
    const PUBLIC_WELFARE = 'public_welfare';

    private static $legacy_map = [
        'classroom' => 'pregnancy_class',
        'lecture'   => 'parent_child',
        'trial'     => 'product_trial',
        'holiday'   => 'member_day',
        'checkin'   => 'public_welfare',
        'maternity' => 'pregnancy_class',
        'parenting' => 'parent_child',
        'early_edu' => 'parent_child',
        'activity'  => 'member_day',
        'other'     => 'pregnancy_class',
        'class'     => 'pregnancy_class',
    ];

    public static function getList()
    {
        return [
            self::PREGNANCY_CLASS => '孕妈课堂',
            self::PARENT_CHILD   => '亲子活动',
            self::PRODUCT_TRIAL  => '新品体验',
            self::MEMBER_DAY     => '会员日',
            self::SALON          => '线下沙龙',
            self::PUBLIC_WELFARE => '公益活动',
        ];
    }

    public static function getName($value)
    {
        $list = self::getList();
        return isset($list[$value]) ? $list[$value] : '';
    }

    public static function isValid($value)
    {
        return in_array($value, [self::PREGNANCY_CLASS, self::PARENT_CHILD, self::PRODUCT_TRIAL, self::MEMBER_DAY, self::SALON, self::PUBLIC_WELFARE]);
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

class MuyingActivityType
{
    const OFFLINE = 'offline';
    const ONLINE_INFO = 'online_info';

    public static function getList()
    {
        return [
            self::OFFLINE     => '线下活动',
            self::ONLINE_INFO => '线上图文',
        ];
    }

    public static function getName($value)
    {
        $list = self::getList();
        return isset($list[$value]) ? $list[$value] : '';
    }

    public static function isValid($value)
    {
        return in_array($value, [self::OFFLINE, self::ONLINE_INFO]);
    }

    public static function Normalize($value)
    {
        if (empty($value)) {
            return self::OFFLINE;
        }
        return self::isValid($value) ? $value : self::OFFLINE;
    }
}

class MuyingActivityStatus
{
    const DRAFT = 'draft';
    const PUBLISHED = 'published';
    const SIGNING = 'signing';
    const FULL = 'full';
    const ENDED = 'ended';
    const CANCELLED = 'cancelled';

    public static function getList()
    {
        return [
            self::DRAFT     => '草稿',
            self::PUBLISHED => '已发布',
            self::SIGNING   => '报名中',
            self::FULL      => '已满员',
            self::ENDED     => '已结束',
            self::CANCELLED => '已取消',
        ];
    }

    public static function getName($value)
    {
        $list = self::getList();
        return isset($list[$value]) ? $list[$value] : '';
    }

    public static function isValid($value)
    {
        return in_array($value, [self::DRAFT, self::PUBLISHED, self::SIGNING, self::FULL, self::ENDED, self::CANCELLED]);
    }

    public static function Normalize($value)
    {
        if (empty($value)) {
            return self::DRAFT;
        }
        return self::isValid($value) ? $value : self::DRAFT;
    }

    public static function getVisibleStatuses()
    {
        return [self::PUBLISHED, self::SIGNING, self::FULL, self::ENDED];
    }

    public static function getStatusClass($value)
    {
        $map = [
            self::DRAFT     => 'muying-activity-status--draft',
            self::PUBLISHED => 'muying-activity-status--published',
            self::SIGNING   => 'muying-activity-status--signing',
            self::FULL      => 'muying-activity-status--full',
            self::ENDED     => 'muying-activity-status--ended',
            self::CANCELLED => 'muying-activity-status--cancelled',
        ];
        return isset($map[$value]) ? $map[$value] : 'muying-activity-status--draft';
    }
}
