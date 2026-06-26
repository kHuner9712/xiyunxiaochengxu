<template>
  <view class="group-detail-page page-shell">
    <view v-if="group" class="group-detail-card card">
      <view class="status-banner" :class="`status-${group.status}`">
        <text class="status-text">{{ statusText(group.status) }}</text>
        <text v-if="group.status === 'forming'" class="status-sub">剩 {{ remainTime(group.expiresAt) }}</text>
        <text v-else-if="group.status === 'success' && group.successAt" class="status-sub">成团时间 {{ formatDateTime(group.successAt) }}</text>
        <text v-else-if="group.status === 'failed' && group.failedAt" class="status-sub">失败时间 {{ formatDateTime(group.failedAt) }}</text>
      </view>

      <view v-if="group.activity" class="activity-info">
        <image
          v-if="group.activity.coverImage"
          class="cover"
          :src="group.activity.coverImage"
          mode="aspectFill"
        />
        <view v-else class="cover cover-placeholder">
          <text class="placeholder-text">拼团</text>
        </view>
        <view class="info-right">
          <view class="act-name">{{ group.activity.name }}</view>
          <view class="price-row">
            <text class="price">¥{{ formatPrice(group.activity.groupPrice) }}</text>
            <text class="size">{{ group.activity.groupSize }}人成团</text>
          </view>
        </view>
      </view>

      <view class="progress-section">
        <view class="progress-bar">
          <view class="progress-inner" :style="{ width: progressPercent + '%' }" />
        </view>
        <view class="progress-text-row">
          <text class="progress-count">{{ group.currentCount }}/{{ group.targetCount }}人</text>
          <text class="group-no">团号：{{ group.groupNo }}</text>
        </view>
      </view>

      <view class="members-section">
        <view class="section-title">团成员</view>
        <view v-for="m in group.members" :key="m.id" class="member-item">
          <image v-if="m.user?.avatar" class="avatar" :src="m.user.avatar" mode="aspectFill" />
          <view v-else class="avatar avatar-placeholder" />
          <view class="member-info">
            <view class="member-top">
              <text class="member-name">{{ m.user?.nickname || '用户' + m.userId }}</text>
              <text v-if="m.role === 'leader'" class="role-tag leader">团长</text>
              <text v-else class="role-tag member">团员</text>
            </view>
            <text class="member-status" :class="`m-status-${m.status}`">{{ memberStatusText(m.status) }}</text>
          </view>
          <text v-if="m.paidAt" class="paid-time">{{ formatDateTime(m.paidAt) }}</text>
        </view>
      </view>

      <view v-if="canJoin" class="bottom-bar">
        <button class="join-btn" @tap="goJoin">参与此团</button>
      </view>
      <button v-else class="share-btn" open-type="share">邀请好友拼团</button>
    </view>

    <Loading v-if="loading" />
  </view>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { onLoad, onShareAppMessage } from '@dcloudio/uni-app'
import { groupBuyApi, type GroupBuyGroup } from '@/api/group-buy'
import { useUserStore } from '@/stores/user'
import Loading from '@/components/Loading.vue'

const userStore = useUserStore()
const group = ref<GroupBuyGroup | null>(null)
const loading = ref(false)

function formatPrice(cents: number): string {
  return (cents / 100).toFixed(2)
}

function remainTime(expiresAt: string): string {
  const ms = new Date(expiresAt).getTime() - Date.now()
  if (ms <= 0) return '已过期'
  const hours = Math.floor(ms / 3600000)
  const mins = Math.floor((ms % 3600000) / 60000)
  return hours > 0 ? `${hours}h${mins}m` : `${mins}m`
}

