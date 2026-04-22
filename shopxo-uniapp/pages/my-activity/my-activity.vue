<template>
    <view :class="theme_view">
        <view class="my-activity-page">
            <!-- Tab 切换 -->
            <view class="muying-tab-bar bg-white">
                <view :class="['muying-tab-item', current_tab === 'activity' ? 'muying-tab-item--active' : '']" @tap="switch_tab('activity')">
                    <text>我的活动</text>
                    <view v-if="current_tab === 'activity'" class="muying-tab-line"></view>
                </view>
                <view :class="['muying-tab-item', current_tab === 'signup' ? 'muying-tab-item--active' : '']" @tap="switch_tab('signup')">
                    <text>我的报名</text>
                    <view v-if="current_tab === 'signup'" class="muying-tab-line"></view>
                </view>
            </view>

            <!-- 我的活动 -->
            <scroll-view v-if="current_tab === 'activity'" scroll-y class="list-scroll" @scrolltolower="scroll_lower_activity" lower-threshold="60">
                <view class="padding-main">
                    <block v-if="activity_list.length > 0">
                        <view v-for="(item, index) in activity_list" :key="'a' + index" class="muying-card spacing-mb padding-main">
                            <view class="flex-row jc-sb align-c">
                                <view class="flex-1">
                                    <view class="text-size fw-b">{{ item.title }}</view>
                                    <view class="text-size-sm cr-grey margin-top-xs">{{ item.time_text }}</view>
                                </view>
                                <text :class="['muying-stage-tag', 'muying-status-' + item.activity_status]">{{ item.activity_status_text }}</text>
                            </view>
                            <view v-if="item.address" class="muying-divider margin-top-main margin-bottom-main"></view>
                            <view v-if="item.address" class="flex-row jc-sb align-c">
                                <view class="text-size-sm cr-grey-9">{{ item.address }}</view>
                                <view class="text-size-sm cr-main cp" @tap="view_detail(item.activity_id)">查看详情</view>
                            </view>
                        </view>
                    </block>
                    <block v-else>
                        <component-no-data :propStatus="data_loding_status"></component-no-data>
                    </block>
                </view>
                <component-bottom-line :propStatus="activity_bottom_line_status"></component-bottom-line>
            </scroll-view>

            <!-- 我的报名 -->
            <scroll-view v-if="current_tab === 'signup'" scroll-y class="list-scroll" @scrolltolower="scroll_lower_signup" lower-threshold="60">
                <view class="padding-main">
                    <block v-if="signup_list.length > 0">
                        <view v-for="(item, index) in signup_list" :key="'s' + index" class="muying-card spacing-mb padding-main">
                            <view class="flex-row jc-sb align-c">
                                <view class="flex-1">
                                    <view class="text-size fw-b">{{ (item.activity_info && item.activity_info.title) || '' }}</view>
                                    <view class="text-size-sm cr-grey margin-top-xs">报名时间：{{ item.add_time_text }}</view>
                                </view>
                                <text :class="['muying-stage-tag', get_signup_status_class(item.status)]">{{ item.status_text }}</text>
                            </view>
                            <view class="muying-divider margin-top-main margin-bottom-main"></view>
                            <view class="flex-row jc-sb align-c">
                                <view class="text-size-sm cr-grey-9">{{ (item.activity_info && item.activity_info.time_text) || '' }}</view>
                                <view class="flex-row align-c">
                                    <view v-if="item.status === 0 || item.status === 1" class="text-size-sm cr-red cp margin-right-main" @tap="cancel_signup(item)">取消报名</view>
                                    <view class="text-size-sm cr-main cp" @tap="view_detail(item.activity_id)">查看详情</view>
                                </view>
                            </view>
                        </view>
                    </block>
                    <block v-else>
                        <component-no-data :propStatus="data_loding_status"></component-no-data>
                    </block>
                </view>
                <component-bottom-line :propStatus="signup_bottom_line_status"></component-bottom-line>
            </scroll-view>
        </view>

        <component-common ref="common"></component-common>
    </view>
</template>

