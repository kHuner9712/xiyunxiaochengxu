<template>
  <view class="confirm-page page-shell">
    <view class="confirm-head">
      <text class="confirm-title">确认订单</text>
      <text class="confirm-subtitle">自营母婴好物 · 安心履约</text>
    </view>

    <view class="delivery-mode-section card">
      <view class="card-title-row">
        <text class="card-title">配送方式</text>
        <text class="card-subtitle">请选择本次履约方式</text>
      </view>
      <view class="mode-tabs">
        <view class="mode-tab" :class="{ active: fulfillmentType === 'delivery' }" @tap="switchFulfillmentType('delivery')">
          <text class="mode-tab-text">快递配送</text>
        </view>
        <view class="mode-tab" :class="{ active: fulfillmentType === 'pickup' }" @tap="switchFulfillmentType('pickup')">
          <text class="mode-tab-text">到店自提</text>
        </view>
      </view>
    </view>

    <view v-if="fulfillmentType === 'delivery'" class="address-section card" @tap="selectAddress">
      <view class="address-badge">收</view>
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

    <view v-if="fulfillmentType === 'pickup'" class="pickup-section card" @tap="selectPickupStore">
      <view class="address-badge pickup">提</view>
      <view v-if="selectedPickupStore" class="pickup-info">
        <view class="pickup-top">
          <text class="pickup-name">{{ selectedPickupStore.name }}</text>
        </view>
        <text class="pickup-address">{{ selectedPickupStore.fullAddress }}</text>
        <text v-if="selectedPickupStore.businessHours" class="pickup-hours">营业时间：{{ selectedPickupStore.businessHours }}</text>
      </view>
      <view v-else class="no-address">
        <text class="no-address-text">请选择自提点</text>
      </view>
      <text class="address-arrow">›</text>
    </view>

    <view class="products-section card">
      <view class="card-title-row">
        <text class="card-title">商品清单</text>
        <text class="card-subtitle">共 {{ orderItems.length }} 件</text>
      </view>
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

    <view class="coupon-section card" @tap="openCouponPicker">
      <text class="section-label">优惠券</text>
      <text class="section-value" :class="{ 'coupon-selected': selectedCoupon }">
        <template v-if="selectedCoupon">-¥{{ formatPrice(couponDiscount) }}</template>
        <template v-else-if="couponList.length === 0">暂无可用优惠券</template>
        <template v-else>选择优惠券</template>
      </text>
      <text v-if="couponList.length > 0" class="section-arrow">›</text>
    </view>

    <view class="points-section card">
      <view class="points-row">
        <text class="section-label">积分抵扣</text>
        <text class="points-info">可用{{ availablePoints }}积分，抵扣¥{{ formatPrice(pointsDeduct) }}</text>
      </view>
      <switch :checked="usePoints" @change="togglePoints" color="#F27678" />
    </view>

    <view class="price-section card">
      <view class="card-title-row">
        <text class="card-title">金额明细</text>
      </view>
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
      <view class="price-row total">
        <text class="price-label">应付金额</text>
        <PriceDisplay :price="payAmount" />
      </view>
    </view>

    <view class="remark-section card">
      <text class="section-label">订单备注</text>
      <input class="remark-input" v-model="remark" placeholder="选填，请先和商家协商一致" />
    </view>

    <view class="legal-section card">
      <checkbox-group class="legal-check-group" @change="toggleLegalAgreement">
        <label class="legal-check-label">
          <checkbox class="legal-checkbox" value="agree" :checked="agreedToLegal" color="#F27678" />
          <view class="legal-copy">
            <text class="legal-text">我已阅读并同意</text>
            <text class="legal-link" @tap.stop="openLegalPage('/pages/agreement/index')">《用户协议》</text>
            <text class="legal-text">、</text>
            <text class="legal-link" @tap.stop="openLegalPage('/pages/privacy/index')">《隐私政策》</text>
            <text class="legal-text">、</text>
            <text class="legal-link" @tap.stop="openLegalPage('/pages/food-safety/index')">《食品安全与售后说明》</text>
          </view>
        </label>
      </checkbox-group>
    </view>

    <view class="bottom-bar bottom-action-bar">
      <view class="total-row">
        <text class="total-label">合计：</text>
        <PriceDisplay :price="payAmount" />
      </view>
      <view class="submit-btn" :class="{ disabled: submitting }" @tap="handleSubmit">
        <text class="submit-text">{{ submitting ? '提交中...' : '提交订单' }}</text>
      </view>
    </view>

    <view v-if="showCouponPicker" class="coupon-mask" @tap="closeCouponPicker">
      <view class="coupon-popup" @tap.stop>
        <view class="popup-header">
          <text class="popup-title">选择优惠券</text>
          <text class="popup-close" @tap="closeCouponPicker">✕</text>
        </view>
        <scroll-view scroll-y class="popup-body">
          <view
            class="coupon-item"
            :class="{ active: !selectedCoupon }"
            @tap="selectCoupon(null)"
          >
            <view class="coupon-item-info">
              <text class="coupon-item-name">不使用优惠券</text>
            </view>
            <view v-if="!selectedCoupon" class="coupon-check">✓</view>
          </view>
          <view
            v-for="coupon in couponList"
            :key="coupon.id"
            class="coupon-item"
            :class="{ active: selectedCoupon?.id === coupon.id }"
            @tap="selectCoupon(coupon)"
          >
            <view class="coupon-item-left">
              <text class="coupon-item-value">¥{{ formatPrice(coupon.value) }}</text>
              <text class="coupon-item-condition">满{{ formatPrice(coupon.minAmount) }}可用</text>
            </view>
            <view class="coupon-item-info">
              <text class="coupon-item-name">{{ coupon.name }}</text>
              <text class="coupon-item-time">{{ coupon.startTime?.slice(0, 10) }} - {{ coupon.endTime?.slice(0, 10) }}</text>
            </view>
            <view v-if="selectedCoupon?.id === coupon.id" class="coupon-check">✓</view>
          </view>
          <view v-if="couponList.length === 0" class="coupon-empty">
            <text class="coupon-empty-text">暂无可用优惠券</text>
          </view>
        </scroll-view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { createOrder, previewOrder, type OrderPreview, type OrderPreviewItem } from '@/api/order'
