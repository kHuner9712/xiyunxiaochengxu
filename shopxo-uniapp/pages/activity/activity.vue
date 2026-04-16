<template>
    <view :class="theme_view">
        <view class="activity-page">
            <!-- 自定义导航栏 -->
            <view class="nav-top pr" :style="'padding-top:' + status_bar_height + 'px;'">
                <view class="nav-top-bg pa top-0 left-0 right-0 wh-auto oh">
                    <image :src="theme_static_url + 'top-bg.png'" mode="widthFix" class="wh-auto"></image>
                </view>
                <view class="nav-top-content pr padding-horizontal-main flex-row align-c jc-c">
                    <text class="nav-top-title cr-white fw-b text-size-lg">活动中心</text>
                </view>
            </view>

            <!-- 阶段筛选 -->
            <view class="stage-tabs padding-horizontal-main">
                <scroll-view :scroll-x="true" :show-scrollbar="false" class="stage-tabs-scroll">
                    <view class="stage-tabs-inner flex-row">
                        <block v-for="(item, index) in stage_tabs" :key="index">
                            <view class="stage-tab-item cp" :class="stage_active_index == index ? 'stage-tab-active' : ''" :data-index="index" @tap="stage_tab_event">
                                <text>{{ item.name }}</text>
                            </view>
                        </block>
                    </view>
                </scroll-view>
            </view>

            <!-- 分类筛选 -->
            <view class="category-tabs padding-horizontal-main">
                <scroll-view :scroll-x="true" :show-scrollbar="false" class="category-tabs-scroll">
                    <view class="category-tabs-inner flex-row">
                        <block v-for="(item, index) in category_tabs" :key="index">
                            <view class="category-tab-item cp" :class="category_active_index == index ? 'category-tab-active' : ''" :data-index="index" @tap="category_tab_event">
                                <text>{{ item.name }}</text>
                            </view>
                        </block>
                    </view>
                </scroll-view>
            </view>

            <!-- 活动列表 -->
            <scroll-view scroll-y class="activity-list-scroll" :scroll-top="scroll_top" @scrolltolower="scroll_lower" lower-threshold="60">
                <view class="activity-list padding-horizontal-main">
                    <block v-if="data_list.length > 0">
                        <block v-for="(item, index) in data_list" :key="index">
                            <view class="muying-activity-card margin-bottom-main cp" :data-index="index" @tap="activity_detail_event">
                                <view class="activity-card-content pr z-i">
                                    <!-- 封面图 -->
                                    <view class="activity-cover border-radius-main oh">
                                        <image :src="item.cover" mode="aspectFill" class="wh-auto"></image>
                                    </view>
                                    <!-- 活动信息 -->
                                    <view class="activity-info margin-top-sm">
                                        <view class="activity-title fw-b text-size cr-base single-text">{{ item.title }}</view>
                                        <view class="activity-meta margin-top-xs flex-row align-c">
                                            <iconfont name="icon-time" size="24rpx" color="#999"></iconfont>
                                            <text class="cr-grey-9 text-size-xs margin-left-xs">{{ item.time }}</text>
                                        </view>
                                        <view v-if="item.address" class="activity-meta margin-top-xs flex-row align-c">
                                            <iconfont name="icon-location" size="24rpx" color="#999"></iconfont>
                                            <text class="cr-grey-9 text-size-xs margin-left-xs">{{ item.address }}</text>
                                        </view>
                                        <view class="activity-bottom margin-top-sm flex-row jc-sb align-c">
                                            <view class="activity-signup flex-row align-c">
                                                <text class="cr-grey-9 text-size-xs">{{ item.signup_count }}人已报名</text>
                                            </view>
                                            <view class="activity-price">
                                                <text v-if="item.price == 0" class="muying-badge-pink">免费</text>
                                                <text v-else class="cr-main fw-b text-size">¥{{ item.price }}</text>
                                            </view>
                                        </view>
                                    </view>
                                    <!-- 阶段标签 -->
                                    <view class="activity-stage-tag">
                                        <text :class="'muying-stage-tag ' + item.stage_class">{{ item.stage_name }}</text>
                                    </view>
                                </view>
                            </view>
                        </block>
                    </block>
                    <block v-else>
                        <component-no-data :propStatus="data_list_loding_status"></component-no-data>
                    </block>
                </view>
                <!-- 结尾 -->
                <component-bottom-line :propStatus="data_bottom_line_status"></component-bottom-line>
            </scroll-view>

            <!-- 底部公共 -->
            <component-common ref="common" :propIsGrayscale="false"></component-common>
        </view>
    </view>
</template>