<script>
    const app = getApp();
    import componentCommon from '@/components/common/common';
    import componentNoData from '@/components/no-data/no-data';
    import componentBottomLine from '@/components/bottom-line/bottom-line';
    import { request as http_request } from '@/common/js/http.js';

    export default {
        data() {
            return {
                theme_view: app.globalData.get_theme_value_view(),
                current_tab: 'activity',
                activity_list: [],
                signup_list: [],
                data_loding_status: 1,
                activity_page: 1,
                activity_page_total: 0,
                activity_is_loading: 0,
                activity_bottom_line_status: false,
                signup_page: 1,
                signup_page_total: 0,
                signup_is_loading: 0,
                signup_bottom_line_status: false,
            };
        },

        components: {
            componentCommon,
            componentNoData,
            componentBottomLine,
        },

        onLoad(params) {
            app.globalData.page_event_onload_handle(params);
            if (params && params.tab) {
                this.setData({ current_tab: params.tab });
            }
        },

        onShow() {
            app.globalData.page_event_onshow_handle();
            if ((this.$refs.common || null) != null) {
                this.$refs.common.on_show();
            }
            if (!app.globalData.is_user_login()) {
                app.globalData.showToast('请先登录');
                setTimeout(function () {
                    app.globalData.url_open('/pages/login/login');
                }, 1500);
                return;
            }
            this.load_data();
        },

        onPullDownRefresh() {
            this.load_data();
        },

        methods: {
            switch_tab(tab) {
                this.setData({ current_tab: tab });
                this.load_data();
            },

            load_data() {
                if (this.current_tab === 'activity') {
                    this.setData({
                        activity_page: 1,
                        activity_list: [],
                        activity_bottom_line_status: false,
                    });
                    this.get_my_activity_list(1);
                } else {
                    this.setData({
                        signup_page: 1,
                        signup_list: [],
                        signup_bottom_line_status: false,
                    });
                    this.get_my_signup_list(1);
                }
            },

            get_my_signup_list(is_mandatory) {
                if (this.signup_is_loading == 1) return;
                this.setData({ signup_is_loading: 1 });
                if (is_mandatory == 1) {
                    this.setData({ data_loding_status: 1 });
                }
                var self = this;
                http_request({
                    controller: 'activity',
                    action: 'mysignup',
                    data: { page: this.signup_page },
                    success: function (data) {
                        uni.stopPullDownRefresh();
                        var list = data.items || [];
                        self.setData({
                            signup_list: self.signup_page > 1 ? self.signup_list.concat(list) : list,
                            data_loding_status: list.length > 0 ? 3 : 0,
                            signup_page_total: data.page_total || 0,
                            signup_bottom_line_status: (data.page_total || 0) <= self.signup_page,
                            signup_is_loading: 0,
                        });
                    },
                    fail: function () {
                        uni.stopPullDownRefresh();
                        self.setData({ data_loding_status: 0, signup_is_loading: 0 });
                    },
                });
            },

            get_my_activity_list(is_mandatory) {
                if (this.activity_is_loading == 1) return;
                this.setData({ activity_is_loading: 1 });
                if (is_mandatory == 1) {
                    this.setData({ data_loding_status: 1 });
                }
                var self = this;
                http_request({
                    controller: 'activity',
                    action: 'mysignup',
                    data: { page: this.activity_page },
                    success: function (data) {
                        uni.stopPullDownRefresh();
                        var raw_list = data.items || [];
                        var activity_map = {};
                        var activity_list = self.activity_page > 1 ? self.activity_list.slice() : [];
                        var now = Math.floor(Date.now() / 1000);
                        raw_list.forEach(function (item) {
                            if (item.activity_info && !activity_map[item.activity_id]) {
                                activity_map[item.activity_id] = true;
                                var info = item.activity_info;
                                var activity_status = 'ongoing';
                                var activity_status_text = '进行中';
                                if (info.signup_end_time > 0 && now > info.signup_end_time && (info.end_time <= 0 || now <= info.end_time)) {
                                    activity_status = 'signing_ended';
                                    activity_status_text = '报名截止';
                                }
                                if (info.end_time > 0 && now > info.end_time) {
                                    activity_status = 'ended';
                                    activity_status_text = '已结束';
                                }
                                activity_list.push({
                                    id: info.id || item.activity_id,
                                    activity_id: item.activity_id,
                                    title: info.title || '',
                                    time_text: info.time_text || '',
                                    address: info.address || '',
                                    activity_status: activity_status,
                                    activity_status_text: activity_status_text,
                                });
                            }
                        });
                        self.setData({
                            activity_list: activity_list,
                            data_loding_status: activity_list.length > 0 ? 3 : 0,
                            activity_page_total: data.page_total || 0,
                            activity_bottom_line_status: (data.page_total || 0) <= self.activity_page,
                            activity_is_loading: 0,
                        });
                    },
                    fail: function () {
                        uni.stopPullDownRefresh();
                        self.setData({ data_loding_status: 0, activity_is_loading: 0 });
                    },
                });
            },

            scroll_lower_activity() {
                if (this.activity_is_loading == 1 || this.activity_page >= this.activity_page_total) return;
                this.setData({ activity_page: this.activity_page + 1 });
                this.get_my_activity_list(0);
            },

            scroll_lower_signup() {
                if (this.signup_is_loading == 1 || this.signup_page >= this.signup_page_total) return;
                this.setData({ signup_page: this.signup_page + 1 });
                this.get_my_signup_list(0);
            },

            view_detail(activity_id) {
                if (activity_id) {
                    uni.navigateTo({ url: '/pages/activity-detail/activity-detail?id=' + activity_id });
                }
            },

            get_signup_status_class(status) {
                if (status === 0) return 'muying-status-pending';
                if (status === 1) return 'muying-status-confirmed';
                if (status === 2) return 'muying-status-cancelled';
                return '';
            },

            cancel_signup(item) {
                var self = this;
                uni.showModal({
                    title: '取消报名',
                    content: '确定要取消报名「' + ((item.activity_info && item.activity_info.title) || '该活动') + '」吗？取消后可重新报名。',
                    confirmColor: '#F5A0B1',
                    success: function (res) {
                        if (!res.confirm) return;
                        http_request({
                            controller: 'activity',
                            action: 'signupcancel',
                            data: { id: item.id },
                            success: function () {
                                uni.showToast({ title: '已取消报名', icon: 'success' });
                                self.load_data();
                            },
                            fail: function (err) {
                                if (!err.feature_disabled && !err.login_expired) {
                                    app.globalData.showToast(err.errMsg || '取消失败，请重试');
                                }
                            },
                        });
                    },
                });
            },
        },
    };
