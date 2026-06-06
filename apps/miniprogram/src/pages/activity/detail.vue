<template>
  <view class="activity-detail-page page-shell">
    <view class="banner-wrap">
      <image class="activity-banner" :src="activityBanner" mode="aspectFill" />
      <view class="banner-shade"></view>
      <text class="banner-status" :class="activityStatusClass">{{ activityStatusText }}</text>
      <view class="banner-copy">
        <text class="banner-eyebrow">禧孕优选活动</text>
        <text class="banner-title">{{ activity.name || '活动详情' }}</text>
      </view>
    </view>

    <view class="activity-info card">
      <view class="info-topline">
        <text class="info-badge">自营福利</text>
        <text class="info-note">优惠以结算页为准</text>
      </view>
      <text class="activity-name">{{ activity.name }}</text>
      <view class="activity-meta">
        <CountdownTimer :endTime="normalizedEndTime" label="距结束" />
      </view>
      <text v-if="activity.description" class="activity-desc">{{ activity.description }}</text>
      <view v-if="activity.discount || activity.minAmount" class="offer-strip">
        <view v-if="activity.discount" class="offer-item">
          <text class="offer-label">活动优惠</text>
          <text class="offer-value">{{ activity.discount }}折</text>
        </view>
        <view v-if="activity.minAmount" class="offer-item">
          <text class="offer-label">使用门槛</text>
          <text class="offer-value">满 ¥{{ activity.minAmount }}</text>
        </view>
      </view>
    </view>

    <view v-if="activity.rules" class="rules-section card">
      <view class="section-title-row">
        <text class="section-title">活动规则</text>
        <text class="section-subtitle">请在下单前确认</text>
      </view>
      <text class="rules-content">{{ activity.rules }}</text>
    </view>

    <view v-if="activityProducts.length" class="products-section">
      <view class="section-title-row">
        <text class="section-title">活动商品</text>
        <text class="section-subtitle">精选自营好物</text>
      </view>
      <view class="product-grid">
        <ProductCard v-for="product in activityProducts" :key="product.id" :product="product" />
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad, onShareAppMessage } from '@dcloudio/uni-app'
import { getActivityDetail, type ActivityDetail } from '@/api/activity'
import { normalizeTimeToTimestamp, type CompatibleTime } from '@/utils/time'
import CountdownTimer from '@/components/CountdownTimer.vue'
import ProductCard from '@/components/ProductCard.vue'

const activity = ref<ActivityDetail>({
  id: 0, name: '', image: '', description: '', type: 0,
  startTime: 0, endTime: 0, rules: ''
})

const activityBanner = computed(() => activity.value.image || activity.value.bannerImage || '/static/default-cover.png')

const activityStatusText = computed(() => {
  const now = Date.now()
  const start = normalizeActivityTime(activity.value.startTime)
  const end = normalizeActivityTime(activity.value.endTime)
  if (Number.isFinite(start) && now < start) return '即将开始'
  if (!Number.isFinite(end) || now > end) return '已结束'
  return '进行中'
})

const activityStatusClass = computed(() => {
  if (activityStatusText.value === '即将开始') return 'pending'
  if (activityStatusText.value === '已结束') return 'ended'
  return 'active'
})

const activityProducts = computed(() => {
  const source =
    (activity.value as any).products ||
    (activity.value as any).activityProducts ||
    (activity.value as any).productList ||
    (activity.value as any).goodsList ||
    []

  if (!Array.isArray(source)) return []

  return source.map((item: any) => ({
    id: item.id || item.productId || item.product?.id,
    name: item.name || item.productName || item.product?.name || '',
    image: item.image || item.productImage || item.product?.mainImage || item.sku?.image || item.cover || '/static/default-cover.png',
    price: Number(item.activityPrice ?? item.price ?? 0),
    originalPrice: Number(item.originalPrice ?? item.product?.minPrice ?? item.price ?? item.activityPrice ?? 0),
    sales: Number(item.sales ?? item.product?.totalSales ?? item.saleCount ?? 0),
    activityPrice: Number(item.activityPrice ?? item.price ?? 0),
    stock: Number(item.stock ?? item.activityStock ?? item.sku?.stock ?? 0),
    tags: ['活动优选', '自营正品']
  })).filter((item: any) => item.id)
})

const normalizedEndTime = computed(() => normalizeActivityTime(activity.value.endTime))

function normalizeActivityTime(value?: CompatibleTime) {
  return normalizeTimeToTimestamp(value)
}

async function loadActivity(id: number) {
  try {
    activity.value = await getActivityDetail(id)
  } catch {
    uni.showToast({ title: '活动加载失败', icon: 'none' })
  }
}

onShareAppMessage(() => ({
  title: activity.value.name,
  path: `/pages/activity/detail?id=${activity.value.id}`
}))

onLoad((options) => {
  if (options?.id) {
    const id = Number(options.id)
    loadActivity(id)
  }
})
</script>

<style lang="scss" scoped>
.activity-detail-page {
  min-height: 100vh;
  padding-bottom: $spacing-xl;
}

.banner-wrap {
  position: relative;
  margin: 24rpx $spacing-md 0;
  height: 460rpx;
  border-radius: 0 0 $radius-xxl $radius-xxl;
  overflow: hidden;
  box-shadow: $shadow-md;
  background: $bg-ivory;
}

.activity-banner {
  width: 100%;
  height: 100%;
  background: $bg-ivory;
}

