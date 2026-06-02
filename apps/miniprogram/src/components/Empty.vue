<template>
  <view class="empty-state">
    <image v-if="image" class="empty-image" :src="image" mode="aspectFit" />
    <view v-else class="empty-illustration">
      <text class="empty-icon-text">{{ iconText || '禧' }}</text>
    </view>
    <text class="empty-text">{{ text }}</text>
    <text class="empty-hint">安心好物会在这里为你准备好</text>
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
  padding: 132rpx 32rpx;
  text-align: center;
}

.empty-image {
  width: 228rpx;
  height: 228rpx;
  margin-bottom: $spacing-lg;
  border-radius: $radius-xxl;
}

.empty-illustration {
  position: relative;
  @include flex-center;
  width: 184rpx;
  height: 148rpx;
  margin-bottom: $spacing-lg;
  border-radius: 48rpx;
  background:
    radial-gradient(circle at 72% 20%, rgba($success-color, 0.18), rgba($success-color, 0) 82rpx),
    $gradient-peach;
  border: 1rpx solid rgba(255, 255, 255, 0.82);
  box-shadow: $shadow-md;

  &::before {
    content: '';
    position: absolute;
    left: 34rpx;
    right: 34rpx;
    bottom: 30rpx;
    height: 42rpx;
    border-radius: 28rpx;
    background: rgba(255, 255, 255, 0.92);
    border: 2rpx solid rgba($primary-color, 0.12);
  }

  &::after {
    content: '';
    position: absolute;
    left: 72rpx;
    bottom: 18rpx;
    width: 40rpx;
    height: 12rpx;
    border-radius: $radius-round;
    background: rgba($primary-color, 0.22);
  }
}

.empty-icon-text {
  position: relative;
  z-index: 1;
  margin-top: -18rpx;
  font-size: 50rpx;
  color: $primary-dark;
  font-weight: 900;
}

.empty-text {
  max-width: 560rpx;
  font-size: $font-md;
  color: $text-color;
  font-weight: 800;
  line-height: 1.5;
}

.empty-hint {
  max-width: 520rpx;
  margin-top: 10rpx;
  margin-bottom: $spacing-lg;
  font-size: $font-sm;
  color: $text-hint;
  line-height: 1.5;
}

.empty-action {
  @include flex-center;
  min-height: 76rpx;
  padding: 0 46rpx;
  border-radius: $radius-round;
  background: $gradient-coral;
  box-shadow: $shadow-coral;

  .empty-action-text {
    color: #FFFFFF;
    font-size: $font-md;
    font-weight: 800;
  }
}
</style>