</script>

<style lang="scss" scoped>
    @import '@/common/css/muying.css';

    .my-activity-page {
        min-height: 100vh;
        background-color: #fff8f5;
    }

    .muying-tab-bar {
        display: flex;
        padding: 0 40rpx;
        border-bottom: 1rpx solid #f5f5f5;
        position: sticky;
        top: 0;
        z-index: 10;
    }

    .muying-tab-item {
        flex: 1;
        text-align: center;
        padding: 24rpx 0;
        font-size: 28rpx;
        color: #999;
        position: relative;
    }

    .muying-tab-item--active {
        color: #f5a0b1;
        font-weight: bold;
    }

    .muying-tab-line {
        position: absolute;
        bottom: 0;
        left: 50%;
        transform: translateX(-50%);
        width: 48rpx;
        height: 6rpx;
        border-radius: 3rpx;
        background: linear-gradient(135deg, #f5a0b1, #f5c6a0);
    }

    .list-scroll {
        height: calc(100vh - 100rpx);
    }

    .muying-status-ongoing {
        background-color: #e8f5e9;
        color: #4caf50;
        border: 1px solid #4caf50;
    }

    .muying-status-signing_ended {
        background-color: #fff5e6;
        color: #e8a050;
        border: 1px solid #e8a050;
    }

    .muying-status-ended {
        background-color: #f5f5f5;
        color: #999;
        border: 1px solid #ddd;
    }

    .muying-status-pending {
        background-color: #fff5e6;
        color: #e8a050;
        border: 1px solid #e8a050;
    }

    .muying-status-confirmed {
        background-color: #e8f5e9;
        color: #4caf50;
        border: 1px solid #4caf50;
    }

    .muying-status-cancelled {
        background-color: #fff0f0;
        color: #e57373;
        border: 1px solid #e57373;
        text-decoration: line-through;
    }

    .cr-red {
        color: #e57373;
    }

    .margin-right-main {
        margin-right: 20rpx;
    }
</style>
