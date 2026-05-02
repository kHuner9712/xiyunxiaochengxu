<template>
    <view :class="theme_view">
        <view class="page-bottom-fixed">
            <!-- 邀请统计卡片 -->
            <view class="invite-stats muying-section-gradient padding-main">
                <view class="muying-card padding-main">
                    <view class="flex-row jc-sa tc">
                        <view class="flex-1">
                            <view class="text-size-lg fw-b cr-main">{{ invite_stats.total_invites }}</view>
                            <view class="text-size-sm cr-grey margin-top-xs">累计邀请</view>
                        </view>
                        <view class="invite-stats-divider"></view>
                        <view class="flex-1">
                            <view class="text-size-lg fw-b cr-main">{{ invite_stats.total_rewards }}</view>
                            <view class="text-size-sm cr-grey margin-top-xs">获得积分</view>
                        </view>
                    </view>
                </view>
            </view>

            <!-- 邀请码和分享 -->
            <view class="padding-main">
                <view class="muying-card padding-main">
                    <view class="flex-row jc-sb align-c">
                        <view>
                            <view class="text-size-sm cr-grey">我的邀请码</view>
                            <view class="text-size fw-b margin-top-xs invite-code-text">{{ invite_code || '加载中...' }}</view>
                        </view>
                        <view class="invite-copy-btn cr-white text-size-sm" @tap="copy_invite_code">复制邀请码</view>
                    </view>
                    <view class="muying-divider margin-top-main margin-bottom-main"></view>
                    <view class="invite-share-btn tc" @tap="share_event">
                        <text class="cr-white text-size">邀请好友 赢积分</text>
                    </view>
                </view>
            </view>

            <!-- 奖励记录 -->
            <scroll-view scroll-y class="padding-horizontal-main" @scrolltolower="scrolltolower_event" style="max-height: 60vh;">
                <view class="text-size fw-b margin-bottom-main">奖励记录</view>
                <block v-if="reward_list.length > 0">
                    <view v-for="(item, index) in reward_list" :key="index" class="muying-card spacing-mb padding-main">
                        <view class="flex-row jc-sb align-c">
                            <view class="flex-1">
                                <view class="text-size">{{ item.desc }}</view>
                                <view class="text-size-sm cr-grey margin-top-xs">{{ item.time }}</view>
                            </view>
                            <view :class="['text-size fw-b', item.amount > 0 ? 'cr-red' : 'cr-grey']">
                                {{ item.amount > 0 ? '+' : '' }}{{ item.amount }}积分
                            </view>
                        </view>
                    </view>
                    <component-bottom-line propStatus="data_list_loding_status"></component-bottom-line>
                </block>
                <block v-else>
                    <component-no-data propStatus="0" propMsg="暂无奖励记录"></component-no-data>
                </block>
            </scroll-view>
        </view>

        <!-- 公共 -->
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
                invite_code: '',
                invite_stats: {
                    total_invites: 0,
                    total_rewards: 0
                },
                reward_list: [],
                data_page: 1,
                data_page_total: 1,
                data_list_loding_status: 1,
                data_is_loading: 0,
            };
        },

        components: {
            componentCommon,
            componentNoData,
            componentBottomLine
        },

        onLoad(params) {
            app.globalData.page_event_onload_handle(params);
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
            this.get_invite_info();
            this.setData({ data_page: 1, reward_list: [] });
            this.get_reward_list();
        },

        onShareAppMessage() {
            return {
                title: '禧孕邀请你一起科学孕育，赢积分好礼！',
                path: '/pages/invite/invite?invite_code=' + (this.invite_code || ''),
                imageUrl: '/static/images/common/logo.png',
            };
        },

        onShareTimeline() {
            return {
                title: '禧孕邀请你一起科学孕育，赢积分好礼！',
                query: 'invite_code=' + (this.invite_code || ''),
            };
        },

        methods: {
            copy_invite_code() {
                if (!this.invite_code) {
                    app.globalData.showToast('邀请码加载中，请稍后');
                    return;
                }
                uni.setClipboardData({
                    data: this.invite_code,
                    success: () => {
                        app.globalData.showToast('邀请码已复制', 'success');
                    }
                });
            },

            share_event() {
                uni.showShareMenu({
                    withShareTicket: true,
                    menus: ['shareAppMessage', 'shareTimeline'],
                });
            },

            get_invite_info() {
                var self = this;
                http_request({
                    controller: 'invite',
                    action: 'index',
                    success: function(data) {
                        self.setData({
                            invite_code: data.invite_code || '',
                            invite_stats: {
                                total_invites: data.invite_count || 0,
                                total_rewards: data.reward_total || 0,
                            },
                        });
                    },
                    fail: function(err) {
                        if (!err.feature_disabled && !err.login_expired) {
                            app.globalData.showToast(err.errMsg || '获取邀请信息失败');
                        }
                    },
                });
            },

            get_reward_list(is_mandatory) {
                if (this.data_is_loading == 1) return;
                if (!is_mandatory && this.data_page > this.data_page_total) return;

                var self = this;
                this.setData({ data_is_loading: 1 });
                http_request({
                    controller: 'invite',
                    action: 'rewardlist',
                    data: { page: this.data_page },
                    success: function(data) {
                        var list = data.items || [];
                        var reward_list = [];
                        for (var i = 0; i < list.length; i++) {
                            var item = list[i];
                            var info = item.invitee_info || {};
                            reward_list.push({
                                id: item.id,
                                desc: (item.trigger_event_text || '') + ' ' + (info.nickname || ''),
                                time: item.add_time_text || '',
                                amount: item.reward_type === 'integral' ? item.reward_value : 0,
                            });
                        }
                        var merged = is_mandatory ? reward_list : self.reward_list.concat(reward_list);
                        self.setData({
                            reward_list: merged,
                            data_page_total: data.page_total || 1,
                            data_list_loding_status: (data.page_total || 1) <= self.data_page ? 0 : 1,
                        });
                    },
                    fail: function(err) {
                        if (!err.feature_disabled && !err.login_expired) {
                            app.globalData.showToast(err.errMsg || '获取奖励记录失败');
                        }
                    },
                    complete: function() {
                        self.setData({ data_is_loading: 0 });
                    },
                });
            },

            scrolltolower_event() {
                if (this.data_page < this.data_page_total) {
                    this.setData({ data_page: this.data_page + 1 });
                    this.get_reward_list(false);
                }
            }
        }
    };
</script>

<style scoped>
    @import '@/common/css/muying.css';

    .invite-stats-divider {
        width: 1rpx;
        height: 60rpx;
        background: linear-gradient(180deg, transparent, #F5A0B1, transparent);
        opacity: 0.3;
    }

    .invite-code-text {
        letter-spacing: 4rpx;
        color: #F5A0B1;
    }

    .invite-copy-btn {
        background: linear-gradient(135deg, #F5A0B1, #F5C6A0);
        padding: 12rpx 28rpx;
        border-radius: 24rpx;
    }

    .invite-share-btn {
        background: linear-gradient(135deg, #F5A0B1, #F5C6A0);
        padding: 20rpx;
        border-radius: 40rpx;
    }
</style>
