<template>
    <view :class="theme_view">
        <view class="page-bottom-fixed">
            <!-- 顶部Tab栏 -->
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

            <!-- 我的活动列表 -->
            <view v-if="current_tab === 'activity'" class="padding-main">
                <block v-if="activity_list.length > 0">
                    <view v-for="(item, index) in activity_list" :key="index" class="muying-card spacing-mb padding-main">
                        <view class="flex-row jc-sb align-c">
                            <view class="flex-1">
                                <view class="text-size fw-b">{{ item.title }}</view>
                                <view class="text-size-sm cr-grey margin-top-xs">{{ item.time }}</view>
                            </view>
                            <view :class="['muying-stage-tag', 'muying-stage-tag--' + item.status_type]">{{ item.status_text }}</view>
                        </view>
                        <view class="muying-divider margin-top-main margin-bottom-main"></view>
                        <view class="flex-row jc-sb align-c">
                            <view class="text-size-sm cr-grey-9">{{ item.location }}</view>
                            <view class="text-size-sm cr-main cp" @tap="view_detail(item)">查看详情</view>
                        </view>
                    </view>
                </block>
                <block v-else>
                    <component-no-data propStatus="0" propMsg="暂无活动数据"></component-no-data>
                </block>
            </view>

            <!-- 我的报名列表 -->
            <view v-if="current_tab === 'signup'" class="padding-main">
                <block v-if="signup_list.length > 0">
                    <view v-for="(item, index) in signup_list" :key="index" class="muying-card spacing-mb padding-main">
                        <view class="flex-row jc-sb align-c">
                            <view class="flex-1">
                                <view class="text-size fw-b">{{ item.title }}</view>
                                <view class="text-size-sm cr-grey margin-top-xs">报名时间：{{ item.signup_time }}</view>
                            </view>
                            <view :class="['muying-stage-tag', 'muying-stage-tag--' + item.status_type]">{{ item.status_text }}</view>
                        </view>
                        <view class="muying-divider margin-top-main margin-bottom-main"></view>
                        <view class="flex-row jc-sb align-c">
                            <view class="text-size-sm cr-grey-9">报名人数：{{ item.signup_count }}人</view>
                            <view class="text-size-sm cr-main cp" @tap="view_detail(item)">查看详情</view>
                        </view>
                    </view>
                </block>
                <block v-else>
                    <component-no-data propStatus="0" propMsg="暂无报名记录"></component-no-data>
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
                current_tab: 'activity',
                activity_list: [
                    {
                        id: 1,
                        title: '孕期瑜伽体验课',
                        time: '2026-04-20 14:00',
                        location: '云溪母婴中心3楼',
                        status_text: '进行中',
                        status_type: 'pregnant'
                    },
                    {
                        id: 2,
                        title: '新生儿护理讲座',
                        time: '2026-04-25 10:00',
                        location: '云溪母婴中心2楼',
                        status_text: '即将开始',
                        status_type: 'prepare'
                    },
                    {
                        id: 3,
                        title: '产后修复训练营',
                        time: '2026-05-01 09:00',
                        location: '云溪健身中心',
                        status_text: '已结束',
                        status_type: 'common'
                    }
                ],
                signup_list: [
                    {
                        id: 1,
                        title: '孕期瑜伽体验课',
                        signup_time: '2026-04-15 10:30',
                        signup_count: 28,
                        status_text: '已确认',
                        status_type: 'pregnant'
                    },
                    {
                        id: 2,
                        title: '新生儿护理讲座',
                        signup_time: '2026-04-16 09:00',
                        signup_count: 45,
                        status_text: '待确认',
                        status_type: 'prepare'
                    },
                    {
                        id: 3,
                        title: '亲子早教体验课',
                        signup_time: '2026-04-10 14:00',
                        signup_count: 20,
                        status_text: '已取消',
                        status_type: 'common'
                    }
                ]
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
        },

        methods: {
            switch_tab(tab) {
                this.setData({ current_tab: tab });
            },

            view_detail(item) {
                app.globalData.showToast('活动详情开发中');
            }
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
</style>
