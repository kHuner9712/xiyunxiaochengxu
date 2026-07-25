<template>
  <view class="cs-btn" @tap="handleTap">
    <view class="cs-icon" aria-hidden="true"></view>
    <text v-if="showText" class="cs-text">{{ text || '客服' }}</text>
  </view>
</template>

<script setup lang="ts">
withDefaults(defineProps<{
  showText?: boolean
  text?: string
}>(), {
  showText: false,
  text: '客服'
})

function handleTap() {
  uni.navigateTo({ url: '/pages/customer-service/index' })
}
</script>

<style lang="scss" scoped>
.cs-btn {
  @include flex-center;
  @include flex-column;
  width: 88rpx;
  height: 88rpx;
  border: 1rpx solid rgba($border-color, 0.72);
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.96);
  box-shadow: 0 10rpx 28rpx rgba(119, 82, 74, 0.1);

  &:active {
    transform: scale(0.96);
  }
}

.cs-icon {
  position: relative;
  width: 38rpx;
  height: 38rpx;

  &::before,
  &::after {
    content: '';
    position: absolute;
    box-sizing: border-box;
  }

  &::before {
    left: 4rpx;
    top: 4rpx;
    width: 30rpx;
    height: 25rpx;
    border: 4rpx solid $primary-dark;
    border-bottom: 0;
    border-radius: 20rpx 20rpx 0 0;
  }

  &::after {
    left: 1rpx;
    top: 20rpx;
    width: 7rpx;
    height: 14rpx;
    border-radius: 5rpx;
    background: $primary-dark;
    box-shadow: 29rpx 0 $primary-dark;
  }
}

.cs-text {
  margin-top: 2rpx;
  color: $text-hint;
  font-size: 19rpx;
  line-height: 1.1;
}
</style>
