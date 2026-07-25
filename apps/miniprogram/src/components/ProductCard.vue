<template>
  <view class="product-card" @tap="handleTap">
    <view class="product-image-wrap">
      <image
        v-if="imageSrc"
        class="product-image"
        :src="imageSrc"
        mode="aspectFit"
        lazy-load
      />
      <view v-else class="product-image-placeholder">
        <text class="placeholder-mark">禧</text>
      </view>
      <text class="product-tag">{{ primaryTag }}</text>
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
        <text class="product-sales">已售 {{ product.sales || 0 }} 件</text>
        <view class="card-more" @tap.stop="handleTap">
          <text class="card-more-text">查看</text>
          <view class="card-more-arrow"></view>
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
const primaryTag = computed(() => {
  const tag = props.product.tag || props.product.tags?.find(Boolean)
  return tag || '自营'
})

function handleTap() {
  uni.navigateTo({ url: `/pages/product/detail?id=${props.product.id}` })
}
</script>

<style lang="scss" scoped>
.product-card {
  overflow: hidden;
  background: rgba(255, 255, 255, 0.96);
  border: 1rpx solid rgba($border-color, 0.68);
  border-radius: 28rpx;
  box-shadow: 0 8rpx 24rpx rgba(119, 82, 74, 0.06);
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
  background: #FFFFFF;
  border-bottom: 1rpx solid rgba($divider-color, 0.62);
}

.product-image,
.product-image-placeholder {
  position: absolute;
  top: 10rpx;
  left: 10rpx;
  width: calc(100% - 20rpx);
  height: calc(100% - 20rpx);
  border-radius: 22rpx;
  background: linear-gradient(180deg, #FFFFFF, $bg-ivory);
}

.product-image-placeholder {
  @include flex-center;
}

.placeholder-mark {
  color: rgba($primary-color, 0.42);
  font-size: 52rpx;
  font-weight: 900;
}

.product-tag {
  position: absolute;
  top: 18rpx;
  left: 18rpx;
  max-width: calc(100% - 36rpx);
  padding: 5rpx 13rpx;
  overflow: hidden;
  color: $success-dark;
  font-size: 18rpx;
  font-weight: 700;
  line-height: 1.35;
  white-space: nowrap;
  text-overflow: ellipsis;
  border: 1rpx solid rgba($success-color, 0.16);
  border-radius: $radius-round;
  background: rgba(255, 255, 255, 0.94);
}

.product-info {
  padding: 16rpx 18rpx 18rpx;
}

.product-name {
  display: block;
  min-height: 78rpx;
  color: $text-color;
  font-size: 27rpx;
  font-weight: 650;
  line-height: 1.44;
  @include text-ellipsis-2;
}

.product-price-row {
  display: flex;
  align-items: baseline;
  min-width: 0;
  margin-top: 10rpx;
}

.product-original-price {
  margin-left: 7rpx;
  overflow: hidden;
  color: $text-hint;
  font-size: 19rpx;
  white-space: nowrap;
  text-decoration: line-through;
  text-overflow: ellipsis;
}

.product-meta {
  @include flex-between;
  min-height: 46rpx;
  margin-top: 9rpx;
}

.product-sales {
  color: $text-hint;
  font-size: 20rpx;
}

.card-more {
  display: inline-flex;
  align-items: center;
  min-height: 42rpx;
  padding: 0 13rpx;
  border-radius: $radius-round;
  background: rgba($primary-color, 0.09);
}

.card-more-text {
  color: $primary-dark;
  font-size: 19rpx;
  font-weight: 700;
}

.card-more-arrow {
  width: 8rpx;
  height: 8rpx;
  margin-left: 7rpx;
  border-top: 2rpx solid $primary-dark;
  border-right: 2rpx solid $primary-dark;
  transform: rotate(45deg);
}
</style>
