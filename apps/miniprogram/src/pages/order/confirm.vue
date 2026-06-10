<template>
  <view class="confirm-page page-shell">
    <view class="confirm-head">
      <text class="confirm-title">确认订单</text>
      <text class="confirm-subtitle">自营母婴好物 · 安心履约</text>
    </view>

    <view class="trust-strip">
      <view class="trust-item">
        <text class="trust-dot">正</text>
        <text class="trust-text">自营正品</text>
      </view>
      <view class="trust-item">
        <text class="trust-dot sage">售</text>
        <text class="trust-text">售后无忧</text>
      </view>
      <view class="trust-item">
        <text class="trust-dot peach">配</text>
        <text class="trust-text">安心履约</text>
      </view>
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
        <text class="address-label">收货地址</text>
        <view class="address-top">
          <text class="address-name">{{ address.name }}</text>
          <text class="address-phone">{{ address.phone }}</text>
        </view>
        <text class="address-detail">{{ address.province }}{{ address.city }}{{ address.district }}{{ address.detail }}</text>
      </view>
      <view v-else class="no-address">
        <text class="no-address-title">请选择收货地址</text>
        <text class="no-address-text">完善地址后为你试算运费与优惠</text>
      </view>
      <text class="address-arrow">›</text>
    </view>

    <view v-if="fulfillmentType === 'pickup'" class="pickup-section card" @tap="selectPickupStore">
      <view class="address-badge pickup">提</view>
      <view v-if="selectedPickupStore" class="pickup-info">
        <text class="address-label">自提门店</text>
        <view class="pickup-top">
          <text class="pickup-name">{{ selectedPickupStore.name }}</text>
        </view>
        <text class="pickup-address">{{ selectedPickupStore.fullAddress }}</text>
        <text v-if="selectedPickupStore.businessHours" class="pickup-hours">营业时间：{{ selectedPickupStore.businessHours }}</text>
      </view>
      <view v-else class="no-address">
        <text class="no-address-title">请选择自提点</text>
        <text class="no-address-text">选择后为你确认可履约门店</text>
      </view>
      <text class="address-arrow">›</text>
    </view>

    <view class="products-section card">
      <view class="card-title-row">
        <text class="card-title">商品清单</text>
        <text class="card-subtitle">共 {{ orderItems.length }} 件</text>
      </view>
      <view v-for="item in orderItems" :key="item.skuId" class="product-item">
        <view class="product-image-wrap">
          <image class="product-image" :src="item.productImage || '/static/placeholder.png'" mode="aspectFill" />
        </view>
        <view class="product-info">
          <text class="product-name">{{ item.productName || '商品信息加载中...' }}</text>
          <text class="product-sku">{{ item.skuName }}</text>
          <view class="product-bottom">
            <PriceDisplay :price="item.price" />
            <text class="product-qty">x{{ item.quantity }}</text>
          </view>
        </view>
      </view>
    </view>

    <view class="order-options-section card">
      <view class="option-row" @tap="openCouponPicker">
        <view class="option-copy">
          <text class="section-label">优惠券</text>
          <text class="section-desc">系统将按可用优惠试算</text>
        </view>
        <view class="option-value-wrap">
          <text class="section-value" :class="{ 'coupon-selected': selectedCoupon }">
            <template v-if="selectedCoupon">-¥{{ formatPrice(couponDiscount) }}</template>
            <template v-else-if="couponList.length === 0">暂无可用</template>
            <template v-else>选择优惠券</template>
          </text>
          <text v-if="couponList.length > 0" class="section-arrow">›</text>
        </view>
      </view>

      <view class="option-row">
        <view class="option-copy">
          <text class="section-label">积分抵扣</text>
          <text class="section-desc">{{ pointsDeductDesc }}</text>
        </view>
        <switch :checked="usePoints" :disabled="!canUsePoints" @change="togglePoints" color="#F27678" />
      </view>

      <view class="option-row remark-row">
        <view class="option-copy">
          <text class="section-label">订单备注</text>
          <text class="section-desc">选填，请先和商家协商一致</text>
        </view>
        <input class="remark-input" v-model="remark" placeholder="填写备注" />
      </view>
    </view>

    <view class="price-section card">
      <view class="card-title-row">
        <text class="card-title">金额明细</text>
        <text class="card-subtitle">确认无误后再支付</text>
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
        <text class="price-label">实付款</text>
        <PriceDisplay :price="payAmount" />
      </view>
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
        <view class="bottom-total-main">
          <text class="total-label">实付款</text>
          <PriceDisplay :price="payAmount" size="large" />
        </view>
        <text class="bottom-note">放心支付 · 自营售后</text>
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
import { useUserStore } from '@/stores/user'
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
const userStore = useUserStore()
const usePoints = ref(false)
const remark = ref('')
const availablePoints = ref(userStore.points || 0)
const maxPointsDeduct = ref(0)
const pointsDeductRate = ref(100)
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

