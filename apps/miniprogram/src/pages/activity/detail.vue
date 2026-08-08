<template>
  <view class="activity-detail-page page-shell">
    <view class="banner-wrap">
      <image class="activity-banner" :src="activityBanner" mode="aspectFill" />
      <view class="banner-shade"></view>
      <text class="banner-status" :class="activityStatusClass">{{ activityStatusText }}</text>
      <view class="banner-copy">
        <text class="banner-eyebrow">{{ activityTypeText }}</text>
        <text class="banner-title">{{ activity.name || '活动详情' }}</text>
      </view>
    </view>

    <view class="activity-info card">
      <view class="info-topline">
        <text class="info-badge">服务端实时核价</text>
        <text class="info-note">优惠以结算页为准</text>
      </view>
      <text class="activity-name">{{ activity.name }}</text>
      <view class="activity-meta">
        <CountdownTimer :endTime="normalizedEndTime" label="距结束" />
      </view>
      <text v-if="activity.description" class="activity-desc">{{ activity.description }}</text>
    </view>

    <view v-if="ruleText" class="rules-section card">
      <view class="section-title-row inner-title-row">
        <text class="section-title">活动规则</text>
        <text class="section-subtitle">下单时再次校验</text>
      </view>
      <text class="rules-content">{{ ruleText }}</text>
    </view>

    <view class="stacking-note card">
      <text class="stacking-title">优惠叠加说明</text>
      <text class="stacking-desc">本活动订单不与普通优惠券、积分抵扣叠加；活动价、活动库存、限购和新人资格均由服务器在提交订单时重新核验。</text>
    </view>

    <view v-if="activityProducts.length" class="products-section">
      <view class="section-title-row">
        <text class="section-title">活动商品</text>
        <text class="section-subtitle">{{ activityProducts.length }} 个可购 SKU</text>
      </view>
      <view class="product-list">
        <view v-for="product in activityProducts" :key="product.activityProductId" class="activity-product card">
          <view class="product-click-area" @tap="openProductDetail(product)">
            <image class="product-image" :src="product.image || '/static/default-cover.png'" mode="aspectFill" />
            <view class="product-main">
              <text class="product-name">{{ product.name }}</text>
              <text v-if="product.skuId" class="sku-id">活动 SKU · {{ product.skuId }}</text>
              <view class="price-row">
                <text class="activity-price">¥{{ formatPrice(product.price) }}</text>
                <text v-if="product.originalPrice > product.price" class="original-price">¥{{ formatPrice(product.originalPrice) }}</text>
              </view>
              <text class="stock-text">活动可售 {{ product.stock }} 件{{ product.limitPerUser ? ` · 每人限购 ${product.limitPerUser} 件` : '' }}</text>
            </view>
          </view>
          <view class="product-footer">
            <text class="fulfillment-tag">{{ product.fulfillmentType === 'pickup' ? '到店自提' : '快递配送' }}</text>
            <button
              class="buy-btn"
              :disabled="activityStatusText !== '进行中' || product.stock <= 0 || !product.skuId || !product.activityProductId"
              @tap="buyActivityProduct(product)"
            >
              {{ product.stock > 0 ? '立即抢购' : '已售罄' }}
            </button>
          </view>
        </view>
      </view>
    </view>

    <view v-else class="empty card">
      <text class="empty-title">暂无可购买活动商品</text>
      <text class="empty-desc">活动商品可能已调整、售罄或下架，请稍后再查看。</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad, onShareAppMessage } from '@dcloudio/uni-app'
import { getActivityDetail, type ActivityDetail, type ActivityProduct } from '@/api/activity'
import { normalizeTimeToTimestamp, type CompatibleTime } from '@/utils/time'
import { formatPrice } from '@/utils/format'
import CountdownTimer from '@/components/CountdownTimer.vue'

const POSITIVE_ID = /^[1-9]\d*$/
const activity = ref<ActivityDetail>({
  id: '',
  name: '',
  image: '',
  description: '',
  type: '',
  startTime: 0,
  endTime: 0,
  rules: null,
  products: [],
})

