<template>
  <view class="points-page page-shell">
    <view class="points-header">
      <view class="points-balance">
        <text class="balance-label">可用积分</text>
        <text class="balance-value">{{ pointsBalance.balance }}</text>
      </view>
      <view class="points-stats">
        <view class="stat-item">
          <text class="stat-value">{{ pointsBalance.totalEarned }}</text>
          <text class="stat-label">累计获得</text>
        </view>
        <view class="stat-item">
          <text class="stat-value">{{ pointsBalance.totalSpent }}</text>
          <text class="stat-label">累计消耗</text>
        </view>
      </view>
    </view>

    <view class="checkin-section card">
      <view class="checkin-info">
        <text class="checkin-label">每日签到</text>
        <text class="checkin-continuous">已连续签到{{ checkInStatus.continuous }}天</text>
      </view>
      <view class="checkin-btn" :class="{ checked: checkInStatus.checked }" @tap="handleCheckIn">
        <text class="checkin-text">{{ checkInStatus.checked ? '已签到' : '签到' }}</text>
      </view>
    </view>

    <view class="detail-section">
      <text class="section-title">积分明细</text>
      <view v-for="item in pointsDetail" :key="item.id" class="detail-item card">
        <view class="detail-info">
          <text class="detail-desc">{{ item.description }}</text>
          <text class="detail-time">{{ item.createTime }}</text>
        </view>
        <text class="detail-points" :class="{ earn: item.points > 0, spend: item.points < 0 }">
          {{ item.points > 0 ? '+' : '' }}{{ item.points }}
        </text>
      </view>
    </view>

    <view class="rules-section card">
      <text class="section-title">积分规则</text>
      <view v-for="rule in pointsRules" :key="rule.action" class="rule-item">
        <text class="rule-action">{{ rule.action }}</text>
        <text class="rule-value">+{{ rule.points }}</text>
      </view>
    </view>

    <Loading v-if="loading" />
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { onReachBottom, onPullDownRefresh } from '@dcloudio/uni-app'
import { getPointsBalance, getPointsDetail, checkIn, getCheckInStatus, getPointsRules, type PointsRecord, type PointsRule } from '@/api/points'
import Loading from '@/components/Loading.vue'

const pointsBalance = ref({ balance: 0, totalEarned: 0, totalSpent: 0 })
const checkInStatus = ref({ checked: false, continuous: 0, todayPoints: 0 })
const pointsDetail = ref<PointsRecord[]>([])
const pointsRules = ref<PointsRule[]>([])
const loading = ref(false)
const page = ref(1)
const finished = ref(false)

async function loadBalance() {
  try {
    pointsBalance.value = await getPointsBalance()
  } catch {
    uni.showToast({ title: '积分加载失败', icon: 'none' })
  }
}

async function loadCheckInStatus() {
  try {
    checkInStatus.value = await getCheckInStatus()
  } catch {
    uni.showToast({ title: '签到状态加载失败', icon: 'none' })
  }
}

async function loadPointsDetail(reset = false) {
  if (loading.value) return
  if (!reset && finished.value) return
  if (reset) {
    page.value = 1
    finished.value = false
    pointsDetail.value = []
  }

  loading.value = true
  try {
    const data = await getPointsDetail({ page: page.value, pageSize: 10 })
    pointsDetail.value.push(...data.list)
    finished.value = pointsDetail.value.length >= data.total
    page.value++
  } catch {
    uni.showToast({ title: '明细加载失败', icon: 'none' })
  } finally {
    loading.value = false
  }
}

async function loadRules() {
  try {
    pointsRules.value = await getPointsRules()
  } catch {
    uni.showToast({ title: '规则加载失败', icon: 'none' })
  }
}

async function handleCheckIn() {
  if (checkInStatus.value.checked) return
  try {
    const data = await checkIn()
    checkInStatus.value.checked = true
    checkInStatus.value.continuous = data.continuous
    uni.showToast({ title: `签到成功，+${data.points}积分`, icon: 'none' })
    await loadBalance()
    loadPointsDetail(true)
  } catch {
    uni.showToast({ title: '签到失败', icon: 'none' })
  }
}

onPullDownRefresh(async () => {
  await Promise.all([loadBalance(), loadCheckInStatus(), loadPointsDetail(true)])
  uni.stopPullDownRefresh()
})

onReachBottom(() => {
  loadPointsDetail()
})

onMounted(() => {
  loadBalance()
  loadCheckInStatus()
  loadPointsDetail()
  loadRules()
})
</script>

<style lang="scss" scoped>
.points-page {
  min-height: 100vh;
}

.points-header {
  background:
    radial-gradient(circle at 86% 18%, rgba($success-color, 0.18) 0%, rgba($success-color, 0) 240rpx),
    $gradient-peach;
  padding: $spacing-xl $spacing-md;
  border-radius: 0 0 $radius-xxl $radius-xxl;
}

.points-balance {
  text-align: center;
  margin-bottom: $spacing-lg;
}

.balance-label {
  font-size: $font-sm;
  color: $text-secondary;
  display: block;
}

.balance-value {
  font-size: 72rpx;
  color: $price-color;
  font-weight: 800;
}

.points-stats {
  display: flex;
  justify-content: center;
  gap: 80rpx;
}

.stat-item {
  text-align: center;
}

.stat-value {
  font-size: $font-lg;
  color: $text-color;
  font-weight: 800;
  display: block;
}

.stat-label {
  font-size: $font-xs;
  color: $text-hint;
}

.checkin-section {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin: $spacing-md;
  background: rgba(255, 255, 255, 0.9);
}

.checkin-info {
  flex: 1;
}

.checkin-label {
  font-size: $font-md;
  font-weight: 600;
  color: $text-color;
  display: block;
}

.checkin-continuous {
  font-size: $font-xs;
  color: $text-hint;
  margin-top: 4rpx;
  display: block;
}

.checkin-btn {
  background: $gradient-coral;
  border-radius: $radius-round;
  padding: 16rpx 40rpx;
  box-shadow: $shadow-coral;

  &.checked {
    background: $bg-gray;
    box-shadow: none;
  }
}

.checkin-text {
  color: #FFFFFF;
  font-size: $font-sm;
  font-weight: 500;

  .checked & { color: $text-hint; }
}

.detail-section {
  padding: 0 $spacing-md;
}

.section-title {
  font-size: $font-lg;
  font-weight: 800;
  color: $text-color;
  display: block;
  margin-bottom: $spacing-sm;
}

.detail-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: $spacing-sm;
  border-radius: $radius-xl;
  background: rgba(255, 255, 255, 0.9);
}

.detail-info {
  flex: 1;
}

.detail-desc {
  font-size: $font-sm;
  color: $text-color;
  display: block;
}

.detail-time {
  font-size: $font-xs;
  color: $text-hint;
  display: block;
  margin-top: 4rpx;
}

.detail-points {
  font-size: $font-md;
  font-weight: 600;

  &.earn { color: $success-dark; }
  &.spend { color: $text-secondary; }
}

.rules-section {
  margin: $spacing-md;
  background: rgba(255, 255, 255, 0.9);
}

.rule-item {
  @include flex-between;
  padding: 12rpx 0;
  border-bottom: 1rpx solid $divider-color;

  &:last-child { border-bottom: none; }
}

.rule-action {
  font-size: $font-sm;
  color: $text-secondary;
}

.rule-value {
  font-size: $font-sm;
  color: $price-color;
  font-weight: 500;
}
</style>
