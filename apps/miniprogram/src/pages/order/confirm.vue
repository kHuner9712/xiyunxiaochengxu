<template>
  <view class="confirm-page">
    <view class="address-section card" @tap="selectAddress">
      <view v-if="address" class="address-info">
        <view class="address-top">
          <text class="address-name">{{ address.name }}</text>
          <text class="address-phone">{{ address.phone }}</text>
        </view>
        <text class="address-detail">{{ address.province }}{{ address.city }}{{ address.district }}{{ address.detail }}</text>
      </view>
      <view v-else class="no-address">
        <text class="no-address-text">请选择收货地址</text>
      </view>
      <text class="address-arrow">›</text>
    </view>

    <view class="products-section card">
      <view v-for="item in orderItems" :key="item.skuId" class="product-item">
        <image class="product-image" :src="item.productImage" mode="aspectFill" />
        <view class="product-info">
          <text class="product-name">{{ item.productName }}</text>
          <text class="product-sku">{{ item.skuName }}</text>
          <view class="product-bottom">
            <PriceDisplay :price="item.price" />
            <text class="product-qty">x{{ item.quantity }}</text>
          </view>
        </view>
      </view>
    </view>

    <view class="coupon-section card" @tap="showCouponPicker = true">
      <text class="section-label">优惠券</text>
      <text class="section-value">{{ selectedCoupon ? `-¥${formatPrice(couponDiscount)}` : '选择优惠券' }}</text>
      <text class="section-arrow">›</text>
    </view>

    <view class="points-section card">
      <view class="points-row">
        <text class="section-label">积分抵扣</text>
        <text class="points-info">可用{{ availablePoints }}积分，抵扣¥{{ formatPrice(pointsDeduct) }}</text>
      </view>
      <switch :checked="usePoints" @change="togglePoints" color="#FF6B9D" />
    </view>

    <view class="price-section card">
      <view class="price-row">
        <text class="price-label">商品金额</text>
        <text class="price-value">¥{{ formatPrice(totalProductPrice) }}</text>
      </view>
      <view class="price-row">
        <text class="price-label">运费</text>
        <text class="price-value">{{ freightAmount > 0 ? `¥${formatPrice(freightAmount)}` : '免运费' }}</text>
      </view>
      <view v-if="couponDiscount > 0" class="price-row">
        <text class="price-label">优惠券</text>
        <text class="price-value discount">-¥{{ formatPrice(couponDiscount) }}</text>
      </view>
      <view v-if="pointsDeduct > 0" class="price-row">
        <text class="price-label">积分抵扣</text>
        <text class="price-value discount">-¥{{ formatPrice(pointsDeduct) }}</text>
      </view>
    </view>

    <view class="remark-section card">
      <text class="section-label">订单备注</text>
      <input class="remark-input" v-model="remark" placeholder="选填，请先和商家协商一致" />
    </view>

    <view class="bottom-bar">
      <view class="total-row">
        <text class="total-label">合计：</text>
        <PriceDisplay :price="payAmount" />
      </view>
      <view class="submit-btn" :class="{ disabled: submitting }" @tap="handleSubmit">
        <text class="submit-text">{{ submitting ? '提交中...' : '提交订单' }}</text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { createOrder, previewOrder, type OrderPreview, type OrderPreviewItem } from '@/api/order'
import { getAddressList, type AddressItem } from '@/api/address'
import { getAvailableCoupons, type MyCouponItem } from '@/api/coupon'
import { createPayment, wxPay } from '@/api/payment'
import { formatPrice } from '@/utils/format'
import PriceDisplay from '@/components/PriceDisplay.vue'

interface OrderItemInput {
  productId: number
  skuId: number
  quantity: number
  productName: string
  productImage: string
  skuName: string
  price: number
}

const address = ref<AddressItem | null>(null)
const orderItems = ref<OrderItemInput[]>([])
const selectedCoupon = ref<MyCouponItem | null>(null)
const usePoints = ref(false)
const remark = ref('')
const availablePoints = ref(0)
const showCouponPicker = ref(false)
const submitting = ref(false)
const loading = ref(false)
const preview = ref<OrderPreview | null>(null)

const totalProductPrice = computed(() => {
  if (preview.value) return preview.value.totalAmount
  return orderItems.value.reduce((sum, item) => sum + item.price * item.quantity, 0)
})

const couponDiscount = computed(() => {
  if (preview.value) return preview.value.couponAmount
  if (!selectedCoupon.value) return 0
  return selectedCoupon.value.value
})

const pointsDeduct = computed(() => {
  if (preview.value) return preview.value.pointsAmount
  if (!usePoints.value) return 0
  return Math.min(availablePoints.value, Math.floor(totalProductPrice.value / 100) * 100)
})

const freightAmount = computed(() => {
  if (preview.value) return preview.value.freightAmount
  return 0
})

const payAmount = computed(() => {
  if (preview.value) return preview.value.payAmount
  return Math.max(0, totalProductPrice.value + freightAmount.value - couponDiscount.value - pointsDeduct.value)
})

async function loadPreview() {
  if (orderItems.value.length === 0) return
  try {
    loading.value = true
    const data = await previewOrder({
      items: orderItems.value.map(item => ({
        skuId: item.skuId,
        quantity: item.quantity
      })),
      addressId: address.value?.id,
      couponId: selectedCoupon.value?.id,
      pointsDeduct: usePoints.value ? availablePoints.value : 0
    })
    preview.value = data
    if (data.items?.length) {
      orderItems.value = data.items.map(item => ({
        productId: Number(item.productId),
        skuId: Number(item.skuId),
        quantity: item.quantity,
        productName: item.productName,
        productImage: item.productImage,
        skuName: item.skuSpecs,
        price: item.price
      }))
    }
  } catch (e: any) {
    uni.showToast({ title: e.message || '获取订单金额失败', icon: 'none' })
  } finally {
    loading.value = false
  }
}

