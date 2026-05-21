<template>
  <view class="price-display">
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
}>(), {
  showSymbol: true,
  showDecimal: true,
  color: ''
})

const priceStr = computed(() => formatPrice(props.price))
const integerPart = computed(() => priceStr.value.split('.')[0])
const decimalPart = computed(() => priceStr.value.split('.')[1])
const priceColor = computed(() => props.color || '#ff4d4f')
</script>

<style lang="scss" scoped>
.price-display {
  display: inline-flex;
  align-items: baseline;
  color: v-bind(priceColor);
  font-weight: 700;
}

.price-symbol {
  font-size: $font-sm;
}

.price-integer {
  font-size: $font-xl;
}

.price-decimal {
  font-size: $font-sm;
}
</style>
