<template>
    <view :class="theme_view">
        <view v-if="data_loaded && !activity.id" class="padding-main" style="padding-top: 45%">
            <component-no-data propStatus="0" propMsg="活动不存在或已下架"></component-no-data>
        </view>
        <view v-else class="activity-detail-page">
            <!-- 自定义导航栏 -->
            <view class="nav-top pf top-0 left-0 right-0 z-i-deep" :style="'padding-top:' + status_bar_height + 'px;'">
                <view class="nav-top-content pr flex-row align-c jc-sb padding-horizontal-main" :style="'background-color:' + (scroll_value > 100 ? '#FFFFFF' : 'transparent') + ';'">
                    <view class="nav-back cp" @tap="nav_back_event">
                        <uni-icons type="back" size="22" :color="scroll_value > 100 ? '#333' : '#FFF'"></uni-icons>
                    </view>
                    <text v-if="scroll_value > 100" class="nav-title cr-base fw-b text-size-md">活动详情</text>
                    <text v-else class="nav-title" style="color: transparent">活动详情</text>
                    <view class="nav-share cp" @tap="share_event">
                        <uni-icons type="redo" size="20" :color="scroll_value > 100 ? '#333' : '#FFF'"></uni-icons>
                    </view>
                </view>
            </view>

            <!-- 封面图 -->
            <view class="cover-container oh">
                <image :src="activity.cover" mode="aspectFill" class="wh-auto cover-image"></image>
                <view class="cover-stage-tag">
                    <text :class="'muying-stage-tag ' + activity.stage_class">{{ activity.stage_name }}</text>
                </view>
                <view v-if="activity.activity_status_text" class="cover-status-tag">
                    <text :class="'muying-activity-status-badge ' + activity.activity_status_class">{{ activity.activity_status_text }}</text>
                </view>
            </view>

            <!-- 基础信息 -->
            <view class="info-container padding-horizontal-main">
                <view class="info-card muying-card padding-main">
                    <view class="activity-title-row flex-row jc-sb align-c">
                        <text class="fw-b text-size-lg cr-base flex-1">{{ activity.title }}</text>
                    </view>

                    <view class="tag-row flex-row align-c margin-top-xs" style="gap: 12rpx; flex-wrap: wrap">
                        <text :class="'muying-stage-tag ' + activity.stage_class">{{ activity.stage_name }}</text>
                        <text class="muying-category-tag">{{ activity.category_text }}</text>
                        <text class="muying-type-tag">{{ activity.activity_type_text }}</text>
                    </view>

                    <view class="info-items margin-top-main">
                        <view class="info-item flex-row align-c margin-top-sm">
                            <iconfont name="icon-time" size="28rpx" color="#F5A0B1"></iconfont>
                            <text class="cr-grey text-size-sm margin-left-sm">{{ activity.time }}</text>
                        </view>
                        <view v-if="activity.address" class="info-item flex-row align-c margin-top-sm">
                            <iconfont name="icon-location" size="28rpx" color="#F5A0B1"></iconfont>
                            <text class="cr-grey text-size-sm margin-left-sm">{{ activity.address }}</text>
                        </view>
                        <view class="info-item flex-row align-c margin-top-sm">
                            <iconfont name="icon-member" size="28rpx" color="#F5A0B1"></iconfont>
                            <text class="cr-grey text-size-sm margin-left-sm"> 已报名 {{ activity.signup_count }}{{ activity.max_count > 0 ? '/' + activity.max_count : '' }}人 </text>
                            <text v-if="activity.remain_count > 0" class="cr-main text-size-xs margin-left-sm">剩余{{ activity.remain_count }}个名额</text>
                            <text v-else-if="activity.max_count > 0 && activity.remain_count === 0" class="cr-grey-9 text-size-xs margin-left-sm">名额已满</text>
                        </view>
                        <view v-if="activity.allow_waitlist && activity.waitlist_count > 0" class="info-item flex-row align-c margin-top-sm">
                            <iconfont name="icon-member" size="28rpx" color="#e8a050"></iconfont>
                            <text class="cr-grey text-size-sm margin-left-sm"> 候补 {{ activity.waitlist_signup_count }}/{{ activity.waitlist_count }}人 </text>
                            <text v-if="activity.waitlist_remain > 0" class="text-size-xs margin-left-sm" style="color: #e8a050">还可候补{{ activity.waitlist_remain }}人</text>
                        </view>
                        <view class="info-item flex-row align-c margin-top-sm">
                            <iconfont name="icon-time" size="28rpx" color="#999"></iconfont>
                            <text class="cr-grey-9 text-size-sm margin-left-sm">报名截止 {{ activity.signup_deadline }}</text>
                        </view>
                    </view>

                    <view class="price-row flex-row jc-sb align-c margin-top-main br-t padding-top-main">
                        <view class="price-info flex-row align-c">
                            <text v-if="activity.price == 0" class="muying-badge-pink text-size">免费</text>
                            <view v-else class="flex-row align-c">
                                <text class="cr-main fw-b text-size-xl">¥{{ activity.price }}</text>
                            </view>
                        </view>
                        <view class="organizer-info text-size-xs cr-grey-9">
                            <text>{{ activity.organizer }}</text>
                            <text class="margin-left-sm">{{ activity.organizer_phone }}</text>
                        </view>
                    </view>
                </view>
            </view>

            <!-- 活动详情 -->
            <view class="detail-container padding-horizontal-main margin-top-main">
                <view class="detail-card muying-card padding-main">
                    <view class="detail-header flex-row align-c margin-bottom-main">
                        <text class="fw-b text-size cr-base">活动详情</text>
                        <view class="muying-divider flex-1 margin-left-main"></view>
                    </view>
                    <view class="detail-content">
                        <mp-html :content="activity.content" />
                    </view>
                </view>
            </view>

            <!-- 适合人群 -->
            <view v-if="activity.suitable_crowd" class="crowd-container padding-horizontal-main margin-top-main">
                <view class="crowd-card muying-card padding-main">
                    <view class="crowd-header flex-row align-c margin-bottom-main">
                        <text class="fw-b text-size cr-base">适合人群</text>
                        <view class="muying-divider flex-1 margin-left-main"></view>
                    </view>
                    <view class="crowd-content">
                        <text class="cr-grey text-size-sm" style="line-height: 1.8">{{ activity.suitable_crowd }}</text>
                    </view>
                </view>
            </view>

            <!-- 免责声明 -->
            <view class="disclaimer-container padding-horizontal-main margin-top-main margin-bottom-xxxl">
                <view class="border-radius-main bg-grey-f5 padding-main">
                    <text class="cr-grey-9 text-size-xs" style="line-height: 1.6">{{ disclaimer_text }}</text>
                </view>
            </view>

            <!-- 签到码展示（已报名且活动启用签到码） -->
            <view v-if="is_signed_up && my_signup && my_signup.signup_code && activity.signup_code_enabled" class="checkin-container padding-horizontal-main margin-top-main">
                <view class="checkin-card muying-card padding-main tc">
                    <view class="checkin-header flex-row align-c jc-c margin-bottom-sm">
                        <iconfont name="icon-check" size="28rpx" color="#4caf50"></iconfont>
                        <text class="fw-b text-size cr-base margin-left-xs">签到码</text>
                    </view>
                    <view class="checkin-code">
                        <text class="fw-b text-size-xxxl cr-base" style="letter-spacing: 8rpx">{{ my_signup.signup_code }}</text>
                    </view>
                    <view class="cr-grey-9 text-size-xs margin-top-sm">现场出示此码完成签到</view>
                    <view v-if="my_signup.is_waitlist" class="waitlist-hint margin-top-sm">
                        <text class="cr-main text-size-xs">当前为候补状态，转正后可签到</text>
                    </view>
                </view>
            </view>

            <!-- 底部操作栏 -->
            <view class="bottom-bar pf bottom-0 left-0 right-0 z-i-deep bg-white">
                <view class="bottom-bar-inner flex-row align-c padding-horizontal-main padding-vertical-sm">
                    <view class="fav-btn tc cp margin-right-main" @tap="fav_event">
                        <uni-icons :type="is_favored ? 'star-filled' : 'star'" size="44rpx" :color="is_favored ? '#F5A0B1' : '#999'"></uni-icons>
                        <text :class="'text-size-xs dis-block ' + (is_favored ? 'cr-main' : 'cr-grey')">{{ is_favored ? '已收藏' : '收藏' }}</text>
                    </view>
                    <button v-if="is_signed_up" class="signup-btn flex-1 cr-white fw-b text-size-md round signup-btn-cancel" @tap="cancel_signup_event">
                        {{ my_signup && my_signup.is_waitlist ? '取消候补' : '取消报名' }}
                    </button>
                    <button v-else class="signup-btn flex-1 cr-white fw-b text-size-md round" :class="signup_btn_class" :disabled="signup_disabled" @tap="signup_event">
                        {{ signup_btn_text }}
                    </button>
                </view>
            </view>

            <!-- 公共 -->
            <component-common ref="common"></component-common>
        </view>
    </view>
