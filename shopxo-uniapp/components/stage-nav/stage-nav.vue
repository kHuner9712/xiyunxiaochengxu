<template>
    <view class="muying-stage-nav">
        <view
            v-for="(item, index) in stageList"
            :key="index"
            class="muying-stage-card muying-card"
            :class="'muying-stage-card--' + item.type"
            @tap="stage_click(item.type)"
        >
            <text class="muying-stage-icon">{{ item.icon }}</text>
            <text class="muying-stage-title">{{ item.title }}</text>
            <text class="muying-stage-subtitle">{{ item.subtitle }}</text>
        </view>
    </view>
</template>

<script>
    import { MuyingStage } from '@/common/js/config/muying-enum';

    export default {
        name: 'component-stage-nav',
        data() {
            return {
                stageList: [
                    { type: MuyingStage.PREPARE, icon: '🌸', title: '备孕阶段', subtitle: '科学备孕·营养先行' },
                    { type: MuyingStage.PREGNANCY, icon: '🤰', title: '孕期阶段', subtitle: '安心孕育·专业陪伴' },
                    { type: MuyingStage.POSTPARTUM, icon: '👶', title: '产后阶段', subtitle: '科学恢复·健康育儿' },
                ],
            };
        },
        methods: {
            stage_click(stage) {
                this.$emit('stage-click', stage);
            },
        },
    };
</script>

<style scoped>
    .muying-stage-nav {
        display: flex;
        justify-content: space-between;
        padding: 20rpx 0;
        gap: 16rpx;
    }

    .muying-stage-card {
        flex: 1;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 28rpx 12rpx;
        border-radius: 16rpx;
        background-color: #FFFFFF;
        box-shadow: 0 4rpx 20rpx rgba(245, 160, 177, 0.12);
        transition: transform 0.2s;
    }

    .muying-stage-card:active {
        transform: scale(0.96);
    }

    .muying-stage-card--prepare {
        background: linear-gradient(135deg, #FFF0F3 0%, #FFFFFF 100%);
    }

    .muying-stage-card--pregnancy {
        background: linear-gradient(135deg, #FFF5E6 0%, #FFFFFF 100%);
    }

    .muying-stage-card--postpartum {
        background: linear-gradient(135deg, #F0F5FF 0%, #FFFFFF 100%);
    }

    .muying-stage-icon {
        font-size: 56rpx;
        line-height: 1;
        margin-bottom: 12rpx;
    }

    .muying-stage-title {
        font-size: 28rpx;
        font-weight: bold;
        color: #333333;
        margin-bottom: 6rpx;
    }

    .muying-stage-card--prepare .muying-stage-title {
        color: #F5A0B1;
    }

    .muying-stage-card--pregnancy .muying-stage-title {
        color: #E8A050;
    }

    .muying-stage-card--postpartum .muying-stage-title {
        color: #7BA0F5;
    }

    .muying-stage-subtitle {
        font-size: 20rpx;
        color: #999999;
    }

    .muying-stage-card--prepare .muying-stage-subtitle {
        color: #F5A0B1;
    }

    .muying-stage-card--pregnancy .muying-stage-subtitle {
        color: #E8A050;
    }

    .muying-stage-card--postpartum .muying-stage-subtitle {
        color: #7BA0F5;
    }
</style>
