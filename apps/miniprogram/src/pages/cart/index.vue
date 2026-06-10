<template>
  <view class="cart-page page-shell">
    <view v-if="cartStore.items.length" class="cart-content">
      <view class="cart-hero">
        <view class="hero-copy">
          <text class="hero-eyebrow">禧孕优选自营</text>
          <text class="hero-title">安心购物车</text>
          <text class="hero-subtitle">科学育儿 · 品质之选</text>
        </view>
        <view class="hero-seal">
          <text class="hero-seal-main">售后</text>
          <text class="hero-seal-sub">无忧</text>
        </view>
      </view>

      <view class="care-tip">
        <view class="care-tip-main">
          <text class="care-tip-mark">安</text>
          <text class="care-tip-title">自营订单享安心售后</text>
        </view>
        <text class="care-tip-text">商品满减和优惠以确认订单为准</text>
      </view>

      <view class="cart-summary card">
        <view>
          <text class="summary-title">购物车</text>
          <text class="summary-subtitle">已选 {{ cartStore.checkedCount }} 件 / 共 {{ cartStore.items.length }} 件</text>
        </view>
        <view class="summary-hint">
          <text class="summary-dot"></text>
          <text>正品保障</text>
        </view>
      </view>

      <view v-for="(item, index) in cartStore.items" :key="item.id" class="cart-item">
        <view class="item-check" @tap="cartStore.toggleCheck(index)">
          <view class="check-box" :class="{ checked: item.checked }">
            <text v-if="item.checked" class="check-icon">✓</text>
          </view>
        </view>
        <view class="item-image-wrap" @tap="goDetail(item.productId)">
          <image class="item-image" :src="item.productImage" mode="aspectFill" />
          <text class="item-image-tag">自营</text>
        </view>
        <view class="item-info">
          <text class="item-name">{{ item.productName }}</text>
          <view class="item-meta-row">
            <text class="item-sku">{{ item.skuName }}</text>
            <text v-if="item.stock !== undefined" class="item-stock">库存 {{ item.stock }}</text>
          </view>
          <view class="item-service-row">
            <text class="item-service">正品保障</text>
            <text class="item-service">安心售后</text>
          </view>
          <view class="item-bottom">
            <view class="item-price-block">
              <PriceDisplay :price="item.price" />
              <text class="item-price-note">单件价</text>
            </view>
            <view class="quantity-control">
              <view class="qty-btn" @tap="handleQuantity(index, -1)">-</view>
              <text class="qty-value">{{ item.quantity }}</text>
              <view class="qty-btn" @tap="handleQuantity(index, 1)">+</view>
            </view>
          </view>
        </view>
      </view>
    </view>

    <view v-else class="cart-empty">
      <view class="empty-visual">
        <text class="empty-visual-text">禧</text>
      </view>
      <text class="empty-title">购物车还没有母婴好物</text>
      <text class="empty-subtitle">去首页挑选自营正品，给宝宝和妈妈多一份安心</text>
      <view class="empty-action" @tap="goHome">
        <text class="empty-action-text">去逛逛</text>
      </view>
    </view>

    <view v-if="cartStore.items.length" class="cart-footer bottom-action-bar">
      <view class="footer-left" @tap="cartStore.toggleCheckAll">
        <view class="check-box" :class="{ checked: cartStore.allChecked }">
          <text v-if="cartStore.allChecked" class="check-icon">✓</text>
        </view>
        <text class="all-check-text">全选</text>
      </view>
      <view class="footer-right">
        <view class="total-price">
          <view class="total-main">
            <text class="total-label">合计</text>
            <PriceDisplay :price="cartStore.totalPrice" size="large" />
          </view>
          <text class="total-note">优惠以确认订单为准</text>
        </view>
        <view class="checkout-btn" :class="{ disabled: cartStore.checkedCount === 0 }" @tap="goCheckout">
          <text class="checkout-text">去结算({{ cartStore.checkedCount }})</text>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { onShow } from '@dcloudio/uni-app'
import { useCartStore } from '@/stores/cart'
import { useUserStore } from '@/stores/user'
import PriceDisplay from '@/components/PriceDisplay.vue'

const cartStore = useCartStore()
const userStore = useUserStore()

function goDetail(productId: string | number) {
  uni.navigateTo({ url: `/pages/product/detail?id=${productId}` })
}