</template>

<script>
    const app = getApp();
    var bar_height = parseInt(app.globalData.get_system_info('statusBarHeight')) || 0;
    import componentCommon from '@/components/common/common';
    import componentNoData from '@/components/no-data/no-data';
    import { MuyingActivityStatus } from '@/common/js/config/muying-enum';
    import { request as http_request } from '@/common/js/http.js';

    export default {
        data() {
            return {
                theme_view: app.globalData.get_theme_value_view(),
                status_bar_height: bar_height,
                scroll_value: 0,
                activity_id: null,
                is_favored: false,
                is_signed_up: false,
                signup_status: 'ongoing',
                my_signup: null,
                activity: {},
                data_loaded: false,
                disclaimer_text: '',
            };
        },

        components: {
            componentCommon,
            componentNoData,
        },

        computed: {
            signup_disabled() {
                if (!this.activity.id) return true;
                if (this.is_signed_up) return true;
                if (this.signup_status === 'not_started') return true;
                if (this.signup_status === 'ended') return true;
                if (this.signup_status === 'full' && this.signup_status !== 'waitlist') return true;
                return false;
            },
            signup_btn_text() {
                if (!this.activity.id) return '加载中...';
                if (this.is_signed_up) return '已报名';
                if (this.signup_status === 'not_started') return '报名未开始';
                if (this.signup_status === 'ended') return '报名已截止';
                if (this.signup_status === 'full') return '名额已满';
                if (this.signup_status === 'waitlist') return '候补报名';
                return '立即报名';
            },
            signup_btn_class() {
                if (!this.activity.id) return 'signup-btn-disabled';
                if (this.signup_disabled) return 'signup-btn-disabled';
                if (this.signup_status === 'waitlist') return 'signup-btn-waitlist';
                return 'signup-btn-active';
            },
        },

        onLoad(params) {
            app.globalData.page_event_onload_handle(params);
            this.setData({
                disclaimer_text: app.globalData.get_config('muying_disclaimer', '平台内容仅用于一般孕育知识科普和活动信息参考，不构成医疗诊断、治疗或用药建议。如有身体不适或医疗问题，请及时咨询正规医疗机构专业医生。'),
            });
            if (params && params.id) {
                this.setData({ activity_id: params.id });
            }
            this.get_activity_detail();
        },

        onShow() {
            app.globalData.page_event_onshow_handle();
            if ((this.$refs.common || null) != null) {
                this.$refs.common.on_show();
            }
            if (this.activity_id) {
                this.get_activity_detail();
            }
        },

        onPageScroll(e) {
            this.setData({ scroll_value: e.scrollTop });
        },

        methods: {
            get_activity_detail() {
                if (!this.activity_id) return;
                var self = this;
                http_request({
                    controller: 'activity',
                    action: 'detail',
                    data: { id: this.activity_id },
                    success: function (data) {
                        self.setData({
                            activity: data.activity || {},
                            is_favored: !!data.is_favored,
                            is_signed_up: !!data.is_signed_up,
                            signup_status: data.signup_status || 'ongoing',
                            my_signup: data.my_signup || null,
                            data_loaded: true,
                        });
                    },
                    fail: function (err) {
                        self.setData({ data_loaded: true });
                        if (!err.feature_disabled && !err.login_expired) {
                            app.globalData.showToast(err.errMsg || '活动不存在');
                        }
                    },
                });
            },

            nav_back_event() {
                app.globalData.page_back_prev_event();
            },

            fav_event() {
                var self = this;
                var user = app.globalData.get_user_cache_info();
                if (!user) {
                    uni.navigateTo({ url: '/pages/login/login' });
                    return;
                }
                http_request({
                    controller: 'activity',
                    action: 'favor',
                    data: { id: this.activity_id },
                    success: function (data) {
                        self.setData({ is_favored: data.is_favored });
                    },
                    fail: function (err) {
                        if (!err.feature_disabled && !err.login_expired) {
                            app.globalData.showToast(err.errMsg || '操作失败');
                        }
                    },
                });
            },

            share_event() {
                uni.showShareMenu({
                    withShareTicket: true,
                    menus: ['shareAppMessage', 'shareTimeline'],
                });
            },

            signup_event() {
                if (this.signup_disabled) return;
                var user = app.globalData.get_user_cache_info();
                if (!user) {
                    uni.navigateTo({ url: '/pages/login/login' });
                    return;
                }
                uni.navigateTo({
                    url: '/pages/activity-signup/activity-signup?id=' + this.activity.id,
                });
            },

            cancel_signup_event() {
                var self = this;
                var cancelText = this.my_signup && this.my_signup.is_waitlist ? '确定要取消候补吗？' : '确定要取消该活动的报名吗？取消后可重新报名。';
                uni.showModal({
                    title: '取消报名',
                    content: cancelText,
                    confirmText: '确定取消',
                    cancelText: '再想想',
                    confirmColor: '#F5A0B1',
                    success: function (res) {
                        if (res.confirm) {
                            self.do_cancel_signup();
                        }
                    },
                });
            },

            do_cancel_signup() {
                var self = this;
                http_request({
                    controller: 'activity',
                    action: 'signupcancel',
                    data: { id: self.activity_id },
                    success: function () {
                        app.globalData.showToast('取消报名成功', 'success');
                        self.setData({
                            is_signed_up: false,
                            signup_status: 'ongoing',
                            my_signup: null,
                        });
                        self.get_activity_detail();
                    },
                    fail: function (err) {
                        if (!err.feature_disabled && !err.login_expired) {
                            app.globalData.showToast(err.errMsg || '取消报名失败');
                        }
                    },
                });
            },
        },

        onShareAppMessage() {
            return {
                title: this.activity.title || '禧孕活动',
                path: '/pages/activity-detail/activity-detail?id=' + this.activity_id,
                imageUrl: this.activity.cover || '',
            };
        },
    };
