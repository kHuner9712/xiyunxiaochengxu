<template>
  <view class="my-coupon-page">
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

    <view class="coupon-list">
      <view v-for="item in coupons" :key="item.id" class="coupon-card" :class="{ used: item.status === 2, expired: item.status === 3 }">
        <view class="coupon-left">
          <view class="coupon-value">
            <text v-if="item.type === 1 || item.type === 3" class="value-symbol">¥</text>
            <text class="value-num">{{ formatCouponValue(item) }}</text>
          </view>
          <text class="coupon-condition">{{ item.minAmount > 0 ? `满${formatPrice(item.minAmount)}可用` : '无门槛' }}</text>
        </view>
        <view class="coupon-right">
          <text class="coupon-name">{{ item.name }}</text>
          <text class="coupon-time">{{ item.startTime }} - {{ item.endTime }}</text>
          <text v-if="item.status === 2" class="coupon-status used">已使用</text>
          <text v-if="item.status === 3" class="coupon-status expired">已过期</text>
          <view v-if="item.status === 1" class="coupon-use-btn" @tap="goUse">
            <text class="use-text">去使用</text>
          </view>
        </view>
      </view>
    </view>

    <Loading v-if="loading" />
    <Empty v-if="!loading && coupons.length === 0" text="暂无优惠券" />
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { onReachBottom, onPullDownRefresh } from '@dcloudio/uni-app'
import { getMyCoupons, type MyCouponItem } from '@/api/coupon'
import { formatPrice, formatCouponValue } from '@/utils/format'
import Loading from '@/components/Loading.vue'
import Empty from '@/components/Empty.vue'

const tabs = [
  { label: '可用', value: 1 },
  { label: '已使用', value: 2 },
  { label: '已过期', value: 3 }
]

const currentTab = ref(1)
const coupons = ref<MyCouponItem[]>([])
const loading = ref(false)
const page = ref(1)
const finished = ref(false)

async function loadCoupons(reset = false) {
  if (loading.value) return
  if (!reset && finished.value) return
  if (reset) {
    page.value = 1
    finished.value = false
    coupons.value = []
  }
  loading.value = true
  try {
    const data = await getMyCoupons({ status: currentTab.value, page: page.value, pageSize: 10 })
    coupons.value.push(...data.list)
    finished.value = coupons.value.length >= data.total
    page.value++
  } catch {} finally {
    loading.value = false
  }
}

function switchTab(value: number) {
  currentTab.value = value
  loadCoupons(true)
}

function goUse() {
  uni.switchTab({ url: '/pages/home/index' })
}

onPullDownRefresh(async () => {
  await loadCoupons(true)
  uni.stopPullDownRefresh()
})

onReachBottom(() => {
  loadCoupons()
})

onMounted(() => {
  loadCoupons()
})
</script>

<style lang="scss" scoped>
.my-coupon-page {
  min-height: 100vh;
  background: $bg-color;
}

.tab-bar {
  display: flex;
  background: $bg-white;
  padding: $spacing-sm 0;
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

.coupon-list {
  padding: $spacing-md;
}

.coupon-card {
  display: flex;
  background: $bg-white;
  border-radius: $radius-lg;
  overflow: hidden;
  margin-bottom: $spacing-md;
  box-shadow: $shadow-sm;

  &.used, &.expired {
    opacity: 0.6;
  }
}

.coupon-left {
  width: 200rpx;
  @include flex-center;
  @include flex-column;
  background: linear-gradient(135deg, $primary-color, $primary-light);
  padding: $spacing-md;
  flex-shrink: 0;
}

.coupon-value {
  color: #FFFFFF;
  font-weight: 700;
  display: flex;
  align-items: baseline;
}

.value-symbol {
  font-size: $font-sm;
}

.value-num {
  font-size: $font-xxl;
}

.coupon-condition {
  font-size: $font-xs;
  color: rgba(255, 255, 255, 0.8);
  margin-top: 4rpx;
}

.coupon-right {
  flex: 1;
  padding: $spacing-md;
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.coupon-name {
  font-size: $font-md;
  font-weight: 600;
  color: $text-color;
  display: block;
  margin-bottom: 8rpx;
}

.coupon-time {
  font-size: $font-xs;
  color: $text-hint;
  display: block;
  margin-bottom: $spacing-sm;
}

.coupon-status {
  font-size: $font-xs;

  &.used { color: $text-hint; }
  &.expired { color: $text-hint; }
}

.coupon-use-btn {
  align-self: flex-start;
  padding: 8rpx 24rpx;
  border: 2rpx solid $primary-color;
  border-radius: $radius-round;
}

.use-text {
  font-size: $font-xs;
  color: $primary-color;
}
</style>
