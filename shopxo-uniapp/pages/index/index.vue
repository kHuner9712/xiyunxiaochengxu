<template>
    <view :class="theme_view">
        <block v-if="page_load_status == 1">
            <view :class="(plugins_mourning_data_is_app ? ' grayscale' : '') + (is_single_page == 1 ? ' single-page-top' : '')">
                <!-- diy模式 -->
                <block v-if="data_mode == 3">
                    <block v-if="load_status == 1">
                        <block v-if="(data_list || null) != null && (data_list.config || null) != null">
                            <component-diy :propValue="data_list.config" :propDataId="data_list.id" :propKey="random_value" @onLocationBack="user_back_choice_location">
                                <!-- 由于diy组件异步加载、默认先加载骨架屏展示 -->
                                <component-no-data propStatus="1" :propLoadingUseSkeleton="true" propPage="home"></component-no-data>
                                <!-- 底部内容 -->
                                <template slot="diy-bottom-content">
                                    <!-- 结尾 -->
                                    <component-bottom-line :propStatus="data_bottom_line_status"></component-bottom-line>
                                    <!-- 版权信息 -->
                                    <component-copyright></component-copyright>
                                </template>
                                <!-- 底部公共 -->
                                <template slot="diy-bottom-common">
                                    <component-common ref="common_footer" :propIsModalBusiness="false" :propIsGrayscale="plugins_mourning_data_is_app"></component-common>
                                </template>
                            </component-diy>
                        </block>
                        <block v-else>
                            <component-no-data propStatus="0" propPage="home"></component-no-data>
                        </block>
                    </block>
                    <block v-else>
                        <component-no-data propStatus="1" propPage="home"></component-no-data>
                    </block>
                    <!-- 底部公共 -->
                    <component-common ref="common" :propIsFooter="false" :propIsGrayscale="plugins_mourning_data_is_app"></component-common>
                </block>
                <!-- 自动和手动模式 -->
                <block v-else>
                    <!-- 顶部内容、如果没有轮播和导航则使用矮的浮动导航背景样式，则使用高的背景样式 -->
                    <view v-if="load_status == 1" class="home-top-nav-content pr" :style="(banner_list.length > 0 || navigation.length > 0 ? top_content_bg_color : top_content_search_bg_color) + top_content_style">
                        <!-- 顶部背景图片 -->
                        <view class="pa top-0 left-0 right-0">
                            <image class="bg-img wh-auto" mode="widthFix" :src="static_url + 'nav-top.png'"></image>
                        </view>

                        <!-- 搜索 -->
                        <view v-if="common_app_is_header_nav_fixed == 1" :class="'search-fixed-seat ' + (common_app_is_enable_search == 1 ? 'nav-enable-search' : '')"></view>
                        <view :class="'pr ' + (common_app_is_header_nav_fixed == 1 ? 'search-content-fixed' : '')" :style="common_app_is_header_nav_fixed == 1 ? top_content_search_bg_color : ''">
                            <view :class="'search-content-fixed-content ' + (common_app_is_enable_search == 1 ? 'nav-enable-search' : '')" :style="(common_app_is_header_nav_fixed == 1 ? top_content_style : '') + (common_app_is_header_nav_fixed == 1 ? top_content_search_content_style : '')">
                                <view class="home-top-nav margin-bottom-sm pr padding-right-main">
                                    <!-- 定位 -->
                                    <view v-if="is_home_location_choice == 1" class="home-top-nav-location dis-inline-block va-m single-text cr-white pr bs-bb padding-left-main padding-right-lg">
                                        <component-choice-location @onBack="user_back_choice_location"></component-choice-location>
                                    </view>
                                    <block v-else>
                                        <!-- logo/标题 -->
                                        <view class="home-top-nav-logo dis-inline-block va-m padding-left-main">
                                            <block v-if="is_home_logo_use_text == 0 && (application_logo || null) != null">
                                                <image :src="application_logo" mode="heightFix" class="home-top-nav-logo-image"></image>
                                            </block>
                                            <block v-else>
                                                <view v-if="(application_title || null) != null" class="home-top-nav-logo-title cr-white single-text">{{ application_title }}</view>
                                            </block>
                                        </view>
                                    </block>
                                    <!-- #ifdef H5 || APP -->
                                    <!-- 右上角icon列表 -->
                                    <view v-if="(right_icon_list || null) != null && right_icon_list.length > 0" class="nav-top-right-icon fr">
                                        <block v-for="(item, index) in right_icon_list">
                                            <view class="item dis-inline-block cp pr" :data-value="item.url || ''" @tap="url_event">
                                                <iconfont :name="item.icon" size="38rpx" color="#fff"></iconfont>
                                                <view v-if="(item.badge || null) != null" class="badge-icon pa">
                                                    <component-badge :propNumber="item.badge"></component-badge>
                                                </view>
                                            </view>
                                        </block>
                                    </view>
                                    <!-- #endif -->
                                </view>
                                <view v-if="common_app_is_enable_search == 1" class="search-content-input padding-horizontal-main">
                                    <!-- 是否开启搜索框前面icon扫一扫 -->
                                    <block v-if="is_home_search_scan == 1">
                                        <component-search :propIsEnterSearchStart="true" :propIsBtn="true" propSize="sm" :propPlaceholder="$t('customview.customview.726k7y')" propPlaceholderClass="cr-grey-c" propIconColor="#999" propBgColor="#fff"
                                            <!-- #ifndef H5 -->
                                            @onicon="search_icon_event" propIcon="icon-scan" :propIsIconOnEvent="true"
                                            <!-- #endif -->
                                        ></component-search>
                                    </block>
                                    <block v-else>
                                        <component-search :propIsEnterSearchStart="true" :propIsBtn="true" propSize="sm" :propPlaceholder="$t('customview.customview.726k7y')" propPlaceholderClass="cr-grey-c" propIconColor="#999" propBgColor="#fff"></component-search>
                                    </block>
                                </view>
                            </view>
                        </view>

                        <!-- 轮播 -->
                        <view class="banner-content padding-horizontal-main margin-top-xs" v-if="banner_list.length > 0">
                            <component-banner :propData="banner_list" @changeBanner="change_banner"></component-banner>
                        </view>
                        <!-- 导航 -->
                        <view v-if="navigation.length > 0" class="spacing-mt" :class="load_status == 1 && (common_shop_notice || null) != null ? '' : ' spacing-mb'">
                            <view class="padding-horizontal-main">
                                <view class="bg-white border-radius-main">
                                    <component-icon-nav :propData="{ ...{ data: navigation }, ...{ random: random_value } }"></component-icon-nav>
                                </view>
                            </view>
                        </view>
                    </view>

                    <!-- 内容 -->
                    <view class="content padding-horizontal-main pr">
                        <!-- 阶段引导卡片（未设置阶段的用户） -->
                        <view v-if="!muying_current_stage && is_feature_enabled(FeatureFlagKey.ACTIVITY)" class="muying-stage-guide muying-card margin-top-main" @tap="go_personal_event">
                            <view class="muying-stage-guide-icon">🤰</view>
                            <view class="muying-stage-guide-text">
                                <text class="muying-stage-guide-title">完善孕育阶段，获取个性化推荐</text>
                                <text class="muying-stage-guide-desc">告诉我们您当前的状态，为您推荐合适的活动和商品</text>
                            </view>
                            <text class="muying-stage-guide-arrow">›</text>
                        </view>

                        <!-- 三大阶段入口 -->
                        <component-stage-nav v-if="is_feature_enabled(FeatureFlagKey.ACTIVITY)" ref="stageNav" @stage-click="stage_click_event"></component-stage-nav>

                        <view class="muying-section" v-if="is_feature_enabled(FeatureFlagKey.ACTIVITY)">
                            <view class="muying-section-header">
                                <text class="muying-section-title">推荐活动</text>
                                <text class="muying-section-more" @tap="activity_more_event">更多 ›</text>
                            </view>
                            <scroll-view v-if="muying_activity_list.length > 0" scroll-x class="muying-activity-scroll">
                                <view v-for="(item, index) in muying_activity_list" :key="index" class="muying-activity-item" @tap="activity_item_event(item)">
                                    <image :src="item.cover" mode="aspectFill" class="muying-activity-cover"></image>
                                    <view class="muying-activity-info">
                                        <text class="muying-activity-title">{{item.title}}</text>
                                        <text class="muying-activity-time">{{item.time_text}}</text>
                                        <view class="muying-activity-bottom">
                                            <text class="muying-stage-tag" :class="item.stage_class">{{item.stage_name}}</text>
                                            <text class="muying-activity-price">{{item.is_free ? '免费' : '¥' + item.price}}</text>
                                        </view>
                                    </view>
                                </view>
                            </scroll-view>
                            <view v-else class="muying-goods-empty tc padding-vertical-main">
                                <text class="cr-grey text-size-sm">暂无推荐活动</text>
                            </view>
                        </view>

                        <!-- 按阶段推荐商品 -->
                        <view class="muying-section" v-if="muying_goods_list.length > 0 || muying_current_stage">
                            <view class="muying-section-header">
                                <text class="muying-section-title">为你推荐</text>
                                <view class="muying-stage-filter">
                                    <text v-for="(s, i) in muying_stage_tabs" :key="i" class="muying-stage-filter-item" :class="{'muying-stage-filter-active': muying_current_stage === s.value}" @tap="muying_stage_change(s.value)">{{s.name}}</text>
                                </view>
                            </view>
                            <view v-if="muying_goods_list.length > 0" class="muying-goods-grid">
                                <view v-for="(item, index) in muying_goods_list" :key="index" class="muying-goods-item muying-card" @tap="goods_item_event(item)">
                                    <image :src="item.images" mode="aspectFill" class="muying-goods-image"></image>
                                    <view class="muying-goods-info">
                                        <text class="muying-goods-title">{{item.title}}</text>
                                        <view class="muying-goods-tags" v-if="item.tags && item.tags.length > 0">
                                            <text v-for="(tag, ti) in item.tags.slice(0,2)" :key="ti" class="muying-article-tag">{{tag}}</text>
                                        </view>
                                        <text class="muying-goods-price">¥{{item.price}}</text>
                                    </view>
                                </view>
                            </view>
                            <view v-else class="muying-goods-empty tc padding-vertical-main">
                                <text class="cr-grey text-size-sm">该阶段暂无推荐商品，试试其他阶段吧</text>
                            </view>
                        </view>

                        <view class="muying-section" v-if="is_feature_enabled(FeatureFlagKey.CONTENT)">
                            <view class="muying-section-header">
                                <text class="muying-section-title">孕育知识</text>
                                <text class="muying-section-more" @tap="article_more_event">更多 ›</text>
                            </view>
                            <view v-if="muying_article_list.length > 0">
                                <view v-for="(item, index) in muying_article_list" :key="index" class="muying-article-item muying-card" @tap="article_item_event(item)">
                                    <text class="muying-article-title">{{item.title}}</text>
                                    <text class="muying-article-desc">{{item.desc}}</text>
                                    <view class="muying-article-tags">
                                        <text v-for="(tag, ti) in item.tags" :key="ti" class="muying-article-tag">{{tag}}</text>
                                    </view>
                                </view>
                            </view>
                            <view v-else class="muying-goods-empty tc padding-vertical-main">
                                <text class="cr-grey text-size-sm">暂无孕育知识</text>
                            </view>
                        </view>

                        <view class="muying-section" v-if="is_feature_enabled(FeatureFlagKey.FEEDBACK)">
                            <view class="muying-section-header">
                                <text class="muying-section-title">妈妈说</text>
                            </view>
                            <scroll-view v-if="muying_feedback_list.length > 0" scroll-x class="muying-feedback-scroll">
                                <view v-for="(item, index) in muying_feedback_list" :key="index" class="muying-feedback-item muying-card">
                                    <view class="muying-feedback-user">
                                        <text class="muying-feedback-avatar">{{item.avatar_emoji}}</text>
                                        <text class="muying-feedback-name">{{item.name}}</text>
                                    </view>
                                    <text class="muying-feedback-content">{{item.content}}</text>
                                    <text class="muying-feedback-stage">{{item.stage_text}}</text>
                                </view>
                            </scroll-view>
                            <view v-else class="muying-goods-empty tc padding-vertical-main">
                                <text class="cr-grey text-size-sm">暂无用户反馈</text>
                            </view>
                        </view>

                        <view class="muying-section" v-if="is_feature_enabled(FeatureFlagKey.INVITE)">
                            <view class="muying-invite-entry" @tap="invite_event">
                                <view class="muying-invite-text">
                                    <text class="muying-invite-title">邀请有礼</text>
            <text class="muying-invite-desc">邀好友 首单得积分</text>
                                </view>
                                <text class="muying-invite-btn">立即邀请 ›</text>
                            </view>
                        </view>

                        <!-- Phase-1 scope: removed long-disabled false template branches -->
                    </view>
                </block>

                <!-- 提示信息 -->
                <block v-if="load_status == 0">
                    <component-no-data :propStatus="data_list_loding_status" :propMsg="data_list_loding_msg" propPage="home" :propIsHeader="true"></component-no-data>
                </block>
            </view>

            <!-- 模式 -->
            <block v-if="data_mode != 3">
                <!-- 页面已加载 -->
                <block v-if="load_status == 1">
                    <!-- 结尾 -->
                    <component-bottom-line :propStatus="data_bottom_line_status"></component-bottom-line>

                    <!-- 版权信息 -->
                    <component-copyright></component-copyright>

                    <!-- 在线客服 -->
                    <component-online-service :propIsNav="true" :propIsBar="true" :propIsGrayscale="plugins_mourning_data_is_app"></component-online-service>

                    <!-- 快捷导航 -->
                    <component-quick-nav :propIsNav="true" :propIsBar="true" :propIsGrayscale="plugins_mourning_data_is_app"></component-quick-nav>
                </block>

                <!-- 公共 -->
                <component-common ref="common" :propIsGrayscale="plugins_mourning_data_is_app"></component-common>
            </block>
            </block>
        <block v-else>
            <component-no-data propStatus="1" propPage="home" :propIsHeader="true"></component-no-data>
        </block>
    </view>
