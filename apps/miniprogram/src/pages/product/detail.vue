<template>
  <view class="product-detail-page page-shell">
    <view class="hero-stage">
      <swiper class="image-swiper" indicator-dots circular :interval="4000" @change="onImageChange">
        <swiper-item v-if="product.videoUrl">
          <video class="product-video" :src="product.videoUrl" controls :show-center-play-btn="true" :show-play-btn="true" object-fit="contain" />
        </swiper-item>
        <swiper-item v-for="(img, index) in product.images" :key="index">
          <image class="product-image" :src="img" mode="aspectFit" @tap="previewImage(index)" />
        </swiper-item>
      </swiper>
      <view v-if="product.images.length || product.videoUrl" class="image-counter">
        <text class="counter-text">{{ currentImageIndex + 1 }}/{{ (product.videoUrl ? 1 : 0) + product.images.length }}</text>
      </view>
    </view>

    <view class="price-section surface-card">
      <view class="price-card-head">
        <view class="self-badge">
          <text class="badge-dot"></text>
          <text class="badge-text">禧孕自营精选</text>
        </view>
        <text class="stock-chip">库存 {{ product.stock }}</text>
      </view>
      <view class="price-row">
        <PriceDisplay :price="product.price" size="large" />
        <text v-if="product.originalPrice > product.price" class="original-price">
          ¥{{ formatPrice(product.originalPrice) }}
        </text>
      </view>
      <text class="product-name">{{ product.name }}</text>
      <text v-if="product.subtitle" class="product-subtitle">{{ product.subtitle }}</text>
      <view class="product-meta-row">
        <text class="sales-text">已售 {{ product.sales }} 件</text>
        <text class="meta-separator"></text>
        <text class="meta-text">正品保障</text>
        <text class="meta-separator"></text>
        <text class="meta-text">安心售后</text>
      </view>
      <text v-if="product.status !== undefined && product.status !== 1" class="sale-warning">该商品已下架，暂不可购买</text>
      <text v-else-if="product.stock <= 0" class="sale-warning">该商品库存不足，暂不可购买</text>
      <view v-if="product.tags?.length" class="tag-row">
        <text v-for="tag in product.tags" :key="tag" class="product-tag">{{ tag }}</text>
      </view>
    </view>

    <view class="service-section card">
      <view class="service-item">
        <text class="service-mark">正</text>
        <text class="service-text">自营正品</text>
      </view>
      <view class="service-item">
        <text class="service-mark warm">严</text>
        <text class="service-text">严选品质</text>
      </view>
      <view class="service-item">
        <text class="service-mark mint">售</text>
        <text class="service-text">售后无忧</text>
      </view>
      <view class="service-item">
        <text class="service-mark sage">规</text>
        <text class="service-text">合规资料</text>
      </view>
    </view>

    <view class="sku-section card" @tap="openSkuPopup('select')">
      <view class="sku-copy">
        <text class="section-label">规格</text>
        <text class="section-hint">选择规格与购买数量</text>
      </view>
      <view class="section-value-pill">
        <text class="section-value">{{ currentSku?.specText || '请选择规格' }}</text>
      </view>
      <text class="section-arrow">›</text>
    </view>

    <view class="detail-section card">
      <view class="block-title-row">
        <view>
          <text class="detail-title">商品详情</text>
          <text class="detail-subtitle">细节信息以页面展示为准</text>
        </view>
      </view>
      <rich-text class="detail-content" :nodes="product.description" />
    </view>

    <view v-if="product.compliance && (product.compliance.isFood || product.compliance.isHealthSupplement || product.compliance.isInfantFormula)" class="compliance-section card">
      <view class="compliance-title-row">
        <view>
          <text class="detail-title">商品合规信息</text>
          <text class="detail-subtitle">食品/保健/奶粉类商品资料公示</text>
        </view>
        <text class="compliance-note">可信资料</text>
      </view>
      <view v-if="product.compliance.isHealthSupplement" class="health-warning">
        <text class="warning-text">保健食品不是药物，不能代替药物治疗疾病</text>
      </view>
      <view v-if="product.compliance.manufacturer" class="compliance-row">
        <text class="compliance-label">生产厂家</text>
        <text class="compliance-value">{{ product.compliance.manufacturer }}</text>
      </view>
      <view v-if="product.compliance.supplierName" class="compliance-row">
        <text class="compliance-label">供应商</text>
        <text class="compliance-value">{{ product.compliance.supplierName }}</text>
      </view>
      <view v-if="product.compliance.productionLicenseNo" class="compliance-row">
        <text class="compliance-label">生产许可证编号</text>
        <text class="compliance-value">{{ product.compliance.productionLicenseNo }}</text>
      </view>
      <view v-if="product.compliance.foodBusinessCertNo" class="compliance-row">
        <text class="compliance-label">食品经营/备案凭证编号</text>
        <text class="compliance-value">{{ product.compliance.foodBusinessCertNo }}</text>
      </view>
      <view v-if="product.compliance.healthSupplementApprovalNo" class="compliance-row">
        <text class="compliance-label">保健食品批准文号/备案号</text>
        <text class="compliance-value">{{ product.compliance.healthSupplementApprovalNo }}</text>
      </view>
      <view v-if="product.compliance.infantFormulaRegNo" class="compliance-row">
        <text class="compliance-label">奶粉产品配方注册号</text>
        <text class="compliance-value">{{ product.compliance.infantFormulaRegNo }}</text>
      </view>
      <view v-if="product.compliance.shelfLife" class="compliance-row">
        <text class="compliance-label">保质期</text>
        <text class="compliance-value">{{ product.compliance.shelfLife }}</text>
      </view>
      <view v-if="product.compliance.storageCondition" class="compliance-row">
        <text class="compliance-label">贮存条件</text>
        <text class="compliance-value">{{ product.compliance.storageCondition }}</text>
      </view>
      <view v-if="product.compliance.suitableFor" class="compliance-row">
        <text class="compliance-label">适用人群</text>
        <text class="compliance-value">{{ product.compliance.suitableFor }}</text>
      </view>
      <view v-if="product.compliance.notSuitableFor" class="compliance-row">
        <text class="compliance-label">不适宜人群</text>
        <text class="compliance-value">{{ product.compliance.notSuitableFor }}</text>
      </view>
      <view v-if="product.compliance.precautions" class="compliance-row">
        <text class="compliance-label">注意事项</text>
        <text class="compliance-value">{{ product.compliance.precautions }}</text>
      </view>
      <view v-if="product.compliance.certImages && product.compliance.certImages.length" class="cert-images">
        <text class="compliance-label">资质图片</text>
        <view class="cert-image-list">
          <image v-for="(img, idx) in product.compliance.certImages" :key="idx" class="cert-image" :src="img" mode="widthFix" @tap="previewCertImage(idx)" />
        </view>
      </view>
    </view>

    <view class="recommend-section" v-if="recommendProducts.length">
      <view class="recommend-title-row">
        <view>
          <text class="section-title">为你推荐</text>
          <text class="recommend-subtitle">同类家庭也在关注</text>
        </view>
      </view>
      <view class="product-grid">
        <ProductCard v-for="item in recommendProducts" :key="item.id" :product="item" />
      </view>
    </view>

    <view class="bottom-bar">
      <view class="bar-icon" @tap="goCustomerService">
        <text class="icon-text">讯</text>
        <text class="icon-label">客服</text>
      </view>
      <view class="bar-icon" @tap="goHome">
        <text class="icon-text">⌂</text>
        <text class="icon-label">首页</text>
      </view>
      <view class="bar-icon" @tap="goCart">
        <text class="icon-text">袋</text>
        <text class="icon-label">购物车</text>
      </view>
      <view class="add-cart-btn" :class="{ disabled: !canPurchase }" @tap="handleAddCart">
        <text class="btn-text">加入购物车</text>
      </view>
      <view class="buy-now-btn" :class="{ disabled: !canPurchase }" @tap="handleBuyNow">
        <text class="btn-text">立即购买</text>
      </view>
    </view>

    <BottomSheet v-model:show="showSkuPopup">
      <view class="sku-popup">
        <view class="popup-handle"></view>
        <view class="popup-title-row">
          <text class="popup-title">选择规格</text>
          <text class="popup-subtitle">确认后继续{{ skuAction === 'buy' ? '购买' : skuAction === 'cart' ? '加入购物车' : '查看规格' }}</text>
        </view>
        <view class="sku-header">
          <image class="sku-image" :src="currentSku?.image || primaryImage" mode="aspectFit" />
          <view class="sku-summary">
            <view class="sku-price">
              <PriceDisplay :price="currentSku?.price || product.price" />
            </view>
            <text class="sku-selected">{{ currentSku?.specText || '请选择规格' }}</text>
            <text class="sku-stock">库存：{{ currentSku?.stock || product.stock }}</text>
          </view>
        </view>
        <SkuSelector :specs="product.specs" :skus="product.skus" @change="onSkuChange" />
        <view class="sku-confirm-btn" @tap="confirmSku">
          <text class="confirm-text">确定</text>
        </view>
      </view>
    </BottomSheet>
  </view>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { onLoad, onShareAppMessage } from '@dcloudio/uni-app'
