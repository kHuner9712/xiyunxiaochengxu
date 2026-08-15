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
      <text class="result-subtext">{{ resultSubtext }}</text>
    </view>

    <view
      v-if="paymentState === 'success' && orderInfo?.status === 'pending_pickup' && orderInfo?.fulfillmentType === 'pickup'"
      class="pickup-tip card"
    >
      <text class="tip-text">请到店出示自提码取货</text>
      <view v-if="orderInfo.pickupCode" class="tip-code">
        <text class="tip-code-label">自提码</text>
        <text class="tip-code-text">{{ orderInfo.pickupCode }}</text>
      </view>
    </view>

    <view v-if="paymentState === 'success' && orderInfo?.status === 'paid'" class="group-tip card">
      <text class="tip-text">已付款，正在等待拼团成团</text>
      <text class="group-tip-subtext">成团后订单才会进入发货或自提流程；若拼团失败，系统会按规则自动退款。</text>
      <view v-if="resolvedGroupId" class="group-progress-link" @tap="goGroupProgress">查看拼团进度</view>
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
      <view class="btn-outline" @tap="goPrimaryDetail">
        <text class="btn-text">{{ resolvedGroupId && paymentState === 'success' ? '查看拼团' : '查看订单' }}</text>
      </view>
      <view class="btn-primary" @tap="goHome">
        <text class="btn-text-white">返回首页</text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad, onUnload, onHide, onShow } from '@dcloudio/uni-app'
import { getOrderDetail, type OrderDetail } from '@/api/order'
import { getPaymentStatus } from '@/api/payment'
import { formatPrice } from '@/utils/format'

type PaymentState = 'confirming' | 'success' | 'failed' | 'pending' | 'unknown'

const orderId = ref('')
const groupId = ref('')
const orderInfo = ref<OrderDetail | null>(null)
const checking = ref(true)
const paymentState = ref<PaymentState>('confirming')
const pollAttempt = ref(0)
const maxPollCount = 6
const pollIntervalMs = 2000
let pollTimer: ReturnType<typeof setTimeout> | null = null
let pollSleepResolve: (() => void) | null = null
let pollGeneration = 0
let pollingActive = false
const payIntent = ref('')
const zeroPay = ref(false)

const resolvedGroupId = computed(() => groupId.value || orderInfo.value?.groupBuyGroupId || '')

const resultText = computed(() => {
  if (checking.value || paymentState.value === 'confirming') return '正在确认支付结果...'
  if (zeroPay.value && paymentState.value === 'success') {
    return orderInfo.value?.status === 'paid' ? '订单已提交，等待拼团成团' : '订单提交成功'
  }
  if (paymentState.value === 'success') {
    return orderInfo.value?.status === 'paid' ? '支付成功，等待拼团成团' : '支付成功'
  }
  if (paymentState.value === 'pending') return '支付结果确认中，请稍后在订单详情查看'
  if (paymentState.value === 'failed') return '支付失败'
  return '支付结果未知，请稍后在订单详情查看'
})

const resultSubtext = computed(() => {
  if (paymentState.value === 'success' && orderInfo.value?.status === 'paid') {
    return '当前仅代表付款成功，尚未进入发货或自提状态'
  }
  return '订单状态可能有短暂延迟，请以订单详情为准'
})

function stopPolling() {
  pollGeneration += 1
  pollingActive = false
  if (pollTimer) {
    clearTimeout(pollTimer)
    pollTimer = null
  }
  if (pollSleepResolve) {
    const resolve = pollSleepResolve
    pollSleepResolve = null
    resolve()
  }
}

function waitForNextPoll(generation: number): Promise<void> {
  if (generation !== pollGeneration) return Promise.resolve()
  return new Promise<void>((resolve) => {
    let settled = false
    const finish = () => {
      if (settled) return
      settled = true
      if (pollSleepResolve === finish) pollSleepResolve = null
      if (pollTimer) {
        clearTimeout(pollTimer)
        pollTimer = null
      }
      resolve()
    }
    pollSleepResolve = finish
    pollTimer = setTimeout(finish, pollIntervalMs)
  })
}