const usablePoints = computed(() => Math.max(0, Math.min(availablePoints.value, maxPointsDeduct.value)))

const requestedPointsDeduct = computed(() => {
  const rate = Math.max(1, pointsDeductRate.value)
  return Math.floor(usablePoints.value / rate) * rate
})

const canUsePoints = computed(() => requestedPointsDeduct.value > 0)

const pointsDeductDesc = computed(() => {
  if (availablePoints.value <= 0) return '暂无可用积分'
  if (maxPointsDeduct.value <= 0) return `可用 ${availablePoints.value} 积分，当前订单暂不支持抵扣`
  const rate = Math.max(1, pointsDeductRate.value)
  return `可用 ${availablePoints.value} 积分，抵扣 ¥${(requestedPointsDeduct.value / rate).toFixed(2)}`
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
      pointsDeduct: usePoints.value ? requestedPointsDeduct.value : 0
    })
    preview.value = data
    availablePoints.value = data.availablePoints ?? availablePoints.value
    maxPointsDeduct.value = data.maxPointsDeduct ?? maxPointsDeduct.value
    pointsDeductRate.value = data.pointsDeductRate ?? pointsDeductRate.value
    if (usePoints.value && (!data.pointsDeducted || data.pointsDeducted <= 0)) {
      usePoints.value = false
    }
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
    console.error('[baby-mall] order confirm loadPreview failed:', e)
    if (usePoints.value) usePoints.value = false
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
  if (type === 'delivery') {
    selectedPickupStore.value = null
  }
  if (type === 'pickup') {
    address.value = null
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
  const checked = !!e.detail.value
  if (checked && availablePoints.value <= 0) {
    usePoints.value = false
    uni.showToast({ title: '暂无可用积分', icon: 'none' })
    return
  }
  if (checked && !canUsePoints.value) {
    usePoints.value = false
    uni.showToast({ title: '当前订单暂不支持积分抵扣', icon: 'none' })
    return
  }
  usePoints.value = checked
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
  if (!userStore.isLoggedIn) {
    userStore.requireLogin(() => {})
    return
  }
  if (!userStore.phone) {
    uni.showModal({
      title: '需要绑定手机号',
      content: '请先在“我的”页面绑定手机号，方便订单履约和售后联系。',
      showCancel: false,
      confirmText: '去绑定',
      success: () => {
        uni.switchTab({ url: '/pages/user/index' })
      }
    })
    return
  }
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
  if (usePoints.value && !canUsePoints.value) {
    uni.showToast({ title: availablePoints.value > 0 ? '当前订单暂不支持积分抵扣' : '暂无可用积分', icon: 'none' })
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
      pointsDeduct: usePoints.value ? requestedPointsDeduct.value : 0,
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
    console.error('[baby-mall] order confirm submit failed:', e)
    uni.showToast({ title: e.message || '下单失败，请重试', icon: 'none' })
  } finally {
    submitting.value = false
  }
}

defineExpose({
  handleSubmit,
  loadPreview,
  selectAddress,
  selectPickupStore,
  agreedToLegal,
  fulfillmentType,
  address,
  selectedPickupStore,
  orderItems,
  preview,
  usePoints,
  availablePoints,
  maxPointsDeduct,
  pointsDeduct,
  payAmount,
  togglePoints
})

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
  padding-bottom: calc(188rpx + constant(safe-area-inset-bottom));
  padding-bottom: calc(188rpx + env(safe-area-inset-bottom));
}

.confirm-head {
  padding: 34rpx $spacing-md 16rpx;
}

