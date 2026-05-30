<template>
  <view class="empty-state">
    <image v-if="image" class="empty-image" :src="image" mode="aspectFit" />
    <view v-else class="empty-illustration">
      <text v-if="iconText" class="empty-icon-text">{{ iconText }}</text>
    </view>
    <text class="empty-text">{{ text }}</text>
    <view v-if="actionText" class="empty-action" @tap="$emit('action')">
      <text class="empty-action-text">{{ actionText }}</text>
    </view>
  </view>
</template>

<script setup lang="ts">
withDefaults(defineProps<{
  text?: string
  image?: string
  iconText?: string
  actionText?: string
}>(), {
  text: '暂无数据',
  iconText: '',
  actionText: ''
})

defineEmits<{
  action: []
}>()
</script>

<style lang="scss" scoped>
.empty-state {
  @include flex-center;
  @include flex-column;
  padding: 128rpx 32rpx;
}

.empty-image {
  width: 240rpx;
  height: 240rpx;
  margin-bottom: $spacing-md;
}

.empty-illustration {
  position: relative;
  width: 176rpx;
  height: 136rpx;
  margin-bottom: $spacing-lg;
  border-radius: 44rpx;
  background: linear-gradient(135deg, $primary-soft, $secondary-soft);
  box-shadow: inset 0 -10rpx 24rpx rgba(244, 124, 124, 0.08);

  &::before {
    content: '';
    position: absolute;
    left: 44rpx;
    top: 38rpx;
    width: 88rpx;
    height: 48rpx;
    border-radius: 28rpx 28rpx 18rpx 18rpx;
    background: rgba(255, 255, 255, 0.92);
    border: 2rpx solid rgba($primary-color, 0.12);
  }

  &::after {
    content: '';
    position: absolute;
    left: 70rpx;
    top: 96rpx;
    width: 36rpx;
    height: 10rpx;
    border-radius: $radius-round;
    background: rgba($primary-color, 0.26);
  }
}

.empty-icon-text {
  position: absolute;
  left: 0;
  right: 0;
  top: 40rpx;
  text-align: center;
  font-size: 44rpx;
  color: $primary-color;
}

.empty-text {
  font-size: $font-md;
  color: $text-hint;
  margin-bottom: $spacing-lg;
}

.empty-action {
  @include flex-center;
  min-height: 68rpx;
  padding: 0 38rpx;
  border-radius: $radius-round;
  background: $primary-soft;

  .empty-action-text {
    color: $primary-dark;
    font-size: $font-md;
    font-weight: 600;
  }
}
</style>
