<template>
  <view class="coupon-center-page">
    <view class="coupon-list">
      <view v-for="item in coupons" :key="item.id" class="coupon-card">
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
          <view class="coupon-action" :class="{ disabled: item.received || item.remainCount <= 0 }" @tap="handleReceive(item)">
            <text class="action-text">{{ item.received ? '已领取' : item.remainCount <= 0 ? '已抢光' : '领取' }}</text>
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
import { getCouponCenter, receiveCoupon, type CouponItem } from '@/api/coupon'
import { formatPrice, formatCouponValue } from '@/utils/format'
import Loading from '@/components/Loading.vue'
import Empty from '@/components/Empty.vue'

const coupons = ref<CouponItem[]>([])
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
    const data = await getCouponCenter({ page: page.value, pageSize: 10 })
    coupons.value.push(...data.list)
    finished.value = coupons.value.length >= data.total
    page.value++
  } catch {} finally {
    loading.value = false
  }
}

async function handleReceive(item: CouponItem) {
  if (item.received || item.remainCount <= 0) return
  try {
    await receiveCoupon(item.id)
    uni.showToast({ title: '领取成功', icon: 'success' })
    item.received = true
    item.remainCount--
  } catch {}
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
.coupon-center-page {
  min-height: 100vh;
  background: $bg-color;
  padding: $spacing-md;
}

.coupon-card {
  display: flex;
  background: $bg-white;
  border-radius: $radius-lg;
  overflow: hidden;
  margin-bottom: $spacing-md;
  box-shadow: $shadow-sm;
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

.coupon-action {
  align-self: flex-start;
  padding: 8rpx 24rpx;
  border: 2rpx solid $primary-color;
  border-radius: $radius-round;

  &.disabled {
    border-color: $border-color;
  }
}

.action-text {
  font-size: $font-xs;
  color: $primary-color;

  .disabled & { color: $text-hint; }
}
</style>
