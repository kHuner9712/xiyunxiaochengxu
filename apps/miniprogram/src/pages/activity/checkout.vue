<template>
  <view class="checkout-page page-shell">
    <view class="page-head">
      <text class="page-title">活动确认订单</text>
      <text class="page-subtitle">价格、库存、赠品、套餐构成和限购均由服务器实时核验</text>
    </view>

    <view class="notice-card card">
      <text class="notice-title">{{ preview?.promotionLabel || activity?.name || '活动优惠' }}</text>
      <text class="notice-desc">活动订单不与普通优惠券、积分抵扣叠加，最终金额以本页实时试算为准。</text>
    </view>

    <view v-if="fulfillmentType === 'delivery'" class="card selector-card" @tap="selectAddress">
      <template v-if="address">
        <view class="selector-topline">
          <text class="selector-title">{{ address.name }} {{ address.phone }}</text>
          <text class="selector-action">更换</text>
        </view>
        <text class="selector-desc">{{ address.province }}{{ address.city }}{{ address.district }}{{ address.detail }}</text>
      </template>
      <template v-else>
        <text class="selector-title">请选择收货地址</text>
        <text class="selector-action">去选择 ›</text>
      </template>
    </view>

    <view v-else class="card selector-card" @tap="selectPickupStore">
      <template v-if="pickupStore">
        <view class="selector-topline">
          <text class="selector-title">{{ pickupStore.name }}</text>
          <text class="selector-action">更换</text>
        </view>
        <text class="selector-desc">{{ pickupStore.fullAddress || `${pickupStore.province}${pickupStore.city}${pickupStore.district}${pickupStore.address}` }}</text>
        <text v-if="pickupStore.businessHours" class="selector-extra">营业时间：{{ pickupStore.businessHours }}</text>
      </template>
      <template v-else>
        <text class="selector-title">请选择自提点</text>
        <text class="selector-action">去选择 ›</text>
      </template>
    </view>

    <view class="card items-card">
      <view class="section-head">
        <text class="section-title">{{ activity?.type === '4' ? '套餐商品' : '活动商品' }}</text>
        <text v-if="activity?.type === '3'" class="section-tip">命中门槛后赠品自动加入</text>
      </view>

      <view v-if="displayItems.length" class="item-list">
        <view v-for="item in displayItems" :key="`${item.skuId}-${item.isGift ? 'gift' : 'paid'}`" class="order-item">
          <image class="product-image" :src="item.productImage || '/static/default-cover.png'" mode="aspectFill" />
          <view class="product-main">
            <view class="name-row">
              <text class="product-name">{{ item.productName }}</text>
              <text v-if="item.isGift" class="gift-tag">赠品</text>
            </view>
            <text v-if="item.skuSpecText" class="sku-text">{{ item.skuSpecText }}</text>
            <view class="price-row">
              <text class="activity-price">{{ item.isGift ? '¥0.00' : `¥${formatPrice(item.price)}` }}</text>
              <text v-if="item.originalPrice > item.price" class="original-price">¥{{ formatPrice(item.originalPrice) }}</text>
              <text class="item-qty">× {{ item.quantity }}</text>
            </view>
          </view>
        </view>
      </view>
      <view v-else-if="product" class="order-item">
        <image class="product-image" :src="product.image || '/static/default-cover.png'" mode="aspectFill" />
        <view class="product-main">
          <text class="product-name">{{ product.name }}</text>
          <view class="price-row"><text class="activity-price">¥{{ formatPrice(product.price) }}</text></view>
        </view>
      </view>

      <view class="quantity-row">
        <text class="quantity-label">{{ activity?.type === '4' ? '套餐数量' : '购买数量' }}</text>
        <view class="stepper">
          <button class="stepper-btn" :disabled="quantity <= 1 || loading" @tap.stop="changeQuantity(-1)">−</button>
          <text class="stepper-value">{{ quantity }}</text>
          <button class="stepper-btn" :disabled="quantity >= maxQuantity || loading" @tap.stop="changeQuantity(1)">+</button>
        </view>
      </view>
      <text class="stock-note">当前最多可购 {{ maxQuantity }} {{ activity?.type === '4' ? '套' : '件' }}</text>
    </view>

    <view class="card amount-card">
      <view class="amount-row"><text>商品原价</text><text>¥{{ formatPrice(preview?.totalAmount || 0) }}</text></view>
      <view class="amount-row discount"><text>活动优惠</text><text>-¥{{ formatPrice(preview?.activityDiscountAmount || 0) }}</text></view>
      <view class="amount-row"><text>运费</text><text>{{ (preview?.freightAmount || 0) > 0 ? `¥${formatPrice(preview?.freightAmount || 0)}` : '免运费' }}</text></view>
      <view class="amount-divider"></view>
      <view class="amount-row total"><text>应付</text><text>¥{{ formatPrice(preview?.payAmount || 0) }}</text></view>
    </view>

    <view class="card remark-card">
      <text class="field-label">订单备注</text>
      <textarea
        v-model="remark"
        class="remark-input"
        maxlength="500"
        placeholder="选填，请勿填写敏感信息"
        placeholder-class="remark-placeholder"
      />
    </view>

    <view class="legal-row">
      <checkbox-group @change="toggleLegalAgreement">
        <label class="legal-label">
          <checkbox value="agree" :checked="agreedToLegal" color="#F27678" />
          <text>我已阅读并同意</text>
        </label>
      </checkbox-group>
      <text class="legal-link" @tap="openLegal('/pages/agreement/index')">《用户协议》</text>
      <text>与</text>
      <text class="legal-link" @tap="openLegal('/pages/privacy/index')">《隐私政策》</text>
    </view>

    <view class="submit-bar">
      <view class="submit-price">
        <text class="submit-label">应付</text>
        <text class="submit-amount">¥{{ formatPrice(preview?.payAmount || 0) }}</text>
      </view>
      <button class="submit-btn" :disabled="submitting || loading || !preview || maxQuantity <= 0" @tap="handleSubmit">
        {{ submitting ? '提交中...' : (preview?.isZeroPay ? '确认下单' : '立即支付') }}
      </button>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import {
  createActivityOrder,
  getActivityDetail,
  previewActivityOrder,
  type ActivityDetail,
  type ActivityOrderPreview,
  type ActivityProduct,
} from '@/api/activity'
import { getAddressList, type AddressItem } from '@/api/address'
import { type PickupStoreItem } from '@/api/pickup-store'
import { createPayment, wxPay } from '@/api/payment'
import { getPromotionSourceForOrder } from '@/utils/share'
import { formatPrice } from '@/utils/format'
import { useUserStore } from '@/stores/user'

