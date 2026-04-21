<template>
    <view :class="theme_view">
        <view class="page-bottom-fixed">
            <view class="muying-tab-bar bg-white">
                <view
                    :class="['muying-tab-item', current_tab === 'activity' ? 'muying-tab-item--active' : '']"
                    @tap="switch_tab('activity')"
                >
                    <text>我的活动</text>
                    <view v-if="current_tab === 'activity'" class="muying-tab-line"></view>
                </view>
                <view
                    :class="['muying-tab-item', current_tab === 'signup' ? 'muying-tab-item--active' : '']"
                    @tap="switch_tab('signup')"
                >
                    <text>我的报名</text>
                    <view v-if="current_tab === 'signup'" class="muying-tab-line"></view>
                </view>
            </view>

            <view v-if="current_tab === 'activity'" class="padding-main">
                <block v-if="activity_list.length > 0">
                    <view v-for="(item, index) in activity_list" :key="index" class="muying-card spacing-mb padding-main">
                        <view class="flex-row jc-sb align-c">
                            <view class="flex-1">
                                <view class="text-size fw-b">{{ item.title }}</view>
                                <view class="text-size-sm cr-grey margin-top-xs">{{ item.time_text }}</view>
                            </view>
                            <text :class="['muying-stage-tag', 'muying-stage-tag--' + item.signup_status]">{{ item.signup_status_text }}</text>
                        </view>
                        <view class="muying-divider margin-top-main margin-bottom-main"></view>
                        <view class="flex-row jc-sb align-c">
                            <view class="text-size-sm cr-grey-9">{{ item.address || '' }}</view>
                            <view class="text-size-sm cr-main cp" @tap="view_detail(item.activity_id || item.id)">查看详情</view>
                        </view>
                    </view>
                </block>
                <block v-else>
                    <component-no-data propStatus="0" propMsg="暂无活动数据"></component-no-data>
                </block>
            </view>

            <view v-if="current_tab === 'signup'" class="padding-main">
                <block v-if="signup_list.length > 0">
                    <view v-for="(item, index) in signup_list" :key="index" class="muying-card spacing-mb padding-main">
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
                    <component-no-data propStatus="0" propMsg="暂无报名记录"></component-no-data>
                </block>
            </view>
        </view>

        <component-common ref="common"></component-common>
    </view>
</template>

<script>
    const app = getApp();
    import componentCommon from '@/components/common/common';
    import componentNoData from '@/components/no-data/no-data';
    import { request as http_request } from '@/common/js/http.js';

    export default {
        data() {
            return {
                theme_view: app.globalData.get_theme_value_view(),
                current_tab: 'activity',
                activity_list: [],
                signup_list: [],
            };
        },

        components: {
            componentCommon,
            componentNoData
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
                setTimeout(function() {
                    app.globalData.url_open('/pages/login/login');
                }, 1500);
                return;
            }
            this.load_data();
        },

        methods: {
            switch_tab(tab) {
                this.setData({ current_tab: tab });
                this.load_data();
            },

            load_data() {
                if (this.current_tab === 'activity') {
                    this.get_my_activity_list();
                } else {
                    this.get_my_signup_list();
                }
            },

            get_my_signup_list() {
                var self = this;
                http_request({
                    controller: 'activity',
                    action: 'mysignup',
                    success: function(data) {
                        self.setData({ signup_list: data.items || [] });
                    },
                    fail: function() {
                        app.globalData.showToast('网络异常，请重试');
                    },
                });
            },

            get_my_activity_list() {
                var self = this;
                http_request({
                    controller: 'activity',
                    action: 'mysignup',
                    success: function(data) {
                        var raw_list = data.items || [];
                        var activity_map = {};
                        var activity_list = [];
                        raw_list.forEach(function(item) {
                            if (item.activity_info && !activity_map[item.activity_id]) {
                                activity_map[item.activity_id] = true;
                                var info = item.activity_info;
                                var now = Math.floor(Date.now() / 1000);
                                var signup_status = 'ongoing';
                                var signup_status_text = '进行中';
                                if (info.signup_end_time > 0 && now > info.signup_end_time) {
                                    signup_status = 'ended';
                                    signup_status_text = '已结束';
                                }
                                if (info.end_time > 0 && now > info.end_time) {
                                    signup_status = 'ended';
                                    signup_status_text = '已结束';
                                }
                                activity_list.push({
                                    id: info.id || item.activity_id,
                                    activity_id: item.activity_id,
                                    title: info.title || '',
                                    time_text: info.time_text || '',
                                    address: info.address || '',
                                    signup_status: signup_status,
                                    signup_status_text: signup_status_text,
                                });
                            }
                        });
                        self.setData({ activity_list: activity_list });
                    },
                    fail: function() {
                        app.globalData.showToast('网络异常，请重试');
                    },
                });
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
                    content: '确定要取消报名「' + ((item.activity_info && item.activity_info.title) || '该活动') + '」吗？',
                    success: function(res) {
                        if (!res.confirm) return;
                        http_request({
                            controller: 'activity',
                            action: 'signupcancel',
                            data: { id: item.id },
                            success: function() {
                                uni.showToast({ title: '已取消报名', icon: 'success' });
                                self.load_data();
                            },
                            fail: function(err) {
                                if (!err.feature_disabled && !err.login_expired) {
                                    app.globalData.showToast(err.errMsg || '取消失败，请重试');
                                }
                            },
                        });
                    },
                });
            },
        }
    };
</script>

<style scoped>
    @import '@/common/css/muying.css';

    .muying-tab-bar {
        display: flex;
        padding: 0 40rpx;
        border-bottom: 1rpx solid #F5F5F5;
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
        color: #F5A0B1;
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
        background: linear-gradient(135deg, #F5A0B1, #F5C6A0);
    }

    .muying-stage-tag--ongoing {
        background-color: #E8F5E9;
        color: #4CAF50;
        border: 1px solid #4CAF50;
    }

    .muying-stage-tag--ended {
        background-color: #F5F5F5;
        color: #999;
        border: 1px solid #DDD;
    }

    .muying-status-pending {
        background-color: #FFF5E6;
        color: #E8A050;
        border: 1px solid #E8A050;
    }

    .muying-status-confirmed {
        background-color: #E8F5E9;
        color: #4CAF50;
        border: 1px solid #4CAF50;
    }

    .muying-status-cancelled {
        background-color: #FFF0F0;
        color: #E57373;
        border: 1px solid #E57373;
        text-decoration: line-through;
    }

    .cr-red {
        color: #E57373;
    }

    .margin-right-main {
        margin-right: 20rpx;
    }
</style>
