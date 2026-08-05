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

const MAX_SIGNED_BIGINT = BigInt('9223372036854775807')
const content = ref<ContentDetail>({
  id: '', title: '', coverImage: '', content: '', categoryId: '',
  contentType: 'article', summary: '', viewCount: 0, publishedAt: ''
})

function isValidContentId(id: string) {
  if (!/^[1-9]\d*$/.test(id)) return false
  try {
    return BigInt(id) <= MAX_SIGNED_BIGINT
  } catch {
    return false
  }
}

async function loadContent(id: string) {
  if (!isValidContentId(id)) {
    uni.showToast({ title: '内容ID无效', icon: 'none' })
    return
  }
  try {
    content.value = await getContentDetail(id)
  } catch {
    uni.showToast({ title: '加载失败', icon: 'none' })
  }
}

onShareAppMessage(() => ({
  title: content.value.title,
  path: `/pages/content/detail?id=${content.value.id}`
}))

onLoad((options) => {
  if (options?.id) loadContent(String(options.id))
})
</script>

<style lang="scss" scoped>
.content-detail-page {
  min-height: 100vh;
}

.content-header {
  padding: 34rpx $spacing-md $spacing-lg;
  background: linear-gradient(180deg, rgba($primary-glow, 0.42), rgba($primary-glow, 0));
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
  background: rgba(255, 255, 255, 0.92);
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
