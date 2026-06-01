<template>
  <view class="coupon-card" :class="{ disabled }">
    <view class="coupon-value">
      <text class="coupon-symbol">¥</text>
      <text class="coupon-amount">{{ amount }}</text>
    </view>
    <view class="coupon-content">
      <text class="coupon-title">{{ title }}</text>
      <text v-if="condition" class="coupon-condition">{{ condition }}</text>
      <text v-if="time" class="coupon-time">{{ time }}</text>
    </view>
    <slot name="extra" />
  </view>
</template>

<script setup lang="ts">
withDefaults(defineProps<{
  amount: string | number
  title: string
  condition?: string
  time?: string
  disabled?: boolean
}>(), {
  condition: '',
  time: '',
  disabled: false
})
</script>

<style lang="scss" scoped>
.coupon-card {
  display: flex;
  align-items: center;
  min-height: 168rpx;
  padding: $spacing-md;
  border-radius: $radius-xxl;
  background: linear-gradient(135deg, $primary-soft 0%, #FFFFFF 58%, $secondary-soft 100%);
  border: 1rpx solid rgba($border-color, 0.78);
  box-shadow: $shadow-sm;

  &.disabled {
    opacity: 0.58;
  }
}

.coupon-value {
  width: 150rpx;
  color: $price-color;
  display: flex;
  align-items: baseline;
}

.coupon-symbol {
  font-size: $font-sm;
  font-weight: 700;
}

.coupon-amount {
  font-size: $font-xxl;
  font-weight: 800;
}

.coupon-content {
  flex: 1;
  min-width: 0;
}

.coupon-title {
  display: block;
  font-size: $font-md;
  font-weight: 700;
  color: $text-color;
  @include text-ellipsis;
}

.coupon-condition,
.coupon-time {
  display: block;
  margin-top: 6rpx;
  font-size: $font-xs;
  color: $text-hint;
}
</style>
