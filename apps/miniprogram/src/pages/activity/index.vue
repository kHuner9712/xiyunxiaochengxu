<template>
  <view class="activity-page page-shell">
    <view class="activity-hero">
      <view class="hero-copy">
        <text class="hero-eyebrow">禧孕优选福利</text>
        <text class="hero-title">育儿福利社</text>
        <text class="hero-subtitle">限时活动 · 亲子内容 · 会员福利</text>
      </view>
      <view class="hero-badge">
        <text class="hero-badge-main">省心</text>
        <text class="hero-badge-sub">优选</text>
      </view>
    </view>

    <view class="promo-quick-row">
      <view class="promo-chip">
        <text class="promo-title">限时秒杀</text>
        <text class="promo-desc">母婴好价</text>
      </view>
      <view class="promo-chip sage">
        <text class="promo-title">会员专享</text>
        <text class="promo-desc">福利加码</text>
      </view>
      <view class="promo-chip peach">
        <text class="promo-title">新人礼包</text>
        <text class="promo-desc">安心开箱</text>
      </view>
    </view>

    <view class="tab-wrap">
      <view class="tab-bar pill-tab-bar">
        <view
          v-for="tab in tabs"
          :key="tab.value"
          class="tab-item pill-tab-item"
          :class="{ active: currentTab === tab.value }"
          @tap="switchTab(tab.value)"
        >
          <text class="tab-text">{{ tab.label }}</text>
        </view>
      </view>
    </view>

    <view class="feed-list">
      <view v-for="item in feedList" :key="item.type + item.id" class="feed-card" @tap="goDetail(item)">
        <view class="feed-image-wrap">
          <image class="feed-image" :src="item.image || '/static/default-cover.png'" mode="aspectFill" />
          <view class="feed-image-shade"></view>
          <text class="feed-status" :class="statusClass(item)">{{ statusLabel(item) }}</text>
          <text class="feed-marketing">{{ marketingLabel(item) }}</text>
        </view>
        <view class="feed-info">
          <view class="feed-topline">
            <view class="feed-type-tag">
            <text class="type-text" :class="item.type">{{ typeLabel(item.type) }}</text>
            </view>
            <text v-if="item.viewCount !== undefined" class="meta-view">{{ item.viewCount }} 阅读</text>
          </view>
          <text class="feed-title">{{ item.title }}</text>
          <text v-if="item.summary" class="feed-summary">{{ item.summary }}</text>
          <view class="feed-meta">
            <view v-if="item.type === 'activity'" class="meta-item countdown-meta">
              <CountdownTimer :endTime="endTimeNumber(item.endTime)" label="距结束" />
            </view>
            <text v-if="item.type === 'video' && item.videoDuration" class="meta-item">
              {{ formatDuration(item.videoDuration) }}
            </text>
          </view>
        </view>
      </view>
    </view>

    <Loading v-if="loading" />
    <Empty v-if="!loading && feedList.length === 0" text="暂无内容" />
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { onReachBottom, onPullDownRefresh } from '@dcloudio/uni-app'
import { getActivityFeed, type FeedItem } from '@/api/activity'
import CountdownTimer from '@/components/CountdownTimer.vue'
import Loading from '@/components/Loading.vue'
import Empty from '@/components/Empty.vue'

const tabs = [
  { label: '推荐', value: 'recommend' },
  { label: '优惠', value: 'discount' },
  { label: '视频', value: 'video' },
  { label: '文章', value: 'article' },
  { label: '线下/活动', value: 'offline' }
]

const currentTab = ref('recommend')
const feedList = ref<FeedItem[]>([])
const loading = ref(false)
const page = ref(1)
const finished = ref(false)

async function loadFeed(reset = false) {
  if (loading.value) return
  if (!reset && finished.value) return
  if (reset) {
    page.value = 1
    finished.value = false
    feedList.value = []
  }
  loading.value = true
  try {
    const data = await getActivityFeed({
      tab: currentTab.value,
      page: page.value,
      pageSize: 10
    })
    feedList.value.push(...data.list)
    finished.value = feedList.value.length >= data.total
    page.value++
  } catch {
    uni.showToast({ title: '加载失败', icon: 'none' })
  } finally {
    loading.value = false
  }
}

function switchTab(value: string) {
  currentTab.value = value
  loadFeed(true)
}

function goDetail(item: FeedItem) {
  if (item.type === 'activity') {
    uni.navigateTo({ url: `/pages/activity/detail?id=${item.id}` })
  } else {
    uni.navigateTo({ url: `/pages/content/detail?id=${item.id}` })
  }
}

