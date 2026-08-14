<template>
  <view class="order-list-page page-shell">
    <view class="order-hero">
      <text class="hero-title">我的订单</text>
      <text class="hero-subtitle">自营履约 · 售后无忧</text>
    </view>
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
        <view v-for="item in order.items" :key="item.id" class="order-product">
          <image class="product-image" :src="item.productImage" mode="aspectFit" />
          <view class="product-info">
            <text class="product-name">{{ item.productName }}</text>
            <text class="product-sku">{{ item.skuName }}</text>
          </view>
          <view class="product-right">
            <PriceDisplay :price="item.price" />
            <text class="product-qty">x{{ item.quantity }}</text>
            <text class="product-line-total">商品小计 ¥{{ formatPrice(item.subtotal ?? item.price * item.quantity) }}</text>
          </view>
        </view>
        <view class="order-footer">
          <text class="order-count">共{{ order.items.length }}件商品</text>
          <view class="order-total">
            <text class="total-label">合计</text>
            <text class="total-price">¥{{ formatPrice(order.payAmount) }}</text>
          </view>
        </view>
        <view v-if="order.status === 'paid'" class="group-waiting-tip">
          已付款，等待拼团成团；成团后才进入发货或自提流程
        </view>
        <view class="order-actions">
          <view
            v-if="order.status === 'pending_payment'"
            class="action-btn cancel"
            :class="{ disabled: isOrderActionBusy(order.id) }"
            @tap.stop="handleCancel(order.id)"
          >取消订单</view>
          <view
            v-if="order.status === 'pending_payment'"
            class="action-btn primary"
            :class="{ disabled: isOrderActionBusy(order.id) }"
            @tap.stop="handlePay(order)"
          >{{ isOrderActionBusy(order.id) ? '处理中...' : '去支付' }}</view>
          <view v-if="order.status === 'paid'" class="action-btn primary" @tap.stop="goGroupProgress(order)">查看拼团进度</view>
          <view v-if="order.status === 'pending_pickup'" class="action-btn primary" @tap.stop="goDetail(order.id)">查看自提码</view>
          <view
            v-if="order.status === 'delivered'"
            class="action-btn primary"
            :class="{ disabled: isOrderActionBusy(order.id) }"
            @tap.stop="handleConfirm(order.id)"
          >{{ isOrderActionBusy(order.id) ? '处理中...' : '确认收货' }}</view>
          <view v-if="order.status === 'completed' || order.status === 'delivered'" class="action-btn" @tap.stop="handleAftersale(order)">申请售后</view>
        </view>
      </view>
    </view>

    <Loading v-if="loading" />
    <Empty v-if="!loading && orders.length === 0" text="暂无订单" />
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { onLoad, onShow, onReachBottom, onPullDownRefresh } from '@dcloudio/uni-app'
import { getOrderList, cancelOrder, confirmReceive, normalizeOrderStatus, type OrderItem, type OrderStatus } from '@/api/order'
import { createPayment, wxPay } from '@/api/payment'
import { formatOrderStatus, formatPrice } from '@/utils/format'
import PriceDisplay from '@/components/PriceDisplay.vue'
import Loading from '@/components/Loading.vue'
import Empty from '@/components/Empty.vue'

