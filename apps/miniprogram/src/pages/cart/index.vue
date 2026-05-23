<template>
  <view class="cart-page">
    <view v-if="cartStore.items.length" class="cart-content">
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

    <view v-if="cartStore.items.length" class="cart-footer">
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
  background: $bg-color;
  padding-bottom: 120rpx;
}

.cart-item {
  display: flex;
  align-items: center;
  padding: $spacing-md;
  background: $bg-white;
  margin-bottom: 2rpx;
}

.item-check {
  padding: 8rpx;
  margin-right: $spacing-sm;
}

.check-box {
  width: 40rpx;
  height: 40rpx;
  border-radius: 50%;
  border: 2rpx solid $border-color;
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
  width: 160rpx;
  height: 160rpx;
  border-radius: $radius-md;
  flex-shrink: 0;
}

.item-info {
  flex: 1;
  margin-left: $spacing-sm;
  overflow: hidden;
}

.item-name {
  font-size: $font-md;
  color: $text-color;
  @include text-ellipsis-2;
  display: block;
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
}

.qty-btn {
  @include flex-center;
  width: 48rpx;
  height: 48rpx;
  background: $bg-gray;
  border-radius: $radius-sm;
  font-size: $font-lg;
  color: $text-color;
}

.qty-value {
  width: 64rpx;
  text-align: center;
  font-size: $font-md;
}

.cart-footer {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: $bg-white;
  padding: $spacing-sm $spacing-md;
  box-shadow: 0 -2rpx 8rpx rgba(0, 0, 0, 0.05);
  @include safe-bottom;
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
  padding: 16rpx 40rpx;
}

.checkout-text {
  color: #FFFFFF;
  font-size: $font-md;
  font-weight: 500;
}
</style>
