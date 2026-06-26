<template>
  <view class="my-flash-page page-shell">
    <view v-for="o in orderList" :key="o.id" class="order-card card" @tap="goOrderDetail(o.orderId)">
      <view class="info">
        <view class="row-1">
          <text class="name">秒杀订单 #{{ o.id }}</text>
          <text class="status-tag" :class="`status-${o.status}`">{{ statusText(o.status) }}</text>
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
import { onShow, onReachBottom } from '@dcloudio/uni-app'
import { flashSaleApi, type FlashSaleOrder } from '@/api/flash-sale'
import Loading from '@/components/Loading.vue'
import Empty from '@/components/Empty.vue'

const orderList = ref<FlashSaleOrder[]>([])
const loading = ref(false)
const page = ref(1)
const finished = ref(false)

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
  const ms = new Date(lockExpireAt).getTime() - Date.now()
  if (ms <= 0) return '已过期'
  const mins = Math.floor(ms / 60000)
  const secs = Math.floor((ms % 60000) / 1000)
  return mins > 0 ? `${mins}m${secs}s` : `${secs}s`
}

function statusText(status: string): string {
  switch (status) {
    case 'pending_payment': return '待支付'
    case 'paid': return '已支付'
    case 'cancelled': return '已取消'
    case 'expired': return '已过期'
    case 'refunded': return '已退款'
    default: return status
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

onShow(() => loadList(true))
onReachBottom(() => loadList())
</script>

<style lang="scss" scoped>
.my-flash-page {
  min-height: 100vh;
  padding: 16rpx;
}
.order-card {
  margin-bottom: 16rpx;
  padding: 24rpx;
  background: #fff;
  border-radius: 16rpx;
}
.info {
  display: flex;
  flex-direction: column;
  gap: 12rpx;
}
.row-1 {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.name {
  font-size: 28rpx;
  font-weight: 600;
  color: #333;
}
.status-tag {
  font-size: 22rpx;
  padding: 4rpx 16rpx;
  border-radius: 4rpx;
  font-weight: 600;
}
.status-tag.status-pending_payment {
  background: rgba(245, 108, 108, 0.1);
  color: #f56c6c;
}
.status-tag.status-paid {
  background: rgba(103, 194, 58, 0.1);
  color: #67c23a;
}
.status-tag.status-cancelled,
.status-tag.status-expired,
.status-tag.status-refunded {
  background: rgba(144, 147, 153, 0.1);
  color: #909399;
}
.row-2 {
  display: flex;
  align-items: baseline;
  gap: 16rpx;
}
.price {
  color: #f56c6c;
  font-size: 32rpx;
  font-weight: 700;
}
.qty {
  color: #909399;
  font-size: 24rpx;
}
.amount {
  margin-left: auto;
  color: #333;
  font-size: 26rpx;
  font-weight: 600;
}
.row-3 {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.time {
  color: #c0c4cc;
  font-size: 22rpx;
}
.remain {
  color: #f56c6c;
  font-size: 22rpx;
  font-weight: 600;
}
</style>
