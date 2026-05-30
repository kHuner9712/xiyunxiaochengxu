<template>
  <view class="price-display" :class="size">
    <text v-if="showSymbol" class="price-symbol">¥</text>
    <text class="price-integer">{{ integerPart }}</text>
    <text v-if="showDecimal && decimalPart" class="price-decimal">.{{ decimalPart }}</text>
  </view>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { formatPrice } from '@/utils/format'

const props = withDefaults(defineProps<{
  price: number | string
  showSymbol?: boolean
  showDecimal?: boolean
  color?: string
  size?: 'small' | 'normal' | 'large'
}>(), {
  showSymbol: true,
  showDecimal: true,
  color: '',
  size: 'normal'
})

const priceStr = computed(() => formatPrice(props.price))
const integerPart = computed(() => priceStr.value.split('.')[0])
const decimalPart = computed(() => priceStr.value.split('.')[1])
const priceColor = computed(() => props.color || '#F47C7C')
</script>

<style lang="scss" scoped>
.price-display {
  display: inline-flex;
  align-items: baseline;
  color: v-bind(priceColor);
  font-weight: 800;
  line-height: 1;
}

.price-symbol {
  font-size: $font-xs;
  margin-right: 2rpx;
}

.price-integer {
  font-size: $font-xl;
}

.price-decimal {
  font-size: $font-sm;
}

.price-display.small {
  .price-symbol,
  .price-decimal {
    font-size: 18rpx;
  }

  .price-integer {
    font-size: $font-md;
  }
}

.price-display.large {
  .price-symbol,
  .price-decimal {
    font-size: $font-md;
  }

  .price-integer {
    font-size: $font-xxl;
  }
}
</style>
