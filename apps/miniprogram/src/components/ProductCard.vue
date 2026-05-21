<template>
  <view class="product-card" @tap="handleTap">
    <view class="product-image-wrap">
      <image class="product-image" :src="product.image" mode="aspectFill" />
      <view v-if="product.tag" class="product-tag">{{ product.tag }}</view>
    </view>
    <view class="product-info">
      <text class="product-name">{{ product.name }}</text>
      <view class="product-price-row">
        <view class="product-price">
          <text class="price-symbol">¥</text>
          <text class="price-value">{{ formatPrice(product.price) }}</text>
        </view>
        <text v-if="product.originalPrice > product.price" class="product-original-price">
          ¥{{ formatPrice(product.originalPrice) }}
        </text>
      </view>
      <text class="product-sales">已售{{ product.sales || 0 }}件</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { formatPrice } from '@/utils/format'

interface ProductCardItem {
  id: number
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
  border-radius: $radius-lg;
  overflow: hidden;
  box-shadow: $shadow-sm;
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
  }

  .product-tag {
    position: absolute;
    top: 8rpx;
    left: 8rpx;
    background: $primary-color;
    color: #fff;
    font-size: $font-xs;
    padding: 4rpx 12rpx;
    border-radius: $radius-sm;
  }
}

.product-info {
  padding: $spacing-sm;
}

.product-name {
  font-size: $font-md;
  color: $text-color;
  @include text-ellipsis-2;
  line-height: 1.4;
  height: 78rpx;
}

.product-price-row {
  display: flex;
  align-items: baseline;
  margin-top: $spacing-xs;
}

.product-price {
  color: $primary-color;
  font-weight: 700;

  .price-symbol {
    font-size: $font-xs;
  }

  .price-value {
    font-size: $font-lg;
  }
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
  margin-top: 4rpx;
}
</style>
