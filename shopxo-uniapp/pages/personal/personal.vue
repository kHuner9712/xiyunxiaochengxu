<template>
    <view :class="theme_view">
        <view class="page-bottom-fixed">
            <!-- 主体内容 -->
            <block v-if="data_list_loding_status == 3">
                <form @submit="form_submit" class="form-container">
                    <view class="padding-main page-bottom-fixed">
                        <view class="bg-white border-radius-main oh">
                            <view class="form-gorup oh flex-row jc-sb align-c">
                                <view>{{ $t('personal.personal.cw1d8p') }}</view>
                                <view class="flex-row align-c">
                                    <button class="bg-white br-0 lh-0 padding-horizontal-sm" hover-class="none" open-type="chooseAvatar" @chooseavatar="choose_avatar_event" @tap="choose_avatar_event">
                                        <image :src="user_data.avatar || default_avatar" mode="widthFix" class="circle br user-avatar flex-1 flex-width"></image>
                                    </button>
                                    <iconfont name="icon-arrow-right" size="34rpx" color="#ccc"></iconfont>
                                </view>
                            </view>

                            <view class="form-gorup oh flex-row jc-sb align-c">
                                <view class="form-gorup-title">{{ $t('personal.personal.gw8br3') }}<text class="form-group-tips-must">*</text></view>
                                <view class="flex-row align-c flex-1 flex-width">
                                    <input :type="application_client_type == 'weixin' ? 'nickname' : 'text'" name="nickname" :value="user_data.nickname || ''" maxlength="16" placeholder-class="cr-grey-9 tr" class="cr-base tr margin-right-sm" :placeholder="$t('personal.personal.44112i')" />
                                </view>
                            </view>

                            <view class="form-gorup oh flex-row jc-sb align-c">
                                <view class="form-gorup-title">{{ $t('personal.personal.jibx42') }}<text class="cr-grey-9 text-size-xs margin-left-xs">(选填)</text></view>
                                <view class="flex-1 flex-width flex-row jc-e align-c">
                                    <picker class="margin-right-sm wh-auto tr" name="birthday" mode="date" :value="user_data.birthday || ''" data-field="birthday" @change="select_change_event">
                                        <view :class="'picker ' + ((user_data.birthday || null) == null ? 'cr-grey' : '')">{{ user_data.birthday || $t('personal.personal.85404s') }}</view>
                                    </picker>
                                    <iconfont name="icon-arrow-right" size="34rpx" color="#ccc"></iconfont>
                                </view>
                            </view>

                            <view class="form-gorup oh flex-row jc-sb align-c">
                                <view class="form-gorup-title">{{ $t('personal.personal.x2fofv') }}<text class="cr-grey-9 text-size-xs margin-left-xs">(选填)</text></view>
                                <view class="flex-row jc-e align-c flex-1 flex-width">
                                    <picker @change="select_change_event" :value="user_data.gender || ''" :range="gender_list" range-key="name" name="gender" data-field="gender" class="margin-right-sm wh-auto tr">
                                        <view class="uni-input cr-base picker">{{ gender_list[user_data.gender] ? gender_list[user_data.gender].name : '请选择' }}</view>
                                    </picker>
                                    <iconfont name="icon-arrow-right" size="34rpx" color="#ccc"></iconfont>
                                </view>
                            </view>

                            <view class="form-gorup oh flex-row jc-sb align-c">
                                <view class="form-gorup-title">当前阶段<text class="cr-grey-9 text-size-xs margin-left-xs">(用于推荐合适的活动和商品)</text></view>
                                <view class="flex-row jc-e align-c flex-1 flex-width">
                                    <picker @change="stage_change_event" :value="current_stage_index" :range="stage_list" range-key="name" class="margin-right-sm wh-auto tr">
                                        <view class="uni-input cr-base picker">{{ stage_list[current_stage_index].name || '请选择' }}</view>
                                    </picker>
                                    <iconfont name="icon-arrow-right" size="34rpx" color="#ccc"></iconfont>
                                </view>
                            </view>

                            <view v-if="user_data.current_stage === 'pregnancy'" class="form-gorup oh flex-row jc-sb align-c">
                                <view class="form-gorup-title">预产期<text class="cr-grey-9 text-size-xs margin-left-xs">(选填，用于推荐适合您的活动)</text></view>
                                <view class="flex-1 flex-width flex-row jc-e align-c">
                                    <picker class="margin-right-sm wh-auto tr" name="due_date" mode="date" :value="user_data.due_date || ''" :start="due_date_start" data-field="due_date" @change="select_change_event">
                                        <view :class="'picker ' + ((user_data.due_date || null) == null ? 'cr-grey' : '')">{{ user_data.due_date || '请选择预产期' }}</view>
                                    </picker>
                                    <iconfont name="icon-arrow-right" size="34rpx" color="#ccc"></iconfont>
                                </view>
                            </view>

                            <view v-if="user_data.current_stage === 'postpartum'" class="form-gorup oh flex-row jc-sb align-c">
                                <view class="form-gorup-title">宝宝生日<text class="cr-grey-9 text-size-xs margin-left-xs">(选填，用于推荐适合您的活动)</text></view>
                                <view class="flex-1 flex-width flex-row jc-e align-c">
                                    <picker class="margin-right-sm wh-auto tr" name="baby_birthday" mode="date" :value="user_data.baby_birthday || ''" :end="baby_birthday_end" data-field="baby_birthday" @change="select_change_event">
                                        <view :class="'picker ' + ((user_data.baby_birthday || null) == null ? 'cr-grey' : '')">{{ user_data.baby_birthday || '请选择宝宝生日' }}</view>
                                    </picker>
                                    <iconfont name="icon-arrow-right" size="34rpx" color="#ccc"></iconfont>
                                </view>
                            </view>

                            <view v-if="user_data.current_stage === 'postpartum' && baby_month_age_text" class="form-gorup oh flex-row jc-sb align-c">
                                <view class="form-gorup-title">宝宝月龄</view>
                                <view class="cr-grey text-size-sm">{{ baby_month_age_text }}</view>
                            </view>
                        </view>

                        <view class="cr-grey-9 text-size-xs padding-top-main padding-horizontal-main muying-privacy-note">
                            <text>孕育阶段、预产期、宝宝生日仅用于个性化推荐活动和商品，不会向第三方共享。您可随时修改或清空。</text>
                            <view class="muying-privacy-link" @tap="open_agreement_event('privacy')">查看《隐私政策》</view>
                        </view>

                        <view class="bottom-fixed" :style="bottom_fixed_style">
                            <view class="bottom-line-exclude">
                                <button class="item bg-main br-main cr-white round text-size" type="default" form-type="submit" hover-class="none" :disabled="form_submit_disabled_status">{{ $t('common.save') }}</button>
                            </view>
                        </view>
                    </view>
                </form>
            </block>

            <!-- 错误提示 -->
            <component-no-data :propStatus="data_list_loding_status" :propMsg="data_list_loding_msg"></component-no-data>
        </view>

        <!-- 公共 -->
        <component-common ref="common"></component-common>
    </view>