const activityBanner = computed(() => activity.value.image || activity.value.bannerImage || '/static/default-cover.png')
const activityProducts = computed<ActivityProduct[]>(() => Array.isArray(activity.value.products) ? activity.value.products : [])
const normalizedEndTime = computed(() => normalizeActivityTime(activity.value.endTime))

const activityTypeText = computed(() => {
  if (activity.value.type === '1') return '限时折扣'
  if (activity.value.type === '2') return '满减活动'
  if (activity.value.type === '5') return '新人优惠'
  return '禧孕优选活动'
})

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

const ruleText = computed(() => {
  if (activity.value.type === '1') return '活动商品按页面标示活动价结算；每次下单都会重新校验活动时间、SKU、库存和限购。'
  if (activity.value.type === '5') return '仅限尚未完成首笔有效订单的新用户；活动价和每人限购在提交订单时重新核验。'
  if (activity.value.type === '2') {
    const rules: any = activity.value.rules
    const items = Array.isArray(rules?.fullReductionRules) ? rules.fullReductionRules : []
    const text = items
      .map((item: any) => ({ full: Number(item.fullAmount), reduce: Number(item.reduceAmount) }))
      .filter((item: any) => Number.isSafeInteger(item.full) && Number.isSafeInteger(item.reduce) && item.full > item.reduce && item.reduce > 0)
      .sort((a: any, b: any) => a.full - b.full)
      .map((item: any) => `满 ¥${formatPrice(item.full)} 减 ¥${formatPrice(item.reduce)}`)
      .join('；')
    return text || '满减金额由服务器根据当前活动规则实时计算。'
  }
  return ''
})

function normalizeActivityTime(value?: CompatibleTime) {
  return normalizeTimeToTimestamp(value)
}

async function loadActivity(id: string) {
  try {
    activity.value = await getActivityDetail(id)
  } catch (error: any) {
    uni.showToast({ title: error?.message || '活动加载失败', icon: 'none' })
  }
}

function openProductDetail(product: ActivityProduct) {
  if (!POSITIVE_ID.test(String(product.productId || ''))) return
  uni.navigateTo({ url: `/pages/product/detail?id=${encodeURIComponent(product.productId)}` })
}

function buyActivityProduct(product: ActivityProduct) {
  if (activityStatusText.value !== '进行中') {
    uni.showToast({ title: activityStatusText.value === '已结束' ? '活动已结束' : '活动尚未开始', icon: 'none' })
    return
  }
  const aId = String(activity.value.id || '')
  const relationId = String(product.activityProductId || '')
  const selectedSkuId = String(product.skuId || '')
  if (![aId, relationId, selectedSkuId].every((value) => POSITIVE_ID.test(value))) {
    uni.showToast({ title: '活动商品配置无效，请稍后重试', icon: 'none' })
    return
  }
  uni.navigateTo({
    url: `/pages/activity/checkout?activityId=${encodeURIComponent(aId)}&activityProductId=${encodeURIComponent(relationId)}&skuId=${encodeURIComponent(selectedSkuId)}`,
  })
}

onShareAppMessage(() => ({
  title: activity.value.name || '禧孕优选活动',
  path: `/pages/activity/detail?id=${encodeURIComponent(activity.value.id)}`,
}))

onLoad((options) => {
  const id = String(options?.id || '').trim()
  if (!POSITIVE_ID.test(id)) {
    uni.showToast({ title: '活动参数无效', icon: 'none' })
    return
  }
  loadActivity(id)
})
</script>

