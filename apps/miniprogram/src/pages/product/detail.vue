<template>
  <view class="product-detail-page">
    <swiper class="image-swiper" indicator-dots circular :interval="4000">
      <swiper-item v-for="(img, index) in product.images" :key="index">
        <image class="product-image" :src="img" mode="aspectFill" @tap="previewImage(index)" />
      </swiper-item>
    </swiper>

    <view class="price-section">
      <view class="price-row">
        <PriceDisplay :price="product.price" />
        <text v-if="product.originalPrice > product.price" class="original-price">
          ¥{{ formatPrice(product.originalPrice) }}
        </text>
      </view>
      <text class="sales-text">已售{{ product.sales }}件</text>
    </view>

    <view class="info-section card">
      <text class="product-name">{{ product.name }}</text>
      <text v-if="product.subtitle" class="product-subtitle">{{ product.subtitle }}</text>
      <view v-if="product.tags?.length" class="tag-row">
        <text v-for="tag in product.tags" :key="tag" class="product-tag">{{ tag }}</text>
      </view>
    </view>

    <view class="sku-section card" @tap="showSkuPopup = true">
      <text class="section-label">规格</text>
      <text class="section-value">请选择规格</text>
      <text class="section-arrow">›</text>
    </view>

    <view class="detail-section card">
      <text class="detail-title">商品详情</text>
      <rich-text class="detail-content" :nodes="product.description" />
    </view>

    <view class="recommend-section" v-if="recommendProducts.length">
      <text class="section-title">为你推荐</text>
      <view class="product-grid">
        <ProductCard v-for="item in recommendProducts" :key="item.id" :product="item" />
      </view>
    </view>

    <view class="bottom-bar">
      <view class="bar-icon" @tap="goHome">
        <text class="icon-text">🏠</text>
        <text class="icon-label">首页</text>
      </view>
      <view class="bar-icon" @tap="goCart">
        <text class="icon-text">🛒</text>
        <text class="icon-label">购物车</text>
      </view>
      <view class="add-cart-btn" @tap="handleAddCart">
        <text class="btn-text">加入购物车</text>
      </view>
      <view class="buy-now-btn" @tap="handleBuyNow">
        <text class="btn-text">立即购买</text>
      </view>
    </view>

    <uni-popup ref="skuPopup" type="bottom">
      <view class="sku-popup">
        <view class="sku-header">
          <image class="sku-image" :src="currentSku?.image || product.images[0]" mode="aspectFill" />
          <view class="sku-price">
            <PriceDisplay :price="currentSku?.price || product.price" />
          </view>
          <text class="sku-stock">库存：{{ currentSku?.stock || product.stock }}</text>
        </view>
        <SkuSelector :specs="product.specs" :skus="product.skus" @change="onSkuChange" />
        <view class="sku-confirm-btn" @tap="confirmSku">
          <text class="confirm-text">确定</text>
        </view>
      </view>
    </uni-popup>
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { onLoad, onShareAppMessage } from '@dcloudio/uni-app'
import { getProductDetail, getProductRecommend, type ProductDetail, type SkuItem } from '@/api/product'
import { useCartStore } from '@/stores/cart'
import { useUserStore } from '@/stores/user'
import { formatPrice } from '@/utils/format'
import PriceDisplay from '@/components/PriceDisplay.vue'
import ProductCard from '@/components/ProductCard.vue'
import SkuSelector from '@/components/SkuSelector.vue'

const product = ref<ProductDetail>({
  id: 0, name: '', subtitle: '', images: [], price: 0, originalPrice: 0,
  sales: 0, stock: 0, description: '', skus: [], specs: [], tags: []
})
const recommendProducts = ref<any[]>([])
const showSkuPopup = ref(false)
const currentSku = ref<SkuItem | null>(null)
const selectedSkuId = ref(0)
const selectedQuantity = ref(1)
const skuAction = ref<'cart' | 'buy'>('cart')

const cartStore = useCartStore()
const userStore = useUserStore()

async function loadProduct(id: number) {
  try {
    const data = await getProductDetail(id)
    product.value = data
  } catch {
    uni.showToast({ title: '商品加载失败', icon: 'none' })
  }
}

async function loadRecommend(id: number) {
  try {
    const data = await getProductRecommend({ productId: id, page: 1, pageSize: 6 })
    recommendProducts.value = data.list
  } catch {
    uni.showToast({ title: '推荐加载失败', icon: 'none' })
  }
}

function previewImage(index: number) {
  uni.previewImage({ urls: product.value.images, current: index })
}

function onSkuChange(skuId: number, quantity: number) {
  selectedSkuId.value = skuId
  selectedQuantity.value = quantity
  currentSku.value = product.value.skus.find(s => s.id === skuId) || null
}

function handleAddCart() {
  skuAction.value = 'cart'
  showSkuPopup.value = true
}

function handleBuyNow() {
  skuAction.value = 'buy'
  showSkuPopup.value = true
}

