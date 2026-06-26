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
  padding: 16rpx;
  padding-bottom: 140rpx;
}
.group-detail-card {
  background: #fff;
  border-radius: 16rpx;
  padding: 24rpx;
}
.status-banner {
  display: flex;
  align-items: baseline;
  gap: 16rpx;
  padding: 20rpx 24rpx;
  border-radius: 12rpx;
  margin-bottom: 24rpx;
}
.status-banner.status-forming {
  background: rgba(245, 108, 108, 0.1);
}
.status-banner.status-success {
  background: rgba(103, 194, 58, 0.1);
}
.status-banner.status-failed,
.status-banner.status-cancelled {
  background: rgba(144, 147, 153, 0.1);
}
.status-text {
  font-size: 32rpx;
  font-weight: 600;
  color: #333;
}
.status-sub {
  font-size: 24rpx;
  color: #909399;
}
.activity-info {
  display: flex;
  margin-bottom: 24rpx;
}
.cover {
  width: 160rpx;
  height: 160rpx;
  border-radius: 12rpx;
  background: #f5f5f5;
  flex-shrink: 0;
}
.cover-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
}
.placeholder-text {
  color: #ccc;
  font-size: 24rpx;
}
.info-right {
  flex: 1;
  margin-left: 16rpx;
  display: flex;
  flex-direction: column;
  justify-content: center;
}
.act-name {
  font-size: 28rpx;
  font-weight: 600;
  color: #333;
  margin-bottom: 12rpx;
}
.price-row {
  display: flex;
  align-items: baseline;
  gap: 12rpx;
}
.price {
  color: #f56c6c;
  font-size: 32rpx;
  font-weight: 600;
}
.size {
  color: #e6a23c;
  font-size: 24rpx;
}
.progress-section {
  margin-bottom: 24rpx;
}
.progress-bar {
  width: 100%;
  height: 16rpx;
  background: #f5f5f5;
  border-radius: 8rpx;
  overflow: hidden;
  margin-bottom: 12rpx;
}
.progress-inner {
  height: 100%;
  background: linear-gradient(90deg, #f56c6c, #ff976a);
  transition: width 0.3s;
}
.progress-text-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.progress-count {
  color: #f56c6c;
  font-size: 28rpx;
  font-weight: 600;
}
.group-no {
  color: #909399;
  font-size: 24rpx;
}
.members-section {
  margin-top: 16rpx;
}
.section-title {
  font-size: 28rpx;
  font-weight: 600;
  color: #333;
  margin-bottom: 16rpx;
}
.member-item {
  display: flex;
  align-items: center;
  padding: 16rpx 0;
  border-bottom: 1rpx solid #f5f5f5;
}
.avatar {
  width: 64rpx;
  height: 64rpx;
  border-radius: 50%;
  background: #f5f5f5;
  flex-shrink: 0;
}
.avatar-placeholder {
  background: #ddd;
}
.member-info {
  flex: 1;
  margin-left: 16rpx;
}
.member-top {
  display: flex;
  align-items: center;
  gap: 8rpx;
  margin-bottom: 4rpx;
}
.member-name {
  font-size: 26rpx;
  color: #333;
}
.role-tag {
  font-size: 20rpx;
  padding: 2rpx 10rpx;
  border-radius: 4rpx;
}
.role-tag.leader {
  background: rgba(245, 108, 108, 0.1);
  color: #f56c6c;
}
.role-tag.member {
  background: rgba(144, 147, 153, 0.1);
  color: #909399;
}
.member-status {
  font-size: 22rpx;
  color: #909399;
}
.member-status.m-status-paid {
  color: #67c23a;
}
.member-status.m-status-pending_payment {
  color: #e6a23c;
}
.member-status.m-status-cancelled,
.member-status.m-status-refunded {
  color: #909399;
}
.paid-time {
  font-size: 22rpx;
  color: #c0c4cc;
}
.bottom-bar {
  margin-top: 32rpx;
}
.join-btn {
  width: 100%;
  border-radius: 48rpx;
  background: #f56c6c;
  color: #fff;
}
.share-btn {
  margin-top: 32rpx;
  width: 100%;
  border-radius: 48rpx;
  background: #f56c6c;
  color: #fff;
}
</style>
