<template>
  <view class="order-list-page">
    <view class="tab-bar">
      <view
        v-for="tab in tabs"
        :key="tab.value"
        class="tab-item"
        :class="{ active: currentTab === tab.value }"
        @tap="switchTab(tab.value)"
      >
        <text class="tab-text">{{ tab.label }}</text>
      </view>
    </view>

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
          <text class="order-total">共{{ order.items.length }}件商品 合计：<text class="total-price">¥{{ formatPrice(order.payAmount) }}</text></text>
        </view>
        <view class="order-actions">
          <view v-if="order.status === 10" class="action-btn cancel" @tap.stop="handleCancel(order.id)">取消订单</view>
          <view v-if="order.status === 10" class="action-btn primary" @tap.stop="handlePay(order)">去支付</view>
          <view v-if="order.status === 30" class="action-btn primary" @tap.stop="handleConfirm(order.id)">确认收货</view>
          <view v-if="order.status === 40" class="action-btn" @tap.stop="goAftersale(order.id)">申请售后</view>
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
import { getOrderList, cancelOrder, confirmReceive, type OrderItem } from '@/api/order'
import { createPayment, wxPay } from '@/api/payment'
import { formatOrderStatus, formatPrice } from '@/utils/format'
import PriceDisplay from '@/components/PriceDisplay.vue'
import Loading from '@/components/Loading.vue'
import Empty from '@/components/Empty.vue'

const tabs = [
  { label: '全部', value: 0 },
  { label: '待付款', value: 10 },
  { label: '待发货', value: 20 },
  { label: '待收货', value: 30 },
  { label: '已完成', value: 40 },
  { label: '售后', value: 60 }
]

const currentTab = ref(0)
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
    const params: any = { page: page.value, pageSize: 10 }
    if (currentTab.value) params.status = currentTab.value
    const data = await getOrderList(params)
    orders.value.push(...data.list)
    finished.value = orders.value.length >= data.total
    page.value++
  } catch {} finally {
    loading.value = false
  }
}

function switchTab(value: number) {
  currentTab.value = value
  loadOrders(true)
}

function goDetail(id: number) {
  uni.navigateTo({ url: `/pages/order/detail?id=${id}` })
}

function goAftersale(orderId: number) {
  uni.navigateTo({ url: `/pages/aftersale/apply?orderId=${orderId}` })
}

function getStatusClass(status: number): string {
  const map: Record<number, string> = {
    10: 'status-unpaid',
    20: 'status-shipping',
    30: 'status-receiving',
    40: 'status-done',
    50: 'status-cancelled',
    60: 'status-aftersale'
  }
  return map[status] || ''
}

async function handleCancel(id: number) {
  uni.showModal({
    title: '提示',
    content: '确定取消该订单吗？',
    success: async (res) => {
      if (res.confirm) {
        await cancelOrder(id)
        loadOrders(true)
      }
    }
  })
}

async function handlePay(order: OrderItem) {
  try {
    const payment = await createPayment({ orderId: order.id, payMethod: 'wxpay' })
    try {
      await wxPay(payment.payParams)
      uni.redirectTo({ url: `/pages/order/pay-result?orderId=${order.id}&success=true` })
    } catch {
      uni.redirectTo({ url: `/pages/order/pay-result?orderId=${order.id}&success=false` })
    }
  } catch {}
}

async function handleConfirm(id: number) {
  uni.showModal({
    title: '提示',
    content: '确认已收到商品吗？',
    success: async (res) => {
      if (res.confirm) {
        await confirmReceive(id)
        loadOrders(true)
      }
    }
  })
}

onLoad((options) => {
  if (options?.status) currentTab.value = Number(options.status)
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
  background: $bg-color;
}

.tab-bar {
  display: flex;
  background: $bg-white;
  padding: $spacing-sm 0;
  position: sticky;
  top: 0;
  z-index: 10;
}

.tab-item {
  flex: 1;
  @include flex-center;
  padding: 16rpx 0;
  position: relative;

  &.active {
    .tab-text {
      color: $primary-color;
      font-weight: 600;
    }

    &::after {
      content: '';
      position: absolute;
      bottom: 0;
      width: 40rpx;
      height: 4rpx;
      background: $primary-color;
      border-radius: 2rpx;
    }
  }
}

.tab-text {
  font-size: $font-sm;
  color: $text-secondary;
}

.order-card {
  margin: $spacing-sm $spacing-md;
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
  font-size: $font-sm;
  font-weight: 500;

  &.status-unpaid { color: $warning-color; }
  &.status-shipping { color: $info-color; }
  &.status-receiving { color: $secondary-color; }
  &.status-done { color: $success-color; }
  &.status-cancelled { color: $text-hint; }
  &.status-aftersale { color: $danger-color; }
}

.order-product {
  display: flex;
  align-items: center;
  padding: $spacing-sm 0;
}

.product-image {
  width: 120rpx;
  height: 120rpx;
  border-radius: $radius-md;
  flex-shrink: 0;
}

.product-info {
  flex: 1;
  margin-left: $spacing-sm;
  overflow: hidden;
}

.product-name {
  font-size: $font-sm;
  color: $text-color;
  @include text-ellipsis;
  display: block;
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
  text-align: right;
  padding: $spacing-sm 0;
  border-top: 1rpx solid $divider-color;
}

.order-total {
  font-size: $font-sm;
  color: $text-secondary;
}

.total-price {
  color: $primary-color;
  font-weight: 600;
}

.order-actions {
  display: flex;
  justify-content: flex-end;
  gap: $spacing-sm;
  padding-top: $spacing-sm;
}

.action-btn {
  padding: 12rpx 28rpx;
  border-radius: $radius-round;
  font-size: $font-xs;
  color: $text-secondary;
  border: 2rpx solid $border-color;

  &.primary {
    color: $primary-color;
    border-color: $primary-color;
  }

  &.cancel {
    color: $text-hint;
    border-color: $border-color;
  }
}
</style>
