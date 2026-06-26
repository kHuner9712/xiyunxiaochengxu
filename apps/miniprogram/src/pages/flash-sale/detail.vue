<template>
  <view class="flash-sale-detail-page page-shell">
    <view v-if="activity" class="detail-card card">
      <view v-if="activity.coverImage" class="cover-wrap">
        <image class="cover" :src="activity.coverImage" mode="aspectFill" />
      </view>
      <view v-else class="cover-wrap">
        <view class="cover cover-placeholder">
          <text class="placeholder-text">秒杀</text>
        </view>
      </view>

      <view class="info-section">
        <view class="name">{{ activity.name }}</view>
        <view class="price-row">
          <text class="flash-price">¥{{ formatPrice(activity.flashPrice) }}</text>
          <text v-if="activity.originalPrice" class="origin-price">¥{{ formatPrice(activity.originalPrice) }}</text>
        </view>
        <view class="meta-grid">
          <view class="meta-item">
            <text class="meta-label">剩余库存</text>
            <text class="meta-value">{{ remainStock }} 件</text>
          </view>
          <view class="meta-item">
            <text class="meta-label">每人限购</text>
            <text class="meta-value">{{ activity.limitPerUser > 0 ? activity.limitPerUser + ' 件' : '不限' }}</text>
          </view>
          <view class="meta-item">
            <text class="meta-label">活动状态</text>
            <text class="meta-value" :class="statusClass">{{ statusText }}</text>
          </view>
          <view class="meta-item">
            <text class="meta-label">锁库存</text>
            <text class="meta-value">{{ activity.lockMinutes }} 分钟</text>
          </view>
        </view>
        <view v-if="statusText === '进行中'" class="countdown-row">
          <text class="countdown-label">距结束</text>
          <text class="countdown-value">{{ remainTime(activity.endTime) }}</text>
        </view>
        <view v-else-if="statusText === '未开始'" class="countdown-row">
          <text class="countdown-label">距开始</text>
          <text class="countdown-value">{{ remainTime(activity.startTime) }}</text>
        </view>
        <view v-if="activity.description" class="desc-section">
          <text class="desc-title">活动说明</text>
          <text class="desc-content">{{ activity.description }}</text>
        </view>
      </view>
    </view>

    <view v-if="activity" class="bottom-bar">
      <button class="buy-btn" :disabled="!canBuy || submitting" @tap="handleBuy">
        <text class="btn-text">{{ buttonText }}</text>
      </button>
    </view>

    <Loading v-if="loading" />
  </view>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { onLoad, onShareAppMessage } from '@dcloudio/uni-app'
import { flashSaleApi, type FlashSaleActivity } from '@/api/flash-sale'
import { useUserStore } from '@/stores/user'
import { getPromotionSourceForOrder } from '@/utils/share'
import { createPayment, wxPay } from '@/api/payment'
import Loading from '@/components/Loading.vue'

const userStore = useUserStore()
const activity = ref<FlashSaleActivity | null>(null)
const loading = ref(false)
const submitting = ref(false)

function formatPrice(cents: number): string {
  return (cents / 100).toFixed(2)
}

const remainStock = computed(() => {
  if (!activity.value) return 0
  return Math.max(0, activity.value.stockLimit - activity.value.soldCount - activity.value.lockedCount)
})

const statusText = computed(() => {
  if (!activity.value) return ''
  const now = Date.now()
  const start = new Date(activity.value.startTime).getTime()
  const end = new Date(activity.value.endTime).getTime()
  if (now < start) return '未开始'
  if (now >= end) return '已结束'
  if (remainStock.value <= 0) return '已售罄'
  return '进行中'
})

const statusClass = computed(() => {
  const s = statusText.value
  if (s === '进行中') return 'status-running'
  if (s === '未开始') return 'status-pending'
  return 'status-end'
})

const canBuy = computed(() => statusText.value === '进行中' && remainStock.value > 0)

const buttonText = computed(() => {
  if (submitting.value) return '抢购中...'
  const s = statusText.value
  if (s === '未开始') return '即将开始'
  if (s === '已结束') return '已结束'
  if (s === '已售罄') return '已售罄'
  return '立即秒杀'
})

function remainTime(timeStr: string): string {
  const ms = new Date(timeStr).getTime() - Date.now()
  if (ms <= 0) return '已结束'
  const days = Math.floor(ms / 86400000)
  const hours = Math.floor((ms % 86400000) / 3600000)
  const mins = Math.floor((ms % 3600000) / 60000)
  const secs = Math.floor((ms % 60000) / 1000)
  if (days > 0) return `${days}天${hours}小时`
  if (hours > 0) return `${hours}h${mins}m${secs}s`
  return `${mins}m${secs}s`
}

async function loadDetail(id: string) {
  loading.value = true
  try {
    const data = await flashSaleApi.getDetail(id)
    activity.value = data
  } catch {
    uni.showToast({ title: '加载失败', icon: 'none' })
  } finally {
    loading.value = false
  }
}

