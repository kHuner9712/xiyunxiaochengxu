<template>
    <view :class="theme_view">
        <view class="page-bottom-fixed">
            <!-- 公开区域：登录/未登录都可见 -->
            <view class="invite-banner muying-section-gradient">
                <view class="invite-banner-content padding-horizontal-main padding-top-xxxl padding-bottom-main">
                    <view class="invite-banner-slogan tc">
                        <view class="invite-banner-title">邀请好友 赢积分</view>
                        <view class="invite-banner-sub">每邀一位好友，最高可获{{ register_reward + first_order_reward }}积分</view>
                    </view>
                    <view v-if="is_logged_in" class="invite-stats-row flex-row jc-sa tc margin-top-xl">
                        <view class="flex-1">
                            <view class="invite-stats-num">{{ invite_count }}</view>
                            <view class="invite-stats-label">累计邀请(人)</view>
                        </view>
                        <view class="invite-stats-divider"></view>
                        <view class="flex-1">
                            <view class="invite-stats-num">{{ reward_total }}</view>
                            <view class="invite-stats-label">获得积分</view>
                        </view>
                    </view>
                    <view v-else class="invite-stats-row tc margin-top-xl">
                        <view class="invite-banner-sub">好友通过邀请码注册，双方均可获得积分奖励</view>
                    </view>
                </view>
            </view>

            <view class="padding-horizontal-main">
                <view class="muying-card padding-main margin-top-main">
                    <view class="muying-section-title margin-bottom-main">奖励规则</view>
                    <view class="invite-rule-item flex-row align-c margin-bottom-main">
                        <view class="invite-rule-icon">1</view>
                        <view class="flex-1">
                            <view class="text-size">邀请好友注册</view>
                            <view class="text-size-sm cr-grey margin-top-xs">好友通过您的邀请码注册成功</view>
                        </view>
                        <view class="invite-rule-reward cr-white">+{{ register_reward }}积分</view>
                    </view>
                    <view class="invite-rule-item flex-row align-c">
                        <view class="invite-rule-icon">2</view>
                        <view class="flex-1">
                            <view class="text-size">好友首单完成</view>
                            <view class="text-size-sm cr-grey margin-top-xs">被邀请好友首次下单并完成</view>
                        </view>
                        <view class="invite-rule-reward cr-white">+{{ first_order_reward }}积分</view>
                    </view>
                </view>
            </view>

            <!-- 未登录态：CTA区域 -->
            <view v-if="!is_logged_in" class="padding-horizontal-main margin-top-main">
                <view class="muying-card padding-main">
                    <view class="invite-cta-section tc">
                        <view class="invite-cta-title">加入孕禧，领取专属福利</view>
                        <view class="invite-cta-desc cr-grey text-size-sm margin-top-sm">注册即享新人权益，邀请好友赢积分</view>
                        <view class="invite-cta-btn cr-white text-size fw-b margin-top-main" @tap="go_register">立即注册 领取福利</view>
                        <view class="invite-cta-login text-size-sm cr-grey margin-top-main" @tap="go_login">已有账号？去登录</view>
                    </view>
                </view>
            </view>

            <!-- 已登录态：邀请码+分享+记录 -->
            <block v-if="is_logged_in">
                <view class="padding-horizontal-main margin-top-main">
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

                <view class="padding-horizontal-main margin-top-main margin-bottom-main">
                    <view class="muying-section-header">
                        <view class="muying-section-title">邀请记录</view>
                    </view>
                    <block v-if="invite_list.length > 0">
                        <view v-for="(item, index) in invite_list" :key="index" class="muying-card spacing-mb padding-main">
                            <view class="flex-row align-c">
                                <image class="invite-avatar circle" :src="item.avatar" mode="aspectFill"></image>
                                <view class="flex-1 margin-left-main">
                                    <view class="flex-row jc-sb align-c">
                                        <view class="text-size fw-b">{{ item.nickname }}</view>
                                        <view :class="['invite-reward-status', item.status === 1 ? 'invite-reward-status--done' : 'invite-reward-status--pending']">
                                            {{ item.status === 1 ? '已发放' : '待发放' }}
                                        </view>
                                    </view>
                                    <view class="text-size-sm cr-grey margin-top-xs">{{ item.register_time }}</view>
                                </view>
                            </view>
                        </view>
                    </block>
                    <block v-else>
                        <component-no-data propStatus="0" propMsg="暂无邀请记录"></component-no-data>
                    </block>
                </view>
            </block>

            <!-- 未登录态底部留白 -->
            <view v-if="!is_logged_in" class="margin-bottom-xxxl"></view>
        </view>

        <component-common ref="common"></component-common>
    </view>