import { getProductDetail, getProductRecommend, type ProductDetail, type SkuItem } from '@/api/product'
import { useCartStore } from '@/stores/cart'
import { useUserStore } from '@/stores/user'
import { formatPrice } from '@/utils/format'
import PriceDisplay from '@/components/PriceDisplay.vue'
import ProductCard from '@/components/ProductCard.vue'
import SkuSelector from '@/components/SkuSelector.vue'
import BottomSheet from '@/components/BottomSheet.vue'
import { ensureSellableSkuSelection } from './sku-popup.logic'

type SkuAction = 'select' | 'cart' | 'buy'

const product = ref<ProductDetail>({
  id: 0, name: '', subtitle: '', images: [], price: 0, originalPrice: 0,
  sales: 0, stock: 0, description: '', skus: [], specs: [], tags: []
})
const recommendProducts = ref<any[]>([])
const showSkuPopup = ref(false)
const currentSku = ref<SkuItem | null>(null)
const selectedSkuId = ref(0)
const selectedQuantity = ref(1)
const skuAction = ref<SkuAction>('select')
const currentImageIndex = ref(0)

const cartStore = useCartStore()
const userStore = useUserStore()

const canPurchase = computed(() => {
  const inSale = product.value.status === undefined || product.value.status === 1
  return inSale && product.value.stock > 0
})
const primaryImage = computed(() => product.value.images?.[0] || '')

