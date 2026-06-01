<template>
  <view class="activity-page page-shell">
    <view class="activity-hero">
      <text class="hero-title">育儿福利社</text>
      <text class="hero-subtitle">限时活动 · 亲子内容 · 会员福利</text>
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
        <image class="feed-image" :src="item.image || '/static/default-cover.png'" mode="aspectFill" />
        <view class="feed-info">
          <view class="feed-type-tag">
            <text class="type-text" :class="item.type">{{ typeLabel(item.type) }}</text>
          </view>
          <text class="feed-title">{{ item.title }}</text>
          <text v-if="item.summary" class="feed-summary">{{ item.summary }}</text>
          <view class="feed-meta">
            <text v-if="item.type === 'activity'" class="meta-item">
              <CountdownTimer :endTime="endTimeNumber(item.endTime)" label="距结束" />
            </text>
            <text v-if="item.type === 'video' && item.videoDuration" class="meta-item">
              {{ formatDuration(item.videoDuration) }}
            </text>
            <text v-if="item.viewCount !== undefined" class="meta-item">{{ item.viewCount }}阅读</text>
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

function formatDuration(seconds: number) {
  const min = Math.floor(seconds / 60)
  const sec = seconds % 60
  return `${min}:${sec.toString().padStart(2, '0')}`
}

function endTimeNumber(value?: string) {
  if (!value) return Date.now()
  const parsed = Number(value)
  if (Number.isFinite(parsed)) return parsed
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
  padding: 34rpx $spacing-md $spacing-md;
}

.hero-title {
  display: block;
  font-size: $font-xl;
  color: $text-color;
  font-weight: 900;
}

.hero-subtitle {
  display: block;
  margin-top: 8rpx;
  font-size: $font-sm;
  color: $text-secondary;
}

.tab-wrap {
  position: sticky;
  top: 0;
  z-index: 5;
  padding: $spacing-sm $spacing-md;
  background: rgba($bg-page, 0.94);
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
  background: $gradient-card;
  border-radius: $radius-xxl;
  overflow: hidden;
  margin: 0 $spacing-md $spacing-md;
  border: 1rpx solid rgba($border-color, 0.78);
  box-shadow: $shadow-sm;
}

.feed-image {
  width: 100%;
  height: 320rpx;
  background: $bg-gray;
}

.feed-info {
  padding: $spacing-md;
}

.feed-type-tag {
  margin-bottom: $spacing-xs;
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
}

.meta-item {
  font-size: $font-xs;
  color: $text-hint;
}
</style>