</template>
<script>
    const app = getApp();
    import componentCommon from '@/components/common/common';
    import componentNoData from '@/components/no-data/no-data';
    import { MuyingStage } from '@/common/js/config/muying-enum';
    import { request as http_request } from '@/common/js/http.js';
    import { userStore } from '@/common/js/user-store.js';
    export default {
        data() {
            return {
                theme_view: app.globalData.get_theme_value_view(),
                application_client_type: app.globalData.application_client_type(),
                data_list_loding_status: 1,
                data_list_loding_msg: '',
                bottom_fixed_style: '',
                form_submit_disabled_status: false,
                default_avatar: app.globalData.data.default_user_head_src,
                user_data: {},
                gender_list: [],
                stage_list: [{ name: '请选择', value: '' }].concat(
                    MuyingStage.getList().filter(function (v) {
                        return v.value !== 'all';
                    })
                ),
                current_stage_index: 0,
                baby_month_age_text: '',
                due_date_start: '',
                baby_birthday_end: '',
            };
        },

        components: {
            componentCommon,
            componentNoData,
        },

        onLoad(params) {
            // 调用公共事件方法
            app.globalData.page_event_onload_handle(params);
        },

        onShow() {
            app.globalData.page_event_onshow_handle();
            this.init_date_constraints();
            this.init();

            // 公共onshow事件
            if ((this.$refs.common || null) != null) {
                this.$refs.common.on_show();
            }
        },

        methods: {
            open_agreement_event(type) {
                app.globalData.url_open('/pages/agreement/agreement?type=' + (type || 'privacy'));
            },

            init_date_constraints() {
                var now = new Date();
                var y = now.getFullYear();
                var m = String(now.getMonth() + 1).padStart(2, '0');
                var d = String(now.getDate()).padStart(2, '0');
                var today = y + '-' + m + '-' + d;
                this.setData({
                    due_date_start: today,
                    baby_birthday_end: today,
                });
            },

            // 获取数据
            init() {
                var user = app.globalData.get_user_info(this, 'init');
                if (user != false) {
                    this.get_data();
                } else {
                    this.setData({
                        data_list_loding_status: 0,
                        data_list_loding_msg: this.$t('setup.setup.nwt4o1'),
                    });
                }
            },

            // 获取数据
            get_data() {
                http_request({
                    action: 'index',
                    controller: 'personal',
                    data: { lang_can_key: 'gender_list' },
                    success: (data) => {
                        var user_data = (data && data.data) || {};
                        var stage_index = 0;
                        if (user_data.current_stage) {
                            var normalized = MuyingStage.normalize(user_data.current_stage);
                            if (normalized) {
                                user_data.current_stage = normalized;
                            }
                            for (var i = 0; i < this.stage_list.length; i++) {
                                if (this.stage_list[i].value === normalized) {
                                    stage_index = i;
                                    break;
                                }
                            }
                        }
                        this.setData({
                            data_list_loding_status: 3,
                            user_data: user_data,
                            gender_list: (data && data.gender_list) || [],
                            current_stage_index: stage_index,
                        });
                        this.calc_baby_month_age();
                    },
                    fail: () => {
                        this.setData({
                            data_list_loding_status: 2,
                            data_list_loding_msg: this.$t('common.internet_error_tips'),
                        });
                    },
                });
            },

            // url事件
            url_event(e) {
                app.globalData.url_event(e);
            },

            // 生日、性别选择事件
            select_change_event(e) {
                var temp = this.user_data;
                temp[e.currentTarget.dataset.field] = e.detail.value;
                this.setData({ user_data: temp });
                if (e.currentTarget.dataset.field === 'baby_birthday') {
                    this.calc_baby_month_age();
                }
            },

            // 阶段选择事件
            stage_change_event(e) {
                var index = e.detail.value;
                var temp = this.user_data;
                var new_stage = this.stage_list[index].value;
                temp.current_stage = new_stage;
                if (new_stage !== 'pregnancy') {
                    temp.due_date = '';
                }
                if (new_stage !== 'postpartum') {
                    temp.baby_birthday = '';
                }
                this.setData({
                    user_data: temp,
                    current_stage_index: index,
                });
                this.calc_baby_month_age();
            },

            // 头像事件
            choose_avatar_event(e = null) {
                let self = this;

                // #ifndef APP
                // 如果是微信/支付宝小程序，直接使用其API（不需要权限弹窗）
                let arr = ['weixin', 'alipay'];
                if (arr.indexOf(this.application_client_type) != -1) {
                    if (e !== null) {
                        let temp_url = e.detail.avatarUrl;
                        if (this.application_client_type == 'alipay') {
                            // 支付宝如果是临时文件走文件上传，普通图片地址走表单
                            if (temp_url.substr(-6) == '.image') {
                                self.upload_handle(temp_url, self);
                            } else {
                                self.upload_url_handle(temp_url, self);
                            }
                        } else {
                            self.upload_handle(temp_url, self);
                        }
                    }
                } else {
                    uni.chooseImage({
                        count: 1,
                        success(res) {
                            if (res.tempFilePaths.length > 0) {
                                self.upload_handle(res.tempFilePaths[0], self);
                            }
                        },
                    });
                }
                // #endif

                // App端先显示权限选择弹窗
                // #ifdef APP
                uni.showActionSheet({
                    title: self.$t('common.choice_image_source_text'),
                    itemList: [self.$t('common.camera_text'), self.$t('common.album_choice_text')],
                    success: (res) => {
                        if (res.tapIndex == 0) {
                            var type = 'camera';
                            var title = self.$t('common.need_camera_power_text');
                            var msg = self.$t('common.camera_get_access_text');
                        } else {
                            var type = 'album';
                            var title = self.$t('common.need_album_power_text');
                            var msg = self.$t('common.album_get_access_text');
                        }
                        uni.showModal({
                            title: title,
                            content: msg,
                            cancelText: self.$t('common.cancel'),
                            confirmText: self.$t('common.confirm'),
                            success: function (res) {
                                if (res.confirm) {
                                    self.choose_image_handle(type, self);
                                }
                            },
                        });
                    },
                });
                // #endif
            },

            // 打开图片选择
            choose_image_handle(type, self) {
                uni.chooseImage({
                    sourceType: [type],
                    count: 1,
                    success(res) {
                        if (res.tempFilePaths.length > 0) {
                            self.upload_handle(res.tempFilePaths[0], self);
                        }
                    },
                    fail(err) {
                        // 用户拒绝权限或取消操作
                        if (err.errMsg && err.errMsg.indexOf('cancel') === -1) {
                            uni.showModal({
                                title: self.$t('common.power_refuse_text'),
                                content: type == 'camera' ? self.$t('common.camera_error_text') : self.$t('common.album_error_text'),
                                showCancel: false,
                            });
                        }
                    },
                });
            },

            // 上传处理
            upload_handle(image, self) {
                uni.uploadFile({
                    url: app.globalData.get_request_url('useravatarupload', 'personal'),
                    filePath: image,
                    name: 'file',
                    header: app.globalData.get_request_headers(),
                    formData: {},
                    success: function (res) {
                        if (res.statusCode == 200) {
                            var data = typeof res.data == 'object' ? res.data : JSON.parse(res.data);
                            if (data.code == 0) {
                                var temp = self.user_data;
                                temp['avatar'] = data.data;
                                self.setData({ user_data: temp });
                            } else {
                                app.globalData.showToast(data.msg);
                            }
                        }
                    },
                });
            },

            // form上传url
            upload_url_handle(image, self) {
                http_request({
                    action: 'useravatarupload',
                    controller: 'personal',
                    data: { file: image },
                    loading_title: this.$t('common.upload_in_text'),
                    success: (data) => {
                        var temp = self.user_data;
                        temp['avatar'] = data;
                        self.setData({ user_data: temp });
                    },
                    fail: () => {},
                });
            },

            // 计算宝宝月龄
            calc_baby_month_age() {
                var text = '';
                if (this.user_data.current_stage === 'postpartum' && this.user_data.baby_birthday) {
                    var b = new Date(this.user_data.baby_birthday);
                    var now = new Date();
                    if (!isNaN(b.getTime())) {
                        var months = (now.getFullYear() - b.getFullYear()) * 12 + (now.getMonth() - b.getMonth());
                        if (months < 0) months = 0;
                        text = months + '个月';
                    }
                }
                this.setData({ baby_month_age_text: text });
            },

            // 数据提交
            form_submit(e) {
                var form_data = e.detail.value;
                form_data['avatar'] = this.user_data.avatar || '';
                form_data['birthday'] = this.user_data.birthday || '';
                form_data['gender'] = this.user_data.gender || 0;
                form_data['current_stage'] = this.user_data.current_stage || '';
                form_data['due_date'] = this.user_data.due_date || '';
                form_data['baby_birthday'] = this.user_data.baby_birthday || '';

                if (!form_data['nickname'] || !form_data['nickname'].trim()) {
                    app.globalData.showToast('请输入昵称');
                    return;
                }

                this.setData({
                    form_submit_disabled_status: true,
                });
                http_request({
                    action: 'save',
                    controller: 'personal',
                    data: form_data,
                    loading_title: this.$t('common.processing_in_text'),
                    success: (data) => {
                        this.setData({
                            form_submit_disabled_status: false,
                        });
                        userStore.set(data);
                        app.globalData.showToast('保存成功', 'success');
                        setTimeout(function () {
                            uni.navigateBack();
                        }, 1000);
                    },
                    fail: (err) => {
                        this.setData({
                            form_submit_disabled_status: false,
                        });
                        if (err && err.login_expired) {
                            return;
                        }
                        if (err && !err.network_error) {
                            app.globalData.showToast(this.$t('common.sub_error_retry_tips'));
                        }
                    },
                });
            },
        },
    };
