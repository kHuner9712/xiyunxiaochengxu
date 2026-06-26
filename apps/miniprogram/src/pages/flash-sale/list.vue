<template>
  <view class="flash-sale-list-page page-shell">
    <view v-for="act in activityList" :key="act.id" class="activity-card card" @tap="goDetail(act.id)">
      <view v-if="act.coverImage" class="cover-wrap">
        <image class="cover" :src="act.coverImage" mode="aspectFill" />
      </view>
      <view v-else class="cover-wrap">
        <view class="cover cover-placeholder">
          <text class="placeholder-text">秒杀</text>
        </view>
      </view>
      <view class="info">
        <view class="name">{{ act.name }}</view>
        <view class="price-row">
          <text class="flash-price">¥{{ formatPrice(act.flashPrice) }}</text>
          <text v-if="act.originalPrice" class="origin-price">¥{{ formatPrice(act.originalPrice) }}</text>
        </view>
        <view class="meta-row">
          <text class="stock">剩余 {{ remainStock(act) }} 件</text>
          <text class="status-tag" :class="activityStatusClass(act)">{{ activityStatusText(act) }}</text>
        </view>
        <view v-if="activityStatusText(act) === '进行中'" class="countdown">{{ remainTime(act.endTime) }}</view>
        <view v-else-if="activityStatusText(act) === '未开始'" class="countdown">距开始 {{ remainTime(act.startTime) }}</view>
      </view>
    </view>
    <Loading v-if="loading" />
    <Empty v-if="!loading && activityList.length === 0" text="暂无秒杀活动" />
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { onLoad, onReachBottom } from '@dcloudio/uni-app'
import { flashSaleApi, type FlashSaleActivity } from '@/api/flash-sale'
import Loading from '@/components/Loading.vue'
import Empty from '@/components/Empty.vue'

const activityList = ref<FlashSaleActivity[]>([])
const loading = ref(false)
const page = ref(1)
const finished = ref(false)

function formatPrice(cents: number): string {
  return (cents / 100).toFixed(2)
}

function remainStock(act: FlashSaleActivity): number {
  return Math.max(0, act.stockLimit - act.soldCount - act.lockedCount)
}

function activityStatusText(act: FlashSaleActivity): string {
  const now = Date.now()
  const start = new Date(act.startTime).getTime()
  const end = new Date(act.endTime).getTime()
  if (now < start) return '未开始'
  if (now >= end) return '已结束'
  if (remainStock(act) <= 0) return '已售罄'
  return '进行中'
}

function activityStatusClass(act: FlashSaleActivity): string {
  const s = activityStatusText(act)
  if (s === '进行中') return 'status-running'
  if (s === '未开始') return 'status-pending'
  return 'status-end'
}

function remainTime(timeStr: string): string {
  const ms = new Date(timeStr).getTime() - Date.now()
  if (ms <= 0) return '已结束'
  const days = Math.floor(ms / 86400000)
  const hours = Math.floor((ms % 86400000) / 3600000)
  const mins = Math.floor((ms % 3600000) / 60000)
  if (days > 0) return `${days}天${hours}小时`
  if (hours > 0) return `${hours}h${mins}m`
  return `${mins}m`
}

async function loadList(reset = false) {
  if (loading.value) return
  if (!reset && finished.value) return
  if (reset) {
    page.value = 1
    finished.value = false
    activityList.value = []
  }
  loading.value = true
  try {
    const data = await flashSaleApi.getList({ page: page.value, pageSize: 20 })
    activityList.value.push(...data.list)
    finished.value = activityList.value.length >= data.total
    page.value++
  } catch {
    uni.showToast({ title: '加载失败', icon: 'none' })
  } finally {
    loading.value = false
  }
}

function goDetail(id: string) {
  uni.navigateTo({ url: `/pages/flash-sale/detail?id=${id}` })
}

onLoad(() => loadList())
onReachBottom(() => loadList())
</script>

<style lang="scss" scoped>
.flash-sale-list-page {
  min-height: 100vh;
  padding: $spacing-sm $spacing-md $spacing-lg;
}

.activity-card {
  display: flex;
  margin-bottom: $spacing-md;
  padding: $spacing-sm;
  background: $gradient-card;
  border-radius: $radius-xxl;
  border: 1rpx solid rgba($border-color, 0.78);
  box-shadow: $shadow-sm;
}

.cover-wrap {
  flex-shrink: 0;
}

.cover {
  width: 200rpx;
  height: 200rpx;
  border-radius: $radius-lg;
  background: $bg-ivory;
}

.cover-placeholder {
  @include flex-center;
}

.placeholder-text {
  color: $text-hint;
  font-size: $font-sm;
}

.info {
  flex: 1;
  min-width: 0;
  margin-left: $spacing-sm;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
}

.name {
  font-size: $font-md;
  font-weight: 700;
  color: $text-color;
  margin-bottom: $spacing-xs;
  line-height: 1.4;
  @include text-ellipsis-2;
}

.price-row {
  display: flex;
  align-items: baseline;
  gap: $spacing-sm;
  margin-bottom: $spacing-xs;
}

.flash-price {
  color: $price-color;
  font-size: 38rpx;
  font-weight: 800;
}

.origin-price {
  color: $text-hint;
  font-size: $font-sm;
  text-decoration: line-through;
}

.meta-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: $spacing-xs;
}

.stock {
  color: $text-hint;
  font-size: $font-xs;
}

.status-tag {
  font-size: $font-xs;
  padding: 4rpx 16rpx;
  border-radius: $radius-round;
  font-weight: 700;
}

.status-tag.status-running {
  background: $primary-soft;
  color: $primary-dark;
}

.status-tag.status-pending {
  background: $warning-soft;
  color: $warning-color;
}

.status-tag.status-end {
  background: $info-soft;
  color: $text-hint;
}

.countdown {
  font-size: $font-xs;
  color: $price-color;
  font-weight: 700;
}
</style>
