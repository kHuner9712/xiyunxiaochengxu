// [MUYING-二开] 母婴阶段枚举 - 前端唯一权威定义
// 后端对应文件：shopxo-backend/app/extend/muying/MuyingStage.php
// 修改枚举时前后端必须同步

var STAGE_LEGACY_MAP = {
    'pregnant': 'pregnancy',
    'newborn': 'postpartum',
    'infant': 'postpartum',
};

var CATEGORY_LEGACY_MAP = {
    'classroom': 'pregnancy_class',
    'lecture': 'parent_child',
    'trial': 'product_trial',
    'holiday': 'member_day',
    'checkin': 'public_welfare',
    'maternity': 'pregnancy_class',
    'parenting': 'parent_child',
    'early_edu': 'parent_child',
    'activity': 'member_day',
    'other': 'pregnancy_class',
    'class': 'pregnancy_class',
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
    PREGNANCY_CLASS: 'pregnancy_class',
    PARENT_CHILD: 'parent_child',
    PRODUCT_TRIAL: 'product_trial',
    MEMBER_DAY: 'member_day',
    SALON: 'salon',
    PUBLIC_WELFARE: 'public_welfare',

    getList() {
        return [
            { value: this.PREGNANCY_CLASS, name: '孕妈课堂' },
            { value: this.PARENT_CHILD, name: '亲子活动' },
            { value: this.PRODUCT_TRIAL, name: '新品体验' },
            { value: this.MEMBER_DAY, name: '会员日' },
            { value: this.SALON, name: '线下沙龙' },
            { value: this.PUBLIC_WELFARE, name: '公益活动' },
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

export const MuyingActivityType = {
    OFFLINE: 'offline',
    ONLINE_INFO: 'online_info',

    getList() {
        return [
            { value: this.OFFLINE, name: '线下活动' },
            { value: this.ONLINE_INFO, name: '线上图文' },
        ];
    },

    getName(value) {
        var item = this.getList().find(function(v) { return v.value === value; });
        return item ? item.name : '';
    },

    isValid(value) {
        return [this.OFFLINE, this.ONLINE_INFO].indexOf(value) !== -1;
    },

    normalize(value) {
        if (!value) return this.OFFLINE;
        return this.isValid(value) ? value : this.OFFLINE;
    },
};

export const MuyingActivityStatus = {
    DRAFT: 'draft',
    PUBLISHED: 'published',
    SIGNING: 'signing',
    FULL: 'full',
    ENDED: 'ended',
    CANCELLED: 'cancelled',

    getList() {
        return [
            { value: this.DRAFT, name: '草稿' },
            { value: this.PUBLISHED, name: '已发布' },
            { value: this.SIGNING, name: '报名中' },
            { value: this.FULL, name: '已满员' },
            { value: this.ENDED, name: '已结束' },
            { value: this.CANCELLED, name: '已取消' },
        ];
    },

    getName(value) {
        var item = this.getList().find(function(v) { return v.value === value; });
        return item ? item.name : '';
    },

    isValid(value) {
        return [this.DRAFT, this.PUBLISHED, this.SIGNING, this.FULL, this.ENDED, this.CANCELLED].indexOf(value) !== -1;
    },

    normalize(value) {
        if (!value) return this.DRAFT;
        return this.isValid(value) ? value : this.DRAFT;
    },

    getStatusClass(value) {
        var map = {};
        map[this.DRAFT] = 'muying-activity-status--draft';
        map[this.PUBLISHED] = 'muying-activity-status--published';
        map[this.SIGNING] = 'muying-activity-status--signing';
        map[this.FULL] = 'muying-activity-status--full';
        map[this.ENDED] = 'muying-activity-status--ended';
        map[this.CANCELLED] = 'muying-activity-status--cancelled';
        return map[value] || 'muying-activity-status--draft';
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

export var MuyingGoodsRiskCategory = {
    NORMAL: 'normal',
    FOOD: 'food',
    SPECIAL_FOOD: 'special_food',
    MEDICAL_DEVICE: 'medical_device',
    MEDICINE: 'medicine',
    SERVICE: 'service',

    getList() {
        return [
            { value: this.NORMAL, name: '普通母婴用品', canShelves: true },
            { value: this.FOOD, name: '普通食品', canShelves: false },
            { value: this.SPECIAL_FOOD, name: '特殊食品', canShelves: false },
            { value: this.MEDICAL_DEVICE, name: '医疗器械', canShelves: false },
            { value: this.MEDICINE, name: '药品', canShelves: false },
            { value: this.SERVICE, name: '服务类', canShelves: false },
        ];
    },

    getName(value) {
        var item = this.getList().find(function(v) { return v.value === value; });
        return item ? item.name : '';
    },

    isForbidden(value) {
        return [this.SPECIAL_FOOD, this.MEDICAL_DEVICE, this.MEDICINE].indexOf(value) !== -1;
    },
};

export var MuyingGoodsQualStatus = {
    NONE_REQUIRED: 'none_required',
    PENDING: 'pending',
    APPROVED: 'approved',
    REJECTED: 'rejected',
    FORBIDDEN: 'forbidden',

    getList() {
        return [
            { value: this.NONE_REQUIRED, name: '无需资质' },
            { value: this.PENDING, name: '审核中' },
            { value: this.APPROVED, name: '已通过' },
            { value: this.REJECTED, name: '未通过' },
            { value: this.FORBIDDEN, name: '禁止上架' },
        ];
    },

    getName(value) {
        var item = this.getList().find(function(v) { return v.value === value; });
        return item ? item.name : '';
    },
};

export var MuyingFocusArea = {
    getList() {
        return [
            { value: 'nutrition', name: '营养喂养' },
            { value: 'care', name: '日常护理' },
            { value: 'safety', name: '安全防护' },
            { value: 'education', name: '早教启蒙' },
            { value: 'comfort', name: '舒适睡眠' },
            { value: 'recovery', name: '产后恢复' },
            { value: 'beauty', name: '孕期美护' },
        ];
    },

    getName(value) {
        var item = this.getList().find(function(v) { return v.value === value; });
        return item ? item.name : '';
    },

    getNames(focusAreasStr) {
        if (!focusAreasStr) return [];
        var self = this;
        return focusAreasStr.split(',').filter(function(v) { return v.trim(); }).map(function(v) {
            return self.getName(v.trim());
        }).filter(function(v) { return v; });
    },
};
