<template>
  <view class="content-list-page">
    <view class="tab-bar">
      <view
        v-for="cat in categories"
        :key="cat.id"
        class="tab-item"
        :class="{ active: currentCategoryId === cat.id }"
        @tap="switchCategory(cat.id)"
      >
        <text class="tab-text">{{ cat.name }}</text>
      </view>
    </view>

    <view class="content-list">
      <view v-for="item in contents" :key="item.id" class="content-card card" @tap="goDetail(item.id)">
        <image v-if="item.cover" class="content-cover" :src="item.cover" mode="aspectFill" />
        <view class="content-info">
          <text class="content-title">{{ item.title }}</text>
          <text class="content-summary">{{ item.summary }}</text>
          <view class="content-meta">
            <text class="meta-category">{{ item.categoryName }}</text>
            <text class="meta-views">{{ item.viewCount }}阅读</text>
          </view>
        </view>
      </view>
    </view>

    <Loading v-if="loading" />
    <Empty v-if="!loading && contents.length === 0" text="暂无内容" />
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { onReachBottom, onPullDownRefresh } from '@dcloudio/uni-app'
import { getContentList, getContentCategories, type ContentItem, type ContentCategory } from '@/api/content'
import Loading from '@/components/Loading.vue'
import Empty from '@/components/Empty.vue'

const categories = ref<ContentCategory[]>([])
const currentCategoryId = ref(0)
const contents = ref<ContentItem[]>([])
const loading = ref(false)
const page = ref(1)
const finished = ref(false)

async function loadCategories() {
  try {
    const data = await getContentCategories()
    categories.value = data
    if (data.length) currentCategoryId.value = data[0].id
  } catch {}
}

async function loadContents(reset = false) {
  if (loading.value) return
  if (!reset && finished.value) return
  if (reset) {
    page.value = 1
    finished.value = false
    contents.value = []
  }
  loading.value = true
  try {
    const params: any = { page: page.value, pageSize: 10 }
    if (currentCategoryId.value) params.categoryId = currentCategoryId.value
    const data = await getContentList(params)
    contents.value.push(...data.list)
    finished.value = contents.value.length >= data.total
    page.value++
  } catch {} finally {
    loading.value = false
  }
}

function switchCategory(id: number) {
  currentCategoryId.value = id
  loadContents(true)
}

function goDetail(id: number) {
  uni.navigateTo({ url: `/pages/content/detail?id=${id}` })
}

onPullDownRefresh(async () => {
  await loadContents(true)
  uni.stopPullDownRefresh()
})

onReachBottom(() => {
  loadContents()
})

onMounted(async () => {
  await loadCategories()
  loadContents()
})
</script>

<style lang="scss" scoped>
.content-list-page {
  min-height: 100vh;
  background: $bg-color;
}

.tab-bar {
  display: flex;
  background: $bg-white;
  padding: $spacing-sm $spacing-md;
  overflow-x: auto;
  white-space: nowrap;
}

.tab-item {
  padding: 12rpx 24rpx;
  margin-right: $spacing-sm;
  border-radius: $radius-round;
  flex-shrink: 0;

  &.active {
    background: rgba($primary-color, 0.1);

    .tab-text { color: $primary-color; font-weight: 600; }
  }
}

.tab-text {
  font-size: $font-sm;
  color: $text-secondary;
}

.content-list {
  padding: $spacing-md;
}

.content-card {
  display: flex;
  margin-bottom: $spacing-md;
}

.content-cover {
  width: 200rpx;
  height: 150rpx;
  border-radius: $radius-md;
  flex-shrink: 0;
}

.content-info {
  flex: 1;
  margin-left: $spacing-sm;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
}

.content-title {
  font-size: $font-md;
  font-weight: 600;
  color: $text-color;
  @include text-ellipsis-2;
  display: block;
  line-height: 1.4;
}

.content-summary {
  font-size: $font-xs;
  color: $text-hint;
  @include text-ellipsis;
  display: block;
}

.content-meta {
  display: flex;
  gap: $spacing-md;
}

.meta-category,
.meta-views {
  font-size: $font-xs;
  color: $text-hint;
}
</style>
