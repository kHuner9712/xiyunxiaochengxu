<template>
  <view class="order-list-page page-shell">
    <scroll-view scroll-x class="tab-scroll">
      <view class="tab-bar pill-tab-bar">
      <view
        v-for="tab in tabs"
        :key="tab.value"
        class="tab-item pill-tab-item"
        :class="{ active: currentTab === tab.value }"
        @tap="switchTab(tab.value)"
      >
        <text class="tab-text">{{ tab.label }}</text>
      </view>
      </view>
    </scroll-view>

    <view class="order-list">
      <view v-for="order in orders" :key="order.id" class="order-card card" @tap="goDetail(order.id)">
        <view class="order-header">
          <text class="order-no">订单号：{{ order.orderNo }}</text>
          <text class="order-status" :class="getStatusClass(order.status)">{{ formatOrderStatus(order.status) }}</text>
        </view>
        <view v-for="item in order.items" :key="item.skuId" class="order-product">
          <image class="product-image" :src="item.productImage" mode="aspectFill" />
          <view class="product-info">
            <text class="product-name">{{ item.productName }}</text>
            <text class="product-sku">{{ item.skuName }}</text>
          </view>
          <view class="product-right">
            <PriceDisplay :price="item.price" />
            <text class="product-qty">x{{ item.quantity }}</text>
          </view>
        </view>
        <view class="order-footer">
          <text class="order-count">共{{ order.items.length }}件商品</text>
          <view class="order-total">
            <text class="total-label">合计</text>
            <text class="total-price">¥{{ formatPrice(order.payAmount) }}</text>
          </view>
        </view>
        <view class="order-actions">
          <view v-if="order.status === 'pending_payment'" class="action-btn cancel" @tap.stop="handleCancel(order.id)">取消订单</view>
          <view v-if="order.status === 'pending_payment'" class="action-btn primary" @tap.stop="handlePay(order)">去支付</view>
          <view v-if="order.status === 'delivered'" class="action-btn primary" @tap.stop="handleConfirm(order.id)">确认收货</view>
          <view v-if="order.status === 'completed' || order.status === 'delivered'" class="action-btn" @tap.stop="handleAftersale(order)">申请售后</view>
        </view>
      </view>
    </view>

    <Loading v-if="loading" />
    <Empty v-if="!loading && orders.length === 0" text="暂无订单" />
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { onLoad, onReachBottom, onPullDownRefresh } from '@dcloudio/uni-app'
import { getOrderList, cancelOrder, confirmReceive, normalizeOrderStatus, type OrderItem, type OrderStatus } from '@/api/order'
import { createPayment, wxPay } from '@/api/payment'
import { formatOrderStatus, formatPrice } from '@/utils/format'
import PriceDisplay from '@/components/PriceDisplay.vue'
import Loading from '@/components/Loading.vue'
import Empty from '@/components/Empty.vue'

const tabs = [
  { label: '全部', value: '' },
  { label: '待付款', value: 'pending_payment' },
  { label: '待发货', value: 'pending_delivery' },
  { label: '待自提', value: 'pending_pickup' },
  { label: '待收货', value: 'delivered' },
  { label: '已完成', value: 'completed' },
  { label: '已取消', value: 'cancelled' },
  { label: '售后', value: 'aftersale' },
] as const

type OrderTabValue = '' | OrderStatus

const currentTab = ref<OrderTabValue>('')
const orders = ref<OrderItem[]>([])
const loading = ref(false)
const page = ref(1)
const finished = ref(false)

async function loadOrders(reset = false) {
  if (loading.value) return
  if (!reset && finished.value) return
  if (reset) {
    page.value = 1
    finished.value = false
    orders.value = []
  }
  loading.value = true
  try {
    const params: { page: number; pageSize: number; status?: OrderStatus } = { page: page.value, pageSize: 10 }
    if (currentTab.value) params.status = currentTab.value
    const data = await getOrderList(params)
    orders.value.push(...data.list)
    finished.value = orders.value.length >= data.total
    page.value++
  } catch {
    uni.showToast({ title: '订单加载失败', icon: 'none' })
  } finally {
    loading.value = false
  }
}

function switchTab(value: OrderTabValue) {
  currentTab.value = value
  loadOrders(true)
}

function goDetail(id: string) {
  uni.navigateTo({ url: `/pages/order/detail?id=${id}` })
}

function goAftersaleWithItem(orderId: string, orderItemId: string) {
  uni.navigateTo({ url: `/pages/aftersale/apply?orderId=${orderId}&orderItemId=${orderItemId}` })
}

function handleAftersale(order: OrderItem) {
  const canApplyItems = (order.items || []).filter((item) => item.canApplyAftersale !== false)
  if (canApplyItems.length === 0) {
    const reason = order.items?.find((item) => item.aftersaleDisabledReason)?.aftersaleDisabledReason || '当前订单暂无可申请售后的商品'
    uni.showToast({ title: reason, icon: 'none' })
    return
  }
  if (canApplyItems.length === 1) {
    goAftersaleWithItem(order.id, canApplyItems[0].id)
    return
  }
  uni.navigateTo({ url: `/pages/order/detail?id=${order.id}&selectAftersale=1` })
}