import { getPickupStoreList, type PickupStoreItem } from '@/api/pickup-store'
import { getAddressList, type AddressItem } from '@/api/address'
import { getAvailableCoupons, type MyCouponItem } from '@/api/coupon'
import { createPayment, wxPay } from '@/api/payment'
import { formatPrice } from '@/utils/format'
import PriceDisplay from '@/components/PriceDisplay.vue'

interface OrderItemInput {
  productId: string
  skuId: string
  quantity: number
  productName: string
  productImage: string
  skuName: string
  price: number
}

const address = ref<AddressItem | null>(null)
const fulfillmentType = ref<'delivery' | 'pickup'>('delivery')
const selectedPickupStore = ref<PickupStoreItem | null>(null)
const orderItems = ref<OrderItemInput[]>([])
const selectedCoupon = ref<MyCouponItem | null>(null)
const usePoints = ref(false)
const remark = ref('')
const availablePoints = ref(0)
const showCouponPicker = ref(false)
const submitting = ref(false)
const loading = ref(false)
const preview = ref<OrderPreview | null>(null)
const couponList = ref<MyCouponItem[]>([])
const agreedToLegal = ref(false)

const totalProductPrice = computed(() => {
  if (preview.value) return preview.value.totalAmount
  return orderItems.value.reduce((sum, item) => sum + item.price * item.quantity, 0)
})

const couponDiscount = computed(() => {
  if (preview.value) return preview.value.couponAmount
  return 0
})

