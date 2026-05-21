<template>
  <view class="aftersale-detail-page">
    <view class="status-section" :class="getStatusClass(detail.status)">
      <text class="status-text">{{ formatAftersaleStatus(detail.status) }}</text>
    </view>

    <view class="progress-section card">
      <text class="section-title">售后进度</text>
      <view v-for="(log, index) in detail.logs" :key="index" class="progress-item">
        <view class="progress-dot" :class="{ active: index === 0 }"></view>
        <view class="progress-info">
          <text class="progress-content">{{ log.content }}</text>
          <text class="progress-time">{{ log.time }}</text>
        </view>
      </view>
    </view>

    <view class="product-section card">
      <view class="product-row">
        <image class="product-image" :src="detail.productImage" mode="aspectFill" />
        <view class="product-info">
          <text class="product-name">{{ detail.productName }}</text>
          <text class="product-sku">{{ detail.skuName }}</text>
          <view class="product-bottom">
            <PriceDisplay :price="detail.price" />
            <text class="product-qty">x{{ detail.quantity }}</text>
          </view>
        </view>
      </view>
    </view>

    <view class="info-section card">
      <view class="info-row">
        <text class="info-label">售后类型</text>
        <text class="info-value">{{ detail.type === 1 ? '退款' : detail.type === 2 ? '退货退款' : '换货' }}</text>
      </view>
      <view class="info-row">
        <text class="info-label">退款原因</text>
        <text class="info-value">{{ detail.reason }}</text>
      </view>
      <view class="info-row">
        <text class="info-label">问题描述</text>
        <text class="info-value">{{ detail.description }}</text>
      </view>
      <view v-if="detail.refundAmount" class="info-row">
        <text class="info-label">退款金额</text>
        <text class="info-value price">¥{{ formatPrice(detail.refundAmount) }}</text>
      </view>
      <view v-if="detail.images?.length" class="info-row vertical">
        <text class="info-label">凭证图片</text>
        <view class="image-list">
          <image v-for="(img, index) in detail.images" :key="index" class="evidence-image" :src="img" mode="aspectFill" @tap="previewImage(img)" />
        </view>
      </view>
    </view>

    <view v-if="detail.status === 10" class="bottom-bar">
      <view class="cancel-btn" @tap="handleCancel">取消申请</view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { getAftersaleDetail, cancelAftersale, type AftersaleDetail } from '@/api/aftersale'
import { formatAftersaleStatus, formatPrice } from '@/utils/format'
import PriceDisplay from '@/components/PriceDisplay.vue'

const detail = ref<AftersaleDetail>({
  id: 0, orderId: 0, orderNo: '', type: 1, reason: '', description: '',
  images: [], status: 0, refundAmount: 0, productName: '', productImage: '',
  skuName: '', price: 0, quantity: 0, logs: [], createTime: ''
})

async function loadDetail(id: number) {
  try {
    detail.value = await getAftersaleDetail(id)
  } catch {}
}

function getStatusClass(status: number): string {
  const map: Record<number, string> = {
    10: 'pending',
    20: 'processing',
    30: 'completed',
    40: 'rejected',
    50: 'cancelled'
  }
  return map[status] || ''
}

function previewImage(url: string) {
  uni.previewImage({ urls: detail.value.images, current: url })
}

async function handleCancel() {
  uni.showModal({
    title: '提示',
    content: '确定取消售后申请吗？',
    success: async (res) => {
      if (res.confirm) {
        await cancelAftersale(detail.value.id)
        loadDetail(detail.value.id)
      }
    }
  })
}

onLoad((options) => {
  if (options?.id) loadDetail(Number(options.id))
})
</script>

<style lang="scss" scoped>
.aftersale-detail-page {
  min-height: 100vh;
  background: $bg-color;
  padding-bottom: 120rpx;
}

.status-section {
  padding: $spacing-lg $spacing-md;
  color: #FFFFFF;

  &.pending { background: $warning-color; }
  &.processing { background: $info-color; }
  &.completed { background: $success-color; }
  &.rejected { background: $danger-color; }
  &.cancelled { background: $text-hint; }
}

.status-text {
  font-size: $font-xl;
  font-weight: 600;
}

.progress-section,
.product-section,
.info-section {
  margin: $spacing-sm $spacing-md;
}

.section-title {
  font-size: $font-md;
  font-weight: 600;
  color: $text-color;
  display: block;
  margin-bottom: $spacing-md;
}

.progress-item {
  display: flex;
  align-items: flex-start;
  padding-bottom: $spacing-md;
  position: relative;
  padding-left: 32rpx;

  &::before {
    content: '';
    position: absolute;
    left: 9rpx;
    top: 24rpx;
    bottom: 0;
    width: 2rpx;
    background: $divider-color;
  }

  &:last-child::before { display: none; }
}

.progress-dot {
  position: absolute;
  left: 0;
  top: 8rpx;
  width: 20rpx;
  height: 20rpx;
  border-radius: 50%;
  background: $border-color;

  &.active { background: $primary-color; }
}

.progress-info {
  flex: 1;
}

.progress-content {
  font-size: $font-sm;
  color: $text-color;
  display: block;
}

.progress-time {
  font-size: $font-xs;
  color: $text-hint;
  display: block;
  margin-top: 4rpx;
}

.product-row {
  display: flex;
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

.product-bottom {
  @include flex-between;
  margin-top: 8rpx;
}

.product-qty {
  font-size: $font-xs;
  color: $text-hint;
}

.info-row {
  @include flex-between;
  padding: 12rpx 0;
  border-bottom: 1rpx solid $divider-color;

  &:last-child { border-bottom: none; }

  &.vertical {
    flex-direction: column;
    align-items: flex-start;
  }
}

.info-label {
  font-size: $font-sm;
  color: $text-hint;
}

.info-value {
  font-size: $font-sm;
  color: $text-color;

  &.price { color: $primary-color; font-weight: 600; }
}

.image-list {
  display: flex;
  flex-wrap: wrap;
  gap: $spacing-sm;
  margin-top: $spacing-sm;
}

.evidence-image {
  width: 160rpx;
  height: 160rpx;
  border-radius: $radius-md;
}

.bottom-bar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  display: flex;
  justify-content: center;
  padding: $spacing-sm $spacing-md;
  background: $bg-white;
  @include safe-bottom;
}

.cancel-btn {
  padding: 20rpx 80rpx;
  border: 2rpx solid $border-color;
  border-radius: $radius-round;
  font-size: $font-md;
  color: $text-secondary;
}
</style>
