<template>
  <view class="activity-content-page page-shell">
    <view class="hero">
      <text class="hero-eyebrow">禧孕优选</text>
      <text class="hero-title">活动专区</text>
      <text class="hero-subtitle">精选图文 · 育儿视频 · 商品推荐</text>
    </view>

    <view class="filter-bar">
      <view
        v-for="tab in tabs"
        :key="tab.value"
        class="filter-item"
        :class="{ active: currentType === tab.value }"
        @tap="switchType(tab.value)"
      >
        <text class="filter-text">{{ tab.label }}</text>
      </view>
    </view>

    <view class="search-bar" @tap="focusSearch">
      <input
        ref="searchInput"
        class="search-input"
        v-model="keyword"
        placeholder="搜索活动标题"
        confirm-type="search"
        @confirm="handleSearch"
      />
    </view>

    <view class="list">
      <view
        v-for="item in list"
        :key="item.id"
        class="item-card"
        @tap="goDetail(item.id)"
      >
        <view class="item-cover-wrap">
          <image
            class="item-cover"
            :src="item.coverImage || '/static/default-cover.png'"
            mode="aspectFill"
          />
          <view class="item-shade"></view>
          <view class="item-type-tag" :class="item.type">
            <text class="tag-text">{{ typeLabel(item.type) }}</text>
          </view>
        </view>
        <view class="item-info">
          <text class="item-title">{{ item.title }}</text>
          <text v-if="item.subtitle" class="item-subtitle">{{ item.subtitle }}</text>
          <text v-else-if="item.summary" class="item-subtitle">{{ item.summary }}</text>
          <view class="item-meta">
            <text class="meta-text">{{ item.viewCount }} 阅读</text>
          </view>
        </view>
      </view>
    </view>

    <Loading v-if="loading" />
    <Empty v-if="!loading && list.length === 0" text="暂无活动内容" />
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { onReachBottom, onPullDownRefresh } from '@dcloudio/uni-app'
import {
  getActivityContentList,
  type ActivityContentListItem,
  type ActivityContentType,
} from '@/api/activity-content'
import Loading from '@/components/Loading.vue'
import Empty from '@/components/Empty.vue'

const tabs = [
  { label: '全部', value: '' },
  { label: '图文', value: 'article' },
  { label: '视频', value: 'video' },
  { label: '商品', value: 'product' },
]

const currentType = ref<string>('')
const keyword = ref('')
const list = ref<ActivityContentListItem[]>([])
const loading = ref(false)
const page = ref(1)
const finished = ref(false)

async function loadList(reset = false) {
  if (loading.value) return
  if (!reset && finished.value) return
  if (reset) {
    page.value = 1
    finished.value = false
    list.value = []
  }
  loading.value = true
  try {
    const data = await getActivityContentList({
      page: page.value,
      pageSize: 10,
      keyword: keyword.value.trim() || undefined,
      type: (currentType.value || undefined) as ActivityContentType | undefined,
    })
    list.value.push(...(data.list || []))
    finished.value = list.value.length >= (data.total || 0)
    page.value++
  } catch {
    uni.showToast({ title: '加载失败', icon: 'none' })
  } finally {
    loading.value = false
  }
}

function switchType(value: string) {
  if (currentType.value === value) return
  currentType.value = value
  loadList(true)
}

function handleSearch() {
  loadList(true)
}

function focusSearch() {
  // 占位：避免占位点击行为，实际输入由 input 自身处理
}

function goDetail(id: string) {
  uni.navigateTo({ url: `/pages/activity-content/detail?id=${id}` })
}

function typeLabel(type: ActivityContentType): string {
  if (type === 'video') return '视频'
  if (type === 'product') return '商品推荐'
  return '图文'
}

onPullDownRefresh(async () => {
  await loadList(true)
  uni.stopPullDownRefresh()
})

onReachBottom(() => {
  loadList()
})

loadList()
</script>

<style lang="scss" scoped>
.activity-content-page {
  padding-bottom: $spacing-lg;
}

.hero {
  display: flex;
  flex-direction: column;
  margin: 24rpx $spacing-md $spacing-sm;
  padding: 34rpx $spacing-md;
  border-radius: $radius-xxl;
  background:
    radial-gradient(circle at 88% 12%, rgba($primary-color, 0.16) 0%, rgba($primary-color, 0) 220rpx),
    linear-gradient(135deg, rgba(255, 255, 255, 0.96) 0%, rgba(255, 239, 231, 0.94) 100%);
  border: 1rpx solid rgba(255, 255, 255, 0.8);
  box-shadow: $shadow-md;
}

.hero-eyebrow {
  display: inline-flex;
  align-self: flex-start;
  min-height: 38rpx;
  padding: 0 18rpx;
  border-radius: $radius-round;
  background: $primary-soft;
  color: $primary-dark;
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

.filter-bar {
  display: flex;
  gap: $spacing-xs;
  padding: $spacing-sm $spacing-md;
}

.filter-item {
  flex: 1;
  text-align: center;
  padding: 16rpx 0;
  border-radius: $radius-round;
  background: rgba(255, 255, 255, 0.78);
  border: 1rpx solid rgba($border-color, 0.74);

  &.active {
    background: $primary-soft;
    border-color: rgba($primary-color, 0.2);

    .filter-text {
      color: $primary-dark;
    }
  }
}

.filter-text {
  font-size: $font-sm;
  color: $text-secondary;
  font-weight: 700;
}

.search-bar {
  margin: 0 $spacing-md $spacing-sm;
}

.search-input {
  width: 100%;
  min-height: 76rpx;
  padding: 0 28rpx;
  background: rgba(255, 255, 255, 0.9);
  border-radius: $radius-round;
  border: 1rpx solid rgba($border-color, 0.86);
  box-shadow: $shadow-sm;
  font-size: $font-sm;
  box-sizing: border-box;
}

.list {
  padding: 0 $spacing-md;
}

.item-card {
  background: $gradient-card;
  border-radius: $radius-xxl;
  overflow: hidden;
  margin-bottom: $spacing-md;
  border: 1rpx solid rgba($border-color, 0.78);
  box-shadow: $shadow-md;
}

.item-cover-wrap {
  position: relative;
  width: 100%;
  height: 320rpx;
  background: $bg-ivory;
}

.item-cover {
  width: 100%;
  height: 100%;
  background: $bg-ivory;
}

.item-shade {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: 100rpx;
  background: linear-gradient(180deg, rgba(58, 48, 44, 0) 0%, rgba(58, 48, 44, 0.22) 100%);
}

.item-type-tag {
  position: absolute;
  top: 18rpx;
  left: 18rpx;
  padding: 6rpx 16rpx;
  border-radius: $radius-round;
  background: rgba(255, 255, 255, 0.92);
  box-shadow: $shadow-xs;

  &.article .tag-text {
    color: $info-color;
  }

  &.video .tag-text {
    color: $success-dark;
  }

  &.product .tag-text {
    color: $primary-dark;
  }
}

.tag-text {
  font-size: $font-xs;
  font-weight: 800;
}

.item-info {
  padding: $spacing-md;
}

.item-title {
  display: block;
  font-size: $font-lg;
  font-weight: 800;
  color: $text-color;
  line-height: 1.4;
  @include text-ellipsis-2;
  margin-bottom: $spacing-xs;
}

.item-subtitle {
  display: block;
  font-size: $font-sm;
  color: $text-hint;
  @include text-ellipsis-2;
  line-height: 1.45;
  margin-bottom: $spacing-xs;
}

.item-meta {
  display: flex;
  align-items: center;
}

.meta-text {
  font-size: $font-xs;
  color: $text-hint;
}
</style>