<style lang="scss" scoped>
.activity-detail-page { min-height: 100vh; padding-bottom: $spacing-xl; }
.banner-wrap { position: relative; margin: 24rpx $spacing-md 0; height: 430rpx; border-radius: $radius-xxl; overflow: hidden; box-shadow: $shadow-md; background: $bg-ivory; }
.activity-banner { width: 100%; height: 100%; }
.banner-shade { position: absolute; inset: auto 0 0; height: 220rpx; background: linear-gradient(180deg, rgba(58,48,44,0), rgba(58,48,44,.42)); }
.banner-status { position: absolute; left: 22rpx; top: 22rpx; padding: 8rpx 18rpx; border-radius: $radius-round; background: rgba(255,255,255,.92); color: $success-dark; font-size: $font-xs; font-weight: 800; }
.banner-status.pending { color: $secondary-color; }
.banner-status.ended { color: $text-hint; }
.banner-copy { position: absolute; left: $spacing-md; right: $spacing-md; bottom: $spacing-md; }
.banner-eyebrow { display: inline-block; padding: 7rpx 16rpx; border-radius: $radius-round; background: rgba(255,255,255,.9); color: $primary-dark; font-size: $font-xs; font-weight: 800; }
.banner-title { display: block; margin-top: 12rpx; color: #fff; font-size: $font-xl; font-weight: 900; line-height: 1.3; }
.card { margin: $spacing-sm $spacing-md; padding: $spacing-md; border-radius: $radius-xl; background: rgba(255,255,255,.96); box-shadow: $shadow-xs; }
.activity-info { margin-top: -24rpx; position: relative; z-index: 2; }
.info-topline, .section-title-row, .product-footer { display: flex; align-items: center; justify-content: space-between; gap: 16rpx; }
.info-badge, .fulfillment-tag { padding: 7rpx 14rpx; border-radius: $radius-round; background: $primary-soft; color: $primary-dark; font-size: $font-xs; font-weight: 800; }
.info-note, .section-subtitle { color: $text-hint; font-size: $font-xs; }
.activity-name { display: block; margin-top: 14rpx; color: $text-color; font-size: $font-xl; font-weight: 900; }
.activity-meta { margin: 16rpx 0; padding: 12rpx; border-radius: $radius-lg; background: rgba($secondary-color,.08); }
.activity-desc, .rules-content, .stacking-desc { display: block; color: $text-secondary; font-size: $font-sm; line-height: 1.75; }
.inner-title-row { margin-bottom: 14rpx; }
.section-title-row { margin: $spacing-lg $spacing-md $spacing-sm; }
.section-title, .stacking-title { color: $text-color; font-size: $font-lg; font-weight: 900; }
.stacking-note { background: rgba($primary-color,.06); }
.stacking-desc { margin-top: 10rpx; }
.product-list { padding-bottom: 10rpx; }
.activity-product { padding: 20rpx; }
.product-click-area { display: flex; gap: 18rpx; }
.product-image { width: 176rpx; height: 176rpx; flex-shrink: 0; border-radius: $radius-lg; background: $bg-ivory; }
.product-main { flex: 1; min-width: 0; }
.product-name { display: block; color: $text-color; font-size: $font-md; font-weight: 800; line-height: 1.45; }
.sku-id, .stock-text { display: block; margin-top: 8rpx; color: $text-hint; font-size: $font-xs; }
.price-row { display: flex; align-items: baseline; gap: 10rpx; margin-top: 14rpx; }
.activity-price { color: $primary-dark; font-size: $font-lg; font-weight: 900; }
.original-price { color: $text-hint; font-size: $font-xs; text-decoration: line-through; }
.product-footer { margin-top: 18rpx; padding-top: 16rpx; border-top: 1rpx solid $border-color; }
.buy-btn { min-width: 190rpx; height: 66rpx; padding: 0 28rpx; border: 0; border-radius: $radius-round; background: $gradient-primary; color: #fff; font-size: $font-sm; font-weight: 900; line-height: 66rpx; }
.buy-btn::after { border: 0; }
.buy-btn[disabled] { opacity: .48; }
.empty { text-align: center; padding: 50rpx 28rpx; }
.empty-title { display: block; color: $text-color; font-size: $font-md; font-weight: 800; }
.empty-desc { display: block; margin-top: 10rpx; color: $text-hint; font-size: $font-sm; line-height: 1.6; }
</style>
