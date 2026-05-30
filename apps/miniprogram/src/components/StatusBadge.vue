<template>
  <view class="status-badge" :class="toneClass">
    <slot>{{ text }}</slot>
  </view>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(defineProps<{
  text?: string
  tone?: 'primary' | 'success' | 'warning' | 'danger' | 'info'
}>(), {
  text: '',
  tone: 'primary'
})

const toneClass = computed(() => `status-${props.tone}`)
</script>

<style lang="scss" scoped>
.status-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 36rpx;
  padding: 4rpx 16rpx;
  font-size: $font-xs;
  border-radius: $radius-round;
  line-height: 1.2;
}

.status-primary {
  background: $primary-soft;
  color: $primary-dark;
}

.status-success {
  background: $success-soft;
  color: $success-color;
}

.status-warning {
  background: $warning-soft;
  color: $warning-color;
}

.status-danger {
  background: $danger-soft;
  color: $danger-color;
}

.status-info {
  background: $info-soft;
  color: $info-color;
}
</style>