const POSITIVE_ID = /^[1-9]\d*$/
const userStore = useUserStore()
const activityId = ref('')
const activityProductId = ref('')
const skuId = ref('')
const activity = ref<ActivityDetail | null>(null)
const product = ref<ActivityProduct | null>(null)
const quantity = ref(1)
const fulfillmentType = ref<'delivery' | 'pickup'>('delivery')
const address = ref<AddressItem | null>(null)
const pickupStore = ref<PickupStoreItem | null>(null)
const preview = ref<ActivityOrderPreview | null>(null)
const remark = ref('')
const loading = ref(false)
const submitting = ref(false)
const agreedToLegal = ref(false)

const displayItems = computed(() => Array.isArray(preview.value?.items) ? preview.value!.items : [])
const maxQuantity = computed(() => {
  if (Number.isSafeInteger(preview.value?.maxQuantity) && Number(preview.value?.maxQuantity) >= 0) {
    return Math.min(99, Number(preview.value?.maxQuantity))
  }
  const stock = Math.max(0, Number(product.value?.stock || product.value?.activityStock || 0))
  const limit = Number(product.value?.limitPerUser || 0)
  return Math.max(0, Math.min(99, stock, limit > 0 ? limit : 99))
})

function buildCheckoutInput() {
  return {
    activityProductId: activityProductId.value,
    skuId: skuId.value,
    quantity: quantity.value,
    fulfillmentType: fulfillmentType.value,
    addressId: fulfillmentType.value === 'delivery' ? address.value?.id : undefined,
    pickupStoreId: fulfillmentType.value === 'pickup' ? pickupStore.value?.id : undefined,
    ...getPromotionSourceForOrder(),
    remark: remark.value.trim() || undefined,
  }
}

async function loadDefaultAddress() {
  try {
    const list = await getAddressList()
    address.value = list.find((item) => item.isDefault) || list[0] || null
  } catch (error) {
    console.warn('[baby-mall] activity checkout address load failed:', error)
    address.value = null
  }
}

async function loadPreview() {
  if (!activityId.value || !activityProductId.value || !skuId.value) return
  if (fulfillmentType.value === 'delivery' && !address.value) {
    preview.value = null
    return
  }
  if (fulfillmentType.value === 'pickup' && !pickupStore.value) {
    preview.value = null
    return
  }
  loading.value = true
  try {
    preview.value = await previewActivityOrder(activityId.value, buildCheckoutInput())
  } catch (error: any) {
    preview.value = null
    uni.showToast({ title: error?.message || '活动金额试算失败', icon: 'none' })
  } finally {
    loading.value = false
  }
}

async function changeQuantity(delta: number) {
  const next = quantity.value + delta
  if (next < 1 || next > maxQuantity.value) return
  quantity.value = next
  await loadPreview()
}

