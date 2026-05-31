<template>
  <view class="pay-result-page page-shell">
    <view class="result-card">
      <view v-if="checking || paymentState === 'confirming'" class="result-icon state-checking">
        <text class="icon-checking">...</text>
      </view>
      <view class="result-icon state-success" v-else-if="paymentState === 'success'">
        <text class="icon-success">✓</text>
      </view>
      <view class="result-icon state-fail" v-else-if="paymentState === 'failed'">
        <text class="icon-fail">✕</text>
      </view>
      <view class="result-icon state-unknown" v-else>
        <text class="icon-fail">?</text>
      </view>

      <text class="result-text">{{ resultText }}</text>
      <text class="result-subtext">订单状态可能有短暂延迟，请以订单详情为准</text>
    </view>

    <view v-if="paymentState === 'success' && orderInfo?.fulfillmentType === 'pickup'" class="pickup-tip card">
      <text class="tip-text">请到店出示自提码取货</text>
      <view v-if="orderInfo.pickupCode" class="tip-code">
        <text class="tip-code-label">自提码</text>
        <text class="tip-code-text">{{ orderInfo.pickupCode }}</text>
      </view>
    </view>

    <view v-if="orderInfo" class="order-info card">
      <view class="info-row">
        <text class="info-label">订单编号</text>
        <text class="info-value">{{ orderInfo.orderNo }}</text>
      </view>
      <view class="info-row">
        <text class="info-label">支付金额</text>
        <text class="info-value price">¥{{ formatPrice(orderInfo.payAmount) }}</text>
      </view>
      <view v-if="orderInfo.payTime" class="info-row">
        <text class="info-label">支付时间</text>
        <text class="info-value">{{ orderInfo.payTime }}</text>
      </view>
    </view>

    <view class="action-btns">
      <view class="btn-outline" @tap="goOrderDetail">
        <text class="btn-text">查看订单</text>
      </view>
      <view class="btn-primary" @tap="goHome">
        <text class="btn-text-white">返回首页</text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad, onUnload } from '@dcloudio/uni-app'
import { getOrderDetail, type OrderDetail } from '@/api/order'
import { getPaymentStatus } from '@/api/payment'
import { formatPrice } from '@/utils/format'

type PaymentState = 'confirming' | 'success' | 'failed' | 'pending' | 'unknown'

const orderId = ref('')
const orderInfo = ref<OrderDetail | null>(null)
const checking = ref(true)
const paymentState = ref<PaymentState>('confirming')
const pollAttempt = ref(0)
const maxPollCount = 6
const pollIntervalMs = 2000
let pollTimer: ReturnType<typeof setTimeout> | null = null
const payIntent = ref('')
const zeroPay = ref(false)

const resultText = computed(() => {
  if (checking.value || paymentState.value === 'confirming') return '正在确认支付结果...'
  if (zeroPay.value && paymentState.value === 'success') return '订单提交成功'
  if (paymentState.value === 'success') return '支付成功'
  if (paymentState.value === 'pending') return '支付结果确认中，请稍后在订单详情查看'
  if (paymentState.value === 'failed') return '支付失败'
  return '支付结果未知，请稍后在订单详情查看'
})

function stopPolling() {
  if (pollTimer) {
    clearTimeout(pollTimer)
    pollTimer = null
  }
}

function mapStatusToState(status: any): PaymentState {
  if (status.displayStatus === 'success') return 'success'
  if (status.displayStatus === 'closed' || status.displayStatus === 'failed' || status.displayStatus === 'cancelled') return 'failed'
  if (status.displayStatus === 'pending' || status.displayStatus === 'confirming' || status.confirming) return 'confirming'
  if (
    status.orderStatus === 'pending_delivery' ||
    status.orderStatus === 'pending_pickup' ||
    status.orderStatus === 'delivered' ||
    status.orderStatus === 'completed' ||
    status.paymentStatus === 2
  ) {
    return 'success'
  }
  if (status.orderStatus === 'pending_payment') return 'confirming'
  return 'unknown'
}

async function checkPaymentStatusOnce() {
  try {
    const status = await getPaymentStatus(orderId.value)
    paymentState.value = mapStatusToState(status)
    return status
  } catch {
    paymentState.value = 'unknown'
    return null
  }
}

async function loadOrder() {
  try {
    orderInfo.value = await getOrderDetail(orderId.value)
  } catch (e: any) {
    uni.showToast({ title: e.message || '订单信息加载失败', icon: 'none' })
  }
}

