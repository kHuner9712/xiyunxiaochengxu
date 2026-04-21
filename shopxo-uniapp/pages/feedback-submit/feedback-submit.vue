<template>
    <view class="page-wrapper bg-f5">
        <view class="content-container padding-main">
            <!-- 表单区域 -->
            <view class="form-container bg-white border-radius-main padding-main">
                <!-- 反馈内容 -->
                <view class="form-item margin-bottom-main">
                    <view class="form-label text-size-md fw-b cr-base margin-bottom-sm">反馈内容</view>
                    <view class="form-input">
                        <textarea v-model="form.content" placeholder="请详细描述您遇到的问题或建议（最多500字）" placeholder-class="cr-grey-9" class="text-size-sm" maxlength="500" :auto-height="false" style="height: 280rpx" />
                    </view>
                    <view class="text-size-xss cr-grey-9 margin-top-xs text-right">{{ form.content.length }}/500</view>
                </view>

                <!-- 当前阶段 -->
                <view class="form-item margin-bottom-main">
                    <view class="form-label text-size-md fw-b cr-base margin-bottom-sm">当前阶段</view>
                    <view class="form-input">
                        <picker :value="stage_index" :range="stage_options" range-key="name" @change="stage_change_event">
                            <view class="picker-value text-size-sm" :class="{ 'picker-placeholder': !current_stage }">
                                {{ current_stage_text || '请选择您当前所处阶段' }}
                            </view>
                        </picker>
                    </view>
                </view>

                <!-- 联系方式（选填） -->
                <view class="form-item margin-bottom-main">
                    <view class="form-label text-size-md fw-b cr-base margin-bottom-sm">
                        <text>联系方式</text>
                        <text class="cr-grey-9 text-size-xs margin-left-xs">(选填)</text>
                    </view>
                    <view class="form-input">
                        <input v-model="form.contact" type="text" placeholder="请输入手机号或微信号，方便我们联系您" placeholder-class="cr-grey-9" class="text-size-sm" />
                    </view>
                </view>
            </view>

            <!-- 提交按钮 -->
            <view class="submit-container margin-top-main">
                <button class="submit-btn cr-white fw-b text-size-md round" @tap="submit_event">提交反馈</button>
            </view>
        </view>

        <!-- 公共 -->
        <component-common ref="common"></component-common>
    </view>
</template>

<script>
    const app = getApp();
    import componentCommon from '@/components/common/common';
    import { MuyingStage } from '@/common/js/config/muying-enum';
    import { request as http_request } from '@/common/js/http.js';

    export default {
        data() {
            return {
                status_bar_height: 0,
                form: {
                    content: '',
                    stage: '',
                    contact: '',
                },
                stage_options: [],
                stage_index: 0,
                current_stage: '',
                current_stage_text: '',
            };
        },

        components: {
            componentCommon,
        },

        onLoad(params) {
            app.globalData.page_event_onload_handle(params);
            this.init_stage_options();
        },

        onShow() {
            app.globalData.page_event_onshow_handle();
            this.load_user_stage();
        },

        methods: {
            init_stage_options() {
                var options = [];
                var stage_list = MuyingStage.getList();
                for (var i = 0; i < stage_list.length; i++) {
                    options.push({
                        value: stage_list[i].value,
                        name: stage_list[i].name,
                    });
                }
                this.setData({ stage_options: options });
            },

            load_user_stage() {
                var user = app.globalData.get_user_cache_info() || null;
                if (user && user.current_stage) {
                    var stage = user.current_stage;
                    var text = MuyingStage.getName(stage);
                    var index = 0;
                    for (var i = 0; i < this.stage_options.length; i++) {
                        if (this.stage_options[i].value == stage) {
                            index = i;
                            break;
                        }
                    }
                    this.setData({
                        current_stage: stage,
                        current_stage_text: text,
                        stage_index: index,
                    });
                    this.form.stage = stage;
                }
            },

            stage_change_event(e) {
                var idx = e.detail.value;
                this.setData({ stage_index: idx });
                this.current_stage = this.stage_options[idx].value;
                this.current_stage_text = this.stage_options[idx].name;
                this.form.stage = this.stage_options[idx].value;
            },

            submit_event() {
                var self = this;

                if (!self.form.content || self.form.content.trim().length === 0) {
                    app.globalData.showToast('请输入反馈内容');
                    return;
                }

                if (self.form.content.length > 500) {
                    app.globalData.showToast('反馈内容不能超过500字');
                    return;
                }

                http_request({
                    controller: 'feedback',
                    action: 'create',
                    data: {
                        content: self.form.content.trim(),
                        stage: self.form.stage,
                        contact: self.form.contact ? self.form.contact.trim() : '',
                    },
                    success: function() {
                        uni.showToast({ title: '提交成功', icon: 'success' });
                        setTimeout(function() {
                            uni.navigateBack();
                        }, 1500);
                    },
                    fail: function(err) {
                        if (!err.feature_disabled && !err.login_expired) {
                            app.globalData.showToast(err.errMsg || '提交失败，请重试');
                        }
                    },
                });
            },
        },
    };
</script>

<style>
    .page-wrapper {
        min-height: 100vh;
        background-color: #F5F5F5;
    }

    .bg-f5 {
        background-color: #F5F5F5;
    }

    .content-container {
        padding-bottom: 40rpx;
    }

    .form-container {
        box-shadow: 0 2rpx 12rpx rgba(0, 0, 0, 0.04);
    }

    .form-item {
        border-bottom: 1rpx solid #F0F0F0;
        padding-bottom: 24rpx;
    }

    .form-item:last-child {
        border-bottom: none;
    }

    .form-label {
        margin-bottom: 16rpx;
    }

    .form-input textarea,
    .form-input input {
        background-color: #F8F8F8;
        border-radius: 12rpx;
        padding: 16rpx 20rpx;
        width: 100%;
        box-sizing: border-box;
    }

    .form-input textarea {
        height: 280rpx;
    }

    .picker-value {
        background-color: #F8F8F8;
        border-radius: 12rpx;
        padding: 16rpx 20rpx;
        width: 100%;
        box-sizing: border-box;
    }

    .picker-placeholder {
        color: #999;
    }

    .text-right {
        text-align: right;
    }

    .submit-btn {
        height: 96rpx;
        line-height: 96rpx;
        background: linear-gradient(135deg, #f5a0b1 0%, #f5c6a0 100%);
        border: none;
    }
</style>
