<template>
  <view class="benefit-detail-page page-shell">
    <Loading v-if="loading" />
    <view v-else-if="pkg" class="detail-body">
      <view class="hero card">
        <image
          v-if="pkg.coverImage"
          class="hero-cover"
          :src="pkg.coverImage"
          mode="aspectFill"
        />
        <view v-else class="hero-cover hero-cover-placeholder">
          <text class="hero-placeholder-text">{{ pkg.name }}</text>
        </view>
        <view class="hero-info">
          <view class="hero-name">{{ pkg.name }}</view>
          <view v-if="pkg.subtitle" class="hero-subtitle">{{ pkg.subtitle }}</view>
          <view class="hero-meta">
            <text v-if="pkg.price != null" class="hero-price">¥{{ formatPrice(pkg.price) }}</text>
            <text v-if="validText" class="hero-valid">{{ validText }}</text>
          </view>
        </view>
      </view>

      <view v-if="pkg.description" class="section card">
        <view class="section-title">权益说明</view>
        <view class="section-text">{{ pkg.description }}</view>
      </view>

      <view class="section card">
        <view class="section-title">包含权益</view>
        <view v-if="pkg.items && pkg.items.length > 0">
          <view v-for="item in pkg.items" :key="item.id" class="item-row">
            <view class="item-name">{{ item.name }}</view>
            <view class="item-meta">
              <text class="item-tag">{{ itemTypeText(item.itemType) }}</text>
              <text v-if="item.quantity > 1" class="item-qty">x{{ item.quantity }}</text>
              <text v-if="item.originalValue != null" class="item-value">价值¥{{ formatPrice(item.originalValue) }}</text>
            </view>
            <view v-if="item.description" class="item-desc">{{ item.description }}</view>
          </view>
        </view>
        <view v-else class="empty-text">暂无权益项</view>
      </view>

      <view class="section card">
        <view class="section-title">有效期规则</view>
        <view class="section-text">{{ validRuleText }}</view>
      </view>

      <view v-if="pkg.productId" class="buy-btn" @tap="goBuy">
        <text>立即购买</text>
      </view>
    </view>
    <Empty v-else text="权益卡不存在或已下架" />
  </view>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { getBenefitPackageDetail, type BenefitPackageDetail } from '@/api/benefit-package'
import Loading from '@/components/Loading.vue'
import Empty from '@/components/Empty.vue'

const pkg = ref<BenefitPackageDetail | null>(null)
const loading = ref(false)

function formatPrice(cents: number): string {
  return (cents / 100).toFixed(2)
}

function itemTypeText(t: string): string {
  switch (t) {
    case 'service': return '服务'
    case 'physical': return '实物'
    case 'coupon': return '优惠券'
    default: return '权益'
  }
}

const validText = computed(() => {
  if (!pkg.value) return ''
  const p = pkg.value
  if (p.validStartAt && p.validEndAt) {
    return `${formatDate(p.validStartAt)} 至 ${formatDate(p.validEndAt)}`
  }
  if (p.validDays) {
    return `购买后${p.validDays}天有效`
  }
  return ''
})

const validRuleText = computed(() => {
  if (!pkg.value) return ''
  const p = pkg.value
  if (p.validStartAt && p.validEndAt) {
    return `本权益卡有效期：${formatDate(p.validStartAt)} 至 ${formatDate(p.validEndAt)}`
  }
  if (p.validDays) {
    return `购买后 ${p.validDays} 天内有效，过期未使用的权益将自动作废。`
  }
  return '以实际购买后到账的有效期为准。'
})

function formatDate(s: string): string {
  const d = new Date(s)
  if (isNaN(d.getTime())) return s
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

async function loadDetail(id: string) {
  loading.value = true
  try {
    pkg.value = await getBenefitPackageDetail(id)
  } catch {
    uni.showToast({ title: '加载失败', icon: 'none' })
  } finally {
    loading.value = false
  }
}

function goBuy() {
  if (!pkg.value?.productId) return
  uni.navigateTo({ url: `/pages/product/detail?id=${pkg.value.productId}` })
}

onLoad((options) => {
  const id = options?.id
  if (id) loadDetail(String(id))
})
</script>

<style lang="scss" scoped>
.benefit-detail-page {
  min-height: 100vh;
  padding: $spacing-md $spacing-md 160rpx;
}

.detail-body {
  display: flex;
  flex-direction: column;
  gap: $spacing-md;
}

.hero {
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: $gradient-card;
  border-radius: $radius-xxl;
}

.hero-cover {
  width: 100%;
  height: 320rpx;
  background: $bg-ivory;
}

.hero-cover-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, $primary-soft 0%, $bg-ivory 100%);
}

.hero-placeholder-text {
  font-size: $font-xl;
  color: $primary-dark;
  font-weight: 900;
}

.hero-info {
  padding: $spacing-md;
}

.hero-name {
  font-size: $font-xl;
  font-weight: 900;
  color: $text-color;
  margin-bottom: 8rpx;
}

.hero-subtitle {
  font-size: $font-sm;
  color: $text-secondary;
  margin-bottom: 12rpx;
}

.hero-meta {
  display: flex;
  align-items: center;
  gap: 16rpx;
}

.hero-price {
  font-size: $font-xl;
  color: $primary-dark;
  font-weight: 900;
}

.hero-valid {
  font-size: $font-xs;
  color: $text-hint;
  padding: 4rpx 12rpx;
  border-radius: $radius-round;
  background: $bg-ivory;
}

.section {
  padding: $spacing-md;
  background: $gradient-card;
  border-radius: $radius-xxl;
}

.section-title {
  font-size: $font-md;
  font-weight: 800;
  color: $text-color;
  margin-bottom: $spacing-sm;
}

.section-text {
  font-size: $font-sm;
  color: $text-secondary;
  line-height: 1.7;
  white-space: pre-wrap;
}

.item-row {
  padding: $spacing-sm 0;
  border-bottom: 1rpx solid rgba(0, 0, 0, 0.04);

  &:last-child {
    border-bottom: none;
  }
}

.item-name {
  font-size: $font-sm;
  font-weight: 700;
  color: $text-color;
  margin-bottom: 6rpx;
}

.item-meta {
  display: flex;
  align-items: center;
  gap: 12rpx;
  margin-bottom: 4rpx;
}

.item-tag {
  font-size: $font-xs;
  color: $primary-dark;
  background: $primary-soft;
  padding: 2rpx 12rpx;
  border-radius: $radius-round;
}

.item-qty {
  font-size: $font-xs;
  color: $text-secondary;
}

.item-value {
  font-size: $font-xs;
  color: $text-hint;
}

.item-desc {
  font-size: $font-xs;
  color: $text-hint;
  line-height: 1.6;
}

.empty-text {
  font-size: $font-sm;
  color: $text-hint;
  text-align: center;
  padding: $spacing-md 0;
}

.buy-btn {
  position: fixed;
  left: $spacing-md;
  right: $spacing-md;
  bottom: $spacing-md;
  height: 92rpx;
  border-radius: $radius-round;
  background: $primary-color;
  color: #fff;
  font-size: $font-md;
  font-weight: 800;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: $shadow-md;
}
</style>
