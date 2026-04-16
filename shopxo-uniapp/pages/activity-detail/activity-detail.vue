<template>
    <view :class="theme_view">
        <view class="activity-detail-page">
            <!-- 自定义导航栏 -->
            <view class="nav-top pf top-0 left-0 right-0 z-i-deep" :style="'padding-top:' + status_bar_height + 'px;'">
                <view class="nav-top-content pr flex-row align-c jc-sb padding-horizontal-main" :style="'background-color:' + (scroll_value > 100 ? '#FFFFFF' : 'transparent') + ';'">
                    <view class="nav-back cp" @tap="nav_back_event">
                        <uni-icons type="back" size="22" :color="scroll_value > 100 ? '#333' : '#FFF'"></uni-icons>
                    </view>
                    <text v-if="scroll_value > 100" class="nav-title cr-base fw-b text-size-md">活动详情</text>
                    <text v-else class="nav-title" style="color:transparent;">活动详情</text>
                    <view class="nav-share cp" @tap="share_event">
                        <uni-icons type="redo" size="20" :color="scroll_value > 100 ? '#333' : '#FFF'"></uni-icons>
                    </view>
                </view>
            </view>

            <!-- 封面图 -->
            <view class="cover-container oh">
                <image :src="activity.cover" mode="aspectFill" class="wh-auto cover-image"></image>
                <view class="cover-stage-tag">
                    <text :class="'muying-stage-tag ' + activity.stage_class">{{ activity.stage_name }}</text>
                </view>
            </view>

            <!-- 基础信息 -->
            <view class="info-container padding-horizontal-main">
                <view class="info-card muying-card padding-main">
                    <view class="activity-title-row flex-row jc-sb align-c">
                        <text class="fw-b text-size-lg cr-base flex-1">{{ activity.title }}</text>
                        <text :class="'muying-stage-tag ' + activity.stage_class">{{ activity.stage_name }}</text>
                    </view>

                    <view class="info-items margin-top-main">
                        <view class="info-item flex-row align-c margin-top-sm">
                            <iconfont name="icon-time" size="28rpx" color="#F5A0B1"></iconfont>
                            <text class="cr-grey text-size-sm margin-left-sm">{{ activity.time }}</text>
                        </view>
                        <view class="info-item flex-row align-c margin-top-sm">
                            <iconfont name="icon-location" size="28rpx" color="#F5A0B1"></iconfont>
                            <text class="cr-grey text-size-sm margin-left-sm">{{ activity.address }}</text>
                        </view>
                        <view class="info-item flex-row align-c margin-top-sm">
                            <iconfont name="icon-member" size="28rpx" color="#F5A0B1"></iconfont>
                            <text class="cr-grey text-size-sm margin-left-sm">已报名 {{ activity.signup_count }}/{{ activity.max_count }}人</text>
                            <text class="cr-grey-9 text-size-xs margin-left-sm">截止 {{ activity.signup_deadline }}</text>
                        </view>
                    </view>

                    <view class="price-row flex-row jc-sb align-c margin-top-main br-t padding-top-main">
                        <view class="price-info flex-row align-c">
                            <text v-if="activity.price == 0" class="muying-badge-pink text-size">免费</text>
                            <view v-else class="flex-row align-c">
                                <text class="cr-main fw-b text-size-xl">¥{{ activity.price }}</text>
                            </view>
                        </view>
                        <view class="organizer-info text-size-xs cr-grey-9">
                            <text>{{ activity.organizer }}</text>
                            <text class="margin-left-sm">{{ activity.organizer_phone }}</text>
                        </view>
                    </view>
                </view>
            </view>

            <!-- 活动详情 -->
            <view class="detail-container padding-horizontal-main margin-top-main">
                <view class="detail-card muying-card padding-main">
                    <view class="detail-header flex-row align-c margin-bottom-main">
                        <text class="fw-b text-size cr-base">活动详情</text>
                        <view class="muying-divider flex-1 margin-left-main"></view>
                    </view>
                    <view class="detail-content">
                        <mp-html :content="activity.content" />
                    </view>
                </view>
            </view>

            <!-- 适合人群 -->
            <view v-if="activity.suitable_crowd" class="crowd-container padding-horizontal-main margin-top-main">
                <view class="crowd-card muying-card padding-main">
                    <view class="crowd-header flex-row align-c margin-bottom-main">
                        <text class="fw-b text-size cr-base">适合人群</text>
                        <view class="muying-divider flex-1 margin-left-main"></view>
                    </view>
                    <view class="crowd-content">
                        <text class="cr-grey text-size-sm" style="line-height:1.8;">{{ activity.suitable_crowd }}</text>
                    </view>
                </view>
            </view>

            <!-- 用户晒单 -->
            <view class="share-container padding-horizontal-main margin-top-main">
                <view class="share-card muying-card padding-main">
                    <view class="share-header flex-row align-c jc-sb margin-bottom-main">
                        <view class="flex-row align-c">
                            <text class="fw-b text-size cr-base">用户晒单</text>
                            <text class="cr-grey-9 text-size-xs margin-left-sm">({{ user_shares.length }})</text>
                        </view>
                    </view>
                    <scroll-view :scroll-x="true" :show-scrollbar="false" class="share-scroll">
                        <view class="share-scroll-inner flex-row">
                            <block v-for="(item, index) in user_shares" :key="index">
                                <view class="share-item">
                                    <image :src="item.photo" mode="aspectFill" class="share-photo"></image>
                                    <view class="share-user-info flex-row align-c margin-top-xs">
                                        <text class="cr-base text-size-xs fw-b">{{ item.nickname }}</text>
                                    </view>
                                    <text class="cr-grey text-size-xs share-comment single-text">{{ item.comment }}</text>
                                </view>
                            </block>
                        </view>
                    </scroll-view>
                </view>
            </view>

            <!-- 互动数据 -->
            <view class="interact-container padding-horizontal-main margin-top-main margin-bottom-xxxl">
                <view class="interact-card muying-card padding-main flex-row jc-sa align-c">
                    <view class="interact-item tc cp" @tap="like_event">
                        <uni-icons :type="is_liked ? 'heart-filled' : 'heart'" size="40rpx" :color="is_liked ? '#F5A0B1' : '#999'"></uni-icons>
                        <text :class="'text-size-xs dis-block ' + (is_liked ? 'cr-main' : 'cr-grey')">{{ like_count }}</text>
                    </view>
                    <view class="interact-item tc cp" @tap="comment_event">
                        <uni-icons type="chat" size="40rpx" color="#999"></uni-icons>
                        <text class="text-size-xs cr-grey dis-block">{{ comment_count }}</text>
                    </view>
                    <view class="interact-item tc cp" @tap="share_event">
                        <uni-icons type="redo" size="40rpx" color="#999"></uni-icons>
                        <text class="text-size-xs cr-grey dis-block">分享</text>
                    </view>
                </view>
            </view>

            <!-- 底部操作栏 -->
            <view class="bottom-bar pf bottom-0 left-0 right-0 z-i-deep bg-white">
                <view class="bottom-bar-inner flex-row align-c padding-horizontal-main padding-vertical-sm">
                    <view class="fav-btn tc cp margin-right-main" @tap="fav_event">
                        <uni-icons :type="is_favored ? 'star-filled' : 'star'" size="44rpx" :color="is_favored ? '#F5A0B1' : '#999'"></uni-icons>
                        <text :class="'text-size-xs dis-block ' + (is_favored ? 'cr-main' : 'cr-grey')">{{ is_favored ? '已收藏' : '收藏' }}</text>
                    </view>
                    <view class="poster-btn tc cp margin-right-main" @tap="poster_event">
                        <uni-icons type="image" size="44rpx" color="#F5A0B1"></uni-icons>
                        <text class="text-size-xs cr-main dis-block">海报</text>
                    </view>
                    <button class="signup-btn flex-1 cr-white fw-b text-size-md round" :class="signup_btn_class" :disabled="signup_disabled" @tap="signup_event">
                        {{ signup_btn_text }}
                    </button>
                </view>
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
                scroll_value: 0,
                activity_id: null,
                is_favored: false,
                is_liked: false,
                like_count: 36,
                comment_count: 8,
                activity: {
                    id: 1,
                    title: '孕妈瑜伽课堂·第二期',
                    stage_name: '孕期',
                    stage_class: 'muying-stage-tag--pregnant',
                    cover: '/static/images/common/default-images.png',
                    time: '2026-04-20 10:00 ~ 2026-04-20 11:30',
                    address: '云禧母婴中心3楼瑜伽室',
                    signup_count: 18,
                    max_count: 30,
                    signup_deadline: '2026-04-19 18:00',
                    price: 0,
                    organizer: '李老师',
                    organizer_phone: '138****6789',
                    suitable_crowd: '孕12周以上的准妈妈，无高危妊娠指征，经医生评估可适度运动者。',
                    content: '<div style="padding:10px 0;"><h3 style="color:#333;font-size:16px;margin-bottom:10px;">课程介绍</h3><p style="color:#666;font-size:14px;line-height:1.8;">孕妈瑜伽是专为孕期妈妈设计的温和运动课程，由专业孕产瑜伽导师授课。通过安全、科学的瑜伽体式，帮助孕妈缓解孕期不适，增强体质，为顺利分娩做好准备。</p><h3 style="color:#333;font-size:16px;margin:15px 0 10px;">课程内容</h3><p style="color:#666;font-size:14px;line-height:1.8;">1. 呼吸练习与放松技巧<br/>2. 孕期安全体式练习<br/>3. 骨盆底肌训练<br/>4. 产前冥想与心理调适</p><h3 style="color:#333;font-size:16px;margin:15px 0 10px;">适合人群</h3><p style="color:#666;font-size:14px;line-height:1.8;">孕12周以上的准妈妈，无高危妊娠指征，经医生评估可适度运动者。</p><h3 style="color:#333;font-size:16px;margin:15px 0 10px;">注意事项</h3><p style="color:#666;font-size:14px;line-height:1.8;">请穿着宽松舒适的运动服装，自带瑜伽垫和水杯。课前2小时请勿进食。</p></div>',
                },
                user_shares: [
                    {
                        nickname: '小橘子',
                        photo: '/static/images/common/default-images.png',
                        comment: '很棒的课程，老师很专业！',
                    },
                    {
                        nickname: '甜甜妈',
                        photo: '/static/images/common/default-images.png',
                        comment: '上完课感觉身体轻松多了',
                    },
                    {
                        nickname: '幸福妈妈',
                        photo: '/static/images/common/default-images.png',
                        comment: '认识了好多准妈妈朋友',
                    },
                ],
            };
        },

        components: {
            componentCommon,
        },

        computed: {
            signup_disabled() {
                return this.activity.signup_count >= this.activity.max_count;
            },
            signup_btn_text() {
                if (this.signup_disabled) return '名额已满';
                return '立即报名';
            },
            signup_btn_class() {
                if (this.signup_disabled) return 'signup-btn-disabled';
                return 'signup-btn-active';
            },
        },

        onLoad(params) {
            app.globalData.page_event_onload_handle(params);
            if (params && params.id) {
                this.setData({ activity_id: params.id });
            }
            this.get_activity_detail();
        },

        onShow() {
            app.globalData.page_event_onshow_handle();
            if ((this.$refs.common || null) != null) {
                this.$refs.common.on_show();
            }
        },

        onPageScroll(e) {
            this.setData({ scroll_value: e.scrollTop });
        },

        methods: {
            get_activity_detail() {
                if (!this.activity_id) return;
                var self = this;
                uni.request({
                    url: app.globalData.get_request_url('detail', 'activity'),
                    method: 'POST',
                    data: { id: this.activity_id },
                    dataType: 'json',
                    success: function(res) {
                        if (res.data.code == 0) {
                            var data = res.data.data || {};
                            self.setData({
                                activity: data.activity || self.activity,
                                user_shares: data.user_shares || self.user_shares,
                                is_favored: data.is_favored || false,
                                is_liked: data.is_liked || false,
                                like_count: data.like_count || self.like_count,
                                comment_count: data.comment_count || self.comment_count,
                            });
                        }
                    },
                    fail: function() {},
                });
            },

            nav_back_event() {
                app.globalData.page_back_prev_event();
            },

            fav_event() {
                this.setData({ is_favored: !this.is_favored });
                app.globalData.showToast(this.is_favored ? '收藏成功' : '已取消收藏', 'success');
            },

            like_event() {
                var new_liked = !this.is_liked;
                this.setData({
                    is_liked: new_liked,
                    like_count: this.like_count + (new_liked ? 1 : -1),
                });
            },

            comment_event() {
                app.globalData.showToast('评论功能开发中');
            },

            share_event() {
                uni.showShareMenu({
                    withShareTicket: true,
                    menus: ['shareAppMessage', 'shareTimeline'],
                    success: function() {},
                    fail: function() {
                        app.globalData.showToast('分享功能暂不可用');
                    },
                });
            },

            poster_event() {
                uni.showShareMenu({
                    withShareTicket: true,
                    menus: ['shareAppMessage', 'shareTimeline'],
                    success: function() {},
                    fail: function() {
                        app.globalData.showToast('分享海报功能暂不可用');
                    },
                });
            },

            signup_event() {
                if (this.signup_disabled) return;
                uni.navigateTo({
                    url: '/pages/activity-signup/activity-signup?id=' + this.activity.id,
                });
            },
        },
    };
