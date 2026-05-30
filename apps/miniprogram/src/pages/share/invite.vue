<template>
  <view class="invite-page page-shell">
    <view class="header-section">
      <text class="header-title">邀请好友 有礼相送</text>
      <text class="header-desc">分享给好友，好友首单支付后你将获得奖励</text>
    </view>

    <view class="stats-section card">
      <view class="stat-item">
        <text class="stat-value">{{ stats.inviteCount }}</text>
        <text class="stat-label">邀请人数</text>
      </view>
      <view class="stat-divider"></view>
      <view class="stat-item">
        <text class="stat-value">{{ stats.totalRewardPoints }}</text>
        <text class="stat-label">获得积分</text>
      </view>
    </view>

    <view class="action-section">
      <button class="share-btn" open-type="share">邀请好友</button>
    </view>

    <view v-if="stats.recentInvites.length" class="list-section card">
      <text class="section-title">邀请记录</text>
      <view v-for="item in stats.recentInvites" :key="item.id" class="invite-item">
        <image class="invite-avatar" :src="item.invitee?.avatarUrl || '/static/default-avatar.png'" mode="aspectFill" />
        <view class="invite-info">
          <text class="invite-name">{{ item.invitee?.nickname || '微信用户' }}</text>
          <text class="invite-time">{{ formatTime(item.registeredAt || item.createdAt) }}</text>
        </view>
        <view class="invite-status" :class="{ paid: item.firstPaidAt }">
          <text class="status-text">{{ item.firstPaidAt ? '已下单' : '待下单' }}</text>
        </view>
      </view>
    </view>

    <view v-else class="empty-section">
      <text class="empty-text">暂无邀请记录，快去邀请好友吧</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { onShareAppMessage } from '@dcloudio/uni-app'
import { getMyShareStats, type MyShareStats } from '@/api/share'
import { useUserStore } from '@/stores/user'

const userStore = useUserStore()

const stats = ref<MyShareStats>({
  inviteCount: 0,
  totalRewardPoints: 0,
  recentInvites: []
})

async function loadStats() {
  try {
    stats.value = await getMyShareStats()
  } catch {}
}

function formatTime(dateStr: string): string {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  return `${d.getMonth() + 1}/${d.getDate()}`
}

onShareAppMessage(() => ({
  title: '禧孕优选好物推荐，快来看看吧！',
  path: `/pages/home/index?inviter=${userStore.userInfo?.id || ''}`
}))

onMounted(() => {
  loadStats()
})
</script>

<style lang="scss" scoped>
.invite-page {
  min-height: 100vh;
}

.header-section {
  background: linear-gradient(135deg, $primary-color, $secondary-color);
  padding: 60rpx $spacing-md 40rpx;
  text-align: center;
}

.header-title {
  font-size: $font-xxl;
  color: #FFFFFF;
  font-weight: 700;
  display: block;
}

.header-desc {
  font-size: $font-sm;
  color: rgba(255, 255, 255, 0.8);
  margin-top: 12rpx;
  display: block;
}

.stats-section {
  display: flex;
  align-items: center;
  margin: -20rpx $spacing-md $spacing-md;
  padding: $spacing-lg;
}

.stat-item {
  flex: 1;
  @include flex-center;
  @include flex-column;
}

.stat-value {
  font-size: $font-xxl;
  font-weight: 700;
  color: $primary-color;
  display: block;
}

.stat-label {
  font-size: $font-xs;
  color: $text-hint;
  margin-top: 8rpx;
  display: block;
}

.stat-divider {
  width: 2rpx;
  height: 60rpx;
  background: $divider-color;
}

.action-section {
  padding: 0 $spacing-md $spacing-md;
}

.share-btn {
  background: linear-gradient(135deg, $primary-color, $primary-light);
  color: #FFFFFF;
  border: none;
  border-radius: $radius-round;
  padding: 24rpx 0;
  font-size: $font-lg;
  font-weight: 600;

  &::after {
    border: none;
  }
}

.list-section {
  margin: 0 $spacing-md;
}

.section-title {
  font-size: $font-md;
  font-weight: 600;
  color: $text-color;
  display: block;
  margin-bottom: $spacing-md;
}

.invite-item {
  @include flex-between;
  padding: $spacing-sm 0;
  border-bottom: 1rpx solid $divider-color;

  &:last-child {
    border-bottom: none;
  }
}

.invite-avatar {
  width: 72rpx;
  height: 72rpx;
  border-radius: 50%;
  flex-shrink: 0;
}

.invite-info {
  flex: 1;
  margin-left: $spacing-sm;
}

.invite-name {
  font-size: $font-md;
  color: $text-color;
  display: block;
}

.invite-time {
  font-size: $font-xs;
  color: $text-hint;
  margin-top: 4rpx;
  display: block;
}

.invite-status {
  padding: 4rpx 16rpx;
  border-radius: $radius-round;
  background: rgba($text-hint, 0.1);

  &.paid {
    background: rgba($success-color, 0.1);
  }
}

.status-text {
  font-size: $font-xs;
  color: $text-hint;

  .paid & {
    color: $success-color;
  }
}

.empty-section {
  @include flex-center;
  padding: 80rpx 0;
}

.empty-text {
  font-size: $font-md;
  color: $text-hint;
}
</style>
