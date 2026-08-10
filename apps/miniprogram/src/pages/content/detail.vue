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

    <view v-if="content.relatedActivity" class="related-section card">
      <view class="related-title-row">
        <text class="related-title">相关活动</text>
        <text class="related-hint">活动仍在进行中</text>
      </view>
      <view class="activity-link" @tap="goActivity(content.relatedActivity.id)">
        <image class="activity-image" :src="content.relatedActivity.image || '/static/default-cover.png'" mode="aspectFill" />
        <view class="activity-copy">
          <text class="activity-name">{{ content.relatedActivity.name }}</text>
          <text class="activity-action">查看活动 ›</text>
        </view>
      </view>
    </view>

    <view v-if="content.relatedProducts?.length" class="related-section card">
      <view class="related-title-row">
        <text class="related-title">相关商品</text>
        <text class="related-hint">当前可售</text>
      </view>
      <view class="related-products">
        <view
          v-for="product in content.relatedProducts"
          :key="product.id"
          class="related-product"
          @tap="goProduct(product.id)"
        >
          <image class="related-product-image" :src="product.image || '/static/placeholder.png'" mode="aspectFit" />
          <view class="related-product-copy">
            <text class="related-product-name">{{ product.name }}</text>
            <text class="related-product-price">¥{{ formatPrice(product.price) }}</text>
          </view>
          <text class="related-product-arrow">›</text>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { onLoad, onShareAppMessage } from '@dcloudio/uni-app'
import { getContentDetail, type ContentDetail } from '@/api/content'
import { formatPrice } from '@/utils/format'

const MAX_SIGNED_BIGINT_ID = '9223372036854775807'
const content = ref<ContentDetail>({
  id: '', title: '', coverImage: '', content: '', categoryId: '',
  contentType: 'article', summary: '', viewCount: 0, publishedAt: ''
})

function isValidContentId(id: string) {
  if (!/^[1-9]\d*$/.test(id)) return false
  return id.length < MAX_SIGNED_BIGINT_ID.length
    || (id.length === MAX_SIGNED_BIGINT_ID.length && id <= MAX_SIGNED_BIGINT_ID)
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

function goProduct(id: string) {
  if (!isValidContentId(id)) return
  uni.navigateTo({ url: `/pages/product/detail?id=${encodeURIComponent(id)}` })
}

function goActivity(id: string) {
  if (!isValidContentId(id)) return
  uni.navigateTo({ url: `/pages/activity/detail?id=${encodeURIComponent(id)}` })
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
  padding-bottom: $spacing-lg;
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

.video-section,
.content-body,
.content-tags,
.related-section {
  margin: $spacing-sm $spacing-md;
}

.content-video {
  width: 100%;
  border-radius: $radius-xl;
}

.content-body,
.related-section {
  border-radius: $radius-xxl;
  background: rgba(255, 255, 255, 0.92);
}

.content-rich {
  font-size: $font-md;
  line-height: 1.95;
  color: $text-color;
}

.content-tags {
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

.related-title-row {
  @include flex-between;
  margin-bottom: $spacing-sm;
}

.related-title {
  font-size: $font-md;
  font-weight: 800;
  color: $text-color;
}

.related-hint {
  font-size: $font-xs;
  color: $text-hint;
}

.activity-link {
  display: flex;
  align-items: center;
  gap: $spacing-sm;
}

.activity-image {
  width: 160rpx;
  height: 112rpx;
  flex-shrink: 0;
  border-radius: $radius-lg;
  background: $bg-ivory;
}

.activity-copy,
.related-product-copy {
  flex: 1;
  min-width: 0;
}

.activity-name,
.related-product-name {
  display: block;
  color: $text-color;
  font-size: $font-sm;
  font-weight: 700;
  @include text-ellipsis-2;
}

.activity-action {
  display: block;
  margin-top: 10rpx;
  color: $primary-dark;
  font-size: $font-xs;
  font-weight: 700;
}

.related-products {
  display: flex;
  flex-direction: column;
}

.related-product {
  display: flex;
  align-items: center;
  gap: $spacing-sm;
  padding: 14rpx 0;
  border-bottom: 1rpx solid $divider-color;

  &:last-child {
    border-bottom: none;
  }
}

.related-product-image {
  width: 112rpx;
  height: 112rpx;
  flex-shrink: 0;
  border-radius: $radius-lg;
  background: $bg-ivory;
}

.related-product-price {
  display: block;
  margin-top: 8rpx;
  color: $price-color;
  font-size: $font-sm;
  font-weight: 800;
}

.related-product-arrow {
  color: $text-hint;
  font-size: $font-lg;
}
</style>