function mapStatusToState(status: any): PaymentState {
  if (status.displayStatus === 'success') return 'success'
  if (status.displayStatus === 'closed' || status.displayStatus === 'failed' || status.displayStatus === 'cancelled') return 'failed'
  if (status.displayStatus === 'pending' || status.displayStatus === 'confirming' || status.confirming) return 'confirming'
  if (
    status.orderStatus === 'paid' ||
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

function mapZeroPayOrderToState(detail: OrderDetail): PaymentState {
  if (Number(detail.payAmount) !== 0) return 'unknown'
  if (
    detail.status === 'paid' ||
    detail.status === 'pending_delivery' ||
    detail.status === 'pending_pickup' ||
    detail.status === 'delivered' ||
    detail.status === 'completed'
  ) {
    return 'success'
  }
  if (detail.status === 'cancelled') return 'failed'
  return 'unknown'
}

async function checkPaymentStatusOnce(generation: number) {
  try {
    const status = await getPaymentStatus(orderId.value)
    if (generation !== pollGeneration) return null
    paymentState.value = mapStatusToState(status)
    return status
  } catch {
    if (generation !== pollGeneration) return null
    paymentState.value = 'unknown'
    return null
  }
}

async function loadOrder(generation?: number) {
  try {
    const detail = await getOrderDetail(orderId.value)
    if (generation !== undefined && generation !== pollGeneration) return
    orderInfo.value = detail
  } catch (e: any) {
    if (generation !== undefined && generation !== pollGeneration) return
    uni.showToast({ title: e.message || '订单信息加载失败', icon: 'none' })
  }
}

async function loadZeroPayOrder() {
  const generation = ++pollGeneration
  checking.value = true
  try {
    const detail = await getOrderDetail(orderId.value)
    if (generation !== pollGeneration) return
    orderInfo.value = detail
    paymentState.value = mapZeroPayOrderToState(detail)
  } catch (e: any) {
    if (generation !== pollGeneration) return
    paymentState.value = 'unknown'
    uni.showToast({ title: e.message || '订单信息加载失败', icon: 'none' })
  } finally {
    if (generation === pollGeneration) checking.value = false
  }
}

async function startPollingStatus() {
  if (pollingActive || zeroPay.value || !orderId.value) return

  const generation = ++pollGeneration
  pollingActive = true
  checking.value = true
  pollAttempt.value = 0

  try {
    while (generation === pollGeneration && pollAttempt.value < maxPollCount) {
      pollAttempt.value++
      const status = await checkPaymentStatusOnce(generation)
      if (generation !== pollGeneration) return

      if (paymentState.value === 'success' || paymentState.value === 'failed') {
        checking.value = false
        await loadOrder(generation)
        return
      }

      if (
        status?.displayStatus === 'pending'
        || status?.displayStatus === 'confirming'
        || status?.confirming
        || paymentState.value === 'confirming'
        || paymentState.value === 'unknown'
      ) {
        await waitForNextPoll(generation)
      }
    }

    if (generation !== pollGeneration) return
    checking.value = false
    if (paymentState.value !== 'success' && paymentState.value !== 'failed') {
      paymentState.value = 'pending'
    }
    await loadOrder(generation)
  } finally {
    if (generation === pollGeneration) {
      pollingActive = false
      if (pollTimer) {
        clearTimeout(pollTimer)
        pollTimer = null
      }
      pollSleepResolve = null
    }
  }
}

function goOrderDetail() {
  stopPolling()
  uni.redirectTo({ url: `/pages/order/detail?id=${orderId.value}` })
}

function goGroupProgress() {
  stopPolling()
  if (!resolvedGroupId.value) {
    goOrderDetail()
    return
  }
  uni.redirectTo({ url: `/pages/group-buy/group?id=${resolvedGroupId.value}` })
}

function goPrimaryDetail() {
  if (resolvedGroupId.value && paymentState.value === 'success') {
    goGroupProgress()
    return
  }
  goOrderDetail()
}

function goHome() {
  stopPolling()
  uni.switchTab({ url: '/pages/home/index' })
}

onLoad((options) => {
  if (options?.orderId) orderId.value = String(options.orderId)
  if (options?.groupId) groupId.value = String(options.groupId)
  if (options?.payIntent) payIntent.value = String(options.payIntent)
  zeroPay.value = options?.zeroPay === '1'

  if (!/^[1-9]\d*$/.test(orderId.value)) {
    checking.value = false
    paymentState.value = 'unknown'
    uni.showToast({ title: '订单参数无效，请返回订单列表重试', icon: 'none' })
    uni.redirectTo({ url: '/pages/order/list' })
    return
  }

  if (payIntent.value === 'cancel') {
    uni.showToast({ title: '已取消支付，可稍后继续支付', icon: 'none' })
  }
  if (zeroPay.value) {
    void loadZeroPayOrder()
    return
  }
  void startPollingStatus()
})

onHide(() => {
  stopPolling()
})

onShow(() => {
  if (zeroPay.value) {
    if (orderId.value && paymentState.value !== 'success' && paymentState.value !== 'failed') {
      void loadZeroPayOrder()
    }
    return
  }
  if (orderId.value && paymentState.value !== 'success' && paymentState.value !== 'failed') {
    void startPollingStatus()
  }
})

onUnload(() => {
  stopPolling()
})

defineExpose({
  orderInfo,
  checking,
  paymentState,
  zeroPay,
  mapZeroPayOrderToState,
  loadZeroPayOrder,
  startPollingStatus,
})
</script>

<style lang="scss" scoped>
.pay-result-page {
  @include flex-center;
  @include flex-column;
  min-height: 100vh;
  padding: 96rpx $spacing-md $spacing-xl;
}

.result-card {
  width: 100%;
  @include flex-center;
  @include flex-column;
  padding: $spacing-xl $spacing-md;
  margin-bottom: $spacing-md;
  border-radius: $radius-xxl;
  background:
    radial-gradient(circle at 50% 0%, rgba($success-color, 0.14) 0%, rgba($success-color, 0) 220rpx),
    $gradient-card;
  border: 1rpx solid rgba($border-color, 0.78);
  box-shadow: $shadow-md;
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
  background: $success-dark;
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

.pickup-tip,
.group-tip {
  width: 100%;
  text-align: center;
  padding: $spacing-lg $spacing-md;
  background: $gradient-sage;
  border: 2rpx solid rgba($primary-color, 0.18);
  border-radius: $radius-xxl;
  margin-bottom: $spacing-md;
}

.tip-text {
  font-size: $font-md;
  color: $success-dark;
  font-weight: 600;
  display: block;
  margin-bottom: $spacing-sm;
}

.group-tip-subtext {
  display: block;
  font-size: $font-xs;
  color: $text-secondary;
  line-height: 1.6;
}

.group-progress-link {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 60rpx;
  margin-top: $spacing-sm;
  padding: 0 28rpx;
  border-radius: $radius-round;
  background: rgba(255, 255, 255, 0.9);
  color: $primary-dark;
  font-size: $font-sm;
  font-weight: 700;
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
    color: $price-color;
    font-weight: 800;
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