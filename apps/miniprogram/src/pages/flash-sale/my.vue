<template>
  <view class="my-flash-page page-shell">
    <view v-for="o in orderList" :key="o.id" class="order-card card" @tap="goOrderDetail(o.orderId)">
      <view class="info">
        <view class="row-1">
          <text class="name">秒杀订单 #{{ o.id }}</text>
          <text class="status-tag" :class="`status-${displayStatus(o)}`">{{ statusText(o) }}</text>
        </view>
        <view class="row-2">
          <text class="price">¥{{ formatPrice(o.flashPrice) }}</text>
          <text class="qty">x{{ o.quantity }}</text>
          <text class="amount">合计 ¥{{ formatPrice(o.flashPrice * o.quantity) }}</text>
        </view>
        <view class="row-3">
          <text class="time">{{ formatDateTime(o.createdAt) }} 下单</text>
          <text v-if="o.status === 'pending_payment'" class="remain">锁库存剩 {{ remainTime(o.lockExpireAt) }}</text>
          <text v-else-if="o.status === 'paid' && o.paidAt" class="time">已支付 {{ formatDateTime(o.paidAt) }}</text>
          <text v-else-if="o.status === 'cancelled' && o.cancelledAt" class="time">已取消 {{ formatDateTime(o.cancelledAt) }}</text>
          <text v-else-if="o.status === 'expired' && o.expiredAt" class="time">已过期 {{ formatDateTime(o.expiredAt) }}</text>
        </view>
      </view>
    </view>
    <Loading v-if="loading" />
    <Empty v-if="!loading && orderList.length === 0" text="暂无秒杀订单" />
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { onHide, onReachBottom, onShow, onUnload } from '@dcloudio/uni-app'
import { flashSaleApi, type FlashSaleOrder } from '@/api/flash-sale'
import Loading from '@/components/Loading.vue'
import Empty from '@/components/Empty.vue'

const orderList = ref<FlashSaleOrder[]>([])
const loading = ref(false)
const page = ref(1)
const finished = ref(false)
const nowMs = ref(Date.now())
let clockTimer: ReturnType<typeof setInterval> | null = null

function startClock() {
  stopClock()
  nowMs.value = Date.now()
  clockTimer = setInterval(() => {
    nowMs.value = Date.now()
  }, 1000)
}

function stopClock() {
  if (clockTimer) {
    clearInterval(clockTimer)
    clockTimer = null
  }
}

function formatPrice(cents: number): string {
  return (cents / 100).toFixed(2)
}

function formatDate(s: string): string {
  const d = new Date(s)
  if (isNaN(d.getTime())) return s
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function formatDateTime(s: string): string {
  const d = new Date(s)
  if (isNaN(d.getTime())) return s
  return `${formatDate(s)} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function remainTime(lockExpireAt: string): string {
  const ms = new Date(lockExpireAt).getTime() - nowMs.value
  if (ms <= 0) return '已过期'
  const mins = Math.floor(ms / 60000)
  const secs = Math.floor((ms % 60000) / 1000)
  return mins > 0 ? `${mins}m${secs}s` : `${secs}s`
}

function displayStatus(order: FlashSaleOrder): string {
  if (order.status === 'pending_payment' && new Date(order.lockExpireAt).getTime() <= nowMs.value) {
    return 'expired'
  }
  return order.status
}

function statusText(order: FlashSaleOrder): string {
  switch (displayStatus(order)) {
    case 'pending_payment': return '待支付'
    case 'paid': return '已支付'
    case 'cancelled': return '已取消'
    case 'expired': return '已过期'
    case 'refunded': return '已退款'
    default: return order.status
  }
}

async function loadList(reset = false) {
  if (loading.value) return
  if (!reset && finished.value) return
  if (reset) {
    page.value = 1
    finished.value = false
    orderList.value = []
  }
  loading.value = true
  try {
    const data = await flashSaleApi.getMyOrders({ page: page.value, pageSize: 20 })
    orderList.value.push(...data.list)
    finished.value = orderList.value.length >= data.total
    page.value++
  } catch {
    uni.showToast({ title: '加载失败', icon: 'none' })
  } finally {
    loading.value = false
  }
}

function goOrderDetail(orderId: string) {
  uni.navigateTo({ url: `/pages/order/detail?id=${orderId}` })
}

onShow(() => {
  startClock()
  loadList(true)
})
onHide(() => stopClock())
onUnload(() => stopClock())
onReachBottom(() => loadList())
</script>

<style lang="scss" scoped>
.my-flash-page {
  min-height: 100vh;
  padding: $spacing-sm $spacing-md $spacing-lg;
}

.order-card {
  margin-bottom: $spacing-md;
  padding: $spacing-md;
  background: $gradient-card;
  border-radius: $radius-xxl;
  border: 1rpx solid rgba($border-color, 0.78);
  box-shadow: $shadow-sm;
}

.info {
  display: flex;
  flex-direction: column;
  gap: $spacing-sm;
}

.row-1 {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.name {
  font-size: $font-md;
  font-weight: 700;
  color: $text-color;
  @include text-ellipsis;
}

.status-tag {
  font-size: $font-xs;
  padding: 4rpx 16rpx;
  border-radius: $radius-round;
  font-weight: 700;
}

.status-tag.status-pending_payment {
  background: $warning-soft;
  color: $warning-color;
}

.status-tag.status-paid {
  background: $success-soft;
  color: $success-dark;
}

.status-tag.status-cancelled,
.status-tag.status-expired,
.status-tag.status-refunded {
  background: $info-soft;
  color: $text-hint;
}

.row-2 {
  display: flex;
  align-items: baseline;
  gap: $spacing-sm;
}

.price {
  color: $price-color;
  font-size: $font-lg;
  font-weight: 800;
}

.qty {
  color: $text-hint;
  font-size: $font-sm;
}

.amount {
  margin-left: auto;
  color: $text-color;
  font-size: $font-sm;
  font-weight: 700;
}

.row-3 {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.time {
  color: $text-hint;
  font-size: $font-xs;
}

.remain {
  color: $price-color;
  font-size: $font-xs;
  font-weight: 700;
}
</style>