async function loadDefaultAddress() {
  try {
    const list = await getAddressList()
    address.value = list.find(item => item.isDefault) || list[0] || null
  } catch (e: any) {
    uni.showToast({ title: '加载地址失败', icon: 'none' })
  }
}

function selectAddress() {
  uni.navigateTo({
    url: '/pages/address/list?select=true',
    events: {
      selectAddress: (data: AddressItem) => {
        address.value = data
        loadPreview()
      }
    }
  })
}

function togglePoints(e: any) {
  usePoints.value = e.detail.value
  loadPreview()
}

async function handleSubmit() {
  if (submitting.value) return
  if (!address.value) {
    uni.showToast({ title: '请选择收货地址', icon: 'none' })
    return
  }
  try {
    submitting.value = true
    const orderData = {
      addressId: address.value.id,
      items: orderItems.value.map(item => ({
        productId: item.productId,
        skuId: item.skuId,
        quantity: item.quantity
      })),
      couponId: selectedCoupon.value?.id,
      pointsDeduct: usePoints.value ? availablePoints.value : 0,
      remark: remark.value
    }
    const order = await createOrder(orderData)
    const payment = await createPayment({ orderId: String(order.orderId) })
    try {
      await wxPay(payment)
      uni.redirectTo({ url: `/pages/order/pay-result?orderId=${order.orderId}` })
    } catch {
      uni.redirectTo({ url: `/pages/order/pay-result?orderId=${order.orderId}` })
    }
  } catch (e: any) {
    uni.showToast({ title: e.message || '下单失败，请重试', icon: 'none' })
  } finally {
    submitting.value = false
  }
}

onLoad((options) => {
  if (options?.items) {
    orderItems.value = JSON.parse(decodeURIComponent(options.items))
  } else if (options?.productId) {
    orderItems.value = [{
      productId: Number(options.productId),
      skuId: Number(options.skuId),
      quantity: Number(options.quantity || 1),
      productName: '',
      productImage: '',
      skuName: '',
      price: 0
    }]
  }
  loadDefaultAddress()
  loadPreview()
})
</script>

<style lang="scss" scoped>
.confirm-page {
  min-height: 100vh;
  background: $bg-color;
  padding-bottom: 120rpx;
}

.address-section {
  display: flex;
  align-items: center;
  margin: $spacing-sm $spacing-md;
}

.address-info {
  flex: 1;
}

.address-top {
  display: flex;
  align-items: center;
  margin-bottom: 8rpx;
}

.address-name {
  font-size: $font-md;
  font-weight: 600;
  color: $text-color;
  margin-right: $spacing-sm;
}

.address-phone {
  font-size: $font-sm;
  color: $text-secondary;
}

.address-detail {
  font-size: $font-sm;
  color: $text-secondary;
}

.no-address-text {
  font-size: $font-md;
  color: $text-hint;
}

.address-arrow {
  font-size: $font-lg;
  color: $text-hint;
  margin-left: $spacing-sm;
}

.products-section {
  margin: $spacing-sm $spacing-md;
}

.product-item {
  display: flex;
  padding: $spacing-sm 0;
  border-bottom: 1rpx solid $divider-color;

  &:last-child {
    border-bottom: none;
  }
}

.product-image {
  width: 160rpx;
  height: 160rpx;
  border-radius: $radius-md;
  flex-shrink: 0;
}

.product-info {
  flex: 1;
  margin-left: $spacing-sm;
}

.product-name {
  font-size: $font-md;
  color: $text-color;
  @include text-ellipsis-2;
  display: block;
}

.product-sku {
  font-size: $font-xs;
  color: $text-hint;
  margin-top: 4rpx;
  display: block;
}

.product-bottom {
  @include flex-between;
  margin-top: $spacing-sm;
}

.product-qty {
  font-size: $font-sm;
  color: $text-hint;
}

.coupon-section,
.points-section,
.remark-section {
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
  text-align: right;
}

.section-arrow {
  font-size: $font-lg;
  color: $text-hint;
  margin-left: 8rpx;
}

.points-row {
  flex: 1;
  display: flex;
  align-items: center;
}

.points-info {
  font-size: $font-xs;
  color: $text-hint;
  margin-left: $spacing-sm;
}

.remark-input {
  flex: 1;
  font-size: $font-sm;
  text-align: right;
}

.price-section {
  margin: $spacing-sm $spacing-md;
}

.price-row {
  @include flex-between;
  padding: 8rpx 0;
}

.price-label {
  font-size: $font-sm;
  color: $text-secondary;
}

.price-value {
  font-size: $font-sm;
  color: $text-color;

  &.discount {
    color: $danger-color;
  }
}

.bottom-bar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  background: $bg-white;
  padding: $spacing-sm $spacing-md;
  box-shadow: 0 -2rpx 8rpx rgba(0, 0, 0, 0.05);
  @include safe-bottom;
}

.total-row {
  display: flex;
  align-items: baseline;
  margin-right: $spacing-md;
}

.total-label {
  font-size: $font-sm;
  color: $text-secondary;
}

.submit-btn {
  background: linear-gradient(135deg, $primary-color, $primary-light);
  border-radius: $radius-round;
  padding: 20rpx 48rpx;

  &.disabled {
    opacity: 0.6;
    pointer-events: none;
  }
}

.submit-text {
  color: #FFFFFF;
  font-size: $font-md;
  font-weight: 500;
}
</style>