function goHome() {
  uni.switchTab({ url: '/pages/home/index' })
}

async function handleQuantity(index: number, delta: number) {
  const item = cartStore.items[index]
  const newQty = item.quantity + delta
  if (newQty < 1) {
    uni.showModal({
      title: '提示',
      content: '确定删除该商品吗？',
      success: async (res) => {
        if (res.confirm) {
          try {
            await cartStore.removeItem(item.id)
          } catch {
            uni.showToast({ title: '删除失败', icon: 'none' })
          }
        }
      }
    })
    return
  }
  if (newQty > item.stock) {
    uni.showToast({ title: '库存不足', icon: 'none' })
    return
  }
  await cartStore.updateQuantity(item.id, newQty)
}

function goCheckout() {
  if (cartStore.checkedCount === 0) {
    uni.showToast({ title: '请选择商品', icon: 'none' })
    return
  }
  userStore.requireLogin(() => {
    const items = cartStore.checkedItems.map(item => ({
      productId: item.productId,
      skuId: item.skuId,
      quantity: item.quantity,
      productName: item.productName,
      productImage: item.productImage,
      skuName: item.skuName,
      price: item.price
    }))
    uni.navigateTo({ url: `/pages/order/confirm?items=${encodeURIComponent(JSON.stringify(items))}` })
  })
}

onShow(() => {
  if (userStore.isLoggedIn) {
    cartStore.fetchCart()
  }
})
</script>

<style lang="scss" scoped>
.cart-page {
  min-height: 100vh;
  padding-bottom: calc(178rpx + constant(safe-area-inset-bottom));
  padding-bottom: calc(178rpx + env(safe-area-inset-bottom));
}

.cart-content {
  padding-top: 22rpx;
}

.cart-hero {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin: 0 $spacing-md $spacing-sm;
  padding: 30rpx $spacing-md;
  border-radius: $radius-xxl;
  background:
    radial-gradient(circle at 88% 10%, rgba($success-color, 0.18) 0%, rgba($success-color, 0) 220rpx),
    linear-gradient(135deg, rgba(255, 255, 255, 0.96) 0%, rgba(255, 245, 238, 0.94) 100%);
  border: 1rpx solid rgba(255, 255, 255, 0.84);
  box-shadow: $shadow-md;
}

.hero-copy {
  min-width: 0;
}

.hero-eyebrow {
  display: inline-flex;
  align-items: center;
  min-height: 38rpx;
  padding: 0 18rpx;
  border-radius: $radius-round;
  background: $success-soft;
  color: $success-dark;
  font-size: $font-xs;
  font-weight: 700;
}

.hero-title {
  display: block;
  margin-top: 12rpx;
  font-size: 42rpx;
  line-height: 1.18;
  font-weight: 900;
  color: $text-color;
}

.hero-subtitle {
  display: block;
  margin-top: 8rpx;
  font-size: $font-sm;
  color: $text-secondary;
}

.hero-seal {
  @include flex-center;
  flex-direction: column;
  width: 112rpx;
  height: 112rpx;
  margin-left: $spacing-sm;
  border-radius: 50%;
  background: $gradient-coral;
  box-shadow: $shadow-coral;
  flex-shrink: 0;
}

.hero-seal-main,
.hero-seal-sub {
  color: #FFFFFF;
  font-weight: 800;
  line-height: 1.15;
}

.hero-seal-main {
  font-size: $font-md;
}

.hero-seal-sub {
  font-size: $font-xs;
}

.care-tip {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: $spacing-sm;
  min-height: 76rpx;
  margin: 0 $spacing-md $spacing-sm;
  padding: 12rpx $spacing-md;
  border-radius: $radius-round;
  background: linear-gradient(135deg, rgba($success-color, 0.13), rgba($secondary-color, 0.1));
  border: 1rpx solid rgba($success-color, 0.18);
}

.care-tip-main {
  display: flex;
  align-items: center;
  min-width: 0;
}

.care-tip-mark {
  @include flex-center;
  width: 38rpx;
  height: 38rpx;
  margin-right: 10rpx;
  border-radius: 50%;
  background: $success-soft;
  color: $success-dark;
  font-size: $font-xs;
  font-weight: 800;
}

.care-tip-title {
  font-size: $font-sm;
  color: $success-dark;
  font-weight: 700;
  @include text-ellipsis;
}