async function confirmSku() {
  if (!selectedSkuId.value) {
    uni.showToast({ title: '请选择规格', icon: 'none' })
    return
  }
  showSkuPopup.value = false

  if (skuAction.value === 'cart') {
    userStore.requireLogin(async () => {
      await cartStore.addToCart({
        productId: product.value.id,
        skuId: selectedSkuId.value,
        quantity: selectedQuantity.value
      })
      uni.showToast({ title: '已加入购物车', icon: 'success' })
    })
  } else {
    userStore.requireLogin(() => {
      uni.navigateTo({
        url: `/pages/order/confirm?productId=${product.value.id}&skuId=${selectedSkuId.value}&quantity=${selectedQuantity.value}`
      })
    })
  }
}

function goHome() {
  uni.switchTab({ url: '/pages/home/index' })
}

function goCart() {
  uni.switchTab({ url: '/pages/cart/index' })
}

function goCustomerService() {
  uni.navigateTo({ url: '/pages/customer-service/index' })
}

onShareAppMessage(() => ({
  title: product.value.name,
  path: `/pages/product/detail?id=${product.value.id}&inviter=${userStore.userInfo?.id || ''}`
}))

onLoad((options) => {
  if (options?.id) {
    const id = Number(options.id)
    loadProduct(id)
    loadRecommend(id)
  }
})
</script>

<style lang="scss" scoped>
.product-detail-page {
  padding-bottom: 120rpx;
}

.image-swiper {
  height: 750rpx;
}

.product-image {
  width: 100%;
  height: 100%;
}

.price-section {
  background: $bg-white;
  padding: $spacing-md;
}

.price-row {
  display: flex;
  align-items: baseline;
  gap: $spacing-sm;
}

.original-price {
  font-size: $font-sm;
  color: $text-hint;
  text-decoration: line-through;
}

.sales-text {
  font-size: $font-xs;
  color: $text-hint;
  margin-top: 8rpx;
  display: block;
}

.info-section {
  margin: $spacing-sm $spacing-md;
}

.product-name {
  font-size: $font-lg;
  font-weight: 600;
  color: $text-color;
  display: block;
  line-height: 1.5;
}

.product-subtitle {
  font-size: $font-sm;
  color: $text-secondary;
  margin-top: 8rpx;
  display: block;
}

.tag-row {
  display: flex;
  gap: 8rpx;
  margin-top: $spacing-sm;
}

.product-tag {
  @extend .tag;
  @extend .tag-primary;
}

.sku-section {
  display: flex;
  align-items: center;
  margin: $spacing-sm $spacing-md;
}

.section-label {
  font-size: $font-md;
  color: $text-color;
  margin-right: $spacing-sm;
}

.section-value {
  flex: 1;
  font-size: $font-sm;
  color: $text-hint;
}

.section-arrow {
  font-size: $font-lg;
  color: $text-hint;
}

.detail-section {
  margin: $spacing-sm $spacing-md;
}

.detail-title {
  font-size: $font-lg;
  font-weight: 600;
  display: block;
  margin-bottom: $spacing-md;
}

.detail-content {
  font-size: $font-md;
  line-height: 1.8;
}

.recommend-section {
  margin-top: $spacing-md;
  padding: 0 $spacing-md;
}

.product-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: $spacing-sm;
}

.bottom-bar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  display: flex;
  align-items: center;
  background: $bg-white;
  padding: $spacing-sm $spacing-md;
  box-shadow: 0 -2rpx 8rpx rgba(0, 0, 0, 0.05);
  @include safe-bottom;
}

.bar-icon {
  @include flex-center;
  @include flex-column;
  padding: 0 $spacing-md;
}

.icon-text {
  font-size: 40rpx;
}

.icon-label {
  font-size: $font-xs;
  color: $text-hint;
}

.add-cart-btn {
  flex: 1;
  background: $secondary-color;
  border-radius: $radius-round;
  padding: 20rpx 0;
  text-align: center;
  margin-left: $spacing-sm;
}

.buy-now-btn {
  flex: 1;
  background: linear-gradient(135deg, $primary-color, $primary-light);
  border-radius: $radius-round;
  padding: 20rpx 0;
  text-align: center;
  margin-left: $spacing-sm;
}

.btn-text {
  color: #FFFFFF;
  font-size: $font-md;
  font-weight: 500;
}

.sku-popup {
  background: $bg-white;
  border-radius: $radius-xl $radius-xl 0 0;
  padding: $spacing-lg;
  max-height: 80vh;
}

.sku-header {
  display: flex;
  align-items: center;
  margin-bottom: $spacing-md;
  padding-bottom: $spacing-md;
  border-bottom: 1rpx solid $divider-color;
}

.sku-image {
  width: 160rpx;
  height: 160rpx;
  border-radius: $radius-md;
  margin-right: $spacing-md;
}

.sku-price {
  flex: 1;
}

.sku-stock {
  font-size: $font-sm;
  color: $text-hint;
}

.sku-confirm-btn {
  margin-top: $spacing-lg;
  background: linear-gradient(135deg, $primary-color, $primary-light);
  border-radius: $radius-round;
  padding: 24rpx 0;
  text-align: center;
}

.confirm-text {
  color: #FFFFFF;
  font-size: $font-lg;
  font-weight: 500;
}
</style>