async function startPollingStatus() {
  checking.value = true
  stopPolling()
  pollAttempt.value = 0

  while (pollAttempt.value < maxPollCount) {
    pollAttempt.value++
    const status = await checkPaymentStatusOnce()
    if (paymentState.value === 'success') {
      checking.value = false
      await loadOrder()
      return
    }
    if (paymentState.value === 'failed') {
      checking.value = false
      await loadOrder()
      return
    }
    if (status?.displayStatus === 'pending' || status?.displayStatus === 'confirming' || status?.confirming || paymentState.value === 'confirming') {
      await new Promise<void>((resolve) => {
        pollTimer = setTimeout(() => resolve(), pollIntervalMs)
      })
      continue
    }
    await new Promise<void>((resolve) => {
      pollTimer = setTimeout(() => resolve(), pollIntervalMs)
    })
  }

  checking.value = false
  if (paymentState.value !== 'success' && paymentState.value !== 'failed') {
    paymentState.value = 'pending'
  }
  await loadOrder()
}

function goOrderDetail() {
  uni.redirectTo({ url: `/pages/order/detail?id=${orderId.value}` })
}

function goHome() {
  uni.switchTab({ url: '/pages/home/index' })
}

onLoad((options) => {
  if (options?.orderId) orderId.value = options.orderId
  if (options?.payIntent) payIntent.value = options.payIntent
  zeroPay.value = options?.zeroPay === '1'
  if (payIntent.value === 'cancel') {
    uni.showToast({ title: '已取消支付，可稍后继续支付', icon: 'none' })
  }
  if (zeroPay.value) {
    paymentState.value = 'success'
    checking.value = false
    loadOrder()
    return
  }
  startPollingStatus()
})

onUnload(() => {
  stopPolling()
})
</script>

<style lang="scss" scoped>
.pay-result-page {
  @include flex-center;
  @include flex-column;
  min-height: 100vh;
  padding: 96rpx $spacing-md 0;
}

.result-card {
  width: 100%;
  @include flex-center;
  @include flex-column;
  padding: $spacing-xl $spacing-md;
  margin-bottom: $spacing-md;
  border-radius: $radius-xxl;
  background: linear-gradient(180deg, #FFFFFF 0%, $bg-soft 100%);
  border: 1rpx solid rgba($border-color, 0.72);
  box-shadow: $shadow-sm;
}

.result-icon {
  width: 148rpx;
  height: 148rpx;
  border-radius: 50%;
  @include flex-center;
  margin-bottom: $spacing-lg;
  background: $bg-white;
  box-shadow: $shadow-md;
}

.icon-checking {
  font-size: 44rpx;
  color: #FFFFFF;
  background: $warning-color;
  width: 104rpx;
  height: 104rpx;
  border-radius: 50%;
  @include flex-center;
}

.icon-success {
  font-size: 60rpx;
  color: #FFFFFF;
  background: $success-color;
  width: 104rpx;
  height: 104rpx;
  border-radius: 50%;
  @include flex-center;
}

.icon-fail {
  font-size: 60rpx;
  color: #FFFFFF;
  background: $danger-color;
  width: 104rpx;
  height: 104rpx;
  border-radius: 50%;
  @include flex-center;
}

.result-text {
  font-size: $font-xl;
  font-weight: 800;
  color: $text-color;
}

.result-subtext {
  font-size: $font-xs;
  color: $text-hint;
  margin-top: $spacing-sm;
  text-align: center;
}

.order-info {
  width: 100%;
}

.pickup-tip {
  width: 100%;
  text-align: center;
  padding: $spacing-lg $spacing-md;
  background: linear-gradient(135deg, $primary-soft, #FFFFFF);
  border: 2rpx solid rgba($primary-color, 0.18);
  border-radius: $radius-xl;
  margin-bottom: $spacing-md;
}

.tip-text {
  font-size: $font-md;
  color: $primary-color;
  font-weight: 600;
  display: block;
  margin-bottom: $spacing-sm;
}

.tip-code {
  display: inline-flex;
  align-items: center;
  gap: $spacing-sm;
  min-height: 92rpx;
  padding: 0 $spacing-lg;
  border-radius: $radius-xl;
  background: $bg-white;
  box-shadow: $shadow-sm;
}

.tip-code-label {
  font-size: $font-xs;
  color: $text-hint;
}

.tip-code-text {
  font-size: $font-xxl;
  font-weight: 800;
  color: $primary-dark;
  letter-spacing: 8rpx;
}

.info-row {
  @include flex-between;
  padding: 12rpx 0;
}

.info-label {
  font-size: $font-sm;
  color: $text-hint;
}

.info-value {
  font-size: $font-sm;
  color: $text-color;

  &.price {
    color: $primary-color;
    font-weight: 600;
  }
}

.action-btns {
  display: flex;
  gap: $spacing-md;
  margin-top: $spacing-xl;
  width: 100%;
}

.btn-outline {
  flex: 1;
  @include ghost-pill-btn;
}

.btn-text {
  color: $primary-color;
  font-size: $font-md;
}

.btn-primary {
  flex: 1;
  @include primary-pill-btn;
}

.btn-text-white {
  color: #FFFFFF;
  font-size: $font-md;
}
</style>