.care-tip-text {
  font-size: $font-xs;
  color: $text-secondary;
  text-align: right;
  flex-shrink: 0;
  max-width: 330rpx;
  @include text-ellipsis;
}

.cart-summary {
  @include flex-between;
  align-items: flex-start;
  margin: $spacing-sm $spacing-md $spacing-md;
  background:
    radial-gradient(circle at 88% 0%, rgba($primary-color, 0.12) 0%, rgba($primary-color, 0) 220rpx),
    $gradient-card;
  border-color: rgba(255, 255, 255, 0.78);
}

.summary-title {
  display: block;
  font-size: $font-xl;
  font-weight: 800;
  color: $text-color;
}

.summary-subtitle {
  display: block;
  margin-top: 6rpx;
  font-size: $font-xs;
  color: $text-hint;
}

.summary-hint {
  display: inline-flex;
  align-items: center;
  min-height: 44rpx;
  padding: 0 18rpx;
  border-radius: $radius-round;
  background: $primary-soft;
  color: $primary-dark;
  font-size: $font-xs;
  font-weight: 700;
  flex-shrink: 0;
}

.summary-dot {
  width: 10rpx;
  height: 10rpx;
  margin-right: 8rpx;
  border-radius: 50%;
  background: $primary-color;
}

.cart-item {
  display: flex;
  align-items: flex-start;
  padding: 22rpx;
  background: $gradient-card;
  margin: $spacing-sm $spacing-md 20rpx;
  border-radius: $radius-xxl;
  border: 1rpx solid rgba($border-color, 0.78);
  box-shadow: $shadow-md;
}

.item-check {
  padding: 72rpx 6rpx 0 0;
  margin-right: 10rpx;
}

.check-box {
  width: 42rpx;
  height: 42rpx;
  border-radius: 50%;
  border: 2rpx solid rgba($border-color, 0.95);
  background: rgba(255, 255, 255, 0.9);
  @include flex-center;
  box-shadow: inset 0 0 0 4rpx rgba(255, 255, 255, 0.7);

  &.checked {
    background: $gradient-coral;
    border-color: $primary-color;
    box-shadow: $shadow-coral;
  }
}

.check-icon {
  color: #FFFFFF;
  font-size: $font-sm;
}

.item-image-wrap {
  position: relative;
  width: 184rpx;
  height: 184rpx;
  border-radius: 32rpx;
  flex-shrink: 0;
  overflow: hidden;
  background:
    radial-gradient(circle at 50% 0%, rgba($primary-color, 0.08), rgba($primary-color, 0) 120rpx),
    $bg-ivory;
  border: 1rpx solid rgba($border-color, 0.62);
}

.item-image {
  width: 100%;
  height: 100%;
  border-radius: 32rpx;
  background: $bg-ivory;
}

.item-image-tag {
  position: absolute;
  left: 10rpx;
  top: 10rpx;
  min-height: 34rpx;
  padding: 0 12rpx;
  border-radius: $radius-round;
  background: rgba(255, 255, 255, 0.88);
  color: $success-dark;
  font-size: 18rpx;
  font-weight: 800;
  line-height: 34rpx;
}

.item-info {
  flex: 1;
  margin-left: $spacing-sm;
  overflow: hidden;
}

.item-name {
  font-size: $font-md;
  color: $text-color;
  font-weight: 600;
  @include text-ellipsis-2;
  display: block;
  line-height: 1.42;
}

.item-meta-row {
  display: flex;
  align-items: center;
  gap: 10rpx;
  margin-top: 12rpx;
  min-width: 0;
}

.item-sku {
  font-size: $font-xs;
  color: $text-secondary;
  display: inline-flex;
  min-width: 0;
  max-width: 100%;
  padding: 6rpx 14rpx;
  border-radius: $radius-round;
  background: $primary-soft;
  border: 1rpx solid rgba($primary-color, 0.12);
  @include text-ellipsis;
}

.item-stock {
  flex-shrink: 0;
  font-size: $font-xs;
  color: $text-hint;
}

.item-service-row {
  display: flex;
  align-items: center;
  gap: 8rpx;
  margin-top: 10rpx;
}