</template>
<script>
    const app = getApp();
    import componentCommon from '@/components/common/common';
    import componentSearch from '@/components/search/search';
    import componentQuickNav from '@/components/quick-nav/quick-nav';
    import componentIconNav from '@/components/icon-nav/icon-nav';
    import componentBanner from '@/components/slider/slider';
    import componentBadge from '@/components/badge/badge';
    import componentNoData from '@/components/no-data/no-data';
    import componentBottomLine from '@/components/bottom-line/bottom-line';
    import componentCopyright from '@/components/copyright/copyright';
    import componentOnlineService from '@/components/online-service/online-service';
    import componentDiy from '@/pages/diy/components/diy/diy';
    import componentChoiceLocation from '@/components/choice-location/choice-location';
    import componentStageNav from '@/components/stage-nav/stage-nav';
    import { filter_phase_one_navigation, filter_phase_one_plugin_sort_list, is_feature_enabled } from '@/common/js/config/phase-one-scope.js';
    import { FeatureFlagKey } from '@/common/js/config/muying-constants.js';
    import { MuyingStage } from '@/common/js/config/muying-enum';
    import { request as http_request } from '@/common/js/http.js';
    import { logger } from '@/common/js/logger.js';

    // 状态栏高度
    var bar_height = parseInt(app.globalData.get_system_info('statusBarHeight', 0, true));
    // #ifdef MP-TOUTIAO
    bar_height = 0;
    // #endif
    export default {
        data() {
            return {
                FeatureFlagKey: FeatureFlagKey,
                theme_view: '',
                theme_color: '',
                common_static_url: '',
                seckill_static_url: '',
                static_url: '',
                data_list_loding_status: 1,
                data_list_loding_msg: '',
                data_bottom_line_status: false,
                page_load_status: 0,
                load_status: 0,
                currency_symbol: app.globalData.currency_symbol(),
                is_home_search_scan: app.globalData.data.is_home_search_scan,
                data_list: [],
                banner_list: [],
                navigation: [],
                article_list: [],
                cart_total: 0,
                message_total: 0,
                right_icon_list: [],
                // 首页数据模式
                data_mode: 0,
                // 增加随机数，避免无法监听数据列表内部数据更新
                random_value: 0,
                // 基础配置
                common_shop_notice: null,
                common_app_is_enable_search: 0,
                common_app_is_header_nav_fixed: 0,
                common_app_is_online_service: 0,
                // 顶部导航、名称、logo、定位
                application_title: app.globalData.data.application_title,
                application_logo: app.globalData.data.application_logo,
                is_home_logo_use_text: app.globalData.data.is_home_logo_use_text,
                is_home_location_choice: app.globalData.data.is_home_location_choice,
                // 顶部+搜索样式配置
                top_content_bg_color: '',
                top_content_search_bg_color: '',
                top_content_search_content_style: '',
                // #ifdef MP
                top_content_style: 'padding-top:' + (bar_height + 10) + 'px;',
                // #endif
                // #ifdef H5 || MP-TOUTIAO
                top_content_style: 'padding-top:' + (bar_height + 14) + 'px;',
                // #endif
                // #ifdef APP
                top_content_style: 'padding-top:' + bar_height + 'px;',
                // #endif
                // 是否单页预览
                is_single_page: app.globalData.is_current_single_page() || 0,
                // 轮播滚动时，背景色替换
                slider_bg: null,
                // 插件顺序列表
                plugins_sort_list: [],
                // 限时秒杀插件
                plugins_seckill_data: null,
                // 购买记录插件
                plugins_salerecords_data: null,
                // 活动配置插件
                plugins_activity_data: null,
                // 标签插件
                plugins_label_data: null,
                // 首页中间广告插件
                plugins_homemiddleadv_data: null,
                // 哀悼灰度插件
                plugins_mourning_data_is_app: app.globalData.is_app_mourning(),
                // 标签插件
                plugins_blog_data: null,
                // 门店插件
                plugins_realstore_data: null,
                // 多商户插件
                plugins_shop_data: null,
                // 组合搭配插件
                plugins_binding_data: null,
                // 魔方插件
                plugins_magic_data: null,
                // 母婴模块数据
                muying_activity_list: [],
                muying_stage_tabs: MuyingStage.getFilterTabs(),
                muying_current_stage: '',
                muying_goods_list: [],
                muying_article_list: [],
                muying_feedback_list: [],
            };
        },

        components: {
            componentCommon,
            componentSearch,
            componentQuickNav,
            componentIconNav,
            componentBanner,
            componentBadge,
            componentNoData,
            componentBottomLine,
            componentCopyright,
            componentOnlineService,
            componentDiy,
            componentChoiceLocation,
            componentStageNav,
        },

        onLoad(params) {
            // 调用公共事件方法
            app.globalData.page_event_onload_handle(params);
        },

        onShow() {
            // Global page onShow hook
            app.globalData.page_event_onshow_handle();

            // Load base mall data
            this.load_home_base_data_on_show();

            // Init global config
            if(app.globalData.get_config('status') == 1) {
                app.globalData.init_config(0, this, 'init_config', true);
            } else {
                app.globalData.is_config(this, 'init_config');
            }

            // Common onShow callbacks
            if ((this.$refs.common || null) != null) {
                this.$refs.common.on_show({object: this, method: 'init'});
            }
            if ((this.$refs.common_footer || null) != null) {
                this.$refs.common_footer.on_show({object: this, method: 'init'});
            }

            // Load maternal-home business data
            this.set_navigation_bar_color();
            this.load_muying_home_data();
        },

        // 下拉刷新
        onPullDownRefresh() {
            if (this.data_list_loding_status === 1) {
                uni.stopPullDownRefresh();
            } else {
                this.init();
            }
        },

        methods: {
            is_feature_enabled(key) {
                return is_feature_enabled(key);
            },

            init_config(status) {
                if ((status || false) == true) {
                    this.setData({
                        page_load_status: 1,
                        currency_symbol: app.globalData.get_config('currency_symbol'),
                        data_mode: parseInt(app.globalData.get_config('config.home_index_floor_data_type', 0)),
                        common_shop_notice: app.globalData.get_config('config.common_shop_notice'),
                        common_app_is_enable_search: app.globalData.get_config('config.common_app_is_enable_search'),
                        common_app_is_header_nav_fixed: app.globalData.get_config('config.common_app_is_header_nav_fixed'),
                        common_app_is_online_service: app.globalData.get_config('config.common_app_is_online_service'),
                        application_title: app.globalData.get_application_title(),
                        application_logo: app.globalData.get_application_logo(),
                    });
                }
            },

            // Home base-data entry (keep init for backward callbacks)
            init(params = {}) {
                this.load_home_base_data(params);
            },

            // Delayed first-load flow for base mall data on onShow
            load_home_base_data_on_show() {
                if(this.load_status == 0 && app.globalData.is_init_config_success_pages_begin()) {
                    let self = this;
                    setTimeout(function() {
                        self.load_home_base_data();
                    }, 500);
                } else {
                    this.load_home_base_data();
                }
            },

            // Base mall data: cache + remote request flow
            load_home_base_data(params = {}) {
                var request_params = Object.assign({}, params);
                var cache_context = this.read_home_base_cache(request_params);

                // #ifdef APP
                // 网络检查
                if ((request_params || null) == null || (request_params.loading || 0) == 0) {
                    app.globalData.network_type_handle(this, 'init', request_params);
                    return false;
                }
                // #endif

                if (cache_context.cache_data == null) {
                    this.setData({
                        data_list_loding_status: 1,
                    });
                }

                this.request_home_base_remote_data(request_params, cache_context.cache_key);
            },

            // Read home base-data cache
            read_home_base_cache(request_params = {}) {
                var cache_key = app.globalData.data.cache_index_data_key;
                var cache_data = null;
                if (this.load_status == 0) {
                    cache_data = uni.getStorageSync(cache_key) || null;
                    if (cache_data != null) {
                        this.setData(cache_data);
                        this.init_result_common_handle();
                        request_params.is_cache = 0;
                        this.set_navigation_bar_color();
                    }
                } else {
                    request_params.is_cache = 0;
                }
                return { cache_key: cache_key, cache_data: cache_data };
            },

            // Request home base-data from remote
            request_home_base_remote_data(request_params, cache_key) {
                uni.request({
                    url: app.globalData.get_request_url('index', 'index'),
                    method: 'POST',
                    data: request_params,
                    dataType: 'json',
                    header: app.globalData.get_request_headers(),
                    success: (res) => {
                        uni.stopPullDownRefresh();
                        var data = res.data.data;
                        if (res.data.code == 0) {
                            var upd_data = this.build_home_base_update_data(data);
                            this.setData(upd_data);
                            uni.setStorageSync(cache_key, upd_data);
                            this.set_navigation_bar_color();

                            if (parseInt(data.is_result_data_cache || 0) == 1) {
                                this.load_home_base_data({ is_cache: 0 });
                            } else {
                                app.globalData.set_tab_bar_badge('cart', this.cart_total);
                            }
                        } else {
                            this.setData({
                                data_list_loding_status: 0,
                                data_list_loding_msg: res.data.msg,
                                data_bottom_line_status: true,
                            });
                        }

                        this.init_result_common_handle();
                    },
                    fail: () => {
                        if (this.load_status == 0 || (this.top_content_search_bg_color || null) == null) {
                            this.change_banner(app.globalData.get_theme_color());
                        }

                        uni.stopPullDownRefresh();
                        this.setData({
                            data_list_loding_status: 2,
                            data_list_loding_msg: this.$t('common.internet_error_tips'),
                            data_bottom_line_status: true,
                            load_status: 1,
                        });
                    },
                });
            },

            // Build home base-data payload
            build_home_base_update_data(data = {}) {
                var data_list = data.data_list || null;
                var navigation = filter_phase_one_navigation(data.navigation || []);
                var right_icon_list = filter_phase_one_navigation(data.right_icon_list || []);
                var plugins_sort_list = filter_phase_one_plugin_sort_list(data.plugins_sort_list || []);

                var upd_data = {
                    random_value: Math.random(),
                    page_load_status: 1,
                    data_bottom_line_status: true,
                    data_mode: data.data_mode || 0,
                    data_list: data_list,
                    data_list_loding_status: data_list == null || data_list.length == 0 ? 0 : 3,

                    banner_list: data.banner_list || [],
                    navigation: navigation,
                    right_icon_list: right_icon_list,
                    article_list: data.article_list || [],
                    cart_total: data.cart_total.buy_number || 0,
                    message_total: parseInt(data.message_total || 0),
                    plugins_sort_list: plugins_sort_list,

                    plugins_mourning_data_is_app: parseInt(data.plugins_mourning_data || 0) == 1,
                };

                // 一期保留的插件数据（购买记录，首页底部展示）
                if ((data.plugins_salerecords_data || null) != null && data.plugins_salerecords_data.length > 0) {
                    upd_data.plugins_salerecords_data = data.plugins_salerecords_data;
                }

                // 一期禁用的插件数据，不赋值，保持 data() 中的 null 初始值
                // 禁用列表：seckill / activity(原生活动插件) / label / homemiddleadv
                //           / blog / realstore / shop / binding / magic
                // 这些插件即使后端返回了数据，前端也不展示，无需赋值

                if (upd_data.plugins_mourning_data_is_app == 1) {
                    upd_data.common_app_is_header_nav_fixed = 0;
                }
                return upd_data;
            },

            // 设置顶部导航的默认颜色
            set_navigation_bar_color() {
                if(this.data_mode == 3) {
                    app.globalData.set_navigation_bar_color(parseInt(app.globalData.get_key_data(this.data_list, 'config.header.com_data.style.function_buttons_type', 0)) == 1);
                }
            },

            // 初始化返回公共处理
            init_result_common_handle() {
                var theme_view = app.globalData.get_theme_value_view();
                var theme_color = app.globalData.get_theme_color();
                var common_static_url = app.globalData.get_static_url('common');
                var static_url = app.globalData.get_static_url('home');

                // 轮播数据处理
                if (this.load_status == 0 || (this.top_content_search_bg_color || null) == null) {
                    var color = this.banner_list && this.banner_list.length > 0 && (this.banner_list[0]['bg_color'] || null) != null ? this.banner_list[0]['bg_color'] : theme_color;
                    this.change_banner(color);
                }

                // 公共数据
                this.setData({
                    top_content_search_content_style: 'background-image: url("' + static_url + 'nav-top.png");',
                    theme_view: theme_view,
                    theme_color: theme_color,
                    common_static_url: common_static_url,
                    static_url: static_url,
                    load_status: 1,
                });

                // 分享菜单处理、延时执行，确保基础数据已加载完成
                setTimeout(function () {
                    app.globalData.page_share_handle();
                }, 3000);
            },

            // 选择用户地理位置回调
            user_back_choice_location(e) {
                // 重新刷新数据
                this.init();
            },

            // url事件
            url_event(e) {
                app.globalData.url_event(e);
            },

            // 轮播改变、背景色处理
            change_banner(color) {
                if ((color || null) == null) {
                    color = this.theme_color;
                }
                this.setData({
                    top_content_bg_color: 'background: linear-gradient(180deg, ' + color + ' 0%, #f5f5f5 80%);',
                    top_content_search_bg_color: 'background: linear-gradient(180deg, ' + color + ' 0%, #f5f5f5 300%);',
                });
            },

            // 搜索icon扫码事件
            search_icon_event(e) {
                app.globalData.scan_handle();
            },

            // Maternal-home business data loader (single entry)
            // Includes activity, stage goods, article and feedback requests
            load_muying_home_data() {
                var stage = this.init_user_stage();
                this.get_muying_activity_list();
                this.get_muying_goods_list(stage);
                this.get_muying_article_list();
                this.get_muying_feedback_list();
            },
            // Stage click event
            stage_click_event(stage) {
                app.globalData.url_open('/pages/activity/activity?stage=' + stage);
            },

            // 母婴模块 - 活动更多
            activity_more_event() {
                app.globalData.url_open('/pages/activity/activity');
            },

            // 母婴模块 - 活动项点击
            activity_item_event(item) {
                app.globalData.url_open('/pages/activity-detail/activity-detail?id=' + item.id);
            },

            // 母婴模块 - 阶段筛选切换
            muying_stage_change(stage) {
                this.setData({ muying_current_stage: stage });
                this.get_muying_goods_list(stage);
            },

            get_muying_goods_list(stage) {
                var self = this;
                var post_data = { n: 20 };
                if (stage) {
                    post_data.stage = stage;
                }
                http_request({
                    action: 'datalist',
                    controller: 'search',
                    data: post_data,
                    loading: false,
                    success: function(data) {
                        var raw = (data && data.data) || [];
                        var list = raw.map(function(item) {
                            return {
                                id: item.id,
                                title: item.title || '',
                                images: item.images || '',
                                price: item.price || '0.00',
                                original_price: item.original_price || '',
                                tags: (item.category_names || '').split(',').filter(function(t) { return t; }),
                                url: '/pages/goods-detail/goods-detail?id=' + item.id,
                            };
                        });
                        self.setData({ muying_goods_list: list });
                        if (list.length === 0 && stage) {
                            logger.warn('index', '阶段推荐返回空列表 stage=' + stage);
                        }
                    },
                    fail: function(err) {
                        self.setData({ muying_goods_list: [] });
                        if (err && !err.feature_disabled) {
                            logger.warn('index', '阶段推荐请求失败 stage=' + stage);
                        }
                    },
                });
            },

            init_user_stage() {
                var user = app.globalData.get_user_cache_info();
                var stage = this.muying_current_stage;
                if (user && user.current_stage && !stage) {
                    stage = user.current_stage;
                    this.setData({ muying_current_stage: stage });
                }
                return stage;
            },

            // 母婴模块 - 活动列表
            get_muying_activity_list() {
                var self = this;
                http_request({
                    action: 'index',
                    controller: 'activity',
                    data: { n: 4 },
                    loading: false,
                    success: function(data) {
                        var list = (data && data.data) || [];
                        self.setData({ muying_activity_list: list });
                    },
                    fail: function() {
                        self.setData({ muying_activity_list: [] });
                    },
                });
            },

            // 母婴模块 - 文章更多
            article_more_event() {
                app.globalData.url_open('/pages/article-category/article-category');
            },

            // 母婴模块 - 文章项点击
            article_item_event(item) {
                app.globalData.url_open('/pages/article-detail/article-detail?id=' + item.id);
            },

            // 母婴模块 - 邀请有礼
            invite_event() {
                app.globalData.url_open('/pages/invite/invite');
            },

            // 母婴模块 - 去完善个人资料
            go_personal_event() {
                var user = app.globalData.get_user_cache_info();
                if (user && user.id) {
                    app.globalData.url_open('/pages/personal/personal');
                } else {
                    app.globalData.url_open('/pages/login/login');
                }
            },

            // 母婴模块 - 商品点击
            goods_item_event(item) {
                app.globalData.url_open('/pages/goods-detail/goods-detail?id=' + item.id);
            },

            get_muying_article_list() {
                var self = this;
                http_request({
                    action: 'datalist',
                    controller: 'article',
                    data: { n: 3 },
                    loading: false,
                    success: function(data) {
                        var raw = (data && data.data) || [];
                        var list = raw.map(function(item) {
                            return {
                                id: item.id,
                                title: item.title || '',
                                desc: item.describe || '',
                                tags: (item.article_category_name || '').split(',').filter(function(t) { return t; }),
                            };
                        });
                        self.setData({ muying_article_list: list });
                    },
                    fail: function() {
                        self.setData({ muying_article_list: [] });
                    },
                });
            },

            get_muying_feedback_list() {
                var self = this;
                http_request({
                    action: 'index',
                    controller: 'feedback',
                    data: { n: 3 },
                    loading: false,
                    success: function(data) {
                        var raw = (data && data.data) || [];
                        var list = raw.map(function(item) {
                            return {
                                avatar_emoji: '\u{1F931}',
                                name: item.nickname || '',
                                content: item.content || '',
                                stage_text: item.stage_text || '',
                            };
                        });
                        self.setData({ muying_feedback_list: list });
                    },
                    fail: function() {
                        self.setData({ muying_feedback_list: [] });
                    },
                });
            },
        },
    };
</script>
<style>
    @import './index.css';
</style>