async function handleBuy() {
  if (!activity.value) return
  if (!canBuy.value) return
  if (submitting.value) return
  if (!userStore.isLoggedIn) {
    userStore.requireLogin(() => handleBuy())
    return
  }
  submitting.value = true
  try {
    const promo = getPromotionSourceForOrder()
    const result = await flashSaleApi.buy({
      activityId: Number(activity.value.id),
      quantity: 1,
      fulfillmentType: 'delivery',
      sourceType: promo.sourceType,
      sourceCode: promo.sourceCode,
      referrerUserId: promo.referrerUserId,
    })
    uni.showToast({ title: '抢购成功，请支付', icon: 'success' })
    setTimeout(() => payOrder(result.orderId), 800)
  } catch (err: any) {
    uni.showToast({ title: err?.message || '秒杀失败', icon: 'none' })
  } finally {
    submitting.value = false
  }
}

async function payOrder(orderId: string) {
  try {
    const payment = await createPayment({ orderId })
    await wxPay(payment)
    uni.showToast({ title: '支付成功', icon: 'success' })
    setTimeout(() => {
      uni.redirectTo({ url: `/pages/order/detail?id=${orderId}` })
    }, 1500)
  } catch (err: any) {
    const msg = err?.errMsg || err?.message || ''
    if (msg.includes('cancel')) {
      uni.showModal({
        title: '支付未完成',
        content: '请在订单列表中尽快完成支付，否则锁库存将过期',
        showCancel: false,
        confirmText: '查看订单',
        success: () => {
          uni.redirectTo({ url: `/pages/order/detail?id=${orderId}` })
        },
      })
      return
    }
    uni.showToast({ title: '支付失败', icon: 'none' })
  }
}

onLoad((options) => {
  if (options?.id) {
    loadDetail(options.id)
  }
})

onShareAppMessage(() => ({
  title: activity.value?.name || '限时秒杀，手慢无',
  path: `/pages/flash-sale/detail?id=${activity.value?.id || ''}&inviter=${userStore.userInfo?.id || ''}`,
}))
</script>

<style lang="scss" scoped>
.flash-sale-detail-page {
  min-height: 100vh;
  padding: 16rpx;
  padding-bottom: 140rpx;
}
.detail-card {
  background: #fff;
  border-radius: 16rpx;
  overflow: hidden;
}
.cover-wrap {
  width: 100%;
}
.cover {
  width: 100%;
  height: 400rpx;
  background: #f5f5f5;
}
.cover-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
}
.placeholder-text {
  color: #ccc;
  font-size: 32rpx;
}
.info-section {
  padding: 24rpx;
}
.name {
  font-size: 32rpx;
  font-weight: 700;
  color: #333;
  margin-bottom: 16rpx;
}
.price-row {
  display: flex;
  align-items: baseline;
  gap: 16rpx;
  margin-bottom: 24rpx;
}
.flash-price {
  color: #f56c6c;
  font-size: 48rpx;
  font-weight: 800;
}
.origin-price {
  color: #c0c4cc;
  font-size: 28rpx;
  text-decoration: line-through;
}
.meta-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 16rpx;
  margin-bottom: 24rpx;
}
.meta-item {
  width: 48%;
  display: flex;
  justify-content: space-between;
  padding: 12rpx 16rpx;
  background: #f9f9f9;
  border-radius: 8rpx;
}
.meta-label {
  font-size: 24rpx;
  color: #909399;
}
.meta-value {
  font-size: 24rpx;
  color: #333;
  font-weight: 600;
}
.meta-value.status-running {
  color: #f56c6c;
}
.meta-value.status-pending {
  color: #e6a23c;
}
.meta-value.status-end {
  color: #909399;
}
.countdown-row {
  display: flex;
  align-items: center;
  gap: 12rpx;
  padding: 16rpx;
  background: rgba(245, 108, 108, 0.08);
  border-radius: 8rpx;
  margin-bottom: 24rpx;
}
.countdown-label {
  font-size: 26rpx;
  color: #f56c6c;
}
.countdown-value {
  font-size: 32rpx;
  color: #f56c6c;
  font-weight: 700;
}
.desc-section {
  margin-top: 16rpx;
}
.desc-title {
  font-size: 28rpx;
  font-weight: 600;
  color: #333;
  margin-bottom: 8rpx;
  display: block;
}
.desc-content {
  font-size: 26rpx;
  color: #606266;
  line-height: 1.6;
}
.bottom-bar {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  padding: 16rpx 24rpx;
  background: #fff;
  border-top: 1rpx solid #eee;
  z-index: 10;
}
.buy-btn {
  width: 100%;
  border-radius: 48rpx;
  background: #f56c6c;
  color: #fff;
  font-size: 32rpx;
  font-weight: 700;
  padding: 20rpx 0;
}
.buy-btn[disabled] {
  background: #c0c4cc;
  color: #fff;
}
.btn-text {
  color: inherit;
}
</style>
