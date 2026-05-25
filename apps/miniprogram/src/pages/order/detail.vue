<template>
  <view class="order-detail-page">
    <view class="status-section" :class="getStatusClass(order.status)">
      <text class="status-text">{{ formatOrderStatus(order.status) }}</text>
    </view>

    <view v-if="order.addressName" class="address-section card">
      <view class="address-top">
        <text class="address-name">{{ order.addressName }}</text>
        <text class="address-phone">{{ order.addressPhone }}</text>
      </view>
      <text class="address-detail">{{ order.addressDetail }}</text>
    </view>

    <view v-if="order.fulfillmentType === 'pickup' && order.pickupStoreName" class="pickup-section card">
      <view class="pickup-header">
        <text class="pickup-label">自提信息</text>
        <text v-if="order.pickupCode" class="pickup-code-badge">待自提</text>
      </view>
      <view class="pickup-detail">
        <view class="pickup-row">
          <text class="pickup-row-label">自提点</text>
          <text class="pickup-row-value">{{ order.pickupStoreName }}</text>
        </view>
        <view class="pickup-row">
          <text class="pickup-row-label">地址</text>
          <text class="pickup-row-value">{{ order.pickupStoreAddress }}</text>
        </view>
        <view v-if="order.pickupContactPhone" class="pickup-row">
          <text class="pickup-row-label">电话</text>
          <text class="pickup-row-value phone" @tap="callPhone(order.pickupContactPhone!)">{{ order.pickupContactPhone }}</text>
        </view>
        <view v-if="order.pickupCode" class="pickup-code-section">
          <text class="pickup-code-label">自提码</text>
          <view class="pickup-code-box">
            <text class="pickup-code-text">{{ order.pickupCode }}</text>
          </view>
          <text class="pickup-code-copy" @tap="copyPickupCode">复制</text>
        </view>
        <view v-if="order.pickedUpAt" class="pickup-row">
          <text class="pickup-row-label">核销时间</text>
          <text class="pickup-row-value">{{ order.pickedUpAt }}</text>
        </view>
      </view>
    </view>

    <view v-if="order.logistics" class="logistics-section card" @tap="showLogistics = true">
      <text class="section-label">物流信息</text>
      <text class="logistics-company">{{ order.logistics.company }}</text>
      <text class="section-arrow">›</text>
    </view>

    <view class="products-section card">
      <view v-for="item in order.items" :key="item.id" class="product-item">
        <image class="product-image" :src="item.productImage" mode="aspectFill" />
        <view class="product-info">
          <text class="product-name">{{ item.productName }}</text>
          <text class="product-sku">{{ item.skuName }}</text>
        </view>
        <view class="product-right">
          <PriceDisplay :price="item.price" />
          <text class="product-qty">x{{ item.quantity }}</text>
          <view
            v-if="order.status === 'completed'"
            class="item-aftersale-btn"
            @tap="goAftersale(item.id)"
          >申请售后</view>
        </view>
      </view>
    </view>

    <view class="price-section card">
      <view class="price-row">
        <text class="price-label">商品金额</text>
        <text class="price-value">¥{{ formatPrice(order.totalAmount) }}</text>
      </view>
      <view class="price-row">
        <text class="price-label">运费</text>
        <text class="price-value">{{ order.freightAmount > 0 ? `¥${formatPrice(order.freightAmount)}` : '免运费' }}</text>
      </view>
      <view v-if="order.couponAmount > 0" class="price-row">
        <text class="price-label">优惠券</text>
        <text class="price-value discount">-¥{{ formatPrice(order.couponAmount) }}</text>
      </view>
      <view v-if="order.pointsAmount > 0" class="price-row">
        <text class="price-label">积分抵扣</text>
        <text class="price-value discount">-¥{{ formatPrice(order.pointsAmount) }}</text>
      </view>
      <view class="price-row total">
        <text class="price-label">实付金额</text>
        <text class="price-value pay-amount">¥{{ formatPrice(order.payAmount) }}</text>
      </view>
    </view>

    <view class="info-section card">
      <view class="info-row">
        <text class="info-label">订单编号</text>
        <text class="info-value">{{ order.orderNo }}</text>
      </view>
      <view class="info-row">
        <text class="info-label">下单时间</text>
        <text class="info-value">{{ order.createTime }}</text>
      </view>
      <view v-if="order.payTime" class="info-row">
        <text class="info-label">支付时间</text>
        <text class="info-value">{{ order.payTime }}</text>
      </view>
      <view v-if="order.remark" class="info-row">
        <text class="info-label">备注</text>
        <text class="info-value">{{ order.remark }}</text>
      </view>
    </view>

    <view class="bottom-bar" v-if="order.status">
      <view v-if="order.status === 'pending_payment'" class="action-btn cancel" @tap="handleCancel">取消订单</view>
      <view v-if="order.status === 'pending_payment'" class="action-btn primary" @tap="handlePay">去支付</view>
      <view v-if="order.status === 'delivered'" class="action-btn primary" @tap="handleConfirm">确认收货</view>
      <view v-if="order.status === 'completed'" class="action-hint">请选择要售后的商品</view>
      <view class="action-btn" @tap="goCustomerService">联系商家</view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { getOrderDetail, cancelOrder, confirmReceive, type OrderDetail } from '@/api/order'
