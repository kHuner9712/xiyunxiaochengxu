<template>
  <view v-if="visible" class="loading-wrap" :class="{ fullscreen: fullscreen }">
    <view class="loading-card">
      <view class="loading-spinner">
        <view class="spinner-halo"></view>
        <view class="spinner-dot" v-for="i in 3" :key="i" :style="{ animationDelay: `${(i - 1) * 0.16}s` }"></view>
      </view>
      <text v-if="text" class="loading-text">{{ text }}</text>
    </view>
  </view>
</template>

<script setup lang="ts">
withDefaults(defineProps<{
  visible?: boolean
  text?: string
  fullscreen?: boolean
}>(), {
  visible: true,
  text: '加载中...',
  fullscreen: false
})
</script>

<style lang="scss" scoped>
.loading-wrap {
  @include flex-center;
  @include flex-column;
  padding: 64rpx 0;

  &.fullscreen {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background:
      radial-gradient(circle at 16% 12%, rgba($primary-color, 0.12), rgba($primary-color, 0) 260rpx),
      rgba(255, 253, 251, 0.88);
    z-index: 9999;
  }
}

.loading-card {
  @include flex-center;
  @include flex-column;
  min-width: 196rpx;
  min-height: 138rpx;
  padding: 28rpx 34rpx;
  border-radius: $radius-xxl;
  background: rgba(255, 255, 255, 0.82);
  border: 1rpx solid rgba(255, 255, 255, 0.78);
  box-shadow: $shadow-sm;
}

.loading-spinner {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  height: 34rpx;
}

.spinner-halo {
  position: absolute;
  left: 50%;
  top: 50%;
  width: 92rpx;
  height: 34rpx;
  border-radius: $radius-round;
  background: linear-gradient(135deg, rgba($primary-color, 0.08), rgba($secondary-color, 0.1));
  transform: translate(-50%, -50%);
}

.spinner-dot {
  position: relative;
  z-index: 1;
  width: 12rpx;
  height: 12rpx;
  border-radius: 50%;
  background: $gradient-coral;
  margin: 0 8rpx;
  animation: dot-breathe 1.4s infinite ease-in-out both;
  box-shadow: 0 4rpx 10rpx rgba($primary-color, 0.18);
}

@keyframes dot-breathe {
  0%, 80%, 100% {
    opacity: 0.28;
    transform: scale(0.72);
  }
  40% {
    opacity: 1;
    transform: scale(1);
  }
}

.loading-text {
  font-size: $font-sm;
  color: $text-secondary;
  margin-top: 20rpx;
  font-weight: 600;
}
</style>