async function loadProduct(id: number) {
  try {
    const data = await getProductDetail(id)
    product.value = {
      ...data,
      images: Array.isArray(data.images) ? data.images : [],
    }
    const defaultSku = product.value.skus.find((sku) => sku.stock > 0) || product.value.skus[0] || null
    if (defaultSku) {
      currentSku.value = defaultSku
      selectedSkuId.value = defaultSku.id
      selectedQuantity.value = 1
    }
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

function onImageChange(e: any) {
  currentImageIndex.value = e.detail.current || 0
}

function previewCertImage(index: number) {
  uni.previewImage({ urls: product.value.compliance?.certImages || [], current: index })
}

function onSkuChange(skuId: number, quantity: number) {
  selectedSkuId.value = skuId
  selectedQuantity.value = quantity
  currentSku.value = product.value.skus.find(s => s.id === skuId) || null
}

function getDefaultSellableSku() {
  return product.value.skus.find((sku) => sku.stock > 0) || product.value.skus[0] || null
}

function openSkuPopup(action: SkuAction) {
  if (!canPurchase.value) {
    uni.showToast({ title: product.value.status !== undefined && product.value.status !== 1 ? '商品已下架' : '库存不足', icon: 'none' })
    return
  }
  skuAction.value = action
  const result = ensureSellableSkuSelection(product.value.skus, selectedSkuId.value)
  if (!result.sku) {
    uni.showToast({ title: '商品暂无可售规格', icon: 'none' })
    return
  }
  onSkuChange(result.sku.id, 1)
  showSkuPopup.value = true
}

function handleAddCart() {
  openSkuPopup('cart')
}

function handleBuyNow() {
  openSkuPopup('buy')
}

async function confirmSku() {
  if (!selectedSkuId.value || !currentSku.value) {
    const defaultSku = getDefaultSellableSku()
    if (!defaultSku) {
      uni.showToast({ title: '商品暂无可售规格', icon: 'none' })
      return
    }
    onSkuChange(defaultSku.id, 1)
  }
  if (!currentSku.value || currentSku.value.stock < selectedQuantity.value) {
    uni.showToast({ title: (currentSku.value?.stock ?? 0) <= 0 ? '商品暂无可售规格' : '库存不足，请重新选择', icon: 'none' })
    return
  }
  showSkuPopup.value = false

  if (skuAction.value === 'select') {
    return
  }

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
  padding-bottom: calc(190rpx + constant(safe-area-inset-bottom));
  padding-bottom: calc(190rpx + env(safe-area-inset-bottom));
}

.hero-stage {
  position: relative;
  background:
    radial-gradient(circle at 80% 10%, rgba($success-color, 0.16) 0%, rgba($success-color, 0) 260rpx),
    radial-gradient(circle at 14% 18%, rgba($primary-color, 0.12) 0%, rgba($primary-color, 0) 260rpx),
    linear-gradient(180deg, $bg-ivory 0%, $bg-soft 100%);
  padding: 18rpx $spacing-md 60rpx;
}

.image-swiper {
  height: 724rpx;
  overflow: hidden;
  border-radius: 0 0 $radius-xxl $radius-xxl;
  background: linear-gradient(180deg, #FFFFFF 0%, $bg-soft 100%);
  box-shadow: $shadow-sm;
}

.product-image {
  width: 100%;
  height: 100%;
}

.product-video {
  width: 100%;
  height: 100%;
}

.image-counter {
  position: absolute;
  right: 38rpx;
  bottom: 84rpx;
  min-width: 72rpx;
  height: 40rpx;
  padding: 0 14rpx;
  border-radius: $radius-round;
  background: rgba(58, 48, 44, 0.44);
  @include flex-center;
}

.counter-text {
  font-size: $font-xs;
  color: #FFFFFF;
  font-weight: 700;
}

.price-section {
  margin: -88rpx $spacing-md $spacing-sm;
  position: relative;
  z-index: 2;
  border-radius: $radius-xxl;
  padding: 34rpx $spacing-lg $spacing-lg;
  border-color: rgba(255, 255, 255, 0.82);
  box-shadow: $shadow-lg;
}

.price-card-head {
  @include flex-between;
  align-items: center;
  margin-bottom: $spacing-sm;
}

.self-badge {
  display: inline-flex;
  align-items: center;
  min-height: 42rpx;
  padding: 0 16rpx;
  border-radius: $radius-round;
  background: rgba($success-color, 0.12);
  border: 1rpx solid rgba($success-color, 0.16);
}

.badge-dot {
  width: 10rpx;
  height: 10rpx;
  border-radius: 50%;
  margin-right: 8rpx;
  background: $success-color;
}

.badge-text {
  font-size: $font-xs;
  color: $success-dark;
  font-weight: 800;
}

.stock-chip {
  font-size: $font-xs;
  color: $text-hint;
  padding: 8rpx 16rpx;
  border-radius: $radius-round;
  background: $bg-soft;
}

.price-row {
  display: flex;
  align-items: baseline;
  gap: $spacing-sm;
  margin-bottom: $spacing-sm;
}

.original-price {
  font-size: $font-sm;
  color: $text-hint;
  text-decoration: line-through;
}

.sales-text {
  font-size: $font-xs;
  color: $text-secondary;
}

.product-meta-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 10rpx;
  margin-top: $spacing-sm;
}

.meta-text {
  font-size: $font-xs;
  color: $text-hint;
}

.meta-separator {
  width: 6rpx;
  height: 6rpx;
  border-radius: 50%;
  background: rgba($text-hint, 0.42);
}

.info-section {
  margin: $spacing-sm $spacing-md;
}

.product-name {
  font-size: 40rpx;
  font-weight: 800;
  color: $text-color;
  display: block;
  line-height: 1.42;
}

.product-subtitle {
  font-size: $font-sm;
  color: $text-secondary;
  margin-top: 8rpx;
  display: block;
}

.sale-warning {
  font-size: $font-sm;
  color: $danger-color;
  margin-top: 8rpx;
  display: block;
}

.tag-row {
  display: flex;
  flex-wrap: wrap;
  gap: 10rpx;
  margin-top: $spacing-sm;
}

.product-tag {
  @include tag-base;
  background: rgba($primary-color, 0.1);
  color: $primary-dark;
}

.service-section {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: $spacing-xs;
  margin: $spacing-sm $spacing-md;
  padding: 14rpx;
  background: rgba(255, 255, 255, 0.86);
  border-color: rgba(255, 255, 255, 0.8);
}

.service-item {
  @include flex-center;
  @include flex-column;
  min-height: 120rpx;
  border-radius: 26rpx;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.88) 0%, rgba($bg-soft, 0.88) 100%);
  border: 1rpx solid rgba($border-color, 0.68);
}