<script>
    const app = getApp();
    var bar_height = parseInt(app.globalData.get_system_info('statusBarHeight')) || 0;
    import componentCommon from '@/components/common/common';
    import componentNoData from '@/components/no-data/no-data';
    import componentBottomLine from '@/components/bottom-line/bottom-line';

    export default {
        data() {
            return {
                theme_view: app.globalData.get_theme_value_view(),
                theme_static_url: app.globalData.get_static_url('muying'),
                status_bar_height: bar_height,
                data_list_loding_status: 1,
                data_bottom_line_status: false,
                data_list: [],
                data_page: 1,
                data_page_total: 0,
                data_is_loading: 0,
                scroll_top: 0,
                stage_tabs: [
                    { name: '全部', value: '' },
                    { name: '备孕', value: 'prepare' },
                    { name: '孕期', value: 'pregnant' },
                    { name: '产后', value: 'postpartum' },
                ],
                stage_active_index: 0,
                category_tabs: [
                    { name: '全部', value: '' },
                    { name: '孕妈课堂', value: 'class' },
                    { name: '线下沙龙', value: 'salon' },
                    { name: '试用活动', value: 'trial' },
                    { name: '讲座报名', value: 'lecture' },
                ],
                category_active_index: 0,
            };
        },

        components: {
            componentCommon,
            componentNoData,
            componentBottomLine,
        },

        onLoad(params) {
            app.globalData.page_event_onload_handle(params);
        },

        onShow() {
            app.globalData.page_event_onshow_handle();

            if ((this.$refs.common || null) != null) {
                this.$refs.common.on_show();
            }

            this.init();
        },

        onPullDownRefresh() {
            this.init();
        },

        methods: {
            init() {
                this.setData({
                    data_page: 1,
                    data_list: [],
                    data_bottom_line_status: false,
                });
                this.get_data_list(1);
            },

            get_data_list(is_mandatory) {
                if (this.data_is_loading == 1) {
                    return false;
                }
                this.setData({ data_is_loading: 1 });

                if (is_mandatory == 1) {
                    this.setData({ data_list_loding_status: 1 });
                }

                var self = this;
                var selected_stage = this.stage_tabs[this.stage_active_index].value;
                var selected_category = this.category_tabs[this.category_active_index].value;
                var params = 'page=' + this.data_page;
                if (selected_stage) {
                    params += '&stage=' + selected_stage;
                }
                if (selected_category) {
                    params += '&category=' + selected_category;
                }

                uni.request({
                    url: app.globalData.get_request_url('index', 'activity') + '&' + params,
                    method: 'POST',
                    dataType: 'json',
                    success: function(res) {
                        uni.stopPullDownRefresh();
                        if (res.data.code == 0) {
                            var data = res.data.data || {};
                            var list = data.data || [];
                            self.setData({
                                data_list: self.data_page > 1 ? self.data_list.concat(list) : list,
                                data_list_loding_status: 3,
                                data_bottom_line_status: (data.page_total || 0) <= self.data_page,
                                data_page_total: data.page_total || 0,
                                data_is_loading: 0,
                            });
                        } else {
                            self.setData({
                                data_list: [],
                                data_page_total: 0,
                                data_is_loading: 0,
                            });
                        }
                    },
                    fail: function() {
                        uni.stopPullDownRefresh();
                        self.setData({
                            data_list: [],
                            data_page_total: 0,
                            data_is_loading: 0,
                        });
                    },
                });
            },



            stage_tab_event(e) {
                var index = e.currentTarget.dataset.index;
                this.setData({ stage_active_index: index });
                this.init();
            },

            category_tab_event(e) {
                var index = e.currentTarget.dataset.index;
                this.setData({ category_active_index: index });
                this.init();
            },

            scroll_lower(e) {
                this.get_data_list(0);
            },

            activity_detail_event(e) {
                var index = e.currentTarget.dataset.index;
                var item = this.data_list[index];
                if (item) {
                    uni.navigateTo({ url: '/pages/activity-detail/activity-detail?id=' + item.id });
                }
            },
        },
    };
</script>

<style lang="scss" scoped>
    .activity-page {
        min-height: 100vh;
        background-color: #FFF8F5;
    }

    .nav-top {
        position: relative;
        z-index: 10;
    }

    .nav-top-bg image {
        width: 100%;
    }

    .nav-top-content {
        height: 88rpx;
        position: relative;
        z-index: 1;
    }

    .nav-top-title {
        text-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.1);
    }

    .stage-tabs {
        position: relative;
        z-index: 5;
        padding-top: 16rpx;
        padding-bottom: 8rpx;
    }

    .stage-tabs-scroll {
        white-space: nowrap;
    }

    .stage-tabs-inner {
        gap: 16rpx;
    }

    .stage-tab-item {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        padding: 10rpx 28rpx;
        border-radius: 28rpx;
        font-size: 26rpx;
        color: #666;
        background-color: #FFFFFF;
        border: 1px solid #EEEEEE;
        transition: all 0.2s;
    }

    .stage-tab-active {
        background: linear-gradient(135deg, #F5A0B1 0%, #F5C6A0 100%);
        color: #FFFFFF;
        border-color: transparent;
    }

    .category-tabs {
        position: relative;
        z-index: 5;
        padding-bottom: 16rpx;
    }

    .category-tabs-scroll {
        white-space: nowrap;
    }

    .category-tabs-inner {
        gap: 12rpx;
    }

    .category-tab-item {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        padding: 8rpx 24rpx;
        border-radius: 24rpx;
        font-size: 24rpx;
        color: #999;
        background-color: transparent;
        transition: all 0.2s;
    }

    .category-tab-active {
        color: #F5A0B1;
        background-color: #FFF0F3;
        font-weight: bold;
    }

    .activity-list-scroll {
        height: calc(100vh - 360rpx);
    }

    .activity-cover {
        width: 100%;
        height: 320rpx;
        overflow: hidden;
    }

    .activity-cover image {
        width: 100%;
        height: 100%;
    }

    .activity-stage-tag {
        position: absolute;
        top: 16rpx;
        left: 16rpx;
        z-index: 2;
    }

    .activity-meta {
        gap: 4rpx;
    }
</style>