const tabs = [
  { label: '全部', value: '' },
  { label: '待付款', value: 'pending_payment' },
  { label: '待成团', value: 'paid' },
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
const orderActionBusy = ref<Record<string, boolean>>({})
let orderVersion = 0
let loadingVersion = -1

function isOrderActionBusy(id: string) {
  return orderActionBusy.value[id] === true
}

function beginOrderAction(id: string) {
  if (isOrderActionBusy(id)) return false
  orderActionBusy.value = { ...orderActionBusy.value, [id]: true }
  return true
}

function endOrderAction(id: string) {
  if (!isOrderActionBusy(id)) return
  const next = { ...orderActionBusy.value }
  delete next[id]
  orderActionBusy.value = next
}

function confirmModal(options: { title: string; content: string }) {
  return new Promise<boolean>((resolve) => {
    uni.showModal({
      ...options,
      success: (res) => resolve(Boolean(res.confirm)),
      fail: () => resolve(false),
    })
  })
}

function resetOrders() {
  page.value = 1
  finished.value = false
  orders.value = []
}

async function loadOrders(version = orderVersion) {
  if (finished.value && version === orderVersion) return
  if (loading.value && loadingVersion === version) return

  const requestPage = page.value
  const requestStatus = currentTab.value
  loading.value = true
  loadingVersion = version
  try {
    const params: { page: number; pageSize: number; status?: OrderStatus } = {
      page: requestPage,
      pageSize: 10,
    }
    if (requestStatus) params.status = requestStatus
    const data = await getOrderList(params)
    if (version !== orderVersion) return

    orders.value.push(...data.list)
    finished.value = orders.value.length >= data.total
    page.value = requestPage + 1
  } catch {
    if (version === orderVersion) {
      uni.showToast({ title: '订单加载失败', icon: 'none' })
    }
  } finally {
    if (version === orderVersion) {
      loading.value = false
      loadingVersion = -1
    }
  }
}

function refreshOrders() {
  const version = ++orderVersion
  resetOrders()
  return loadOrders(version)
}

function switchTab(value: OrderTabValue) {
  if (currentTab.value === value) return
  currentTab.value = value
  refreshOrders()
}

function goDetail(id: string) {
  uni.navigateTo({ url: `/pages/order/detail?id=${id}` })
}

function goGroupProgress(order: OrderItem) {
  if (order.groupBuyGroupId) {
    uni.navigateTo({ url: `/pages/group-buy/group?id=${order.groupBuyGroupId}` })
    return
  }
  uni.showToast({ title: '拼团信息加载中，请进入订单详情查看', icon: 'none' })
  goDetail(order.id)
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
    paid: 'status-grouping',
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
  if (!beginOrderAction(id)) return
  try {
    const confirmed = await confirmModal({ title: '提示', content: '确定取消该订单吗？' })
    if (!confirmed) return
    await cancelOrder(id)
    await refreshOrders()
  } catch {
    uni.showToast({ title: '取消失败', icon: 'none' })
  } finally {
    endOrderAction(id)
  }
}

async function handlePay(order: OrderItem) {
  if (!beginOrderAction(order.id)) return
  try {
    const payment = await createPayment({ orderId: order.id })
    try {
      await wxPay(payment)
      uni.navigateTo({ url: `/pages/order/pay-result?orderId=${order.id}&payScene=list&payIntent=success` })
    } catch (payClientErr: any) {
      const detail = String(payClientErr?.errMsg || payClientErr?.message || '')
      if (detail.toLowerCase().includes('cancel')) {
        uni.showToast({ title: '已取消支付，可稍后继续支付', icon: 'none' })
        return
      }
      uni.showModal({
        title: '支付未完成',
        content: payClientErr?.message || payClientErr?.errMsg || '支付发起异常，请稍后重试或联系客服',
        showCancel: false,
        confirmText: '我知道了'
      })
    }
  } catch (e: any) {
    const message = e?.message || '支付发起失败，请稍后重试或联系客服'
    uni.showModal({
      title: '支付未完成',
      content: message,
      showCancel: false,
      confirmText: '我知道了'
    })
  } finally {
    endOrderAction(order.id)
  }
}

async function handleConfirm(id: string) {
  if (!beginOrderAction(id)) return
  try {
    const confirmed = await confirmModal({ title: '提示', content: '确认已收到商品吗？' })
    if (!confirmed) return
    await confirmReceive(id)
    await refreshOrders()
  } catch {
    uni.showToast({ title: '确认失败', icon: 'none' })
  } finally {
    endOrderAction(id)
  }
}

onLoad((options) => {
  const status = normalizeOrderStatus(Array.isArray(options?.status) ? options?.status[0] : options?.status)
  currentTab.value = status || ''
})

onShow(() => {
  refreshOrders()
})

onReachBottom(() => loadOrders(orderVersion))

onPullDownRefresh(async () => {
  await refreshOrders()
  uni.stopPullDownRefresh()
})

defineExpose({
  currentTab,
  orders,
  loading,
  orderActionBusy,
  isOrderActionBusy,
  handleCancel,
  handlePay,
  handleConfirm,
  switchTab,
  loadOrders,
  refreshOrders,
})
</script>

<style lang="scss" scoped>
.order-list-page {
  min-height: 100vh;
}

.order-hero {
  padding: 28rpx $spacing-md 18rpx;

  .hero-title {
    display: block;
    font-size: 42rpx;
    font-weight: 800;
    color: $text-color;
  }

  .hero-subtitle {
    display: block;
    margin-top: 8rpx;
    font-size: $font-sm;
    color: $text-hint;
  }
}

.tab-scroll {
  background: transparent;
  white-space: nowrap;
  padding-bottom: 8rpx;
}

.tab-bar {
  display: inline-flex;
  min-width: 100%;
  gap: 8rpx;
  padding: 0 $spacing-md 10rpx;
  box-sizing: border-box;
}

.tab-item {
  flex-shrink: 0;
  min-width: 116rpx;
  height: 62rpx;
  @include flex-center;
  position: relative;
}

.tab-item.active .tab-text {
  color: $primary-dark;
  font-weight: 700;
}

.tab-text {
  font-size: $font-sm;
  color: $text-secondary;
}

.order-list {
  padding: 0 $spacing-md $spacing-lg;
}

.order-card {
  margin: $spacing-sm 0;
  padding: 24rpx;
  background: rgba(255, 255, 255, 0.94);
}

.order-header {
  @include flex-between;
  padding-bottom: $spacing-sm;
  border-bottom: 1rpx solid $divider-color;
}

.order-no {
  font-size: $font-xs;
  color: $text-secondary;
  letter-spacing: 1rpx;
}

.order-status {
  font-size: $font-sm;
  color: $primary-dark;
  font-weight: 700;
  padding: 6rpx 16rpx;
  border-radius: $radius-round;
  background: $primary-soft;

  &.status-unpaid { color: $warning-color; background: $warning-soft; }
  &.status-grouping { color: $primary-dark; background: $primary-soft; }
  &.status-shipping { color: $info-color; background: $info-soft; }
  &.status-pickup { color: $primary-dark; background: $primary-soft; }
  &.status-receiving { color: $secondary-color; background: $secondary-soft; }
  &.status-done { color: $success-color; background: $success-soft; }
  &.status-cancelled { color: $text-hint; background: $bg-gray; }
  &.status-aftersale { color: $danger-color; background: $danger-soft; }
}

.order-product {
  display: flex;
  align-items: flex-start;
  padding: $spacing-sm 0;
  border-bottom: 1rpx solid $divider-color;

  &:last-of-type {
    border-bottom: none;
  }
}

.product-image {
  width: 148rpx;
  height: 148rpx;
  border-radius: 26rpx;
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
  color: $text-secondary;
  margin-top: 8rpx;
  display: inline-flex;
  max-width: 100%;
  padding: 6rpx 14rpx;
  border-radius: $radius-round;
  background: $bg-soft;
  @include text-ellipsis;
}

.product-right {
  text-align: right;
  margin-left: $spacing-sm;
}

.product-qty {
  font-size: $font-xs;
  color: $text-hint;
  display: block;
  margin-top: 4rpx;
}

.product-line-total {
  margin-top: 4rpx;
  font-size: $font-xs;
  color: $price-color;
  display: block;
  font-weight: 700;
}

.order-footer {
  @include flex-between;
  padding-top: $spacing-sm;
}

.order-count {
  font-size: $font-xs;
  color: $text-hint;
}

.order-total {
  display: flex;
  align-items: baseline;
}

.total-label {
  font-size: $font-sm;
  color: $text-secondary;
  margin-right: 8rpx;
}

.total-price {
  font-size: $font-lg;
  color: $price-color;
  font-weight: 800;
}

.group-waiting-tip {
  margin-top: $spacing-sm;
  padding: 14rpx 18rpx;
  border-radius: $radius-lg;
  background: $primary-soft;
  color: $primary-dark;
  font-size: $font-xs;
  line-height: 1.5;
}

.order-actions {
  display: flex;
  justify-content: flex-end;
  gap: $spacing-sm;
  margin-top: $spacing-sm;
  padding-top: $spacing-sm;
  border-top: 1rpx solid $divider-color;
}

.action-btn {
  min-height: 60rpx;
  padding: 0 28rpx;
  border-radius: $radius-round;
  font-size: $font-sm;
  color: $text-secondary;
  border: 2rpx solid $border-color;
  background: $bg-white;
  @include flex-center;

  &.primary {
    color: #FFFFFF;
    border-color: transparent;
    background: $gradient-coral;
    box-shadow: $shadow-coral;
    font-weight: 700;
  }

  &.cancel {
    color: $text-hint;
  }

  &.disabled {
    opacity: 0.55;
    pointer-events: none;
  }
}
</style>