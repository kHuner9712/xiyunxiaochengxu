// [MUYING-二开] 母婴阶段枚举 - 前端唯一权威定义
// 后端对应文件：shopxo-backend/app/extend/muying/MuyingStage.php
// 修改枚举时前后端必须同步

var STAGE_LEGACY_MAP = {
    'pregnant': 'pregnancy',
    'newborn': 'postpartum',
    'infant': 'postpartum',
};

var CATEGORY_LEGACY_MAP = {
    'maternity': 'classroom',
    'parenting': 'lecture',
    'early_edu': 'lecture',
    'activity': 'holiday',
    'other': 'classroom',
    'class': 'classroom',
};

export const MuyingStage = {
    PREPARE: 'prepare',
    PREGNANCY: 'pregnancy',
    POSTPARTUM: 'postpartum',
    ALL: 'all',

    getList() {
        return [
            { value: this.PREPARE, name: '备孕' },
            { value: this.PREGNANCY, name: '孕期' },
            { value: this.POSTPARTUM, name: '产后' },
            { value: this.ALL, name: '通用' },
        ];
    },

    getName(value) {
        var item = this.getList().find(function(v) { return v.value === value; });
        return item ? item.name : '';
    },

    isValid(value) {
        return [this.PREPARE, this.PREGNANCY, this.POSTPARTUM, this.ALL].indexOf(value) !== -1;
    },

    normalize(value) {
        if (!value) return '';
        if (STAGE_LEGACY_MAP[value]) return STAGE_LEGACY_MAP[value];
        return this.isValid(value) ? value : '';
    },

    getStageClass(value) {
        var map = {};
        map[this.PREPARE] = 'muying-stage-tag--prepare';
        map[this.PREGNANCY] = 'muying-stage-tag--pregnancy';
        map[this.POSTPARTUM] = 'muying-stage-tag--postpartum';
        map[this.ALL] = 'muying-stage-tag--common';
        return map[value] || 'muying-stage-tag--common';
    },

    getFilterTabs() {
        return [{ name: '全部', value: '' }].concat(this.getList().filter(function(v) { return v.value !== 'all'; }));
    },
};

export const MuyingActivityCategory = {
    CLASSROOM: 'classroom',
    SALON: 'salon',
    LECTURE: 'lecture',
    TRIAL: 'trial',
    HOLIDAY: 'holiday',
    CHECKIN: 'checkin',

    getList() {
        return [
            { value: this.CLASSROOM, name: '孕妈课堂' },
            { value: this.SALON, name: '线下沙龙' },
            { value: this.LECTURE, name: '育儿讲座' },
            { value: this.TRIAL, name: '试用官招募' },
            { value: this.HOLIDAY, name: '节日活动' },
            { value: this.CHECKIN, name: '签到打卡' },
        ];
    },

    getName(value) {
        var item = this.getList().find(function(v) { return v.value === value; });
        return item ? item.name : '';
    },

    isValid(value) {
        return this.getList().some(function(v) { return v.value === value; });
    },

    normalize(value) {
        if (!value) return '';
        if (CATEGORY_LEGACY_MAP[value]) return CATEGORY_LEGACY_MAP[value];
        return this.isValid(value) ? value : '';
    },

    getFilterTabs() {
        return [{ name: '全部', value: '' }].concat(this.getList());
    },
};

export const MuyingSignupStatus = {
    PENDING: 0,
    CONFIRMED: 1,
    CANCELLED: 2,

    getList() {
        return [
            { id: this.PENDING, name: '待确认' },
            { id: this.CONFIRMED, name: '已确认' },
            { id: this.CANCELLED, name: '已取消' },
        ];
    },

    getName(status) {
        var item = this.getList().find(function(v) { return v.id === status; });
        return item ? item.name : '';
    },
};

export const MuyingCheckinStatus = {
    NOT_CHECKED: 0,
    CHECKED: 1,

    getList() {
        return [
            { id: this.NOT_CHECKED, name: '未签到' },
            { id: this.CHECKED, name: '已签到' },
        ];
    },

    getName(status) {
        var item = this.getList().find(function(v) { return v.id === status; });
        return item ? item.name : '未签到';
    },
};