.confirm-title {
  display: block;
  font-size: 42rpx;
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

.trust-strip {
  display: flex;
  align-items: center;
  gap: 10rpx;
  margin: 0 $spacing-md $spacing-sm;
  padding: 10rpx;
  border-radius: $radius-round;
  background: rgba(255, 255, 255, 0.72);
  border: 1rpx solid rgba(255, 255, 255, 0.78);
  box-shadow: $shadow-xs;
}

.trust-item {
  @include flex-center;
  flex: 1;
  min-width: 0;
  min-height: 54rpx;
  padding: 0 8rpx;
  border-radius: $radius-round;
  background: rgba(255, 250, 246, 0.84);
}

.trust-dot {
  @include flex-center;
  width: 30rpx;
  height: 30rpx;
  margin-right: 6rpx;
  border-radius: 50%;
  background: $primary-soft;
  color: $primary-dark;
  font-size: 18rpx;
  font-weight: 900;
  flex-shrink: 0;

  &.sage {
    background: $success-soft;
    color: $success-dark;
  }

  &.peach {
    background: $secondary-soft;
    color: $secondary-color;
  }
}

.trust-text {
  font-size: $font-xs;
  color: $text-secondary;
  font-weight: 700;
  @include text-ellipsis;
}

.address-section {
  display: flex;
  align-items: flex-start;
  margin: $spacing-sm $spacing-md;
  background:
    radial-gradient(circle at 88% 0%, rgba($primary-color, 0.12) 0%, rgba($primary-color, 0) 220rpx),
    $gradient-card;
  border-color: rgba(255, 255, 255, 0.78);
  box-shadow: $shadow-md;
}

.delivery-mode-section {
  margin: $spacing-sm $spacing-md;
  background:
    radial-gradient(circle at 8% 0%, rgba($success-color, 0.12), rgba($success-color, 0) 180rpx),
    rgba(255, 255, 255, 0.86);
  border-color: rgba(255, 255, 255, 0.78);
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
  color: $text-secondary;

  &.active {
    border-color: rgba($primary-color, 0.32);
    background: $primary-soft;
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
  box-shadow: $shadow-md;
}

.address-badge {
  @include flex-center;
  width: 62rpx;
  height: 62rpx;
  border-radius: 24rpx;
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
  min-width: 0;
}

.pickup-top {
  margin-bottom: 8rpx;
}

.pickup-name {
  font-size: $font-md;
  font-weight: 600;
  color: $text-color;
  @include text-ellipsis;
}

.pickup-address {
  font-size: $font-sm;
  color: $text-secondary;
  display: block;
  line-height: 1.55;
}

.pickup-hours {
  font-size: $font-xs;
  color: $text-hint;
  display: block;
  margin-top: 4rpx;
}

.address-info {
  flex: 1;
  min-width: 0;
}

.address-label {
  display: inline-flex;
  align-items: center;
  min-height: 34rpx;
  padding: 0 14rpx;
  margin-bottom: 10rpx;
  border-radius: $radius-round;
  background: rgba($success-color, 0.12);
  color: $success-dark;
  font-size: 18rpx;
  font-weight: 800;
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
  max-width: 220rpx;
  @include text-ellipsis;
}

.address-phone {
  font-size: $font-sm;
  color: $text-secondary;
}

.address-detail {
  font-size: $font-sm;
  color: $text-secondary;
  line-height: 1.55;
  display: block;
}

.no-address {
  flex: 1;
  min-width: 0;
}

.no-address-title {
  display: block;
  font-size: $font-md;
  color: $text-color;
  font-weight: 800;
}

.no-address-text {
  display: block;
  margin-top: 8rpx;
  font-size: $font-sm;
  color: $text-secondary;
}

.address-arrow {
  font-size: $font-lg;
  color: $text-hint;
  margin-left: $spacing-sm;
}

.products-section {
  margin: $spacing-sm $spacing-md;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.94) 0%, rgba(255, 252, 248, 0.94) 100%);
  border-color: rgba(255, 255, 255, 0.78);
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
  padding: $spacing-md 0 22rpx;
  border-bottom: 1rpx solid $divider-color;

  &:last-child {
    border-bottom: none;
    padding-bottom: 0;
  }
}

.product-image-wrap {
  width: 164rpx;
  height: 164rpx;
  border-radius: 28rpx;
  flex-shrink: 0;
  overflow: hidden;
  background: $bg-ivory;
  border: 1rpx solid rgba($border-color, 0.62);
}

.product-image {
  width: 100%;
  height: 100%;
  border-radius: 28rpx;
  background: $bg-ivory;
}

.product-info {
  flex: 1;
  margin-left: $spacing-sm;
  min-width: 0;
}

.product-name {
  font-size: $font-md;
  color: $text-color;
  font-weight: 600;
  @include text-ellipsis-2;
  display: block;
  line-height: 1.42;
}

