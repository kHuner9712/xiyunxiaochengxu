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

            <!-- 搜索栏 -->
            <view class="search-bar padding-horizontal-main padding-top-sm padding-bottom-sm">
                <view class="search-input-wrap flex-row align-c bg-white border-radius-main padding-horizontal-main">
                    <iconfont name="icon-search" size="28rpx" color="#999"></iconfont>
                    <input type="text" v-model="search_keyword" placeholder="搜索活动" placeholder-class="cr-grey-9" class="search-input cr-base text-size-sm margin-left-sm" confirm-type="search" @confirm="search_event" />
                    <view v-if="search_keyword" class="search-clear cp" @tap="clear_search_event">
                        <uni-icons type="clear" size="16" color="#999"></uni-icons>
                    </view>
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
                                                <text v-if="item.is_signed_up" class="signed-badge margin-left-xs">已报名</text>
                                            </view>
                                            <view class="activity-price">
                                                <text v-if="item.is_free == 1" class="muying-badge-pink">免费</text>
                                                <text v-else class="cr-main fw-b text-size">¥{{ item.price }}</text>
                                            </view>
                                        </view>
                                    </view>
                                    <!-- 阶段标签 -->
                                    <view class="activity-stage-tag">
                                        <text :class="'muying-stage-tag ' + item.stage_class">{{ item.stage_name }}</text>
                                    </view>
                                    <!-- 报名状态角标 -->
                                    <view v-if="item.signup_status === 'full'" class="activity-status-badge activity-status-full">
                                        <text class="text-size-xs cr-white">已满</text>
                                    </view>
                                    <view v-else-if="item.signup_status === 'ended'" class="activity-status-badge activity-status-ended">
                                        <text class="text-size-xs cr-white">已截止</text>
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
    import { MuyingStage, MuyingActivityCategory } from '@/common/js/config/muying-enum';
    import { request as http_request } from '@/common/js/http.js';

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
                stage_tabs: MuyingStage.getFilterTabs(),
                stage_active_index: 0,
                category_tabs: MuyingActivityCategory.getFilterTabs(),
                category_active_index: 0,
                search_keyword: '',
                is_logged_in: false,
            };
        },

        components: {
            componentCommon,
            componentNoData,
            componentBottomLine,
        },

        onLoad(params) {
            app.globalData.page_event_onload_handle(params);
            if (params && params.stage) {
                var tabs = this.stage_tabs;
                for (var i = 0; i < tabs.length; i++) {
                    if (tabs[i].value === params.stage) {
                        this.setData({ stage_active_index: i });
                        break;
                    }
                }
            }
            if (params && params.awd) {
                this.setData({ search_keyword: params.awd });
            }
        },

        onShow() {
            app.globalData.page_event_onshow_handle();
            if ((this.$refs.common || null) != null) {
                this.$refs.common.on_show();
            }
            this.is_logged_in = !!app.globalData.get_user_cache_info();
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

                var request_data = { page: this.data_page };
                if (selected_stage) {
                    request_data.stage = selected_stage;
                }
                if (selected_category) {
                    request_data.category = selected_category;
                }
                if (this.search_keyword.trim()) {
                    request_data.awd = this.search_keyword.trim();
                }

                http_request({
                    controller: 'activity',
                    action: 'index',
                    data: request_data,
                    success: function (data) {
                        uni.stopPullDownRefresh();
                        var list = data.items || [];
                        self.setData({
                            data_list: self.data_page > 1 ? self.data_list.concat(list) : list,
                            data_list_loding_status: list.length > 0 ? 3 : 0,
                            data_bottom_line_status: (data.page_total || 0) <= self.data_page,
                            data_page_total: data.page_total || 0,
                            data_is_loading: 0,
                        });
                    },
                    fail: function () {
                        uni.stopPullDownRefresh();
                        self.setData({
                            data_list_loding_status: 0,
                            data_is_loading: 0,
                        });
                    },
                });
            },

            search_event() {
                this.init();
            },

            clear_search_event() {
                this.setData({ search_keyword: '' });
                this.init();
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
                if (this.data_is_loading == 1 || this.data_page >= this.data_page_total) {
                    return false;
                }
                this.setData({ data_page: this.data_page + 1 });
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
        background-color: #fff8f5;
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

    .search-bar {
        position: relative;
        z-index: 5;
    }

    .search-input-wrap {
        height: 64rpx;
        border: 1rpx solid #f0f0f0;
    }

    .search-input {
        flex: 1;
        height: 64rpx;
        font-size: 26rpx;
    }

    .search-clear {
        padding: 4rpx;
    }

    .stage-tabs {
        position: relative;
        z-index: 5;
        padding-top: 8rpx;
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
        background-color: #ffffff;
        border: 1px solid #eeeeee;
        transition: all 0.2s;
    }

    .stage-tab-active {
        background: linear-gradient(135deg, #f5a0b1 0%, #f5c6a0 100%);
        color: #ffffff;
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
        color: #f5a0b1;
        background-color: #fff0f3;
        font-weight: bold;
    }

    .activity-list-scroll {
        height: calc(100vh - 430rpx);
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

    .activity-status-badge {
        position: absolute;
        top: 16rpx;
        right: 16rpx;
        z-index: 2;
        padding: 4rpx 16rpx;
        border-radius: 16rpx;
    }

    .activity-status-full {
        background-color: rgba(229, 115, 115, 0.85);
    }

    .activity-status-ended {
        background-color: rgba(153, 153, 153, 0.85);
    }

    .signed-badge {
        display: inline-block;
        padding: 2rpx 10rpx;
        border-radius: 8rpx;
        font-size: 20rpx;
        color: #fff;
        background: linear-gradient(135deg, #f5a0b1, #f5c6a0);
    }

    .activity-meta {
        gap: 4rpx;
    }
</style>