function typeLabel(type: string) {
  if (type === 'activity') return '活动'
  if (type === 'video') return '视频'
  if (type === 'article') return '文章'
  return type
}

function marketingLabel(item: FeedItem) {
  if (item.activityType) return item.activityType
  if (item.type === 'activity') return '限时活动'
  if (item.type === 'video') return '育儿视频'
  if (item.type === 'article') return '科学育儿'
  return '精选内容'
}

function statusLabel(item: FeedItem) {
  if (item.type !== 'activity') return '精选'
  const now = Date.now()
  const start = item.startTime ? endTimeNumber(item.startTime) : 0
  const end = item.endTime ? endTimeNumber(item.endTime) : 0
  if (start && now < start) return '即将开始'
  if (end && now > end) return '已结束'
  return '进行中'
}

function statusClass(item: FeedItem) {
  const label = statusLabel(item)
  if (label === '即将开始') return 'pending'
  if (label === '已结束') return 'ended'
  if (label === '精选') return 'featured'
  return 'active'
}

function formatDuration(seconds: number) {
  const min = Math.floor(seconds / 60)
  const sec = seconds % 60
  return `${min}:${sec.toString().padStart(2, '0')}`
}

function endTimeNumber(value?: string) {
  if (!value) return Date.now()
  const parsed = Number(value)
  if (Number.isFinite(parsed)) return parsed < 10000000000 ? parsed * 1000 : parsed
  const timestamp = new Date(value).getTime()
  return Number.isFinite(timestamp) ? timestamp : Date.now()
}

onPullDownRefresh(async () => {
  await loadFeed(true)
  uni.stopPullDownRefresh()
})

onReachBottom(() => {
  loadFeed()
})

onMounted(() => {
  loadFeed()
})
</script>

<style lang="scss" scoped>
.activity-page {
  padding-bottom: $spacing-lg;
}

.activity-hero {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin: 24rpx $spacing-md $spacing-sm;
  padding: 34rpx $spacing-md;
  border-radius: $radius-xxl;
  background:
    radial-gradient(circle at 88% 12%, rgba($success-color, 0.18) 0%, rgba($success-color, 0) 220rpx),
    linear-gradient(135deg, rgba(255, 255, 255, 0.96) 0%, rgba(255, 239, 231, 0.94) 100%);
  border: 1rpx solid rgba(255, 255, 255, 0.8);
  box-shadow: $shadow-md;
}

.hero-copy {
  min-width: 0;
}

.hero-eyebrow {
  display: inline-flex;
  min-height: 38rpx;
  padding: 0 18rpx;
  border-radius: $radius-round;
  background: $success-soft;
  color: $success-dark;
  font-size: $font-xs;
  line-height: 38rpx;
  font-weight: 800;
}

.hero-title {
  display: block;
  margin-top: 12rpx;
  font-size: 44rpx;
  color: $text-color;
  font-weight: 900;
  line-height: 1.16;
}

.hero-subtitle {
  display: block;
  margin-top: 8rpx;
  font-size: $font-sm;
  color: $text-secondary;
}

.hero-badge {
  @include flex-center;
  flex-direction: column;
  width: 112rpx;
  height: 112rpx;
  margin-left: $spacing-sm;
  border-radius: 50%;
  background: $gradient-coral;
  box-shadow: $shadow-coral;
  flex-shrink: 0;
}

.hero-badge-main,
.hero-badge-sub {
  color: #FFFFFF;
  font-weight: 900;
  line-height: 1.15;
}

.hero-badge-main {
  font-size: $font-md;
}

.hero-badge-sub {
  font-size: $font-xs;
}

.promo-quick-row {
  display: flex;
  gap: $spacing-sm;
  margin: 0 $spacing-md $spacing-sm;
}

.promo-chip {
  flex: 1;
  min-width: 0;
  padding: 18rpx 16rpx;
  border-radius: 28rpx;
  background: $primary-soft;
  border: 1rpx solid rgba($primary-color, 0.12);

  &.sage {
    background: $success-soft;
    border-color: rgba($success-color, 0.14);
  }

  &.peach {
    background: $secondary-soft;
    border-color: rgba($secondary-color, 0.16);
  }
}

.promo-title,
.promo-desc {
  display: block;
  @include text-ellipsis;
}

.promo-title {
  color: $text-color;
  font-size: $font-sm;
  font-weight: 800;
}

.promo-desc {
  margin-top: 6rpx;
  color: $text-hint;
  font-size: $font-xs;
}