</script>
<style>
    @import './personal.css';
    @import '@/common/css/muying.css';

    /* 权限说明弹窗样式 */
    .permission-modal-mask {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background-color: rgba(0, 0, 0, 0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 9999;
    }

    .permission-modal {
        width: 80%;
        max-width: 600rpx;
        background-color: #fff;
        border-radius: 16rpx;
        overflow: hidden;
        animation: fadeIn 0.3s ease;
    }

    .permission-modal-title {
        padding: 40rpx 30rpx 20rpx;
        font-size: 36rpx;
        font-weight: bold;
        text-align: center;
        color: #333;
    }

    .permission-modal-content {
        padding: 20rpx 30rpx 40rpx;
        font-size: 28rpx;
        line-height: 1.5;
        color: #666;
        text-align: center;
    }

    .permission-modal-buttons {
        display: flex;
        border-top: 1rpx solid #eee;
    }

    .permission-btn {
        flex: 1;
        height: 88rpx;
        line-height: 88rpx;
        font-size: 32rpx;
        background: none;
        border-radius: 0;
        margin: 0;
        position: relative;
    }

    .permission-btn::after {
        border: none;
    }

    .permission-btn.cancel {
        color: #666;
        border-right: 1rpx solid #eee;
    }

    .permission-btn.confirm {
        color: #007aff;
    }

    @keyframes fadeIn {
        from {
            opacity: 0;
            transform: scale(0.9);
        }
        to {
            opacity: 1;
            transform: scale(1);
        }
    }
</style>