.service-mark {
  @include flex-center;
  width: 44rpx;
  height: 44rpx;
  border-radius: 50%;
  background: $primary-soft;
  color: $primary-dark;
  font-size: $font-xs;
  font-weight: 800;
  margin-bottom: 8rpx;

  &.mint {
    background: $success-soft;
    color: $success-color;
  }

  &.warm {
    background: $secondary-soft;
    color: $secondary-color;
  }

  &.sage {
    background: $success-soft;
    color: $success-dark;
  }
}

.service-text {
  font-size: $font-xs;
  color: $text-secondary;
  line-height: 1.2;
}

.sku-section {
  display: flex;
  align-items: center;
  margin: $spacing-sm $spacing-md;
  min-height: 116rpx;
  background: rgba(255, 255, 255, 0.9);
  border-color: rgba(255, 255, 255, 0.78);
}

.sku-copy {
  flex-shrink: 0;
  margin-right: $spacing-sm;
}

.section-label {
  display: block;
  font-size: $font-md;
  color: $text-color;
  font-weight: 800;
}

.section-hint {
  display: block;
  margin-top: 6rpx;
  font-size: $font-xs;
  color: $text-hint;
}

.section-value-pill {
  flex: 1;
  min-width: 0;
  display: flex;
  justify-content: flex-end;
}