function formatDate(s: string): string {
  const d = new Date(s)
  if (isNaN(d.getTime())) return s
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function formatDateTime(s: string): string {
  const d = new Date(s)
  if (isNaN(d.getTime())) return s
  return `${formatDate(s)} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function statusText(status: string): string {
  switch (status) {
    case 'forming': return '组团中'
    case 'success': return '已成团'
    case 'failed': return '已失败'
    case 'cancelled': return '已取消'
    default: return status
  }
}

function memberStatusText(status: string): string {
  switch (status) {
    case 'pending_payment': return '待支付'
    case 'paid': return '已支付'
    case 'cancelled': return '已取消'
    case 'refunded': return '已退款'
    default: return status
  }
}

const progressPercent = computed(() => {
  if (!group.value) return 0
  const target = group.value.targetCount || 1
  return Math.min(100, Math.round((group.value.currentCount / target) * 100))
})

const canJoin = computed(() => {
  if (!group.value) return false
  if (group.value.status !== 'forming') return false
  if (new Date(group.value.expiresAt).getTime() <= Date.now()) return false
  if (group.value.currentCount >= group.value.targetCount) return false
  // 已加入该团则不能再次参团
  const meId = String(userStore.userInfo?.id || '')
  if (!meId) return true
  return !group.value.members?.some((m: any) => String(m.userId) === meId)
})

async function loadDetail(id: string) {
  loading.value = true
  try {
    const data = await groupBuyApi.getGroupDetail(id)
    group.value = data
  } catch {
    uni.showToast({ title: '加载失败', icon: 'none' })
  } finally {
    loading.value = false
  }
}

function goJoin() {
  if (!group.value) return
  if (!userStore.isLoggedIn) {
    userStore.requireLogin(() => goJoin())
    return
  }
  uni.navigateTo({
    url: `/pages/group-buy/detail?id=${group.value!.activityId}`,
  })
}

onLoad((options) => {
  if (options?.id) {
    loadDetail(options.id)
  }
})

onShareAppMessage(() => ({
  title: group.value?.activity?.name || '快来一起拼团',
  path: `/pages/group-buy/group?id=${group.value?.id || ''}&activityId=${group.value?.activityId || ''}&inviter=${userStore.userInfo?.id || ''}`,
}))
</script>

<style lang="scss" scoped>
.group-detail-page {
  min-height: 100vh;
  padding: $spacing-sm $spacing-md;
  padding-bottom: 60rpx;
}

.group-detail-card {
  background: $gradient-card;
  border-radius: $radius-xxl;
  padding: $spacing-md;
  border: 1rpx solid rgba($border-color, 0.78);
  box-shadow: $shadow-md;
}

.status-banner {
  display: flex;
  align-items: baseline;
  gap: $spacing-sm;
  padding: 20rpx $spacing-md;
  border-radius: $radius-lg;
  margin-bottom: $spacing-md;
}

.status-banner.status-forming {
  background: $primary-soft;
}

.status-banner.status-success {
  background: $success-soft;
}

.status-banner.status-failed,
.status-banner.status-cancelled {
  background: $info-soft;
}

.status-text {
  font-size: $font-lg;
  font-weight: 800;
  color: $text-color;
}

.status-sub {
  font-size: $font-sm;
  color: $text-secondary;
}

.activity-info {
  display: flex;
  margin-bottom: $spacing-md;
}

.cover {
  width: 160rpx;
  height: 160rpx;
  border-radius: $radius-lg;
  background: $bg-ivory;
  flex-shrink: 0;
}

.cover-placeholder {
  @include flex-center;
}

.placeholder-text {
  color: $text-hint;
  font-size: $font-sm;
}

.info-right {
  flex: 1;
  min-width: 0;
  margin-left: $spacing-sm;
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.act-name {
  font-size: $font-md;
  font-weight: 700;
  color: $text-color;
  margin-bottom: $spacing-sm;
  line-height: 1.4;
  @include text-ellipsis-2;
}

.price-row {
  display: flex;
  align-items: baseline;
  gap: $spacing-sm;
}

.price {
  color: $price-color;
  font-size: $font-lg;
  font-weight: 800;
}

.size {
  color: $warning-color;
  font-size: $font-sm;
}

.progress-section {
  margin-bottom: $spacing-md;
}

.progress-bar {
  width: 100%;
  height: 16rpx;
  background: $bg-gray;
  border-radius: $radius-round;
  overflow: hidden;
  margin-bottom: $spacing-sm;
}

.progress-inner {
  height: 100%;
  background: $gradient-coral;
  transition: width 0.3s;
}

.progress-text-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.progress-count {
  color: $price-color;
  font-size: $font-md;
  font-weight: 700;
}

.group-no {
  color: $text-hint;
  font-size: $font-sm;
  @include text-ellipsis;
}

.members-section {
  margin-top: $spacing-md;
}

.section-title {
  font-size: $font-md;
  font-weight: 700;
  color: $text-color;
  margin-bottom: $spacing-md;
}

.member-item {
  display: flex;
  align-items: center;
  padding: $spacing-sm 0;
  border-bottom: 1rpx solid $divider-color;

  &:last-child {
    border-bottom: none;
  }
}

.avatar {
  width: 64rpx;
  height: 64rpx;
  border-radius: 50%;
  background: $bg-ivory;
  flex-shrink: 0;
}

.avatar-placeholder {
  background: $bg-gray;
}

.member-info {
  flex: 1;
  min-width: 0;
  margin-left: $spacing-sm;
}

.member-top {
  display: flex;
  align-items: center;
  gap: $spacing-xs;
  margin-bottom: 4rpx;
}

.member-name {
  font-size: $font-sm;
  color: $text-color;
  @include text-ellipsis;
}

.role-tag {
  font-size: 20rpx;
  padding: 2rpx 12rpx;
  border-radius: $radius-round;
  font-weight: 700;
}

.role-tag.leader {
  background: $primary-soft;
  color: $primary-dark;
}

.role-tag.member {
  background: $info-soft;
  color: $text-hint;
}

.member-status {
  font-size: $font-xs;
  color: $text-hint;
}

.member-status.m-status-paid {
  color: $success-dark;
}

.member-status.m-status-pending_payment {
  color: $warning-color;
}

.member-status.m-status-cancelled,
.member-status.m-status-refunded {
  color: $text-hint;
}

.paid-time {
  font-size: $font-xs;
  color: $text-hint;
}

.bottom-bar {
  margin-top: $spacing-lg;
}

.join-btn {
  width: 100%;
  border-radius: $radius-round;
  background: $gradient-coral;
  color: #FFFFFF;
  font-size: $font-md;
  font-weight: 700;
  box-shadow: $shadow-coral;

  &::after {
    border: none;
  }
}

.share-btn {
  margin-top: $spacing-lg;
  width: 100%;
  border-radius: $radius-round;
  background: $gradient-coral;
  color: #FFFFFF;
  font-size: $font-md;
  font-weight: 700;
  box-shadow: $shadow-coral;

  &::after {
    border: none;
  }
}
</style>
