<template>
  <view class="bottom-action-bar">
    <slot />
  </view>
</template>

<script setup lang="ts">
</script>

<style lang="scss" scoped>
.bottom-action-bar {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 20;
  display: flex;
  align-items: center;
  gap: $spacing-sm;
  min-height: 112rpx;
  background: rgba(255, 253, 251, 0.96);
  border-top: 1rpx solid rgba($border-color, 0.82);
  box-shadow: 0 -10rpx 30rpx rgba(119, 82, 74, 0.06);
  padding: $spacing-sm $spacing-md;
  @include safe-bottom;
}
</style>