</script>

<style lang="scss" scoped>
    .activity-detail-page {
        min-height: 100vh;
        background-color: #FFF8F5;
        padding-bottom: 140rpx;
    }

    .nav-top {
        transition: background-color 0.3s;
    }

    .nav-top-content {
        height: 88rpx;
        transition: background-color 0.3s;
    }

    .nav-title {
        position: absolute;
        left: 50%;
        transform: translateX(-50%);
    }

    .cover-container {
        position: relative;
        width: 100%;
        height: 500rpx;
    }

    .cover-image {
        width: 100%;
        height: 100%;
    }

    .cover-stage-tag {
        position: absolute;
        top: 24rpx;
        left: 24rpx;
        z-index: 2;
    }

    .info-card {
        margin-top: -40rpx;
        position: relative;
        z-index: 5;
    }

    .price-row {
        gap: 16rpx;
    }

    .detail-content {
        line-height: 1.8;
    }

    .share-scroll {
        white-space: nowrap;
    }

    .share-scroll-inner {
        gap: 20rpx;
    }

    .share-item {
        display: inline-flex;
        flex-direction: column;
        width: 280rpx;
        vertical-align: top;
    }

    .share-photo {
        width: 280rpx;
        height: 200rpx;
        border-radius: 12rpx;
    }

    .share-comment {
        margin-top: 4rpx;
    }

    .interact-item {
        min-width: 100rpx;
    }

    .bottom-bar {
        box-shadow: 0 -4rpx 20rpx rgba(0, 0, 0, 0.06);
    }

    .bottom-bar-inner {
        gap: 16rpx;
    }

    .fav-btn {
        min-width: 80rpx;
    }

    .poster-btn {
        min-width: 80rpx;
    }

    .signup-btn {
        height: 88rpx;
        line-height: 88rpx;
        padding: 0;
        border: none;
    }

    .signup-btn-active {
        background: linear-gradient(135deg, #F5A0B1 0%, #F5C6A0 100%);
    }

    .signup-btn-disabled {
        background-color: #DDDDDD;
        color: #999999;
    }
</style>
