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
                            <view class="text-size fw-b margin-top-xs invite-code-text">{{ invite_code }}</view>
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
                invite_code: 'YX2026ABC',
                invite_stats: {
                    total_invites: 12,
                    total_rewards: 86.50
                },
                reward_list: [
                    { id: 1, desc: '邀请好友 小红 注册成功', time: '2026-04-15 10:30', amount: 10.00 },
                    { id: 2, desc: '邀请好友 小明 完成首单', time: '2026-04-12 16:20', amount: 20.00 },
                    { id: 3, desc: '邀请好友 小丽 注册成功', time: '2026-04-10 09:15', amount: 10.00 },
                    { id: 4, desc: '邀请好友 小刚 完成首单', time: '2026-04-08 14:00', amount: 20.00 },
                    { id: 5, desc: '邀请好友 小芳 注册成功', time: '2026-04-05 11:30', amount: 10.00 },
                    { id: 6, desc: '邀请奖励提现', time: '2026-04-03 09:00', amount: -83.50 }
                ]
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
                app.globalData.showToast('分享功能开发中');
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