.item-service {
  min-height: 34rpx;
  padding: 0 12rpx;
  border-radius: $radius-round;
  background: $success-soft;
  color: $success-dark;
  font-size: 18rpx;
  line-height: 34rpx;
}

.item-bottom {
  @include flex-between;
  align-items: flex-end;
  margin-top: 18rpx;
  gap: $spacing-sm;
}

.item-price-block {
  min-width: 0;
}

.item-price-note {
  display: block;
  margin-top: 4rpx;
  color: $text-hint;
  font-size: 18rpx;
}

.quantity-control {
  display: flex;
  align-items: center;
  background: rgba(255, 247, 242, 0.94);
  border-radius: $radius-round;
  padding: 6rpx;
  border: 1rpx solid rgba($border-color, 0.82);
  flex-shrink: 0;
  box-shadow: inset 0 0 0 1rpx rgba(255, 255, 255, 0.62);
}

.qty-btn {
  @include flex-center;
  width: 50rpx;
  height: 50rpx;
  background: $bg-white;
  border-radius: $radius-round;
  font-size: $font-md;
  color: $primary-dark;
  font-weight: 700;
  box-shadow: $shadow-xs;
}

.qty-value {
  width: 62rpx;
  text-align: center;
  font-size: $font-md;
  color: $text-color;
  font-weight: 700;
}

.cart-empty {
  @include flex-center;
  flex-direction: column;
  min-height: 72vh;
  padding: 72rpx $spacing-lg 180rpx;
  text-align: center;
}

.empty-visual {
  position: relative;
  @include flex-center;
  width: 184rpx;
  height: 144rpx;
  margin-bottom: $spacing-lg;
  border-radius: 48rpx;
  background: $gradient-peach;
  border: 1rpx solid rgba(255, 255, 255, 0.78);
  box-shadow: $shadow-md;

  &::before,
  &::after {
    content: '';
    position: absolute;
    bottom: 24rpx;
    width: 18rpx;
    height: 18rpx;
    border-radius: 50%;
    background: rgba($primary-color, 0.26);
  }

  &::before {
    left: 52rpx;
  }

  &::after {
    right: 52rpx;
  }
}

.empty-visual-text {
  color: $primary-dark;
  font-size: 52rpx;
  font-weight: 900;
}

.empty-title {
  font-size: $font-lg;
  color: $text-color;
  font-weight: 800;
}

.empty-subtitle {
  max-width: 520rpx;
  margin-top: 12rpx;
  color: $text-secondary;
  font-size: $font-sm;
  line-height: 1.55;
}

.empty-action {
  @include flex-center;
  min-width: 220rpx;
  min-height: 76rpx;
  margin-top: $spacing-lg;
  padding: 0 $spacing-xl;
  border-radius: $radius-round;
  background: $gradient-coral;
  box-shadow: $shadow-coral;
}

.empty-action-text {
  color: #FFFFFF;
  font-size: $font-md;
  font-weight: 800;
}

.cart-footer {
  justify-content: space-between;
  min-height: 144rpx;
  padding-top: 14rpx;
  padding-bottom: calc(14rpx + constant(safe-area-inset-bottom));
  padding-bottom: calc(14rpx + env(safe-area-inset-bottom));
}

.footer-left {
  display: flex;
  align-items: center;
}

.all-check-text {
  font-size: $font-sm;
  color: $text-secondary;
  margin-left: 8rpx;
}

.footer-right {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  flex: 1;
  min-width: 0;
}

.total-price {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  margin-right: $spacing-sm;
  min-width: 0;
  flex: 1;
}

.total-main {
  display: flex;
  align-items: baseline;
  max-width: 100%;
}

.total-label {
  font-size: $font-sm;
  color: $text-secondary;
  margin-right: 6rpx;
  flex-shrink: 0;
}

.total-note {
  margin-top: 6rpx;
  font-size: 18rpx;
  color: $text-hint;
  @include text-ellipsis;
  max-width: 260rpx;
}

.checkout-btn {
  background: $gradient-coral;
  border-radius: $radius-round;
  min-width: 218rpx;
  min-height: 84rpx;
  padding: 0 34rpx;
  @include flex-center;
  box-shadow: $shadow-coral;
  flex-shrink: 0;

  &.disabled {
    opacity: 0.58;
  }
}

.checkout-text {
  color: #FFFFFF;
  font-size: $font-md;
  font-weight: 500;
}
</style>