function selectAddress() {
  uni.navigateTo({
    url: '/pages/address/list?select=true',
    events: {
      selectAddress: (data: AddressItem) => {
        address.value = data
        loadPreview()
      },
    },
  })
}

function selectPickupStore() {
  uni.navigateTo({
    url: '/pages/pickup-store/list?select=true',
    events: {
      selectStore: (data: PickupStoreItem) => {
        pickupStore.value = data
        loadPreview()
      },
    },
  })
}

function toggleLegalAgreement(event: any) {
  agreedToLegal.value = Array.isArray(event?.detail?.value) && event.detail.value.includes('agree')
}

function openLegal(url: string) {
  uni.navigateTo({ url })
}

function isUserCancelPayError(error: any) {
  const message = String(error?.errMsg || error?.message || '').toLowerCase()
  return message.includes('cancel')
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
      success: () => uni.switchTab({ url: '/pages/user/index' }),
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
  if (fulfillmentType.value === 'pickup' && !pickupStore.value) {
    uni.showToast({ title: '请选择自提点', icon: 'none' })
    return
  }
  if (!preview.value || maxQuantity.value <= 0) {
    uni.showToast({ title: '活动金额或库存尚未确认，请重试', icon: 'none' })
    await loadPreview()
    return
  }

  submitting.value = true
  try {
    // Re-preview immediately before create. The server will perform the same checks again inside
    // the write transaction, but this gives the user the newest amount before payment creation.
    preview.value = await previewActivityOrder(activityId.value, buildCheckoutInput())
    const order = await createActivityOrder(activityId.value, buildCheckoutInput())
    if (order.isZeroPay || order.payAmount === 0) {
      uni.redirectTo({ url: `/pages/order/pay-result?orderId=${order.orderId}&payIntent=success&zeroPay=1` })
      return
    }
    try {
      const payment = await createPayment({ orderId: order.orderId })
      try {
        await wxPay(payment)
        uni.redirectTo({ url: `/pages/order/pay-result?orderId=${order.orderId}&payScene=activity&payIntent=success` })
      } catch (payClientError: any) {
        if (isUserCancelPayError(payClientError)) {
          uni.redirectTo({ url: `/pages/order/pay-result?orderId=${order.orderId}&payScene=activity&payIntent=cancel` })
          return
        }
        uni.showModal({
          title: '支付未完成',
          content: '支付发起异常，请在订单详情页继续支付。',
          showCancel: false,
          confirmText: '查看订单',
          success: () => uni.redirectTo({ url: `/pages/order/detail?id=${order.orderId}` }),
        })
      }
    } catch (paymentError: any) {
      uni.showModal({
        title: '支付未完成',
        content: paymentError?.message || '支付发起失败，请在订单详情页继续支付。',
        showCancel: false,
        confirmText: '查看订单',
        success: () => uni.redirectTo({ url: `/pages/order/detail?id=${order.orderId}` }),
      })
    }
  } catch (error: any) {
    uni.showToast({ title: error?.message || '活动下单失败，请重试', icon: 'none' })
    await loadPreview()
  } finally {
    submitting.value = false
  }
}

onLoad(async (options) => {
  const rawActivityId = String(options?.activityId || '').trim()
  const rawActivityProductId = String(options?.activityProductId || '').trim()
  const rawSkuId = String(options?.skuId || '').trim()
  if (![rawActivityId, rawActivityProductId, rawSkuId].every((value) => POSITIVE_ID.test(value))) {
    uni.showToast({ title: '活动商品参数无效', icon: 'none' })
    return
  }
  activityId.value = rawActivityId
  activityProductId.value = rawActivityProductId
  skuId.value = rawSkuId

  try {
    activity.value = await getActivityDetail(activityId.value)
    const found = (activity.value.products || []).find((item) =>
      String(item.activityProductId || '') === activityProductId.value &&
      String(item.skuId || '') === skuId.value,
    )
    if (!found) throw new Error('活动商品已调整或下架')
    product.value = found
    fulfillmentType.value = found.fulfillmentType === 'pickup' ? 'pickup' : 'delivery'
    quantity.value = 1
    if (fulfillmentType.value === 'delivery') {
      await loadDefaultAddress()
      await loadPreview()
    }
  } catch (error: any) {
    uni.showToast({ title: error?.message || '活动商品加载失败', icon: 'none' })
  }
})
</script>