import { createPayment, wxPay } from '@/api/payment'
import { formatOrderStatus, formatPrice } from '@/utils/format'
import PriceDisplay from '@/components/PriceDisplay.vue'

const order = ref<OrderDetail>({
  id: '', orderNo: '', status: '' as any, totalAmount: 0, payAmount: 0,
  freightAmount: 0, couponAmount: 0, pointsAmount: 0,
  addressName: '', addressPhone: '', addressDetail: '',
  fulfillmentType: 'delivery',
  items: [], createTime: ''
})

const showLogistics = ref(false)

async function loadOrder(id: string) {
  try {
    order.value = await getOrderDetail(id)
  } catch {
    uni.showToast({ title: '订单加载失败', icon: 'none' })
  }
}

function getStatusClass(status: string): string {
  const map: Record<string, string> = {
    pending_payment: 'status-unpaid',
    paid: 'status-shipping',
    pending_delivery: 'status-shipping',
    delivered: 'status-receiving',
    completed: 'status-done',
    cancelled: 'status-cancelled',
    aftersale: 'status-aftersale'
  }
  return map[status] || ''
}

async function handleCancel() {
  uni.showModal({
    title: '提示',
    content: '确定取消该订单吗？',
    success: async (res) => {
      if (res.confirm) {
        try {
          await cancelOrder(order.value.id)
          loadOrder(order.value.id)
        } catch {
          uni.showToast({ title: '取消失败', icon: 'none' })
        }
      }
    }
  })
}

async function handlePay() {
  try {
    const payment = await createPayment({ orderId: order.value.id })
    try {
      await wxPay(payment)
      uni.redirectTo({ url: `/pages/order/pay-result?orderId=${order.value.id}` })
    } catch {
      uni.redirectTo({ url: `/pages/order/pay-result?orderId=${order.value.id}` })
    }
  } catch (e: any) {
    const msg = e?.message || '支付发起失败'
    uni.showModal({
      title: '提示',
      content: msg.includes('暂未开通') ? msg : '支付功能暂未开放，请联系客服',
      showCancel: false,
      confirmText: '我知道了'
    })
  }
}

async function handleConfirm() {
  uni.showModal({
    title: '提示',
    content: '确认已收到商品吗？',
    success: async (res) => {
      if (res.confirm) {
        try {
          await confirmReceive(order.value.id)
          loadOrder(order.value.id)
        } catch {
          uni.showToast({ title: '确认收货失败', icon: 'none' })
        }
      }
    }
  })
}

function goAftersale(orderItemId: string) {
  uni.navigateTo({
    url: `/pages/aftersale/apply?orderId=${order.value.id}&orderItemId=${orderItemId}`
  })
}

function goCustomerService() {
  uni.navigateTo({ url: '/pages/customer-service/index' })
}

function copyPickupCode() {
  if (!order.value.pickupCode) return
  uni.setClipboardData({
    data: order.value.pickupCode,
    success: () => uni.showToast({ title: '已复制', icon: 'success' })
  })
}

function callPhone(phone: string) {
  uni.makePhoneCall({ phoneNumber: phone })
}

onLoad((options) => {
  if (options?.id) loadOrder(options.id)
})
</script>

<style lang="scss" scoped>
.order-detail-page {
  min-height: 100vh;
  background: $bg-color;
  padding-bottom: 120rpx;
}

.status-section {
  padding: $spacing-lg $spacing-md;
  color: #FFFFFF;

  &.status-unpaid { background: $warning-color; }
  &.status-shipping { background: $info-color; }
  &.status-receiving { background: $secondary-color; }
  &.status-done { background: $success-color; }
  &.status-cancelled { background: $text-hint; }
  &.status-aftersale { background: $danger-color; }
}

