<template>
  <view class="content-detail-page">
    <view class="content-header">
      <text class="content-title">{{ content.title }}</text>
      <view class="content-meta">
        <text class="meta-category">{{ content.categoryName }}</text>
        <text class="meta-views">{{ content.viewCount }}阅读</text>
        <text class="meta-time">{{ content.createTime }}</text>
      </view>
    </view>

    <view class="content-body card">
      <rich-text class="content-rich" :nodes="content.content" />
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { onLoad, onShareAppMessage } from '@dcloudio/uni-app'
import { getContentDetail, type ContentDetail } from '@/api/content'

const content = ref<ContentDetail>({
  id: 0, title: '', cover: '', content: '', categoryId: 0,
  categoryName: '', viewCount: 0, createTime: ''
})

async function loadContent(id: number) {
  try {
    content.value = await getContentDetail(id)
  } catch {}
}

onShareAppMessage(() => ({
  title: content.value.title,
  path: `/pages/content/detail?id=${content.value.id}`
}))

onLoad((options) => {
  if (options?.id) loadContent(Number(options.id))
})
</script>

<style lang="scss" scoped>
.content-detail-page {
  min-height: 100vh;
  background: $bg-color;
}

.content-header {
  background: $bg-white;
  padding: $spacing-lg $spacing-md;
}

.content-title {
  font-size: $font-xl;
  font-weight: 600;
  color: $text-color;
  line-height: 1.5;
  display: block;
  margin-bottom: $spacing-sm;
}

.content-meta {
  display: flex;
  gap: $spacing-md;
}

.meta-category,
.meta-views,
.meta-time {
  font-size: $font-xs;
  color: $text-hint;
}

.content-body {
  margin: $spacing-sm $spacing-md;
}

.content-rich {
  font-size: $font-md;
  line-height: 1.8;
  color: $text-color;
}
</style>
