<template>
  <view class="product-card" @tap="handleTap">
    <view class="product-image-wrap">
      <image class="product-image" :src="imageSrc" mode="aspectFit" />
      <view class="image-glow"></view>
      <view v-if="displayTags.length" class="product-tag">{{ displayTags[0] }}</view>
    </view>
    <view class="product-info">
      <view class="tag-row">
        <text v-for="tag in displayTags.slice(0, 2)" :key="tag" class="soft-tag">{{ tag }}</text>
      </view>
      <text class="product-name">{{ product.name }}</text>
      <view class="product-price-row">
        <PriceDisplay :price="product.price" size="small" />
        <text v-if="product.originalPrice > product.price" class="product-original-price">
          ¥{{ formatPrice(product.originalPrice) }}
        </text>
      </view>
      <view class="product-meta">
        <text class="product-sales">已售{{ product.sales || 0 }}件</text>
        <view class="visual-cart-btn" @tap.stop="handleTap">
          <text class="visual-cart-icon">+</text>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { formatPrice } from '@/utils/format'
import PriceDisplay from '@/components/PriceDisplay.vue'

interface ProductCardItem {
  id: string | number
  name: string
  image?: string
  images?: string[]
  price: number
  originalPrice: number
  sales: number
  tag?: string
  tags?: string[]
}

const props = defineProps<{
  product: ProductCardItem
}>()

const imageSrc = computed(() => props.product.image || props.product.images?.[0] || '')
const displayTags = computed(() => {
  const tags = [
    props.product.tag,
    ...(props.product.tags || [])
  ].filter(Boolean) as string[]
  const uniqueTags = Array.from(new Set(tags))
  return uniqueTags.length ? uniqueTags : ['自营正品']
})

function handleTap() {
  uni.navigateTo({ url: `/pages/product/detail?id=${props.product.id}` })
}
</script>

<style lang="scss" scoped>
.product-card {
  background: $gradient-card;
  border-radius: $radius-xxl;
  overflow: hidden;
  border: 1rpx solid rgba($border-color, 0.76);
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
  padding-top: 104%;
  background: linear-gradient(180deg, $bg-ivory 0%, $bg-soft 100%);

  .product-image {
    position: absolute;
    top: 12rpx;
    left: 12rpx;
    width: calc(100% - 24rpx);
    height: calc(100% - 20rpx);
    background: $bg-gray;
    border-radius: 28rpx;
  }

  .image-glow {
    position: absolute;
    left: 18rpx;
    right: 18rpx;
    bottom: 8rpx;
    height: 46rpx;
    border-radius: 50%;
    background: rgba($primary-color, 0.08);
  }

  .product-tag {
    position: absolute;
    top: 20rpx;
    left: 20rpx;
    background: rgba(255, 255, 255, 0.94);
    color: $primary-dark;
    font-size: $font-xs;
    padding: 6rpx 14rpx;
    border-radius: $radius-round;
    box-shadow: $shadow-sm;
  }
}

.product-info {
  padding: 18rpx 20rpx 20rpx;
}

.tag-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8rpx;
  min-height: 34rpx;
  margin-bottom: 8rpx;
}

.soft-tag {
  max-width: 142rpx;
  padding: 4rpx 12rpx;
  border-radius: $radius-round;
  background: rgba($success-color, 0.11);
  color: $success-dark;
  font-size: 18rpx;
  line-height: 1.35;
  @include text-ellipsis;
}

.product-name {
  font-size: $font-md;
  color: $text-color;
  font-weight: 600;
  @include text-ellipsis-2;
  line-height: 1.46;
  min-height: 82rpx;
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
  margin-top: 12rpx;
  @include flex-between;
}

.visual-cart-btn {
  @include flex-center;
  width: 48rpx;
  height: 48rpx;
  border-radius: 50%;
  background: $gradient-coral;
  box-shadow: $shadow-coral;
  flex-shrink: 0;
}

.visual-cart-icon {
  color: #FFFFFF;
  font-size: 34rpx;
  line-height: 1;
  font-weight: 500;
}
</style>