.status-text {
  font-size: $font-xl;
  font-weight: 600;
}

.address-section,
.logistics-section,
.products-section,
.price-section,
.info-section {
  margin: $spacing-sm $spacing-md;
}

.pickup-section {
  margin: $spacing-sm $spacing-md;
}

.pickup-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: $spacing-sm;
}

.pickup-label {
  font-size: $font-md;
  font-weight: 600;
  color: $text-color;
}

.pickup-code-badge {
  font-size: $font-xs;
  color: $primary-color;
  background: rgba($primary-color, 0.1);
  padding: 4rpx 16rpx;
  border-radius: $radius-round;
}

.pickup-row {
  @include flex-between;
  padding: 8rpx 0;
}

.pickup-row-label {
  font-size: $font-sm;
  color: $text-hint;
}

.pickup-row-value {
  font-size: $font-sm;
  color: $text-color;

  &.phone {
    color: $primary-color;
  }
}

.pickup-code-section {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: $spacing-md 0;
  margin-top: $spacing-sm;
  border-top: 1rpx solid $divider-color;
}

.pickup-code-label {
  font-size: $font-sm;
  color: $text-hint;
  margin-right: $spacing-sm;
}

.pickup-code-box {
  background: rgba($primary-color, 0.1);
  padding: 12rpx 32rpx;
  border-radius: $radius-md;
}

.pickup-code-text {
  font-size: $font-xl;
  font-weight: 700;
  color: $primary-color;
  letter-spacing: 8rpx;
}

.pickup-code-copy {
  font-size: $font-sm;
  color: $primary-color;
  margin-left: $spacing-md;
}

.address-top {
  display: flex;
  align-items: center;
  margin-bottom: 8rpx;
}

.address-name {
  font-size: $font-md;
  font-weight: 600;
  margin-right: $spacing-sm;
}

.address-phone {
  font-size: $font-sm;
  color: $text-secondary;
}

.address-detail {
  font-size: $font-sm;
  color: $text-secondary;
}

.logistics-section {
  display: flex;
  align-items: center;
}

.section-label {
  font-size: $font-md;
  color: $text-color;
  margin-right: $spacing-sm;
}

.logistics-company {
  flex: 1;
  font-size: $font-sm;
  color: $text-secondary;
}

.section-arrow {
  font-size: $font-lg;
  color: $text-hint;
}

.product-item {
  display: flex;
  align-items: center;
  padding: $spacing-sm 0;
  border-bottom: 1rpx solid $divider-color;

  &:last-child { border-bottom: none; }
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

.item-aftersale-btn {
  margin-top: 8rpx;
  font-size: $font-xs;
  color: $primary-color;
  border: 1rpx solid $primary-color;
  border-radius: $radius-round;
  padding: 4rpx 16rpx;
  display: inline-block;
}

.price-row {
  @include flex-between;
  padding: 8rpx 0;

  &.total {
    border-top: 1rpx solid $divider-color;
    padding-top: $spacing-sm;
    margin-top: $spacing-xs;
  }
}

.price-label {
  font-size: $font-sm;
  color: $text-secondary;
}

.price-value {
  font-size: $font-sm;
  color: $text-color;

  &.discount { color: $danger-color; }
  &.pay-amount { color: $primary-color; font-weight: 600; font-size: $font-lg; }
}

.info-row {
  @include flex-between;
  padding: 8rpx 0;
}

.info-label {
  font-size: $font-sm;
  color: $text-hint;
}

.info-value {
  font-size: $font-sm;
  color: $text-color;
}

.bottom-bar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  display: flex;
  justify-content: flex-end;
  gap: $spacing-sm;
  background: $bg-white;
  padding: $spacing-sm $spacing-md;
  box-shadow: 0 -2rpx 8rpx rgba(0, 0, 0, 0.05);
  @include safe-bottom;
}

.action-btn {
  padding: 16rpx 32rpx;
  border-radius: $radius-round;
  font-size: $font-sm;
  color: $text-secondary;
  border: 2rpx solid $border-color;

  &.primary { color: $primary-color; border-color: $primary-color; }
  &.cancel { color: $text-hint; }
}

.action-hint {
  font-size: $font-sm;
  color: $text-hint;
  padding: 16rpx 0;
}
</style>