.product-sku {
  font-size: $font-xs;
  color: $text-secondary;
  margin-top: 8rpx;
  display: inline-flex;
  max-width: 100%;
  padding: 6rpx 14rpx;
  border-radius: $radius-round;
  background: $primary-soft;
  border: 1rpx solid rgba($primary-color, 0.12);
  @include text-ellipsis;
}

.product-bottom {
  @include flex-between;
  align-items: flex-end;
  margin-top: $spacing-sm;
  gap: $spacing-sm;
}

.product-qty {
  font-size: $font-sm;
  color: $text-hint;
}

.order-options-section,
.legal-section {
  margin: $spacing-sm $spacing-md;
  background: rgba(255, 255, 255, 0.86);
  border-color: rgba(255, 255, 255, 0.78);
}

.option-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 94rpx;
  padding: 18rpx 0;
  border-bottom: 1rpx solid $divider-color;

  &:first-child {
    padding-top: 0;
  }

  &:last-child {
    padding-bottom: 0;
    border-bottom: none;
  }
}

.option-copy {
  flex: 1;
  min-width: 0;
  padding-right: $spacing-sm;
}

.option-value-wrap {
  display: flex;
  align-items: center;
  max-width: 300rpx;
  flex-shrink: 0;
}

.section-label {
  display: block;
  font-size: $font-md;
  color: $text-color;
  font-weight: 800;
}

.section-desc {
  display: block;
  margin-top: 6rpx;
  color: $text-hint;
  font-size: $font-xs;
  @include text-ellipsis;
}

.section-value {
  font-size: $font-sm;
  color: $text-hint;
  text-align: right;
  @include text-ellipsis;

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

.remark-input {
  width: 260rpx;
  font-size: $font-sm;
  text-align: right;
  color: $text-color;
  flex-shrink: 0;
}

.legal-section {
  display: flex;
  align-items: flex-start;
  background: rgba(255, 255, 255, 0.78);
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
    radial-gradient(circle at 88% 0%, rgba($primary-color, 0.1) 0%, rgba($primary-color, 0) 220rpx),
    linear-gradient(180deg, rgba(255, 255, 255, 0.96) 0%, rgba(255, 246, 241, 0.94) 100%);
  border-color: rgba(255, 255, 255, 0.78);
  box-shadow: $shadow-md;
}

.price-row {
  @include flex-between;
  padding: 12rpx 0;

  &.total {
    margin-top: 10rpx;
    padding-top: $spacing-md;
    border-top: 1rpx solid $divider-color;

    .price-label {
      color: $text-color;
      font-weight: 800;
      font-size: $font-md;
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
  min-height: 144rpx;
  padding-top: 14rpx;
  padding-bottom: calc(14rpx + constant(safe-area-inset-bottom));
  padding-bottom: calc(14rpx + env(safe-area-inset-bottom));
}

.total-row {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  margin-right: $spacing-md;
  min-width: 0;
  flex: 1;
}

.bottom-total-main {
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

.bottom-note {
  display: block;
  margin-top: 6rpx;
  font-size: 18rpx;
  color: $text-hint;
  max-width: 310rpx;
  @include text-ellipsis;
}

.submit-btn {
  background: $gradient-coral;
  border-radius: $radius-round;
  min-width: 230rpx;
  min-height: 84rpx;
  padding: 0 42rpx;
  @include flex-center;
  box-shadow: $shadow-coral;
  flex-shrink: 0;

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
  background: rgba(58, 48, 44, 0.46);
  z-index: 999;
  display: flex;
  align-items: flex-end;
}

.coupon-popup {
  width: 100%;
  max-height: 70vh;
  background:
    radial-gradient(circle at 14% 0%, rgba($primary-color, 0.12), rgba($primary-color, 0) 260rpx),
    $bg-page;
  border-radius: 44rpx 44rpx 0 0;
  display: flex;
  flex-direction: column;
  box-shadow: 0 -24rpx 60rpx rgba(92, 64, 52, 0.18);
  border-top: 1rpx solid rgba(255, 255, 255, 0.78);
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
  @include safe-bottom;
}

.coupon-item {
  display: flex;
  align-items: center;
  padding: $spacing-md;
  margin-bottom: $spacing-sm;
  border-radius: $radius-xl;
  border: 2rpx solid rgba($border-color, 0.9);
  background: rgba(255, 255, 255, 0.82);
  box-shadow: $shadow-xs;

  &.active {
    border-color: $primary-color;
    background: $primary-soft;
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