.banner-shade {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: 210rpx;
  background: linear-gradient(180deg, rgba(58, 48, 44, 0) 0%, rgba(58, 48, 44, 0.34) 100%);
}

.banner-status {
  position: absolute;
  left: 22rpx;
  top: 22rpx;
  min-height: 42rpx;
  padding: 0 18rpx;
  border-radius: $radius-round;
  background: rgba(255, 255, 255, 0.9);
  color: $success-dark;
  font-size: $font-xs;
  line-height: 42rpx;
  font-weight: 800;

  &.pending {
    color: $secondary-color;
  }

  &.ended {
    color: $text-hint;
  }
}

.banner-copy {
  position: absolute;
  left: $spacing-md;
  right: $spacing-md;
  bottom: $spacing-md;
}

.banner-eyebrow {
  display: inline-flex;
  min-height: 38rpx;
  padding: 0 16rpx;
  border-radius: $radius-round;
  background: rgba(255, 255, 255, 0.86);
  color: $primary-dark;
  font-size: $font-xs;
  line-height: 38rpx;
  font-weight: 800;
}

.banner-title {
  display: block;
  margin-top: 12rpx;
  color: #FFFFFF;
  font-size: $font-xl;
  line-height: 1.28;
  font-weight: 900;
  text-shadow: 0 4rpx 14rpx rgba(58, 48, 44, 0.2);
  @include text-ellipsis-2;
}

.activity-info {
  margin: -34rpx $spacing-md $spacing-sm;
  border-radius: $radius-xxl;
  position: relative;
  z-index: 2;
  background:
    radial-gradient(circle at 90% 0%, rgba($primary-color, 0.1), rgba($primary-color, 0) 220rpx),
    rgba(255, 255, 255, 0.94);
  border-color: rgba(255, 255, 255, 0.78);
  box-shadow: $shadow-md;
}

.info-topline {
  @include flex-between;
  margin-bottom: $spacing-sm;
}

.info-badge {
  min-height: 38rpx;
  padding: 0 16rpx;
  border-radius: $radius-round;
  background: $primary-soft;
  color: $primary-dark;
  font-size: $font-xs;
  line-height: 38rpx;
  font-weight: 800;
}

.info-note {
  color: $text-hint;
  font-size: $font-xs;
}

.activity-name {
  font-size: $font-xl;
  font-weight: 800;
  color: $text-color;
  display: block;
  margin-bottom: $spacing-sm;
  line-height: 1.38;
}

.activity-meta {
  margin-bottom: $spacing-sm;
  padding: 14rpx 18rpx;
  border-radius: $radius-lg;
  background: rgba($secondary-color, 0.08);
  border: 1rpx solid rgba($secondary-color, 0.12);
}

.activity-desc {
  font-size: $font-sm;
  color: $text-secondary;
  line-height: 1.8;
}

.offer-strip {
  display: flex;
  gap: $spacing-sm;
  margin-top: $spacing-md;
}

.offer-item {
  flex: 1;
  min-width: 0;
  padding: 18rpx;
  border-radius: 26rpx;
  background: $gradient-peach;
  border: 1rpx solid rgba($primary-color, 0.1);
}

.offer-label,
.offer-value {
  display: block;
}

.offer-label {
  color: $text-hint;
  font-size: $font-xs;
}

.offer-value {
  margin-top: 8rpx;
  color: $primary-dark;
  font-size: $font-lg;
  font-weight: 900;
}

.rules-section {
  margin: $spacing-sm $spacing-md;
  background: rgba(255, 255, 255, 0.9);
  border-color: rgba(255, 255, 255, 0.78);
}

.section-title-row {
  @include flex-between;
  align-items: flex-end;
  margin: 0 $spacing-md $spacing-sm;

  .rules-section & {
    margin: 0 0 $spacing-sm;
  }
}

.section-title {
  font-size: $font-lg;
  font-weight: 800;
  color: $text-color;
  display: block;
}

.section-subtitle {
  color: $text-hint;
  font-size: $font-xs;
}

.rules-content {
  font-size: $font-sm;
  color: $text-secondary;
  line-height: 1.8;
}

.products-section {
  margin-top: $spacing-lg;
}

.product-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 22rpx;
  padding: 0 $spacing-md;
}

.activity-detail-page :deep(.countdown-wrap) {
  min-height: 46rpx;
  padding: 4rpx 8rpx 4rpx 14rpx;
  border-radius: $radius-round;
  background: rgba($primary-color, 0.08);
}

.activity-detail-page :deep(.countdown-label) {
  color: $primary-dark;
  font-size: $font-xs;
  font-weight: 700;
}

.activity-detail-page :deep(.countdown-block) {
  min-width: 40rpx;
  border-radius: $radius-round;
  background: rgba(255, 255, 255, 0.92);
  box-shadow: $shadow-xs;
}

.activity-detail-page :deep(.countdown-num) {
  color: $primary-dark;
  font-size: $font-xs;
  font-weight: 800;
}

.activity-detail-page :deep(.countdown-sep) {
  color: $primary-color;
  font-size: $font-xs;
}

.activity-detail-page :deep(.countdown-expired) {
  min-height: 40rpx;
  padding: 0 16rpx;
  border-radius: $radius-round;
  background: rgba($bg-gray, 0.86);
  color: $text-hint;
  font-size: $font-xs;
  line-height: 40rpx;
}
</style>
