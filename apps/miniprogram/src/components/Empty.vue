<template>
  <view class="empty-state">
    <image v-if="image" class="empty-image" :src="image" mode="aspectFit" />
    <view v-else class="empty-illustration">
      <text class="empty-icon-text">{{ iconText || '禧' }}</text>
    </view>
    <text class="empty-text">{{ text }}</text>
    <text v-if="hint" class="empty-hint">{{ hint }}</text>
    <view v-if="actionText" class="empty-action" @tap="$emit('action')">
      <text class="empty-action-text">{{ actionText }}</text>
    </view>
  </view>
</template>

<script setup lang="ts">
withDefaults(defineProps<{
  text?: string
  hint?: string
  image?: string
  iconText?: string
  actionText?: string
}>(), {
  text: '暂无数据',
  hint: '暂时没有内容，稍后再来看看',
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
  padding: 92rpx 32rpx 110rpx;
  text-align: center;
}

.empty-image {
  width: 188rpx;
  height: 188rpx;
  margin-bottom: 24rpx;
  border-radius: 36rpx;
}

.empty-illustration {
  position: relative;
  @include flex-center;
  width: 152rpx;
  height: 122rpx;
  margin-bottom: 24rpx;
  border: 1rpx solid rgba(255, 255, 255, 0.88);
  border-radius: 40rpx;
  background:
    radial-gradient(circle at 72% 18%, rgba($success-color, 0.16), rgba($success-color, 0) 68rpx),
    linear-gradient(145deg, #fff7f1, #fff0e9);
  box-shadow: 0 10rpx 28rpx rgba(119, 82, 74, 0.07);

  &::before {
    content: '';
    position: absolute;
    left: 28rpx;
    right: 28rpx;
    bottom: 24rpx;
    height: 34rpx;
    border: 2rpx solid rgba($primary-color, 0.11);
    border-radius: 24rpx;
    background: rgba(255, 255, 255, 0.92);
  }

  &::after {
    content: '';
    position: absolute;
    left: 59rpx;
    bottom: 14rpx;
    width: 34rpx;
    height: 10rpx;
    border-radius: $radius-round;
    background: rgba($primary-color, 0.2);
  }
}

.empty-icon-text {
  position: relative;
  z-index: 1;
  margin-top: -14rpx;
  color: $primary-dark;
  font-size: 42rpx;
  font-weight: 900;
}

.empty-text {
  max-width: 560rpx;
  color: $text-color;
  font-size: 29rpx;
  font-weight: 800;
  line-height: 1.45;
}

.empty-hint {
  max-width: 520rpx;
  margin-top: 8rpx;
  color: $text-hint;
  font-size: 23rpx;
  line-height: 1.55;
}

.empty-action {
  @include flex-center;
  min-height: 68rpx;
  margin-top: 24rpx;
  padding: 0 38rpx;
  border-radius: $radius-round;
  background: $gradient-coral;
  box-shadow: $shadow-coral;

  .empty-action-text {
    color: #FFFFFF;
    font-size: 25rpx;
    font-weight: 800;
  }
}
</style>
