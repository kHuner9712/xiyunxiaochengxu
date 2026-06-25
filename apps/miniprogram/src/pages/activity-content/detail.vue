<template>
  <view class="detail-page page-shell">
    <view v-if="detail" class="detail-card">
      <view v-if="detail.coverImage" class="cover-wrap">
        <image class="cover" :src="detail.coverImage" mode="aspectFill" />
      </view>

      <view class="info-block">
        <view class="title-row">
          <view class="type-tag" :class="detail.type">
            <text class="type-text">{{ typeLabel(detail.type) }}</text>
          </view>
          <text class="view-count">{{ detail.viewCount }} 阅读</text>
        </view>
        <text class="detail-title">{{ detail.title }}</text>
        <text v-if="detail.subtitle" class="detail-subtitle">{{ detail.subtitle }}</text>
        <text v-else-if="detail.summary" class="detail-subtitle">{{ detail.summary }}</text>
      </view>

      <view v-if="detail.type === 'video' && detail.videoUrl" class="video-block">
        <video
          class="video-player"
          :src="detail.videoUrl"
          controls
          object-fit="contain"
          show-center-play-btn
          show-play-btn
          show-fullscreen-btn
        />
      </view>

      <view v-if="detail.content" class="content-block">
        <text class="content-text">{{ detail.content }}</text>
      </view>

      <view v-if="detail.linkedProductId" class="product-jump">
        <view class="jump-info">
          <text class="jump-title">关联商品</text>
          <text class="jump-desc">查看该活动推荐的商品/卡项</text>
        </view>
        <view class="jump-btn" @tap="goProduct">
          <text class="jump-btn-text">查看商品</text>
        </view>
      </view>
    </view>

    <Loading v-if="loading && !detail" />
    <Empty v-if="!loading && !detail" text="活动内容不存在或已下架" />
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { onLoad, onShareAppMessage } from '@dcloudio/uni-app'
import { getActivityContentDetail, type ActivityContentDetail } from '@/api/activity-content'
import Loading from '@/components/Loading.vue'
import Empty from '@/components/Empty.vue'

const detail = ref<ActivityContentDetail | null>(null)
const loading = ref(false)

async function loadDetail(id: string) {
  loading.value = true
  try {
    detail.value = await getActivityContentDetail(id)
  } catch {
    detail.value = null
    uni.showToast({ title: '加载失败', icon: 'none' })
  } finally {
    loading.value = false
  }
}

function goProduct() {
  if (!detail.value?.linkedProductId) return
  uni.navigateTo({ url: `/pages/product/detail?id=${detail.value.linkedProductId}` })
}

function typeLabel(type: string): string {
  if (type === 'video') return '视频'
  if (type === 'product') return '商品推荐'
  return '图文'
}

onShareAppMessage(() => ({
  title: detail.value?.title || '禧孕优选活动',
  path: `/pages/activity-content/detail?id=${detail.value?.id || ''}`,
}))

onLoad((options) => {
  if (options?.id) {
    loadDetail(String(options.id))
  }
})
</script>

<style lang="scss" scoped>
.detail-page {
  padding-bottom: $spacing-xl;
}

.detail-card {
  margin: 24rpx $spacing-md;
  border-radius: $radius-xxl;
  overflow: hidden;
  background: $gradient-card;
  border: 1rpx solid rgba($border-color, 0.78);
  box-shadow: $shadow-md;
}

.cover-wrap {
  width: 100%;
  height: 400rpx;
  background: $bg-ivory;
}

.cover {
  width: 100%;
  height: 100%;
  background: $bg-ivory;
}

.info-block {
  padding: $spacing-md;
}

.title-row {
  @include flex-between;
  margin-bottom: $spacing-sm;
}

.type-tag {
  padding: 6rpx 16rpx;
  border-radius: $radius-round;
  background: $info-soft;

  &.article .type-text {
    color: $info-color;
  }

  &.video .type-text {
    color: $success-dark;
    background: $success-soft;
  }

  &.product .type-text {
    color: $primary-dark;
    background: $primary-soft;
  }

  &.video,
  &.product {
    background: transparent;
  }
}

.type-text {
  font-size: $font-xs;
  font-weight: 800;
}

.view-count {
  font-size: $font-xs;
  color: $text-hint;
}

.detail-title {
  display: block;
  font-size: $font-xl;
  font-weight: 900;
  color: $text-color;
  line-height: 1.36;
  margin-bottom: $spacing-xs;
}

.detail-subtitle {
  display: block;
  font-size: $font-sm;
  color: $text-secondary;
  line-height: 1.6;
}

.video-block {
  margin: 0 $spacing-md $spacing-md;
  border-radius: $radius-lg;
  overflow: hidden;
  background: #000;
}

.video-player {
  width: 100%;
  height: 420rpx;
}

.content-block {
  margin: 0 $spacing-md $spacing-md;
  padding: $spacing-md;
  border-radius: $radius-lg;
  background: rgba(255, 255, 255, 0.78);
  border: 1rpx solid rgba($border-color, 0.74);
}

.content-text {
  display: block;
  font-size: $font-md;
  color: $text-color;
  line-height: 1.85;
  white-space: pre-wrap;
  word-break: break-word;
}

.product-jump {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin: 0 $spacing-md $spacing-md;
  padding: $spacing-md;
  border-radius: $radius-lg;
  background: $gradient-peach;
  border: 1rpx solid rgba($primary-color, 0.12);
}

.jump-info {
  flex: 1;
  min-width: 0;
}

.jump-title {
  display: block;
  font-size: $font-md;
  font-weight: 800;
  color: $primary-dark;
  margin-bottom: 6rpx;
}

.jump-desc {
  display: block;
  font-size: $font-xs;
  color: $text-secondary;
}

.jump-btn {
  padding: 16rpx 28rpx;
  border-radius: $radius-round;
  background: $gradient-coral;
  box-shadow: $shadow-coral;
  flex-shrink: 0;
}

.jump-btn-text {
  color: #FFFFFF;
  font-size: $font-sm;
  font-weight: 800;
}
</style>
