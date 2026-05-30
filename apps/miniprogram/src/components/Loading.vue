<template>
  <view v-if="visible" class="loading-wrap" :class="{ fullscreen: fullscreen }">
    <view class="loading-spinner">
      <view class="spinner-dot" v-for="i in 3" :key="i" :style="{ animationDelay: `${(i - 1) * 0.16}s` }"></view>
    </view>
    <text v-if="text" class="loading-text">{{ text }}</text>
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
  padding: 56rpx 0;

  &.fullscreen {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(255, 253, 251, 0.86);
    z-index: 9999;
  }
}

.loading-spinner {
  display: flex;
  align-items: center;
  justify-content: center;
}

.spinner-dot {
  width: 10rpx;
  height: 10rpx;
  border-radius: 50%;
  background: $primary-color;
  margin: 0 7rpx;
  animation: dot-breathe 1.4s infinite ease-in-out both;
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
  color: $text-hint;
  margin-top: 18rpx;
}
</style>
