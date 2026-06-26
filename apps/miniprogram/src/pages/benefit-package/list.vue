<template>
  <view class="benefit-list-page page-shell">
    <view v-for="pkg in packageList" :key="pkg.id" class="pkg-card card" @tap="goDetail(pkg.id)">
      <image
        v-if="pkg.coverImage"
        class="pkg-cover"
        :src="pkg.coverImage"
        mode="aspectFill"
      />
      <view v-else class="pkg-cover pkg-cover-placeholder">
        <text class="placeholder-text">权益卡</text>
      </view>
      <view class="pkg-info">
        <view class="pkg-name">{{ pkg.name }}</view>
        <view v-if="pkg.subtitle" class="pkg-subtitle">{{ pkg.subtitle }}</view>
        <view class="pkg-meta">
          <text v-if="pkg.price != null" class="pkg-price">¥{{ formatPrice(pkg.price) }}</text>
          <text v-if="pkg.validDays" class="pkg-valid">{{ pkg.validDays }}天有效</text>
        </view>
      </view>
    </view>
    <Loading v-if="loading" />
    <Empty v-if="!loading && packageList.length === 0" text="暂无权益卡" />
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { onLoad, onReachBottom } from '@dcloudio/uni-app'
import { getBenefitPackageList, type BenefitPackageSummary } from '@/api/benefit-package'
import Loading from '@/components/Loading.vue'
import Empty from '@/components/Empty.vue'

const packageList = ref<BenefitPackageSummary[]>([])
const loading = ref(false)
const page = ref(1)
const finished = ref(false)

function formatPrice(cents: number): string {
  return (cents / 100).toFixed(2)
}

async function loadList(reset = false) {
  if (loading.value) return
  if (!reset && finished.value) return
  if (reset) {
    page.value = 1
    finished.value = false
    packageList.value = []
  }
  loading.value = true
  try {
    const data = await getBenefitPackageList({ page: page.value, pageSize: 20 })
    packageList.value.push(...data.list)
    finished.value = packageList.value.length >= data.total
    page.value++
  } catch {
    uni.showToast({ title: '加载失败', icon: 'none' })
  } finally {
    loading.value = false
  }
}

function goDetail(id: string) {
  uni.navigateTo({ url: `/pages/benefit-package/detail?id=${id}` })
}

onLoad(() => loadList())
onReachBottom(() => loadList())
</script>

<style lang="scss" scoped>
.benefit-list-page {
  min-height: 100vh;
  padding: $spacing-md;
}

.pkg-card {
  display: flex;
  margin-bottom: $spacing-md;
  background: $gradient-card;
  border-radius: $radius-xxl;
  overflow: hidden;
}

.pkg-cover {
  width: 220rpx;
  height: 220rpx;
  flex-shrink: 0;
  background: $bg-ivory;
}

.pkg-cover-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, $primary-soft 0%, $bg-ivory 100%);
}

.placeholder-text {
  font-size: $font-sm;
  color: $primary-dark;
  font-weight: 700;
}

.pkg-info {
  flex: 1;
  padding: $spacing-md;
  display: flex;
  flex-direction: column;
  justify-content: center;
  min-width: 0;
}

.pkg-name {
  font-size: $font-lg;
  font-weight: 800;
  color: $text-color;
  margin-bottom: 8rpx;
  @include text-ellipsis;
}

.pkg-subtitle {
  font-size: $font-xs;
  color: $text-secondary;
  margin-bottom: 12rpx;
  @include text-ellipsis;
}

.pkg-meta {
  display: flex;
  align-items: center;
  gap: 16rpx;
}

.pkg-price {
  font-size: $font-md;
  color: $primary-dark;
  font-weight: 900;
}

.pkg-valid {
  font-size: $font-xs;
  color: $text-hint;
  padding: 4rpx 12rpx;
  border-radius: $radius-round;
  background: $bg-ivory;
}
</style>
