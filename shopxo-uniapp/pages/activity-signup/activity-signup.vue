<template>
    <view :class="theme_view">
        <view class="activity-signup-page">
            <!-- 自定义导航栏 -->
            <view class="nav-top pf top-0 left-0 right-0 z-i-deep" :style="'padding-top:' + status_bar_height + 'px;'">
                <view class="nav-top-content pr flex-row align-c jc-c padding-horizontal-main bg-white">
                    <view class="nav-back pa left-0 cp padding-horizontal-main" @tap="nav_back_event">
                        <uni-icons type="back" size="22" color="#333"></uni-icons>
                    </view>
                    <text class="nav-title cr-base fw-b text-size-md">活动报名</text>
                </view>
            </view>

            <!-- 活动摘要卡片 -->
            <view class="summary-container padding-horizontal-main" :style="'padding-top:' + (status_bar_height + 88) + 'px;'">
                <view class="summary-card muying-card padding-main">
                    <view class="flex-row jc-sb align-c">
                        <view class="flex-1">
                            <text class="fw-b text-size cr-base">{{ activity.title }}</text>
                            <view class="flex-row align-c margin-top-xs">
                                <iconfont name="icon-time" size="24rpx" color="#999"></iconfont>
                                <text class="cr-grey-9 text-size-xs margin-left-xs">{{ activity.time }}</text>
                            </view>
                        </view>
                        <view class="price-info">
                            <text v-if="activity.price == 0" class="muying-badge-pink text-size">免费</text>
                            <text v-else class="cr-main fw-b text-size-lg">¥{{ activity.price }}</text>
                        </view>
                    </view>
                </view>
            </view>

            <!-- 报名表单 -->
            <view class="form-container padding-horizontal-main margin-top-main">
                <view class="form-card muying-card padding-main">
                    <view class="form-header flex-row align-c margin-bottom-main">
                        <text class="fw-b text-size cr-base">报名信息</text>
                        <view class="muying-divider flex-1 margin-left-main"></view>
                    </view>

                    <view class="form-items">
                        <!-- 姓名 -->
                        <view class="form-item br-b padding-bottom-main margin-bottom-main">
                            <view class="form-label flex-row align-c">
                                <text class="cr-main">*</text>
                                <text class="cr-base text-size-sm margin-left-xs">姓名</text>
                            </view>
                            <view class="form-input margin-top-xs">
                                <input v-model="form.name" type="text" placeholder="请输入姓名" placeholder-class="cr-grey-9" class="text-size-sm" maxlength="20" />
                            </view>
                        </view>

                        <!-- 手机号 -->
                        <view class="form-item br-b padding-bottom-main margin-bottom-main">
                            <view class="form-label flex-row align-c">
                                <text class="cr-main">*</text>
                                <text class="cr-base text-size-sm margin-left-xs">手机号</text>
                            </view>
                            <view class="form-input margin-top-xs">
                                <input v-model="form.phone" type="number" placeholder="请输入手机号" placeholder-class="cr-grey-9" class="text-size-sm" maxlength="11" />
                            </view>
                        </view>

                        <!-- 当前阶段 -->
                        <view class="form-item br-b padding-bottom-main margin-bottom-main">
                            <view class="form-label flex-row align-c">
                                <text class="cr-main">*</text>
                                <text class="cr-base text-size-sm margin-left-xs">当前阶段</text>
                            </view>
                            <view class="form-input margin-top-xs">
                                <picker :range="stage_options" :value="stage_index" @change="stage_change_event">
                                    <view class="flex-row jc-sb align-c">
                                        <text :class="'text-size-sm ' + (stage_index >= 0 ? 'cr-base' : 'cr-grey-9')">{{ stage_index >= 0 ? stage_options[stage_index] : '请选择当前阶段' }}</text>
                                        <uni-icons type="right" size="16" color="#999"></uni-icons>
                                    </view>
                                </picker>
                            </view>
                        </view>

                        <!-- 预产期（孕期时显示） -->
                        <view v-if="selected_stage === 'pregnancy'" class="form-item br-b padding-bottom-main margin-bottom-main">
                            <view class="form-label flex-row align-c">
                                <text class="cr-main">*</text>
                                <text class="cr-base text-size-sm margin-left-xs">预产期</text>
                            </view>
                            <view class="form-input margin-top-xs">
                                <picker mode="date" :value="form.due_date" :start="due_date_start" @change="due_date_change_event">
                                    <view class="flex-row jc-sb align-c">
                                        <text :class="'text-size-sm ' + (form.due_date ? 'cr-base' : 'cr-grey-9')">{{ form.due_date || '请选择预产期' }}</text>
                                        <uni-icons type="right" size="16" color="#999"></uni-icons>
                                    </view>
                                </picker>
                            </view>
                        </view>

                        <!-- 宝宝生日（产后时显示） -->
                        <view v-if="selected_stage === 'postpartum'" class="form-item br-b padding-bottom-main margin-bottom-main">
                            <view class="form-label flex-row align-c">
                                <text class="cr-main">*</text>
                                <text class="cr-base text-size-sm margin-left-xs">宝宝生日</text>
                            </view>
                            <view class="form-input margin-top-xs">
                                <picker mode="date" :value="form.baby_birthday" :end="baby_birthday_end" @change="baby_birthday_change_event">
                                    <view class="flex-row jc-sb align-c">
                                        <text :class="'text-size-sm ' + (form.baby_birthday ? 'cr-base' : 'cr-grey-9')">{{ form.baby_birthday || '请选择宝宝生日' }}</text>
                                        <uni-icons type="right" size="16" color="#999"></uni-icons>
                                    </view>
                                </picker>
                            </view>
                        </view>

                        <!-- 宝宝月龄（产后时显示） -->
                        <view v-if="selected_stage === 'postpartum'" class="form-item br-b padding-bottom-main margin-bottom-main">
                            <view class="form-label flex-row align-c">
                                <text class="cr-main">*</text>
                                <text class="cr-base text-size-sm margin-left-xs">宝宝月龄</text>
                            </view>
                            <view class="form-input margin-top-xs">
                                <picker :range="baby_month_age_options" :value="baby_month_age_index" @change="baby_month_age_change_event">
                                    <view class="flex-row jc-sb align-c">
                                        <text :class="'text-size-sm ' + (baby_month_age_index >= 0 ? 'cr-base' : 'cr-grey-9')">{{ baby_month_age_index >= 0 ? baby_month_age_options[baby_month_age_index] : '请选择宝宝月龄' }}</text>
                                        <uni-icons type="right" size="16" color="#999"></uni-icons>
                                    </view>
                                </picker>
                            </view>
                        </view>

                        <!-- 备注 -->
                        <view class="form-item">
                            <view class="form-label flex-row align-c">
                                <text class="cr-base text-size-sm">备注</text>
                                <text class="cr-grey-9 text-size-xs margin-left-xs">(选填)</text>
                            </view>
                            <view class="form-input margin-top-xs">
                                <textarea v-model="form.remark" placeholder="请输入备注信息" placeholder-class="cr-grey-9" class="text-size-sm" maxlength="200" :auto-height="false" style="height: 160rpx" />
                            </view>
                        </view>
                    </view>
                </view>
            </view>

            <!-- [MUYING-二开] 隐私授权拆分：报名必需 vs 同步画像 -->
            <view class="privacy-container padding-horizontal-main margin-top-main">
                <view class="privacy-card muying-card padding-main">
                    <view class="privacy-header flex-row align-c margin-bottom-sm">
                        <uni-icons type="info" size="28rpx" color="#F5A0B1"></uni-icons>
                        <text class="fw-b text-size-sm cr-base margin-left-xs">隐私告知</text>
                    </view>
                    <view class="privacy-content">
                        <text class="text-size-xs cr-grey block margin-bottom-xs">1. 我们将收集您的姓名、手机号、孕育阶段、预产期/宝宝生日/宝宝月龄等信息，仅用于本次活动的报名确认、签到核实及活动通知。</text>
                        <text class="text-size-xs cr-grey block margin-bottom-xs">2. 您的个人信息仅用于孕禧平台相关服务，不会提供给第三方。</text>
                        <text class="text-size-xs cr-grey block margin-bottom-xs">3. 您可自主选择是否将孕育信息同步至个人资料，用于获得更精准的活动和内容推荐。</text>
                    </view>
                    <view class="privacy-agree flex-row align-c margin-top-main" @tap="toggle_privacy_agree">
                        <view class="privacy-checkbox" :class="{ 'privacy-checkbox-checked': privacy_agreed }">
                            <uni-icons v-if="privacy_agreed" type="checkmarkempty" size="22rpx" color="#fff"></uni-icons>
                        </view>
                        <text class="text-size-xs cr-base margin-left-sm">我已阅读并同意<text class="cr-main" @tap.stop="open_privacy_url">《隐私政策》</text>，并同意提交本次活动报名所需信息</text>
                    </view>
                    <view class="privacy-agree flex-row align-c margin-top-sm" @tap="toggle_profile_sync_agree">
                        <view class="privacy-checkbox" :class="{ 'privacy-checkbox-checked': profile_sync_agreed }">
                            <uni-icons v-if="profile_sync_agreed" type="checkmarkempty" size="22rpx" color="#fff"></uni-icons>
                        </view>
                        <text class="text-size-xs cr-grey margin-left-sm">我同意将孕育阶段、预产期/宝宝生日等信息同步到个人资料，用于推荐更适合的活动和内容（可选）</text>
                    </view>
                </view>
            </view>

            <!-- 提交按钮 -->
            <view class="submit-container padding-horizontal-main margin-top-main margin-bottom-xxxl">
                <button class="submit-btn cr-white fw-b text-size-md round" :class="{ 'submit-btn-disabled': !privacy_agreed || loading }" :disabled="!privacy_agreed || loading" :loading="loading" @tap="submit_event">{{ loading ? '提交中...' : '提交报名' }}</button>
            </view>

            <!-- 公共 -->
            <component-common ref="common"></component-common>
        </view>
    </view>