const pointsDeduct = computed(() => {
  if (preview.value) return preview.value.pointsAmount
  return 0
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
  if (fulfillmentType.value === 'delivery' && !address.value) return
  if (fulfillmentType.value === 'pickup' && !selectedPickupStore.value) return
  try {
    loading.value = true
    const data = await previewOrder({
      items: orderItems.value.map(item => ({
        skuId: item.skuId,
        quantity: item.quantity
      })),
      addressId: fulfillmentType.value === 'delivery' ? address.value?.id : undefined,
      pickupStoreId: fulfillmentType.value === 'pickup' ? selectedPickupStore.value?.id : undefined,
      fulfillmentType: fulfillmentType.value,
      couponId: selectedCoupon.value?.id,
      pointsDeduct: usePoints.value ? availablePoints.value : 0
    })
    preview.value = data
    if (data.items?.length) {
      orderItems.value = data.items.map(item => ({
        productId: item.productId,
        skuId: item.skuId,
        quantity: item.quantity,
        productName: item.productName,
        productImage: item.productImage,
        skuName: item.skuSpecText || (typeof item.skuSpecs === 'string' ? item.skuSpecs : Object.entries(item.skuSpecs || {}).map(([k, v]) => `${k}：${v}`).join(' / ')),
        price: item.price
      }))
    }
  } catch (e: any) {
    preview.value = null
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

async function loadCoupons() {
  try {
    const totalAmount = orderItems.value.reduce((sum, item) => sum + item.price * item.quantity, 0)
    const productIds = orderItems.value.map(item => item.productId)
    couponList.value = await getAvailableCoupons({ amount: totalAmount, productIds })
  } catch {
    couponList.value = []
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

function switchFulfillmentType(type: 'delivery' | 'pickup') {
  fulfillmentType.value = type
  if (type === 'pickup') {
    if (!selectedPickupStore.value) {
      preview.value = null
      uni.showToast({ title: '请选择自提点', icon: 'none' })
      return
    }
    loadPreview()
    return
  }

  if (address.value) {
    loadPreview()
  } else {
    preview.value = null
  }
}

function selectPickupStore() {
  uni.navigateTo({
    url: '/pages/pickup-store/list?select=true',
    events: {
      selectStore: (data: PickupStoreItem) => {
        selectedPickupStore.value = data
        loadPreview()
      }
    }
  })
}

function openCouponPicker() {
  if (couponList.value.length === 0) return
  showCouponPicker.value = true
}

function closeCouponPicker() {
  showCouponPicker.value = false
}

async function selectCoupon(coupon: MyCouponItem | null) {
  selectedCoupon.value = coupon
  showCouponPicker.value = false
  await loadPreview()
}

function togglePoints(e: any) {
  usePoints.value = e.detail.value
  loadPreview()
}

function openLegalPage(url: string) {
  uni.navigateTo({ url })
}

function toggleLegalAgreement(e: any) {
  agreedToLegal.value = e.detail.value.includes('agree')
}

function isUserCancelPayError(err: any): boolean {
  const msg = String(err?.errMsg || err?.message || '').toLowerCase()
  return msg.includes('cancel')
}

async function handleSubmit() {
  if (submitting.value) return
  if (!agreedToLegal.value) {
    uni.showToast({ title: '请先阅读并同意相关协议', icon: 'none' })
    return
  }
  if (fulfillmentType.value === 'delivery' && !address.value) {
    uni.showToast({ title: '请选择收货地址', icon: 'none' })
    return
  }
  if (fulfillmentType.value === 'pickup' && !selectedPickupStore.value) {
    uni.showToast({ title: '请选择自提点', icon: 'none' })
    return
  }
  if (orderItems.value.length === 0) {
    uni.showToast({ title: '订单商品为空', icon: 'none' })
    return
  }
  if (!preview.value) {
    uni.showToast({ title: '金额试算失败，请返回重试', icon: 'none' })
    return
  }
  try {
    submitting.value = true
    const orderData = {
      fulfillmentType: fulfillmentType.value,
      addressId: fulfillmentType.value === 'delivery' ? address.value!.id : undefined,
      pickupStoreId: fulfillmentType.value === 'pickup' ? selectedPickupStore.value!.id : undefined,
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
    if (order.isZeroPay === true || order.payAmount === 0) {
      uni.redirectTo({ url: `/pages/order/pay-result?orderId=${order.orderId}&payIntent=success&zeroPay=1` })
      return
    }
    try {
      const payment = await createPayment({ orderId: order.orderId })
      try {
        await wxPay(payment)
        uni.redirectTo({ url: `/pages/order/pay-result?orderId=${order.orderId}&payScene=confirm&payIntent=success` })
      } catch (payClientErr: any) {
        if (isUserCancelPayError(payClientErr)) {
          uni.redirectTo({ url: `/pages/order/pay-result?orderId=${order.orderId}&payScene=confirm&payIntent=cancel` })
          return
        }
        uni.showModal({
          title: '支付未完成',
          content: '支付发起异常，请在订单详情页继续支付',
          showCancel: false,
          confirmText: '查看订单',
          success: () => {
            uni.redirectTo({ url: `/pages/order/detail?id=${order.orderId}` })
          }
        })
      }
    } catch (payErr: any) {
      const payMsg = payErr?.message || '支付发起失败'
      uni.showModal({
        title: '提示',
        content: payMsg.includes('暂未开通') ? payMsg : '支付功能暂未开放，请联系客服',
        showCancel: false,
        confirmText: '我知道了',
        success: () => {
          uni.redirectTo({ url: `/pages/order/detail?id=${order.orderId}` })
        }
      })
    }
  } catch (e: any) {
    uni.showToast({ title: e.message || '下单失败，请重试', icon: 'none' })
  } finally {
    submitting.value = false
  }
}

onLoad(async (options) => {
  if (options?.items) {
    orderItems.value = JSON.parse(decodeURIComponent(options.items))
  } else if (options?.productId) {
    orderItems.value = [{
      productId: options.productId,
      skuId: options.skuId,
      quantity: Number(options.quantity || 1),
      productName: '',
      productImage: '',
      skuName: '',
      price: 0
    }]
  }
  await loadDefaultAddress()
  if (fulfillmentType.value === 'delivery' ? !!address.value : !!selectedPickupStore.value) {
    await loadPreview()
  }
  loadCoupons()
})
</script>

<style lang="scss" scoped>
.confirm-page {
  min-height: 100vh;
  padding-bottom: 168rpx;
}

.confirm-head {
  padding: 34rpx $spacing-md 18rpx;
}

.confirm-title {
  display: block;
  font-size: $font-xl;
  line-height: 1.16;
  color: $text-color;
  font-weight: 900;
}

.confirm-subtitle {
  display: block;
  margin-top: 8rpx;
  font-size: $font-sm;
  color: $text-secondary;
}

.address-section {
  display: flex;
  align-items: flex-start;
  margin: $spacing-sm $spacing-md;
  background:
    radial-gradient(circle at 88% 0%, rgba($primary-color, 0.12) 0%, rgba($primary-color, 0) 220rpx),
    $gradient-card;
  border-color: rgba(255, 255, 255, 0.78);
}

.delivery-mode-section {
  margin: $spacing-sm $spacing-md;
  background: rgba(255, 255, 255, 0.82);
}

.mode-tabs {
  display: flex;
  gap: $spacing-sm;
}

.mode-tab {
  flex: 1;
  @include flex-center;
  min-height: 76rpx;
  padding: 0 12rpx;
  border: 2rpx solid rgba($border-color, 0.9);
  border-radius: $radius-round;
  transition: all 0.3s;
  background: rgba(255, 255, 255, 0.78);

  &.active {
    border-color: rgba($primary-color, 0.28);
    background: #FFFFFF;
    box-shadow: $shadow-xs;
  }
}

.mode-tab-text {
  font-size: $font-md;
  color: $text-secondary;

  .active & {
    color: $primary-color;
    font-weight: 600;
  }
}

.pickup-section {
  display: flex;
  align-items: flex-start;
  margin: $spacing-sm $spacing-md;
  background:
    radial-gradient(circle at 88% 0%, rgba($secondary-color, 0.16) 0%, rgba($secondary-color, 0) 220rpx),
    $gradient-card;
  border-color: rgba(255, 255, 255, 0.78);
}

.address-badge {
  @include flex-center;
  width: 56rpx;
  height: 56rpx;
  border-radius: 22rpx;
  background: $primary-soft;
  color: $primary-dark;
  font-size: $font-sm;
  font-weight: 800;
  margin-right: $spacing-sm;
  flex-shrink: 0;

  &.pickup {
    background: $secondary-soft;
    color: $secondary-color;
  }
}

.pickup-info {
  flex: 1;
}

.pickup-top {
  margin-bottom: 8rpx;
}

.pickup-name {
  font-size: $font-md;
  font-weight: 600;
  color: $text-color;
}

.pickup-address {
  font-size: $font-sm;
  color: $text-secondary;
  display: block;
}

.pickup-hours {
  font-size: $font-xs;
  color: $text-hint;
  display: block;
  margin-top: 4rpx;
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
  line-height: 1.55;
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
  background: rgba(255, 255, 255, 0.88);
}

.card-title-row {
  @include flex-between;
  margin-bottom: $spacing-sm;
}

.card-title {
  font-size: $font-md;
  color: $text-color;
  font-weight: 800;
}

.card-subtitle {
  font-size: $font-xs;
  color: $text-hint;
}

.product-item {
  display: flex;
  padding: $spacing-md 0;
  border-bottom: 1rpx solid $divider-color;

  &:last-child {
    border-bottom: none;
  }
}

.product-image {
  width: 156rpx;
  height: 156rpx;
  border-radius: 28rpx;
  flex-shrink: 0;
  background: $bg-gray;
}

.product-info {
  flex: 1;
  margin-left: $spacing-sm;
}

.product-name {
  font-size: $font-md;
  color: $text-color;
  font-weight: 600;
  @include text-ellipsis-2;
  display: block;
}

.product-sku {
  font-size: $font-xs;
  color: $text-secondary;
  margin-top: 8rpx;
  display: inline-flex;
  max-width: 100%;
  padding: 6rpx 14rpx;
  border-radius: $radius-round;
  background: $bg-soft;
  @include text-ellipsis;
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
.remark-section,
.legal-section {
  display: flex;
  align-items: center;
  margin: $spacing-sm $spacing-md;
  background: rgba(255, 255, 255, 0.86);
}

.section-label {
  font-size: $font-md;
  color: $text-color;
  margin-right: $spacing-sm;
  font-weight: 800;
}

.section-value {
  flex: 1;
  font-size: $font-sm;
  color: $text-hint;
  text-align: right;

  &.coupon-selected {
    color: $price-color;
    font-weight: 700;
  }
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
  color: $text-color;
}

.legal-section {
  align-items: flex-start;
}

.legal-check-group {
  width: 100%;
}

.legal-check-label {
  display: flex;
  align-items: flex-start;
}

.legal-checkbox {
  transform: scale(0.8);
  margin-right: 8rpx;
  flex-shrink: 0;
}

.legal-copy {
  flex: 1;
  line-height: 1.8;
}

.legal-text {
  font-size: $font-xs;
  color: $text-hint;
  line-height: 1.8;
}

.legal-link {
  font-size: $font-xs;
  color: $primary-color;
  line-height: 1.8;
}

.price-section {
  margin: $spacing-sm $spacing-md;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.94) 0%, rgba(255, 246, 241, 0.92) 100%);
  border-color: rgba(255, 255, 255, 0.78);
}

.price-row {
  @include flex-between;
  padding: 10rpx 0;

  &.total {
    margin-top: $spacing-xs;
    padding-top: $spacing-sm;
    border-top: 1rpx solid $divider-color;

    .price-label {
      color: $text-color;
      font-weight: 800;
    }
  }
}

.price-label {
  font-size: $font-sm;
  color: $text-secondary;
}

.price-value {
  font-size: $font-sm;
  color: $text-color;

  &.discount {
    color: $price-color;
  }
}

.bottom-bar {
  justify-content: space-between;
  min-height: 136rpx;
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
  background: $gradient-coral;
  border-radius: $radius-round;
  min-height: 82rpx;
  padding: 0 56rpx;
  @include flex-center;
  box-shadow: $shadow-coral;

  &.disabled {
    opacity: 0.6;
    pointer-events: none;
  }
}

.submit-text {
  color: #FFFFFF;
  font-size: $font-md;
  font-weight: 700;
}

.coupon-mask {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(58, 48, 44, 0.42);
  z-index: 999;
  display: flex;
  align-items: flex-end;
}

.coupon-popup {
  width: 100%;
  max-height: 70vh;
  background: $bg-page;
  border-radius: $radius-xxl $radius-xxl 0 0;
  display: flex;
  flex-direction: column;
}

.popup-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: $spacing-md $spacing-lg;
  border-bottom: 1rpx solid $divider-color;
}

.popup-title {
  font-size: $font-lg;
  font-weight: 600;
  color: $text-color;
}

.popup-close {
  font-size: $font-lg;
  color: $text-hint;
  padding: $spacing-xs;
}

.popup-body {
  flex: 1;
  padding: $spacing-sm $spacing-md;
  max-height: 60vh;
}

.coupon-item {
  display: flex;
  align-items: center;
  padding: $spacing-md;
  margin-bottom: $spacing-sm;
  border-radius: $radius-xl;
  border: 2rpx solid rgba($border-color, 0.9);
  background: rgba(255, 255, 255, 0.82);

  &.active {
    border-color: $primary-color;
    background: rgba($primary-color, 0.07);
  }
}

.coupon-item-left {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-right: $spacing-md;
  min-width: 120rpx;
}

.coupon-item-value {
  font-size: $font-xl;
  font-weight: 700;
  color: $price-color;
}

.coupon-item-condition {
  font-size: $font-xs;
  color: $text-hint;
  margin-top: 4rpx;
}

.coupon-item-info {
  flex: 1;
}

.coupon-item-name {
  font-size: $font-md;
  color: $text-color;
  display: block;
}

.coupon-item-time {
  font-size: $font-xs;
  color: $text-hint;
  margin-top: 4rpx;
  display: block;
}

.coupon-check {
  font-size: $font-lg;
  color: $primary-color;
  margin-left: $spacing-sm;
}

.coupon-empty {
  padding: $spacing-xl 0;
  text-align: center;
}

.coupon-empty-text {
  font-size: $font-sm;
  color: $text-hint;
}
</style>