</script>

<style lang="scss" scoped>
    .activity-detail-page {
        min-height: 100vh;
        background-color: #fff8f5;
        padding-bottom: 140rpx;
    }

    .nav-top {
        transition: background-color 0.3s;
    }

    .nav-top-content {
        height: 88rpx;
        transition: background-color 0.3s;
    }

    .nav-title {
        position: absolute;
        left: 50%;
        transform: translateX(-50%);
    }

    .cover-container {
        position: relative;
        width: 100%;
        height: 500rpx;
    }

    .cover-image {
        width: 100%;
        height: 100%;
    }

    .cover-stage-tag {
        position: absolute;
        top: 24rpx;
        left: 24rpx;
        z-index: 2;
    }

    .cover-status-tag {
        position: absolute;
        top: 24rpx;
        right: 24rpx;
        z-index: 2;
    }

    .muying-activity-status-badge {
        display: inline-block;
        padding: 6rpx 20rpx;
        border-radius: 20rpx;
        font-size: 24rpx;
        color: #fff;
    }

    .muying-activity-status--signing .muying-activity-status-badge,
    .muying-activity-status-badge {
        background-color: rgba(76, 175, 80, 0.85);
    }

    .muying-category-tag {
        display: inline-block;
        padding: 4rpx 16rpx;
        border-radius: 16rpx;
        font-size: 22rpx;
        color: #f5a0b1;
        background-color: #fff0f3;
        border: 1rpx solid #f5a0b1;
    }

    .muying-type-tag {
        display: inline-block;
        padding: 4rpx 16rpx;
        border-radius: 16rpx;
        font-size: 22rpx;
        color: #999;
        background-color: #f5f5f5;
        border: 1rpx solid #ddd;
    }

    .info-card {
        margin-top: -40rpx;
        position: relative;
        z-index: 5;
    }

    .price-row {
        gap: 16rpx;
    }

    .detail-content {
        line-height: 1.8;
    }

    .checkin-card {
        background: linear-gradient(135deg, #f0fff0 0%, #ffffff 100%);
    }

    .checkin-code {
        padding: 24rpx;
        background-color: #f8f8f8;
        border-radius: 16rpx;
        border: 2rpx dashed #4caf50;
    }

    .waitlist-hint {
        padding: 8rpx 16rpx;
        background-color: #fff8f5;
        border-radius: 8rpx;
    }

    .bottom-bar {
        box-shadow: 0 -4rpx 20rpx rgba(0, 0, 0, 0.06);
    }

    .bottom-bar-inner {
        gap: 16rpx;
    }

    .fav-btn {
        min-width: 80rpx;
    }

    .signup-btn {
        height: 88rpx;
        line-height: 88rpx;
        padding: 0;
        border: none;
    }

    .signup-btn-active {
        background: linear-gradient(135deg, #f5a0b1 0%, #f5c6a0 100%);
    }

    .signup-btn-waitlist {
        background: linear-gradient(135deg, #e8a050 0%, #f5c6a0 100%);
    }

    .signup-btn-disabled {
        background-color: #dddddd;
        color: #999999;
    }

    .signup-btn-cancel {
        background-color: #fff;
        color: #f5a0b1;
        border: 2rpx solid #f5a0b1;
    }
</style>
