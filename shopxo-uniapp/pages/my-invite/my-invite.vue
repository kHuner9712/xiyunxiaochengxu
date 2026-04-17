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
                            <view class="text-size-sm cr-grey margin-top-xs">获得奖励(元)</view>
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
                        <text class="cr-white text-size">邀请好友 赢奖励</text>
                    </view>
                </view>
            </view>

            <!-- 奖励记录 -->
            <view class="padding-horizontal-main">
                <view class="text-size fw-b margin-bottom-main">奖励记录</view>
                <block v-if="reward_list.length > 0">
                    <view v-for="(item, index) in reward_list" :key="index" class="muying-card spacing-mb padding-main">
                        <view class="flex-row jc-sb align-c">
                            <view class="flex-1">
                                <view class="text-size">{{ item.desc }}</view>
                                <view class="text-size-sm cr-grey margin-top-xs">{{ item.time }}</view>
                            </view>
                            <view :class="['text-size fw-b', item.amount > 0 ? 'cr-red' : 'cr-grey']">
                                {{ item.amount > 0 ? '+' : '' }}{{ item.amount }}元
                            </view>
                        </view>
                    </view>
                </block>
                <block v-else>
                    <component-no-data propStatus="0" propMsg="暂无奖励记录"></component-no-data>
                </block>
            </view>
        </view>

        <!-- 公共 -->
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
                invite_code: '',
                invite_stats: {
                    total_invites: 0,
                    total_rewards: 0
                },
                reward_list: [],
                loading: false
            };
        },

        components: {
            componentCommon,
            componentNoData
        },

        onLoad(params) {
            app.globalData.page_event_onload_handle(params);
        },

        onShow() {
            app.globalData.page_event_onshow_handle();
            if ((this.$refs.common || null) != null) {
                this.$refs.common.on_show();
            }
            this.get_invite_info();
            this.get_reward_list();
        },

        methods: {
            copy_invite_code() {
                uni.setClipboardData({
                    data: this.invite_code,
                    success: () => {
                        app.globalData.showToast('邀请码已复制', 'success');
                    }
                });
            },

            share_event() {
                app.globalData.showToast('分享功能暂未开放');
            },

            get_invite_info() {
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
                                invite_stats: {
                                    total_invites: data.invite_count || 0,
                                    total_rewards: data.reward_total || 0,
                                },
                            });
                        } else {
                            app.globalData.showToast(res.data.msg || '获取邀请信息失败');
                        }
                    },
                    fail: function() {
                        app.globalData.showToast('网络异常，请重试');
                    },
                });
            },

            get_reward_list() {
                var self = this;
                uni.request({
                    url: app.globalData.get_request_url('rewardlist', 'invite'),
                    method: 'POST',
                    dataType: 'json',
                    success: function(res) {
                        if (res.data.code == 0) {
                            var list = (res.data.data || {}).data || [];
                            var reward_list = [];
                            for (var i = 0; i < list.length; i++) {
                                var item = list[i];
                                reward_list.push({
                                    id: item.id,
                                    desc: (item.trigger_event_text || '') + ' ' + (item.invitee_info ? item.invitee_info.nickname || '' : ''),
                                    time: item.add_time_text || '',
                                    amount: item.reward_type === 'integral' ? item.reward_value : 0,
                                });
                            }
                            self.setData({ reward_list: reward_list });
                        }
                    },
                    fail: function() {},
                });
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
