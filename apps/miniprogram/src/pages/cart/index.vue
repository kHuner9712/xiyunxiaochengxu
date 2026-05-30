<template>
  <view class="cart-page page-shell">
    <view v-if="cartStore.items.length" class="cart-content">
      <view class="cart-summary card">
        <view>
          <text class="summary-title">购物车</text>
          <text class="summary-subtitle">已选 {{ cartStore.checkedCount }} 件</text>
        </view>
        <text class="summary-hint">满减和优惠以确认订单为准</text>
      </view>
      <view v-for="(item, index) in cartStore.items" :key="item.id" class="cart-item">
        <view class="item-check" @tap="cartStore.toggleCheck(index)">
          <view class="check-box" :class="{ checked: item.checked }">
            <text v-if="item.checked" class="check-icon">✓</text>
          </view>
        </view>
        <image class="item-image" :src="item.productImage" mode="aspectFill" @tap="goDetail(item.productId)" />
        <view class="item-info">
          <text class="item-name">{{ item.productName }}</text>
          <text class="item-sku">{{ item.skuName }}</text>
          <view class="item-bottom">
            <PriceDisplay :price="item.price" />
            <view class="quantity-control">
              <view class="qty-btn" @tap="handleQuantity(index, -1)">-</view>
              <text class="qty-value">{{ item.quantity }}</text>
              <view class="qty-btn" @tap="handleQuantity(index, 1)">+</view>
            </view>
          </view>
        </view>
      </view>
    </view>

    <Empty v-else text="购物车空空如也" actionText="去逛逛" @action="goHome" />

    <view v-if="cartStore.items.length" class="cart-footer bottom-action-bar">
      <view class="footer-left" @tap="cartStore.toggleCheckAll">
        <view class="check-box" :class="{ checked: cartStore.allChecked }">
          <text v-if="cartStore.allChecked" class="check-icon">✓</text>
        </view>
        <text class="all-check-text">全选</text>
      </view>
      <view class="footer-right">
        <view class="total-price">
          <text class="total-label">合计：</text>
          <PriceDisplay :price="cartStore.totalPrice" />
        </view>
        <view class="checkout-btn" @tap="goCheckout">
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
import Empty from '@/components/Empty.vue'

const cartStore = useCartStore()
const userStore = useUserStore()

function goDetail(productId: number) {
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
  padding-bottom: 148rpx;
}

.cart-content {
  padding-top: $spacing-sm;
}

.cart-summary {
  @include flex-between;
  align-items: flex-start;
  margin: $spacing-sm $spacing-md $spacing-md;
  background: linear-gradient(135deg, #FFFFFF 0%, $primary-soft 100%);
}

.summary-title {
  display: block;
  font-size: $font-xl;
  font-weight: 800;
  color: $text-color;
}

.summary-subtitle,
.summary-hint {
  display: block;
  margin-top: 6rpx;
  font-size: $font-xs;
  color: $text-hint;
}

.summary-hint {
  max-width: 300rpx;
  text-align: right;
}

.cart-item {
  display: flex;
  align-items: flex-start;
  padding: $spacing-sm;
  background: $bg-white;
  margin: $spacing-sm $spacing-md $spacing-md;
  border-radius: $radius-xl;
  border: 1rpx solid rgba($border-color, 0.72);
  box-shadow: $shadow-sm;
}

.item-check {
  padding: 58rpx 8rpx 0 0;
  margin-right: $spacing-sm;
}

.check-box {
  width: 40rpx;
  height: 40rpx;
  border-radius: 50%;
  border: 2rpx solid $border-color;
  background: $bg-white;
  @include flex-center;

  &.checked {
    background: $primary-color;
    border-color: $primary-color;
  }
}

.check-icon {
  color: #FFFFFF;
  font-size: $font-sm;
}

.item-image {
  width: 164rpx;
  height: 164rpx;
  border-radius: $radius-lg;
  flex-shrink: 0;
  background: $bg-gray;
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

.item-sku {
  font-size: $font-xs;
  color: $text-hint;
  margin-top: 4rpx;
  display: block;
}

.item-bottom {
  @include flex-between;
  margin-top: $spacing-sm;
}

.quantity-control {
  display: flex;
  align-items: center;
  background: $bg-gray;
  border-radius: $radius-round;
  padding: 4rpx;
}

.qty-btn {
  @include flex-center;
  width: 48rpx;
  height: 48rpx;
  background: $bg-white;
  border-radius: $radius-round;
  font-size: $font-md;
  color: $primary-dark;
  font-weight: 700;
}

.qty-value {
  width: 64rpx;
  text-align: center;
  font-size: $font-md;
}

.cart-footer {
  justify-content: space-between;
  min-height: 128rpx;
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
}

.total-price {
  display: flex;
  align-items: baseline;
  margin-right: $spacing-md;
}

.total-label {
  font-size: $font-sm;
  color: $text-secondary;
}

.checkout-btn {
  background: linear-gradient(135deg, $primary-color, $primary-light);
  border-radius: $radius-round;
  min-height: 82rpx;
  padding: 0 44rpx;
  @include flex-center;
  box-shadow: 0 10rpx 22rpx rgba(244, 124, 124, 0.2);
}

.checkout-text {
  color: #FFFFFF;
  font-size: $font-md;
  font-weight: 500;
}
</style>
