<template>
  <view class="coupon-center-page page-shell">
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
          <view
            class="coupon-action"
            :class="{ disabled: item.received || item.remainCount <= 0 || isReceiving(item.id) }"
            @tap="handleReceive(item)"
          >
            <text class="action-text">{{ isReceiving(item.id) ? '领取中' : item.received ? '已领取' : item.remainCount <= 0 ? '已抢光' : '领取' }}</text>
          </view>
        </view>
      </view>
    </view>

    <Loading v-if="loading" />
    <Empty v-if="!loading && coupons.length === 0" text="暂无优惠券" />
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { onReachBottom, onPullDownRefresh, onShow } from '@dcloudio/uni-app'
import { getClaimableCoupons, getCouponCenter, receiveCoupon, type CouponItem } from '@/api/coupon'
import { formatPrice, formatCouponValue } from '@/utils/format'
import { useUserStore } from '@/stores/user'
import Loading from '@/components/Loading.vue'
import Empty from '@/components/Empty.vue'

const userStore = useUserStore()
const coupons = ref<CouponItem[]>([])
const loading = ref(false)
const receivingCouponIds = ref<Set<string>>(new Set())
const page = ref(1)
const finished = ref(false)
let couponVersion = 0
let loadingVersion = -1

async function loadCoupons(reset = false, version = couponVersion) {
  if (!reset && finished.value && version === couponVersion) return
  if (loading.value && loadingVersion === version) return
  if (reset) {
    page.value = 1
    finished.value = false
    coupons.value = []
  }

  const requestPage = page.value
  const loggedIn = userStore.isLoggedIn
  loading.value = true
  loadingVersion = version
  try {
    if (loggedIn) {
      // /available has already applied member-level, new-customer, stock and per-user-limit rules.
      // It only contains coupons this account can still claim. Ignore its historical `received`
      // flag because a perLimit > 1 coupon may legitimately have been received before and still be
      // claimable now.
      const data = await getClaimableCoupons()
      if (version !== couponVersion) return
      coupons.value = data.map((item) => ({ ...item, received: false }))
      finished.value = true
      return
    }

    const data = await getCouponCenter({ page: requestPage, pageSize: 10 })
    if (version !== couponVersion) return
    coupons.value.push(...data.list)
    finished.value = coupons.value.length >= data.total
    page.value = requestPage + 1
  } catch {
    if (version === couponVersion) {
      uni.showToast({ title: '加载失败', icon: 'none' })
    }
  } finally {
    if (version === couponVersion) {
      loading.value = false
      loadingVersion = -1
    }
  }
}

function refreshCoupons() {
  const version = ++couponVersion
  return loadCoupons(true, version)
}

function isReceiving(couponId: string) {
  return receivingCouponIds.value.has(couponId)
}

function setReceiving(couponId: string, receiving: boolean) {
  const next = new Set(receivingCouponIds.value)
  if (receiving) next.add(couponId)
  else next.delete(couponId)
  receivingCouponIds.value = next
}

async function handleReceive(item: CouponItem) {
  if (item.received || item.remainCount <= 0 || isReceiving(item.id)) return

  if (!userStore.isLoggedIn) {
    userStore.requireLogin(async () => {
      try {
        // Authentication may happen while an anonymous center request is still in flight. Start a
        // new versioned eligibility read so that old anonymous cards can never overwrite the
        // signed-in account's claimable set.
        await refreshCoupons()
        const current = coupons.value.find((coupon) => coupon.id === item.id)
        if (!current) {
          uni.showToast({ title: '当前账号不符合该优惠券领取条件', icon: 'none' })
          return
        }
        await handleReceive(current)
      } catch {
        uni.showToast({ title: '优惠券资格刷新失败', icon: 'none' })
      }
    })
    return
  }

  // perLimit can legitimately be > 1, so backend idempotency cannot distinguish an intentional
  // second claim from a rapid double-tap. Serialize the UI action per coupon to ensure one physical
  // interaction consumes at most one claim and one unit of campaign inventory.
  setReceiving(item.id, true)
  try {
    await receiveCoupon(item.id)
    uni.showToast({ title: '领取成功', icon: 'success' })
    // Server is authoritative for per-user limits. A coupon with perLimit > 1 should remain in the
    // center until the account actually reaches that limit; a fully claimed coupon disappears.
    await refreshCoupons()
  } catch (error: any) {
    uni.showToast({ title: error?.message || '领取失败', icon: 'none' })
    await refreshCoupons()
  } finally {
    setReceiving(item.id, false)
  }
}

onPullDownRefresh(async () => {
  await refreshCoupons()
  uni.stopPullDownRefresh()
})

onReachBottom(() => {
  void loadCoupons(false, couponVersion)
})

onShow(() => {
  void refreshCoupons()
})

defineExpose({
  coupons,
  loading,
  receivingCouponIds,
  loadCoupons,
  refreshCoupons,
  handleReceive,
})
</script>

<style lang="scss" scoped>
.coupon-center-page {
  min-height: 100vh;
  padding: $spacing-md;
}

.coupon-card {
  display: flex;
  background: $gradient-card;
  border-radius: $radius-xxl;
  overflow: hidden;
  margin-bottom: $spacing-md;
  border: 1rpx solid rgba($border-color, 0.78);
  box-shadow: $shadow-sm;
}

.coupon-left {
  width: 200rpx;
  @include flex-center;
  @include flex-column;
  background: $gradient-coral;
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
  font-weight: 800;
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
  min-height: 56rpx;
  padding: 0 28rpx;
  border: 2rpx solid rgba($primary-color, 0.36);
  border-radius: $radius-round;
  @include flex-center;
  background: rgba(255, 255, 255, 0.9);

  &.disabled {
    border-color: $border-color;
    background: $bg-soft;
  }
}

.action-text {
  font-size: $font-xs;
  color: $primary-dark;
  font-weight: 700;

  .disabled & { color: $text-hint; }
}
</style>