</template>

<script>
    const app = getApp();
    var bar_height = parseInt(app.globalData.get_system_info('statusBarHeight')) || 0;
    import componentCommon from '@/components/common/common';
    import { MuyingStage } from '@/common/js/config/muying-enum';
    import { request as http_request } from '@/common/js/http.js';
    import { logger } from '@/common/js/logger.js';
    import { userStore } from '@/common/js/user-store.js';

    export default {
        data() {
            return {
                theme_view: app.globalData.get_theme_value_view(),
                status_bar_height: bar_height,
                activity_id: null,
                activity: {
                    id: 0,
                    title: '',
                    time: '',
                    price: 0,
                },
                stage_options: MuyingStage.getList()
                    .filter(function (v) {
                        return v.value !== 'all';
                    })
                    .map(function (v) {
                        return v.name;
                    }),
                stage_values: MuyingStage.getList()
                    .filter(function (v) {
                        return v.value !== 'all';
                    })
                    .map(function (v) {
                        return v.value;
                    }),
                stage_index: -1,
                selected_stage: '',
                due_date_start: '',
                baby_birthday_end: '',
                baby_month_age_options: [],
                baby_month_age_index: -1,
                form: {
                    name: '',
                    phone: '',
                    due_date: '',
                    baby_birthday: '',
                    baby_month_age: '',
                    remark: '',
                },
                privacy_agreed: false,
                profile_sync_agreed: false,
                data_loaded: false,
            };
        },

        components: {
            componentCommon,
        },

        onLoad(params) {
            app.globalData.page_event_onload_handle(params);
            if (params && params.id) {
                this.setData({ activity_id: params.id });
            }
        },

        onShow() {
            app.globalData.page_event_onshow_handle();
            if ((this.$refs.common || null) != null) {
                this.$refs.common.on_show();
            }
            if (!this.activity_id) return;
            var user = app.globalData.get_user_cache_info();
            if (!user) {
                uni.navigateTo({ url: '/pages/login/login' });
                return;
            }
            if (!this.data_loaded) {
                this.get_activity_summary();
                this.init_baby_month_age_options();
                this.init_due_date_start();
                this.init_baby_birthday_end();
                this.load_user_profile();
                this.setData({ data_loaded: true });
            }
        },

        methods: {
            load_user_profile() {
                var self = this;
                http_request({
                    action: 'index',
                    controller: 'personal',
                    data: {},
                    loading: false,
                    success: function (data) {
                        var profile = (data && data.data) || {};
                        var form = self.form;
                        if (!form.name && profile.user_name_view) {
                            form.name = profile.user_name_view;
                        }
                        // [MUYING-二开] 不再从 profile.mobile 预填手机号，API 已不返回完整手机号
                        if (profile.current_stage) {
                            var normalized_stage = MuyingStage.normalize(profile.current_stage);
                            if (normalized_stage) {
                                var stage_idx = self.stage_values.indexOf(normalized_stage);
                                if (stage_idx >= 0) {
                                    self.setData({ stage_index: stage_idx, selected_stage: normalized_stage });
                                }
                            }
                        }
                        if (profile.due_date) {
                            form.due_date = profile.due_date;
                        }
                        if (profile.baby_birthday) {
                            form.baby_birthday = profile.baby_birthday;
                            var b = new Date(profile.baby_birthday);
                            var now = new Date();
                            if (!isNaN(b.getTime())) {
                                var months = (now.getFullYear() - b.getFullYear()) * 12 + (now.getMonth() - b.getMonth());
                                if (months >= 1 && months <= 36) {
                                    var baby_idx = months - 1;
                                    self.setData({ baby_month_age_index: baby_idx });
                                    form.baby_month_age = months;
                                }
                            }
                        }
                        self.setData({ form: form });
                    },
                    fail: function () {
                        logger.warn('activity-signup', '用户画像加载失败');
                    },
                });
            },

            get_activity_summary() {
                if (!this.activity_id) return;
                var self = this;
                http_request({
                    action: 'detail',
                    controller: 'activity',
                    data: { id: this.activity_id },
                    loading: false,
                    success: function (data) {
                        var activity = (data || {}).activity || {};
                        self.setData({
                            activity: {
                                id: activity.id || self.activity_id,
                                title: activity.title || '',
                                time: activity.time || activity.time_text || '',
                                price: activity.price || 0,
                            },
                        });
                    },
                    fail: function () {
                        self.setData({ data_loaded: true });
                    },
                });
            },

            nav_back_event() {
                app.globalData.page_back_prev_event();
            },

            stage_change_event(e) {
                var idx = e.detail.value;
                var stage = this.stage_values[idx] || '';
                this.setData({
                    stage_index: idx,
                    selected_stage: stage,
                    'form.due_date': '',
                    'form.baby_birthday': '',
                    'form.baby_month_age': '',
                    baby_month_age_index: -1,
                });
            },

            due_date_change_event(e) {
                this.setData({ 'form.due_date': e.detail.value });
            },

            baby_birthday_change_event(e) {
                var birthday = e.detail.value;
                var updates = { 'form.baby_birthday': birthday };
                var b = new Date(birthday);
                var now = new Date();
                if (!isNaN(b.getTime())) {
                    var months = (now.getFullYear() - b.getFullYear()) * 12 + (now.getMonth() - b.getMonth());
                    if (months >= 1 && months <= 36) {
                        updates['baby_month_age_index'] = months - 1;
                        updates['form.baby_month_age'] = months;
                    } else {
                        updates['baby_month_age_index'] = -1;
                        updates['form.baby_month_age'] = '';
                    }
                }
                this.setData(updates);
            },

            baby_month_age_change_event(e) {
                var idx = e.detail.value;
                this.setData({
                    baby_month_age_index: idx,
                    'form.baby_month_age': idx + 1,
                });
            },

            init_baby_month_age_options() {
                var opts = [];
                for (var i = 1; i <= 36; i++) {
                    opts.push(i + '个月');
                }
                this.setData({ baby_month_age_options: opts });
            },

            init_due_date_start() {
                var now = new Date();
                var y = now.getFullYear();
                var m = String(now.getMonth() + 1).padStart(2, '0');
                var d = String(now.getDate()).padStart(2, '0');
                this.setData({ due_date_start: y + '-' + m + '-' + d });
            },

            init_baby_birthday_end() {
                var now = new Date();
                var y = now.getFullYear();
                var m = String(now.getMonth() + 1).padStart(2, '0');
                var d = String(now.getDate()).padStart(2, '0');
                this.setData({ baby_birthday_end: y + '-' + m + '-' + d });
            },

            validate_form() {
                if (!this.form.name.trim()) {
                    app.globalData.showToast('请输入姓名');
                    return false;
                }
                if (!this.form.phone.trim()) {
                    app.globalData.showToast('请输入手机号');
                    return false;
                }
                if (!/^1[3-9]\d{9}$/.test(this.form.phone.trim())) {
                    app.globalData.showToast('请输入正确的手机号');
                    return false;
                }
                if (this.stage_index < 0) {
                    app.globalData.showToast('请选择当前阶段');
                    return false;
                }
                if (this.selected_stage === 'pregnancy' && !this.form.due_date) {
                    app.globalData.showToast('请选择预产期');
                    return false;
                }
                if (this.selected_stage === 'postpartum' && !this.form.baby_birthday) {
                    app.globalData.showToast('请选择宝宝生日');
                    return false;
                }
                if (this.selected_stage === 'postpartum' && this.baby_month_age_index < 0) {
                    app.globalData.showToast('请选择宝宝月龄');
                    return false;
                }
                if (!this.privacy_agreed) {
                    app.globalData.showToast('请阅读并同意隐私告知');
                    return false;
                }
                return true;
            },

            toggle_privacy_agree() {
                this.setData({ privacy_agreed: !this.privacy_agreed });
            },

            toggle_profile_sync_agree() {
                this.setData({ profile_sync_agreed: !this.profile_sync_agreed });
            },

            // [MUYING-二开] web-view 已移除，统一使用 agreement 页面
            open_privacy_url() {
                uni.navigateTo({ url: '/pages/agreement/agreement?type=privacy' });
            },

            submit_event() {
                if (!this.privacy_agreed) {
                    app.globalData.showToast('请先阅读并同意隐私协议');
                    return;
                }
                if (!this.validate_form()) return;
                if (this.loading) return;

                var self = this;
                this.setData({ loading: true });
                var post_data = {
                    activity_id: this.activity_id,
                    name: this.form.name.trim(),
                    phone: this.form.phone.trim(),
                    stage: this.selected_stage,
                    due_date: this.form.due_date,
                    baby_birthday: this.form.baby_birthday,
                    baby_month_age: this.form.baby_month_age,
                    remark: this.form.remark,
                    privacy_agreed: this.privacy_agreed ? 1 : 0,
                    profile_sync_agreed: this.profile_sync_agreed ? 1 : 0,
                };

                http_request({
                    action: 'signup',
                    controller: 'activity',
                    data: post_data,
                    loading_title: '提交中...',
                    success: function (data) {
                        userStore.merge({
                            current_stage: self.selected_stage,
                        });
                        uni.showToast({
                            title: '报名成功',
                            icon: 'success',
                            duration: 1500,
                        });
                        setTimeout(function () {
                            var pages = getCurrentPages();
                            var prevPage = pages.length > 1 ? pages[pages.length - 2] : null;
                            if (prevPage && prevPage.get_activity_detail) {
                                prevPage.get_activity_detail();
                            }
                            uni.navigateBack();
                        }, 1500);
                    },
                    fail: function (err) {
                        if (err && err.network_error) {
                            app.globalData.showToast('网络异常，报名信息未提交，请检查网络后重试');
                        }
                    },
                    complete: function () {
                        self.setData({ loading: false });
                    },
                });
            },
        },
    };
</script>

<style lang="scss" scoped>
    .activity-signup-page {
        min-height: 100vh;
        background-color: #fff8f5;
    }

    .nav-top-content {
        height: 88rpx;
    }

    .nav-title {
        position: absolute;
        left: 50%;
        transform: translateX(-50%);
    }

    .form-input input,
    .form-input textarea {
        background-color: #f8f8f8;
        border-radius: 12rpx;
        padding: 16rpx 20rpx;
        width: 100%;
        box-sizing: border-box;
    }

    .form-input textarea {
        width: 100%;
        box-sizing: border-box;
    }

    .submit-btn {
        height: 96rpx;
        line-height: 96rpx;
        background: linear-gradient(135deg, #f5a0b1 0%, #f5c6a0 100%);
        border: none;
    }

    .submit-btn-disabled {
        opacity: 0.5;
    }

    .privacy-checkbox {
        width: 36rpx;
        height: 36rpx;
        border-radius: 6rpx;
        border: 2rpx solid #ccc;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.2s;
    }

    .privacy-checkbox-checked {
        background-color: #f5a0b1;
        border-color: #f5a0b1;
    }

    .privacy-content {
        padding: 16rpx;
        background-color: #fff8f5;
        border-radius: 12rpx;
    }
</style>