.tab-wrap {
  position: sticky;
  top: 0;
  z-index: 5;
  padding: $spacing-sm $spacing-md;
  background: rgba(255, 252, 247, 0.9);
  box-shadow: 0 8rpx 24rpx rgba(131, 91, 78, 0.04);
}

.tab-bar {
  margin-bottom: 0;
  overflow: hidden;
}

.tab-item {
  flex: 1;

  &.active {
    .tab-text {
      color: $primary-dark;
    }
  }
}

.tab-text {
  font-size: $font-sm;
  color: $text-secondary;
}

.feed-card {
  background:
    radial-gradient(circle at 88% 0%, rgba($primary-color, 0.08), rgba($primary-color, 0) 220rpx),
    $gradient-card;
  border-radius: $radius-xxl;
  overflow: hidden;
  margin: 0 $spacing-md $spacing-md;
  border: 1rpx solid rgba($border-color, 0.78);
  box-shadow: $shadow-md;
}

.feed-image-wrap {
  position: relative;
  width: 100%;
  height: 320rpx;
  background: $bg-ivory;
}

.feed-image {
  width: 100%;
  height: 100%;
  background: $bg-ivory;
}

.feed-image-shade {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: 132rpx;
  background: linear-gradient(180deg, rgba(58, 48, 44, 0) 0%, rgba(58, 48, 44, 0.26) 100%);
}

.feed-status,
.feed-marketing {
  position: absolute;
  border-radius: $radius-round;
  font-size: $font-xs;
  font-weight: 800;
}

.feed-status {
  top: 18rpx;
  left: 18rpx;
  min-height: 40rpx;
  padding: 0 18rpx;
  line-height: 40rpx;
  background: rgba(255, 255, 255, 0.9);
  color: $success-dark;

  &.pending {
    color: $secondary-color;
  }

  &.ended {
    color: $text-hint;
  }

  &.featured {
    color: $primary-dark;
  }
}

.feed-marketing {
  left: 18rpx;
  bottom: 18rpx;
  max-width: 520rpx;
  min-height: 42rpx;
  padding: 0 18rpx;
  line-height: 42rpx;
  background: rgba(255, 255, 255, 0.88);
  color: $primary-dark;
  @include text-ellipsis;
}

.feed-info {
  padding: $spacing-md;
}

.feed-topline {
  @include flex-between;
  margin-bottom: $spacing-xs;
}

.feed-type-tag {
  min-width: 0;
}

.type-text {
  font-size: $font-xs;
  padding: 6rpx 16rpx;
  border-radius: $radius-round;
  font-weight: 700;

  &.activity {
    background: $primary-soft;
    color: $primary-dark;
  }

  &.video {
    background: $success-soft;
    color: $success-dark;
  }

  &.article {
    background: $info-soft;
    color: $info-color;
  }
}

.feed-title {
  font-size: $font-lg;
  font-weight: 800;
  color: $text-color;
  display: block;
  margin-bottom: $spacing-xs;
  @include text-ellipsis-2;
  line-height: 1.4;
}

.feed-summary {
  font-size: $font-sm;
  color: $text-hint;
  display: block;
  @include text-ellipsis-2;
  line-height: 1.45;
  margin-bottom: $spacing-xs;
}

.feed-meta {
  display: flex;
  align-items: center;
  gap: $spacing-md;
  min-height: 44rpx;
}

.meta-item,
.meta-view {
  font-size: $font-xs;
  color: $text-hint;
}

.countdown-meta {
  max-width: 100%;
  overflow: hidden;
}

.activity-page :deep(.countdown-wrap) {
  min-height: 44rpx;
  padding: 4rpx 8rpx 4rpx 14rpx;
  border-radius: $radius-round;
  background: rgba($primary-color, 0.08);
}

.activity-page :deep(.countdown-label) {
  color: $primary-dark;
  font-size: $font-xs;
  font-weight: 700;
}

.activity-page :deep(.countdown-block) {
  min-width: 38rpx;
  border-radius: $radius-round;
  background: rgba(255, 255, 255, 0.92);
  box-shadow: $shadow-xs;
}

.activity-page :deep(.countdown-num) {
  color: $primary-dark;
  font-size: $font-xs;
  font-weight: 800;
}

.activity-page :deep(.countdown-sep) {
  color: $primary-color;
  font-size: $font-xs;
}

.activity-page :deep(.countdown-expired) {
  min-height: 40rpx;
  padding: 0 16rpx;
  border-radius: $radius-round;
  background: rgba($bg-gray, 0.86);
  color: $text-hint;
  font-size: $font-xs;
  line-height: 40rpx;
}
</style>
