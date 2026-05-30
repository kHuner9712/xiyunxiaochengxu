<template>
  <view class="form-card">
    <slot />
  </view>
</template>

<script setup lang="ts">
</script>

<style lang="scss" scoped>
.form-card {
  background: $bg-white;
  border-radius: $radius-xl;
  padding: $spacing-md;
  margin-bottom: $spacing-md;
  border: 1rpx solid rgba($border-color, 0.72);
  box-shadow: $shadow-sm;
}
</style>