</template>
<script>
    const app = getApp();
    import componentCommon from '@/components/common/common';
    import componentNoData from '@/components/no-data/no-data';

    export default {
        data() {
            return {
                theme_view: app.globalData.get_theme_value_view(),
                is_logged_in: false,
                invite_code: '',
                invite_count: 0,
                reward_total: 0,
                invite_list: [],
                register_reward: 0,
                first_order_reward: 0,
            };
        },

        components: {
            componentCommon,
            componentNoData
        },

        onLoad(params) {
            app.globalData.page_event_onload_handle(params);
            if (params && params.invite_code) {
                uni.setStorageSync('invite_code_from_share', params.invite_code);
            }
        },

        onShow() {
            app.globalData.page_event_onshow_handle();
            if ((this.$refs.common || null) != null) {
                this.$refs.common.on_show();
            }
            this.check_login_state();
        },

        onShareAppMessage() {
            return {
                title: '孕禧邀请你一起科学孕育，赢积分好礼！',
                path: '/pages/invite/invite?invite_code=' + (this.invite_code || ''),
                imageUrl: '/static/images/common/logo.png',
            };
        },

        onShareTimeline() {
            return {
                title: '孕禧邀请你一起科学孕育，赢积分好礼！',
                query: 'invite_code=' + (this.invite_code || ''),
            };
        },

        methods: {
            check_login_state() {
                var user = app.globalData.get_user_cache_info();
                var logged_in = !!user;
                this.setData({ is_logged_in: logged_in });
                this.get_reward_config();
                if (logged_in) {
                    uni.removeStorageSync('invite_code_from_share');
                    this.get_invite_index();
                    this.get_invite_rewardlist();
                }
            },

            get_invite_index() {
                var self = this;
                uni.request({
                    url: app.globalData.get_request_url('index', 'invite'),
                    method: 'POST',
                    dataType: 'json',
                    success: function(res) {
                        if (res.data.code == 0) {
                            var data = res.data.data || {};
                            self.setData({
                                invite_code: data.invite_code || '',
                                invite_count: data.invite_count || 0,
                                reward_total: data.reward_total || 0,
                            });
                        }
                    },
                    fail: function() {},
                });
            },

            get_invite_rewardlist() {
                var self = this;
                uni.request({
                    url: app.globalData.get_request_url('rewardlist', 'invite'),
                    method: 'POST',
                    dataType: 'json',
                    success: function(res) {
                        if (res.data.code == 0) {
                            var data = res.data.data || {};
                            self.setData({
                                invite_list: data.data || [],
                            });
                        }
                    },
                    fail: function() {},
                });
            },

            copy_invite_code() {
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

            get_reward_config() {
                var self = this;
                uni.request({
                    url: app.globalData.get_request_url('rewardconfigpublic', 'invite'),
                    method: 'POST',
                    dataType: 'json',
                    success: function(res) {
                        if (res.data.code == 0) {
                            var data = res.data.data || {};
                            self.setData({
                                register_reward: data.register_reward || 0,
                                first_order_reward: data.first_order_reward || 0,
                            });
                        }
                    },
                });
            },

            go_register() {
                var url = '/pages/login/login?opt_form=reg';
                var shared_code = uni.getStorageSync('invite_code_from_share') || '';
                if (shared_code) {
                    url += '&invite_code=' + encodeURIComponent(shared_code);
                }
                uni.navigateTo({ url: url });
            },

            go_login() {
                var url = '/pages/login/login?opt_form=login';
                var shared_code = uni.getStorageSync('invite_code_from_share') || '';
                if (shared_code) {
                    url += '&invite_code=' + encodeURIComponent(shared_code);
                }
                uni.navigateTo({ url: url });
            },
        }
    };
</script>
<style scoped>
    @import '@/common/css/muying.css';

    .invite-banner {
        position: relative;
        overflow: hidden;
    }

    .invite-banner::after {
        content: '';
        position: absolute;
        bottom: -60rpx;
        left: 50%;
        transform: translateX(-50%);
        width: 140%;
        height: 120rpx;
        border-radius: 50% 50% 0 0;
        background-color: #FFF8F5;
    }

    .invite-banner-title {
        font-size: 44rpx;
        font-weight: bold;
        color: #F5A0B1;
        letter-spacing: 4rpx;
    }

    .invite-banner-sub {
        font-size: 26rpx;
        color: #999;
        margin-top: 8rpx;
    }

    .invite-stats-row {
        position: relative;
        z-index: 1;
    }

    .invite-stats-num {
        font-size: 40rpx;
        font-weight: bold;
        color: #F5A0B1;
    }

    .invite-stats-label {
        font-size: 24rpx;
        color: #999;
        margin-top: 4rpx;
    }

    .invite-stats-divider {
        width: 1rpx;
        height: 60rpx;
        background: linear-gradient(180deg, transparent, #F5A0B1, transparent);
        opacity: 0.3;
    }

    .invite-rule-icon {
        width: 44rpx;
        height: 44rpx;
        border-radius: 50%;
        background: linear-gradient(135deg, #F5A0B1, #F5C6A0);
        color: #FFFFFF;
        font-size: 24rpx;
        font-weight: bold;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
        margin-right: 16rpx;
    }

    .invite-rule-reward {
        background: linear-gradient(135deg, #F5A0B1, #F5C6A0);
        font-size: 22rpx;
        padding: 6rpx 16rpx;
        border-radius: 16rpx;
        flex-shrink: 0;
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

    .invite-avatar {
        width: 72rpx;
        height: 72rpx;
        flex-shrink: 0;
    }

    .invite-reward-status {
        font-size: 22rpx;
        padding: 4rpx 16rpx;
        border-radius: 16rpx;
        flex-shrink: 0;
    }

    .invite-reward-status--done {
        background-color: #F0FFF4;
        color: #6ABF8A;
        border: 1px solid #6ABF8A;
    }

    .invite-reward-status--pending {
        background-color: #FFF5E6;
        color: #E8A050;
        border: 1px solid #E8A050;
    }

    .invite-cta-section {
        padding: 20rpx 0;
    }

    .invite-cta-title {
        font-size: 34rpx;
        font-weight: bold;
        color: #333;
    }

    .invite-cta-desc {
        line-height: 1.6;
    }

    .invite-cta-btn {
        background: linear-gradient(135deg, #F5A0B1, #F5C6A0);
        padding: 24rpx;
        border-radius: 40rpx;
        display: inline-block;
        min-width: 400rpx;
    }

    .invite-cta-login {
        padding: 16rpx 0;
    }
</style>
