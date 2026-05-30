<template>
  <view class="product-card" @tap="handleTap">
    <view class="product-image-wrap">
      <image class="product-image" :src="product.image" mode="aspectFill" />
      <view v-if="product.tag" class="product-tag">{{ product.tag }}</view>
    </view>
    <view class="product-info">
      <text class="product-name">{{ product.name }}</text>
      <view class="product-price-row">
        <PriceDisplay :price="product.price" size="small" />
        <text v-if="product.originalPrice > product.price" class="product-original-price">
          ¥{{ formatPrice(product.originalPrice) }}
        </text>
      </view>
      <view class="product-meta">
        <text class="product-sales">已售{{ product.sales || 0 }}件</text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { formatPrice } from '@/utils/format'
import PriceDisplay from '@/components/PriceDisplay.vue'

interface ProductCardItem {
  id: string | number
  name: string
  image: string
  price: number
  originalPrice: number
  sales: number
  tag?: string
}

const props = defineProps<{
  product: ProductCardItem
}>()

function handleTap() {
  uni.navigateTo({ url: `/pages/product/detail?id=${props.product.id}` })
}
</script>

<style lang="scss" scoped>
.product-card {
  background: $bg-white;
  border-radius: $radius-xl;
  overflow: hidden;
  border: 1rpx solid rgba($border-color, 0.72);
  box-shadow: $shadow-sm;
  transition: transform 0.16s ease, box-shadow 0.16s ease;

  &:active {
    transform: scale(0.985);
    box-shadow: none;
  }
}

.product-image-wrap {
  position: relative;
  width: 100%;
  padding-top: 100%;

  .product-image {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: $bg-gray;
  }

  .product-tag {
    position: absolute;
    top: 8rpx;
    left: 8rpx;
    background: rgba(255, 255, 255, 0.92);
    color: $primary-dark;
    font-size: $font-xs;
    padding: 6rpx 14rpx;
    border-radius: $radius-round;
    box-shadow: $shadow-sm;
  }
}

.product-info {
  padding: 18rpx 18rpx 20rpx;
}

.product-name {
  font-size: $font-md;
  color: $text-color;
  font-weight: 600;
  @include text-ellipsis-2;
  line-height: 1.4;
  min-height: 78rpx;
}

.product-price-row {
  display: flex;
  align-items: baseline;
  margin-top: 12rpx;
}

.product-original-price {
  font-size: $font-xs;
  color: $text-hint;
  text-decoration: line-through;
  margin-left: 8rpx;
}

.product-sales {
  font-size: $font-xs;
  color: $text-hint;
}

.product-meta {
  margin-top: 8rpx;
}
</style>