<style lang="scss" scoped>
.checkout-page { min-height: 100vh; padding: 24rpx 24rpx 190rpx; }
.page-head { padding: 8rpx 4rpx 20rpx; }
.page-title { display: block; font-size: 40rpx; font-weight: 900; color: $text-color; }
.page-subtitle { display: block; margin-top: 8rpx; font-size: $font-sm; color: $text-secondary; }
.card { margin-bottom: 18rpx; padding: 24rpx; border-radius: $radius-xl; background: #fff; box-shadow: $shadow-xs; }
.notice-card { background: rgba($primary-color, .08); }
.notice-title { display: block; color: $primary-dark; font-size: $font-md; font-weight: 800; }
.notice-desc { display: block; margin-top: 8rpx; color: $text-secondary; font-size: $font-xs; line-height: 1.6; }
.selector-topline, .section-head, .quantity-row, .amount-row, .name-row { display: flex; align-items: center; justify-content: space-between; gap: 12rpx; }
.selector-title { color: $text-color; font-size: $font-md; font-weight: 800; }
.selector-action { color: $primary-dark; font-size: $font-sm; }
.selector-desc, .selector-extra { display: block; margin-top: 8rpx; color: $text-secondary; font-size: $font-sm; line-height: 1.6; }
.section-title { color: $text-color; font-size: $font-md; font-weight: 900; }
.section-tip { color: $primary-dark; font-size: $font-xs; }
.item-list { margin-top: 12rpx; }
.order-item { display: flex; gap: 18rpx; padding: 16rpx 0; border-bottom: 1rpx solid $border-color; }
.order-item:last-child { border-bottom: 0; }
.product-image { width: 150rpx; height: 150rpx; flex-shrink: 0; border-radius: $radius-lg; background: $bg-ivory; }
.product-main { flex: 1; min-width: 0; }
.product-name { color: $text-color; font-size: $font-md; font-weight: 800; line-height: 1.45; }
.gift-tag { flex-shrink: 0; padding: 4rpx 10rpx; border-radius: $radius-round; background: $primary-soft; color: $primary-dark; font-size: $font-xs; font-weight: 800; }
.sku-text, .stock-note { display: block; margin-top: 8rpx; color: $text-hint; font-size: $font-xs; }
.price-row { display: flex; align-items: baseline; gap: 10rpx; margin-top: 12rpx; }
.activity-price { color: $primary-dark; font-size: $font-lg; font-weight: 900; }
.original-price { color: $text-hint; font-size: $font-xs; text-decoration: line-through; }
.item-qty { margin-left: auto; color: $text-secondary; font-size: $font-sm; }
.quantity-row { margin-top: 20rpx; padding-top: 18rpx; border-top: 1rpx solid $border-color; }
.quantity-label { color: $text-color; font-weight: 800; }
.stepper { display: flex; align-items: center; gap: 16rpx; }
.stepper-btn { width: 60rpx; height: 54rpx; padding: 0; border: 0; border-radius: 14rpx; background: $bg-ivory; color: $text-color; line-height: 54rpx; }
.stepper-btn::after { border: 0; }
.stepper-value { min-width: 44rpx; text-align: center; font-weight: 800; }
.amount-row { padding: 10rpx 0; color: $text-secondary; font-size: $font-sm; }
.amount-row.discount { color: $primary-dark; }
.amount-divider { height: 1rpx; margin: 8rpx 0; background: $border-color; }
.amount-row.total { color: $text-color; font-size: $font-md; font-weight: 900; }
.field-label { display: block; margin-bottom: 12rpx; color: $text-color; font-size: $font-sm; font-weight: 800; }
.remark-input { width: 100%; min-height: 130rpx; padding: 18rpx; box-sizing: border-box; border-radius: $radius-lg; background: $bg-ivory; font-size: $font-sm; }
.legal-row { display: flex; align-items: center; justify-content: center; flex-wrap: wrap; gap: 4rpx; padding: 12rpx 4rpx; color: $text-secondary; font-size: $font-xs; }
.legal-label { display: flex; align-items: center; }
.legal-link { color: $primary-dark; }
.submit-bar { position: fixed; left: 0; right: 0; bottom: 0; z-index: 20; display: flex; align-items: center; justify-content: space-between; gap: 20rpx; padding: 18rpx 28rpx calc(18rpx + env(safe-area-inset-bottom)); background: rgba(255,255,255,.98); box-shadow: 0 -8rpx 24rpx rgba(0,0,0,.06); }
.submit-label { display: block; color: $text-hint; font-size: $font-xs; }
.submit-amount { display: block; margin-top: 2rpx; color: $primary-dark; font-size: 38rpx; font-weight: 900; }
.submit-btn { min-width: 260rpx; height: 82rpx; border: 0; border-radius: $radius-round; background: $gradient-coral; color: #fff; font-size: $font-md; font-weight: 900; line-height: 82rpx; }
.submit-btn::after { border: 0; }
.submit-btn[disabled] { opacity: .48; }
</style>
