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
      <view class="share-product-entry" @click="goProductList">
        <text class="share-product-text">分享指定商品</text>
        <text class="share-product-arrow">›</text>
      </view>
    </view>

    <view v-if="rewards.length" class="rewards-section card">
      <text class="section-title">我的奖励</text>
      <view v-for="item in rewards" :key="item.id" class="reward-item">
        <view class="reward-icon" :class="item.rewardType">
          <text class="reward-icon-text">{{ rewardTypeIcon(item.rewardType) }}</text>
        </view>
        <view class="reward-info">
          <text class="reward-name">{{ item.rewardName }}</text>
          <text class="reward-source">{{ sourceTypeText(item.sourceType) }} · {{ formatTime(item.createdAt) }}</text>
        </view>
        <view class="reward-status" :class="item.status">
          <text class="status-text">{{ rewardStatusText(item.status) }}</text>
        </view>
      </view>
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
import { getMyShareStats, getMyRewards, type MyShareStats, type MyRewardItem } from '@/api/share'
import { useUserStore } from '@/stores/user'

const userStore = useUserStore()

const stats = ref<MyShareStats>({
  inviteCount: 0,
  totalRewardPoints: 0,
  recentInvites: []
})

const rewards = ref<MyRewardItem[]>([])

async function loadStats() {
  try {
    stats.value = await getMyShareStats()
  } catch {}
}

async function loadRewards() {
  try {
    const res = await getMyRewards({ page: 1, pageSize: 20 })
    rewards.value = res.list || []
  } catch {}
}

function formatTime(dateStr: string): string {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  return `${d.getMonth() + 1}/${d.getDate()}`
}

function rewardTypeIcon(type: string): string {
  if (type === 'points') return '分'
  if (type === 'coupon') return '券'
  return '礼'
}

function sourceTypeText(source: string): string {
  if (source === 'register') return '注册奖励'
  if (source === 'first_paid_order') return '首单奖励'
  if (source === 'invite_count') return '邀请人数奖励'
  return source
}

function rewardStatusText(status: string): string {
  if (status === 'pending') return '待领取'
  if (status === 'issued') return '已发放'
  if (status === 'claimed') return '已领取'
  if (status === 'cancelled') return '已取消'
  return status
}

function goProductList() {
  uni.navigateTo({ url: '/pages/product/list' })
}

onShareAppMessage(() => ({
  title: '禧孕优选好物推荐，快来看看吧！',
  path: `/pages/home/index?inviter=${encodeURIComponent(userStore.userInfo?.id || '')}`
}))

onMounted(() => {
  loadStats()
  loadRewards()
})
</script>

<style lang="scss" scoped>
.invite-page {
  min-height: 100vh;
}

.header-section {
  background:
    radial-gradient(circle at 88% 14%, rgba($success-color, 0.18) 0%, rgba($success-color, 0) 240rpx),
    $gradient-coral;
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
  background: rgba(255, 255, 255, 0.92);
}

.stat-item {
  flex: 1;
  @include flex-center;
  @include flex-column;
}

.stat-value {
  font-size: $font-xxl;
  font-weight: 700;
  color: $price-color;
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
  background: $gradient-coral;
  color: #FFFFFF;
  border: none;
  border-radius: $radius-round;
  padding: 24rpx 0;
  font-size: $font-lg;
  font-weight: 600;
  box-shadow: $shadow-coral;

  &::after {
    border: none;
  }
}

.share-product-entry {
  @include flex-between;
  margin-top: $spacing-sm;
  padding: 24rpx $spacing-md;
  background: rgba(255, 255, 255, 0.92);
  border-radius: $radius-md;
}

.share-product-text {
  font-size: $font-md;
  color: $text-color;
  font-weight: 500;
}

.share-product-arrow {
  font-size: $font-xl;
  color: $text-hint;
}

.rewards-section {
  margin: 0 $spacing-md $spacing-md;
  background: rgba(255, 255, 255, 0.9);
}

.reward-item {
  @include flex-between;
  padding: $spacing-sm 0;
  border-bottom: 1rpx solid $divider-color;

  &:last-child {
    border-bottom: none;
  }
}

.reward-icon {
  width: 64rpx;
  height: 64rpx;
  border-radius: 50%;
  @include flex-center;
  flex-shrink: 0;

  &.points {
    background: rgba($warning-color, 0.15);
  }

  &.coupon {
    background: rgba($success-color, 0.15);
  }

  &.physical {
    background: rgba($price-color, 0.15);
  }
}

.reward-icon-text {
  font-size: $font-sm;
  font-weight: 700;

  .points & {
    color: $warning-color;
  }

  .coupon & {
    color: $success-dark;
  }

  .physical & {
    color: $price-color;
  }
}

.reward-info {
  flex: 1;
  margin-left: $spacing-sm;
}

.reward-name {
  font-size: $font-md;
  color: $text-color;
  display: block;
}

.reward-source {
  font-size: $font-xs;
  color: $text-hint;
  margin-top: 4rpx;
  display: block;
}

.reward-status {
  padding: 4rpx 16rpx;
  border-radius: $radius-round;
  background: rgba($text-hint, 0.1);

  &.issued {
    background: rgba($success-color, 0.1);
  }

  &.pending {
    background: rgba($warning-color, 0.1);
  }

  &.claimed {
    background: rgba($text-hint, 0.1);
  }

  &.cancelled {
    background: rgba($text-hint, 0.05);
  }
}

.list-section {
  margin: 0 $spacing-md;
  background: rgba(255, 255, 255, 0.9);
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
    color: $success-dark;
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
