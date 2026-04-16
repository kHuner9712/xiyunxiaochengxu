<template>
    <view v-if="is_show" class="stage-guide-mask" @tap.stop="skip_event">
        <view class="stage-guide-popup" @tap.stop>
            <view class="stage-guide-header">
                <view class="stage-guide-title">选择您当前阶段</view>
                <view class="stage-guide-subtitle">为您提供更精准的内容推荐</view>
            </view>
            <view class="stage-guide-cards">
                <view
                    v-for="(item, index) in stage_list"
                    :key="index"
                    :class="['stage-guide-card', selected_stage === item.value ? 'stage-guide-card--active' : '']"
                    @tap="select_event(item.value)"
                >
                    <view :class="['stage-guide-card-icon', 'stage-guide-card-icon--' + item.value]">
                        <text class="stage-guide-card-icon-text">{{ item.icon }}</text>
                    </view>
                    <view class="stage-guide-card-name">{{ item.name }}</view>
                    <view class="stage-guide-card-desc">{{ item.desc }}</view>
                    <view v-if="selected_stage === item.value" class="stage-guide-card-check">
                        <text>✓</text>
                    </view>
                </view>
            </view>
            <view class="stage-guide-footer">
                <view class="stage-guide-skip" @tap="skip_event">跳过</view>
                <view :class="['stage-guide-confirm', selected_stage ? '' : 'stage-guide-confirm--disabled']" @tap="confirm_event">确认</view>
            </view>
        </view>
    </view>
</template>

<script>
    export default {
        name: 'stage-guide',
        props: {
            propShow: {
                type: Boolean,
                default: false
            }
        },
        data() {
            return {
                is_show: false,
                selected_stage: '',
                stage_list: [
                    { name: '备孕', value: 'prepare', icon: '🥚', desc: '科学备孕·营养先行' },
                    { name: '孕期', value: 'pregnancy', icon: '🤰', desc: '安心孕育·均衡补充' },
                    { name: '产后', value: 'postpartum', icon: '👶', desc: '科学恢复·重塑健康' }
                ]
            };
        },
        watch: {
            propShow(new_val) {
                this.is_show = new_val;
            }
        },
        methods: {
            select_event(value) {
                this.setData({ selected_stage: value });
            },
            skip_event() {
                this.setData({ is_show: false, selected_stage: '' });
                this.$emit('skip');
            },
            confirm_event() {
                if (!this.selected_stage) return;
                this.setData({ is_show: false });
                this.$emit('confirm', this.selected_stage);
            }
        }
    };
</script>

<style scoped>
    @import '@/common/css/muying.css';

    .stage-guide-mask {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 9999;
    }

    .stage-guide-popup {
        width: 85%;
        max-width: 640rpx;
        background: #FFFFFF;
        border-radius: 24rpx;
        overflow: hidden;
        animation: stageGuideFadeIn 0.3s ease;
    }

    @keyframes stageGuideFadeIn {
        from {
            opacity: 0;
            transform: scale(0.9);
        }
        to {
            opacity: 1;
            transform: scale(1);
        }
    }

    .stage-guide-header {
        padding: 48rpx 40rpx 24rpx;
        text-align: center;
    }

    .stage-guide-title {
        font-size: 36rpx;
        font-weight: bold;
        color: #333;
    }

    .stage-guide-subtitle {
        font-size: 26rpx;
        color: #999;
        margin-top: 8rpx;
    }

    .stage-guide-cards {
        display: flex;
        padding: 16rpx 24rpx;
        gap: 16rpx;
    }

    .stage-guide-card {
        flex: 1;
        padding: 28rpx 16rpx;
        border-radius: 16rpx;
        background: #FFF8F5;
        border: 2rpx solid #F5F5F5;
        text-align: center;
        position: relative;
        transition: all 0.2s;
    }

    .stage-guide-card--active {
        border-color: #F5A0B1;
        background: #FFF0F3;
    }

    .stage-guide-card-icon {
        width: 80rpx;
        height: 80rpx;
        border-radius: 50%;
        margin: 0 auto 16rpx;
        display: flex;
        align-items: center;
        justify-content: center;
    }

    .stage-guide-card-icon--prepare {
        background: #FFF0F3;
    }

    .stage-guide-card-icon--pregnancy {
        background: #FFF5E6;
    }

    .stage-guide-card-icon--postpartum {
        background: #F0F5FF;
    }

    .stage-guide-card-icon-text {
        font-size: 40rpx;
    }

    .stage-guide-card-name {
        font-size: 28rpx;
        font-weight: bold;
        color: #333;
        margin-bottom: 8rpx;
    }

    .stage-guide-card-desc {
        font-size: 20rpx;
        color: #999;
    }

    .stage-guide-card-check {
        position: absolute;
        top: 12rpx;
        right: 12rpx;
        width: 36rpx;
        height: 36rpx;
        border-radius: 50%;
        background: linear-gradient(135deg, #F5A0B1, #F5C6A0);
        color: #FFFFFF;
        font-size: 20rpx;
        display: flex;
        align-items: center;
        justify-content: center;
    }

    .stage-guide-footer {
        display: flex;
        padding: 24rpx 40rpx 48rpx;
        gap: 24rpx;
    }

    .stage-guide-skip {
        flex: 1;
        height: 80rpx;
        line-height: 80rpx;
        text-align: center;
        border-radius: 40rpx;
        font-size: 28rpx;
        color: #999;
        border: 2rpx solid #E5E5E5;
    }

    .stage-guide-confirm {
        flex: 1;
        height: 80rpx;
        line-height: 80rpx;
        text-align: center;
        border-radius: 40rpx;
        font-size: 28rpx;
        color: #FFFFFF;
        background: linear-gradient(135deg, #F5A0B1, #F5C6A0);
    }

    .stage-guide-confirm--disabled {
        opacity: 0.5;
    }
</style>
