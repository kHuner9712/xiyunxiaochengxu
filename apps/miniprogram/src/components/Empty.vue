<template>
  <view class="empty-state">
    <image v-if="image" class="empty-image" :src="image" mode="aspectFit" />
    <text v-else class="empty-icon-text">{{ iconText }}</text>
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
  iconText: '📭',
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
  padding: 120rpx 0;
}

.empty-image {
  width: 240rpx;
  height: 240rpx;
  margin-bottom: $spacing-md;
}

.empty-icon-text {
  font-size: 100rpx;
  margin-bottom: $spacing-md;
}

.empty-text {
  font-size: $font-md;
  color: $text-hint;
  margin-bottom: $spacing-lg;
}

.empty-action {
  .empty-action-text {
    color: $primary-color;
    font-size: $font-md;
    padding: 16rpx 48rpx;
    border: 2rpx solid $primary-color;
    border-radius: $radius-round;
  }
}
</style>