.section-value {
  max-width: 360rpx;
  padding: 10rpx 18rpx;
  border-radius: $radius-round;
  background: $bg-soft;
  font-size: $font-sm;
  color: $text-secondary;
  @include text-ellipsis;
}

.section-arrow {
  margin-left: 10rpx;
  font-size: $font-xl;
  color: $primary-dark;
}

.detail-section {
  margin: $spacing-sm $spacing-md;
  background: rgba(255, 255, 255, 0.9);
}

.block-title-row {
  @include flex-between;
  align-items: flex-start;
  margin-bottom: $spacing-md;
}

.detail-title {
  font-size: $font-lg;
  font-weight: 800;
  display: block;
  margin-bottom: 6rpx;
}

.detail-subtitle {
  display: block;
  font-size: $font-xs;
  color: $text-hint;
}

.detail-content {
  font-size: $font-md;
  line-height: 1.8;
}

.recommend-section {
  margin-top: $spacing-lg;
  padding: 0 $spacing-md;
}

.recommend-title-row {
  margin-bottom: $spacing-md;
}

.recommend-subtitle {
  display: block;
  margin-top: 8rpx;
  font-size: $font-xs;
  color: $text-hint;
}

.product-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 22rpx;
}

.bottom-bar {
  @include bottom-action-bar;
  display: flex;
  align-items: center;
  min-height: 138rpx;
  background: rgba(255, 252, 247, 0.98);
}

.bar-icon {
  @include flex-center;
  @include flex-column;
  width: 78rpx;
  height: 82rpx;
  border-radius: 28rpx;
  background: #FFFFFF;
  border: 1rpx solid rgba($border-color, 0.8);
  padding: 0;
  box-shadow: $shadow-xs;
}

.icon-text {
  font-size: 28rpx;
  color: $text-secondary;
  font-weight: 700;
}

.icon-label {
  font-size: $font-xs;
  color: $text-hint;
}