function getStatusClass(status: string): string {
  const map: Record<string, string> = {
    pending_payment: 'status-unpaid',
    pending_delivery: 'status-shipping',
    pending_pickup: 'status-pickup',
    delivered: 'status-receiving',
    completed: 'status-done',
    cancelled: 'status-cancelled',
    aftersale: 'status-aftersale'
  }
  return map[status] || ''
}

async function handleCancel(id: string) {
  uni.showModal({
    title: '提示',
    content: '确定取消该订单吗？',
    success: async (res) => {
      if (res.confirm) {
        try {
          await cancelOrder(id)
          loadOrders(true)
        } catch {
          uni.showToast({ title: '取消失败', icon: 'none' })
        }
      }
    }
  })
}

async function handlePay(order: OrderItem) {
  try {
    const payment = await createPayment({ orderId: order.id })
    try {
      await wxPay(payment)
      uni.redirectTo({ url: `/pages/order/pay-result?orderId=${order.id}` })
    } catch {
      uni.redirectTo({ url: `/pages/order/pay-result?orderId=${order.id}` })
    }
  } catch {
    uni.showToast({ title: '支付发起失败', icon: 'none' })
  }
}

async function handleConfirm(id: string) {
  uni.showModal({
    title: '提示',
    content: '确认已收到商品吗？',
    success: async (res) => {
      if (res.confirm) {
        try {
          await confirmReceive(id)
          loadOrders(true)
        } catch {
          uni.showToast({ title: '确认收货失败', icon: 'none' })
        }
      }
    }
  })
}

onLoad((options) => {
  const status = normalizeOrderStatus(options?.status as string | undefined)
  if (status) currentTab.value = status
  loadOrders()
})

onPullDownRefresh(async () => {
  await loadOrders(true)
  uni.stopPullDownRefresh()
})

onReachBottom(() => {
  loadOrders()
})
</script>

<style lang="scss" scoped>
.order-list-page {
  min-height: 100vh;
  padding-bottom: $spacing-md;
}

.tab-scroll {
  position: sticky;
  top: 0;
  z-index: 10;
  white-space: nowrap;
  background: rgba($bg-color, 0.94);
  padding: $spacing-sm $spacing-md;
}

.tab-bar {
  display: inline-flex;
  min-width: 100%;
}

.tab-item {
  flex: 0 0 auto;
  position: relative;
  min-width: 112rpx;

  &.active {
    .tab-text {
      color: $primary-dark;
      font-weight: 700;
    }
  }
}

.tab-text {
  font-size: $font-sm;
  color: $text-secondary;
}

.order-card {
  margin: $spacing-sm $spacing-md $spacing-md;
  padding: $spacing-md;
}

.order-header {
  @include flex-between;
  padding-bottom: $spacing-sm;
  border-bottom: 1rpx solid $divider-color;
}

.order-no {
  font-size: $font-xs;
  color: $text-hint;
}

.order-status {
  @include status-badge;
  font-size: $font-sm;
  font-weight: 500;

  &.status-unpaid { @include status-warning; }
  &.status-shipping { @include status-info; }
  &.status-pickup { @include status-primary; }
  &.status-receiving { background: $secondary-soft; color: $secondary-color; }
  &.status-done { @include status-success; }
  &.status-cancelled { background: $bg-gray; color: $text-hint; }
  &.status-aftersale { @include status-danger; }
}

.order-product {
  display: flex;
  align-items: center;
  padding: 18rpx 0;
}

.product-image {
  width: 132rpx;
  height: 132rpx;
  border-radius: $radius-lg;
  flex-shrink: 0;
  background: $bg-gray;
}

.product-info {
  flex: 1;
  margin-left: $spacing-sm;
  overflow: hidden;
}

.product-name {
  font-size: $font-sm;
  color: $text-color;
  font-weight: 600;
  @include text-ellipsis-2;
  display: block;
  line-height: 1.4;
}

.product-sku {
  font-size: $font-xs;
  color: $text-hint;
  display: block;
  margin-top: 4rpx;
}

.product-right {
  text-align: right;
  margin-left: $spacing-sm;
}

.product-qty {
  font-size: $font-xs;
  color: $text-hint;
  display: block;
}

.order-footer {
  @include flex-between;
  padding: $spacing-sm 0;
  border-top: 1rpx solid $divider-color;
}

.order-count,
.total-label {
  font-size: $font-sm;
  color: $text-secondary;
}

.order-total {
  display: flex;
  align-items: baseline;
  gap: 8rpx;
}

.total-price {
  color: $primary-color;
  font-weight: 800;
  font-size: $font-lg;
}

.order-actions {
  display: flex;
  justify-content: flex-end;
  gap: $spacing-sm;
  padding-top: $spacing-sm;
}

.action-btn {
  min-height: 60rpx;
  padding: 0 28rpx;
  border-radius: $radius-round;
  font-size: $font-xs;
  color: $text-secondary;
  border: 2rpx solid $border-color;
  @include flex-center;
  background: $bg-white;

  &.primary {
    color: $primary-dark;
    border-color: rgba($primary-color, 0.36);
    background: $primary-soft;
    font-weight: 700;
  }

  &.cancel {
    color: $text-hint;
    border-color: $border-color;
  }
}
</style>
