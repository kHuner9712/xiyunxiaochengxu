export var FeatureFlagKey = {
    SHOP: 'feature_shop_enabled',
    REALSTORE: 'feature_realstore_enabled',
    DISTRIBUTION: 'feature_distribution_enabled',
    WALLET: 'feature_wallet_enabled',
    COIN: 'feature_coin_enabled',
    UGC: 'feature_ugc_enabled',
    MEMBERSHIP: 'feature_membership_enabled',
    SECKILL: 'feature_seckill_enabled',
    COUPON: 'feature_coupon_enabled',
    SIGNIN: 'feature_signin_enabled',
    POINTS: 'feature_points_enabled',
    GIFTCARD: 'feature_giftcard_enabled',
    GIVEGIFT: 'feature_givegift_enabled',
    VIDEO: 'feature_video_enabled',
    LIVE: 'feature_live_enabled',
    INTELLECTSTOOLS: 'feature_intellectstools_enabled',
    HOSPITAL: 'feature_hospital_enabled',
    INVOICE: 'feature_invoice_enabled',
    CERTIFICATE: 'feature_certificate_enabled',
    SCANPAY: 'feature_scanpay_enabled',
    COMPLAINT: 'feature_complaint_enabled',
    ACTIVITY: 'feature_activity_enabled',
    INVITE: 'feature_invite_enabled',
    CONTENT: 'feature_content_enabled',
    FEEDBACK: 'feature_feedback_enabled',
    COUPON_V2: 'feature_coupon_v2_enabled',
    POINTS_V2: 'feature_points_v2_enabled',
    MEMBERSHIP_V2: 'feature_membership_v2_enabled',
    WALLET_V2: 'feature_wallet_v2_enabled',
    PAYMENT: 'feature_payment_enabled',
};

export var QualificationKey = {
    ICP_COMMERCIAL: 'qualification_icp_commercial',
    EDI: 'qualification_edi',
    MEDICAL: 'qualification_medical',
    LIVE: 'qualification_live',
    PAYMENT: 'qualification_payment',
};

export var ActivityStatus = {
    DRAFT: 0,
    PUBLISHED: 1,
    ENDED: 2,
    CANCELLED: 3,

    getList() {
        return [
            { id: this.DRAFT, name: '草稿' },
            { id: this.PUBLISHED, name: '已发布' },
            { id: this.ENDED, name: '已结束' },
            { id: this.CANCELLED, name: '已取消' },
        ];
    },

    getName(status) {
        var item = this.getList().find(function (v) {
            return v.id === status;
        });
        return item ? item.name : '';
    },
};

export var RoutePath = {
    HOME: '/pages/index/index',
    CATEGORY: '/pages/goods-category/goods-category',
    ACTIVITY: '/pages/activity/activity',
    CART: '/pages/cart/cart',
    USER: '/pages/user/user',
    LOGIN: '/pages/login/login',
    PERSONAL: '/pages/personal/personal',
    ACTIVITY_DETAIL: '/pages/activity-detail/activity-detail',
    ACTIVITY_SIGNUP: '/pages/activity-signup/activity-signup',
    MY_ACTIVITY: '/pages/my-activity/my-activity',
    INVITE: '/pages/invite/invite',
    MY_INVITE: '/pages/my-invite/my-invite',
    LOGOUT: '/pages/logout/logout',
    ERROR: '/pages/error/error',
};

export var TipMessage = {
    NETWORK_ERROR: '网络异常，请稍后重试',
    LOGIN_EXPIRED: '登录已过期，请重新登录',
    SAVE_SUCCESS: '保存成功',
    SAVE_FAIL: '保存失败，请稍后重试',
    SIGNUP_SUCCESS: '报名成功',
    SIGNUP_FAIL: '报名失败，请重试',
    FEATURE_DISABLED: '该功能暂未开放',
    QUALIFICATION_BLOCKED: '当前资质暂不支持该功能',
    FORM_NICKNAME_REQUIRED: '请输入昵称',
    FORM_DUE_DATE_REQUIRED: '孕期请选择预产期',
    FORM_BABY_BIRTHDAY_REQUIRED: '产后请选择宝宝生日',
    FORM_PHONE_REQUIRED: '请输入手机号',
    FORM_NAME_REQUIRED: '请输入姓名',
    PRIVACY_NOT_AGREED: '请先同意隐私协议',
};
