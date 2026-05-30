<template>
  <view class="content-detail-page page-shell">
    <view class="content-header">
      <text class="content-title">{{ content.title }}</text>
      <view class="content-meta">
        <text v-if="content.contentType" class="meta-type">{{ content.contentType === 'video' ? '视频' : '文章' }}</text>
        <text class="meta-views">{{ content.viewCount }}阅读</text>
        <text v-if="content.publishedAt" class="meta-time">{{ content.publishedAt }}</text>
      </view>
    </view>

    <view v-if="content.contentType === 'video' && content.videoUrl" class="video-section card">
      <video
        class="content-video"
        :src="content.videoUrl"
        :poster="content.videoCover || content.coverImage"
        controls
        :autoplay="false"
      />
    </view>

    <view class="content-body card">
      <rich-text class="content-rich" :nodes="content.content" />
    </view>

    <view v-if="content.tags && content.tags.length" class="content-tags card">
      <text v-for="tag in content.tags" :key="tag" class="tag-item">{{ tag }}</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { onLoad, onShareAppMessage } from '@dcloudio/uni-app'
import { getContentDetail, type ContentDetail } from '@/api/content'

const content = ref<ContentDetail>({
  id: '', title: '', coverImage: '', content: '', categoryId: '',
  contentType: 'article', summary: '', viewCount: 0, publishedAt: ''
})

async function loadContent(id: string) {
  try {
    content.value = await getContentDetail(Number(id))
  } catch {
    uni.showToast({ title: '加载失败', icon: 'none' })
  }
}

onShareAppMessage(() => ({
  title: content.value.title,
  path: `/pages/content/detail?id=${content.value.id}`
}))

onLoad((options) => {
  if (options?.id) loadContent(options.id)
})
</script>

<style lang="scss" scoped>
.content-detail-page {
  min-height: 100vh;
}

.content-header {
  padding: $spacing-lg $spacing-md;
  background: linear-gradient(180deg, $bg-page, transparent);
}

.content-title {
  font-size: $font-xl;
  font-weight: 800;
  color: $text-color;
  line-height: 1.5;
  display: block;
  margin-bottom: $spacing-sm;
}

.content-meta {
  display: flex;
  flex-wrap: wrap;
  gap: $spacing-md;
}

.meta-type,
.meta-views,
.meta-time {
  font-size: $font-xs;
  color: $text-hint;
}

.video-section {
  margin: $spacing-sm $spacing-md;
}

.content-video {
  width: 100%;
  border-radius: $radius-xl;
}

.content-body {
  margin: $spacing-sm $spacing-md;
  border-radius: $radius-xxl;
}

.content-rich {
  font-size: $font-md;
  line-height: 1.95;
  color: $text-color;
}

.content-tags {
  margin: $spacing-sm $spacing-md;
  display: flex;
  flex-wrap: wrap;
  gap: $spacing-sm;
}

.tag-item {
  font-size: $font-xs;
  color: $primary-dark;
  background: $primary-soft;
  padding: 6rpx 16rpx;
  border-radius: $radius-round;
}
</style>