.add-cart-btn {
  flex: 1;
  min-width: 0;
  background: linear-gradient(135deg, $secondary-soft 0%, #FFDCC4 100%);
  border-radius: $radius-round;
  min-height: 84rpx;
  padding: 0;
  text-align: center;
  margin-left: $spacing-sm;
  border: 1rpx solid rgba($secondary-color, 0.2);
  box-shadow: $shadow-peach;

  &.disabled {
    opacity: 0.55;
  }
}

.buy-now-btn {
  flex: 1;
  min-width: 0;
  background: $gradient-coral;
  border-radius: $radius-round;
  min-height: 84rpx;
  padding: 0;
  text-align: center;
  margin-left: $spacing-sm;
  box-shadow: $shadow-coral;

  &.disabled {
    opacity: 0.55;
  }
}

.btn-text {
  color: #FFFFFF;
  font-size: $font-md;
  font-weight: 700;
}

.add-cart-btn .btn-text {
  color: $primary-dark;
}

.sku-popup {
  background:
    linear-gradient(180deg, #FFFFFF 0%, $bg-page 100%);
  border-radius: $radius-xxl $radius-xxl 0 0;
  padding: $spacing-sm $spacing-lg $spacing-lg;
  max-height: 80vh;
}

.popup-handle {
  width: 72rpx;
  height: 8rpx;
  border-radius: $radius-round;
  background: rgba($border-color, 0.92);
  margin: 4rpx auto $spacing-md;
}

.popup-title-row {
  margin-bottom: $spacing-md;
}

.popup-title {
  display: block;
  font-size: $font-lg;
  color: $text-color;
  font-weight: 900;
}

.popup-subtitle {
  display: block;
  margin-top: 6rpx;
  font-size: $font-xs;
  color: $text-hint;
}

.sku-header {
  display: flex;
  align-items: center;
  margin-bottom: $spacing-md;
  background: $gradient-peach;
  border-radius: $radius-xxl;
  padding: $spacing-md;
  border: 1rpx solid rgba(255, 255, 255, 0.8);
}

.sku-image {
  width: 168rpx;
  height: 168rpx;
  border-radius: 30rpx;
  margin-right: $spacing-md;
  background: $bg-gray;
  box-shadow: $shadow-xs;
}

.sku-summary {
  flex: 1;
  min-width: 0;
}

.sku-price {
  margin-bottom: 10rpx;
}

.sku-selected {
  display: block;
  max-width: 100%;
  font-size: $font-sm;
  color: $text-secondary;
  line-height: 1.4;
  @include text-ellipsis;
}

.sku-stock {
  display: inline-flex;
  margin-top: 10rpx;
  padding: 6rpx 14rpx;
  border-radius: $radius-round;
  background: rgba(255, 255, 255, 0.76);
  font-size: $font-sm;
  color: $success-dark;
}

.sku-confirm-btn {
  margin-top: $spacing-lg;
  background: $gradient-coral;
  border-radius: $radius-round;
  padding: 24rpx 0;
  text-align: center;
  box-shadow: $shadow-coral;
}

.confirm-text {
  color: #FFFFFF;
  font-size: $font-lg;
  font-weight: 800;
}

.compliance-section {
  margin: $spacing-sm $spacing-md;
  background: rgba(255, 255, 255, 0.92);
}

.compliance-title-row {
  @include flex-between;
  align-items: flex-start;
  margin-bottom: $spacing-sm;

  .detail-title {
    margin-bottom: 0;
  }
}

.compliance-note {
  font-size: $font-xs;
  color: $success-dark;
  margin-left: $spacing-sm;
  padding: 8rpx 14rpx;
  border-radius: $radius-round;
  background: rgba($success-color, 0.12);
}

.health-warning {
  background: rgba($warning-color, 0.1);
  border: 1rpx solid rgba($warning-color, 0.24);
  border-radius: $radius-lg;
  padding: $spacing-sm $spacing-md;
  margin-bottom: $spacing-md;
}

.warning-text {
  font-size: $font-sm;
  color: $warning-color;
  font-weight: 500;
}

.compliance-row {
  display: flex;
  padding: 18rpx 0;
  border-bottom: 1rpx solid $divider-color;
}

.compliance-label {
  font-size: $font-sm;
  color: $text-secondary;
  width: 220rpx;
  flex-shrink: 0;
}

.compliance-value {
  font-size: $font-sm;
  color: $text-color;
  flex: 1;
  line-height: 1.55;
}

.cert-images {
  margin-top: $spacing-sm;
}

.cert-image-list {
  display: flex;
  flex-wrap: wrap;
  gap: $spacing-sm;
  margin-top: $spacing-xs;
}

.cert-image {
  width: 200rpx;
  border-radius: $radius-md;
}
</style>
