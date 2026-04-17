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
                                <textarea v-model="form.remark" placeholder="请输入备注信息" placeholder-class="cr-grey-9" class="text-size-sm" maxlength="200" :auto-height="false" style="height: 160rpx;" />
                            </view>
                        </view>
                    </view>
                </view>
            </view>

            <!-- 提交按钮 -->
            <view class="submit-container padding-horizontal-main margin-top-xxxl margin-bottom-xxxl">
                <button class="submit-btn cr-white fw-b text-size-md round" @tap="submit_event">提交报名</button>
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
                stage_options: ['备孕', '孕期', '产后'],
                stage_values: ['prepare', 'pregnancy', 'postpartum'],
                stage_index: -1,
                selected_stage: '',
                due_date_start: '',
                baby_month_age_options: [],
                baby_month_age_index: -1,
                form: {
                    name: '',
                    phone: '',
                    due_date: '',
                    baby_month_age: '',
                    remark: '',
                },
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
            this.get_activity_summary();
            this.init_baby_month_age_options();
            this.init_due_date_start();
        },

        onShow() {
            app.globalData.page_event_onshow_handle();
            if ((this.$refs.common || null) != null) {
                this.$refs.common.on_show();
            }
        },

        methods: {
            get_activity_summary() {
                if (!this.activity_id) return;
                var self = this;
                uni.request({
                    url: app.globalData.get_request_url('detail', 'activity'),
                    method: 'POST',
                    data: { id: this.activity_id },
                    dataType: 'json',
                    success: function(res) {
                        if (res.data.code == 0) {
                            var activity = (res.data.data || {}).activity || {};
                            self.setData({
                                activity: {
                                    id: activity.id || self.activity_id,
                                    title: activity.title || '',
                                    time: (activity.start_time_text || '') + (activity.end_time_text ? ' ~ ' + activity.end_time_text : ''),
                                    price: activity.price || 0,
                                },
                            });
                        }
                    },
                    fail: function() {},
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
                    'form.baby_month_age': '',
                    baby_month_age_index: -1,
                });
            },

            due_date_change_event(e) {
                this.setData({ 'form.due_date': e.detail.value });
            },

            baby_month_age_change_event(e) {
                var idx = e.detail.value;
                this.setData({
                    baby_month_age_index: idx,
                    'form.baby_month_age': this.baby_month_age_options[idx],
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
                if (this.selected_stage === 'postpartum' && this.baby_month_age_index < 0) {
                    app.globalData.showToast('请选择宝宝月龄');
                    return false;
                }
                return true;
            },

            submit_event() {
                if (!this.validate_form()) return;

                uni.showLoading({ title: '提交中...' });
                var self = this;
                var post_data = {
                    activity_id: this.activity_id,
                    name: this.form.name.trim(),
                    phone: this.form.phone.trim(),
                    stage: this.selected_stage,
                    due_date: this.form.due_date,
                    baby_month_age: this.form.baby_month_age,
                    remark: this.form.remark,
                };

                uni.request({
                    url: app.globalData.get_request_url('signup', 'activity'),
                    method: 'POST',
                    data: post_data,
                    dataType: 'json',
                    success: function(res) {
                        uni.hideLoading();
                        if (res.data.code == 0) {
                            uni.showToast({
                                title: '报名成功',
                                icon: 'success',
                                duration: 1500,
                            });
                            setTimeout(function() {
                                uni.navigateBack();
                            }, 1500);
                        } else {
                            app.globalData.showToast(res.data.msg || '报名失败，请重试');
                        }
                    },
                    fail: function() {
                        uni.hideLoading();
                        app.globalData.showToast('网络异常，请重试');
                    },
                });
            },
        },
    };
</script>

<style lang="scss" scoped>
    .activity-signup-page {
        min-height: 100vh;
        background-color: #FFF8F5;
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
        background-color: #F8F8F8;
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
        background: linear-gradient(135deg, #F5A0B1 0%, #F5C6A0 100%);
        border: none;
    }
</style>
