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
  padding: 16rpx;
}
.activity-card {
  display: flex;
  margin-bottom: 16rpx;
  padding: 16rpx;
  background: #fff;
  border-radius: 16rpx;
}
.cover-wrap {
  flex-shrink: 0;
}
.cover {
  width: 200rpx;
  height: 200rpx;
  border-radius: 12rpx;
  background: #f5f5f5;
}
.cover-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
}
.placeholder-text {
  color: #ccc;
  font-size: 24rpx;
}
.info {
  flex: 1;
  margin-left: 16rpx;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
}
.name {
  font-size: 28rpx;
  font-weight: 600;
  color: #333;
  margin-bottom: 8rpx;
}
.price-row {
  display: flex;
  align-items: baseline;
  gap: 12rpx;
  margin-bottom: 8rpx;
}
.flash-price {
  color: #f56c6c;
  font-size: 36rpx;
  font-weight: 700;
}
.origin-price {
  color: #c0c4cc;
  font-size: 24rpx;
  text-decoration: line-through;
}
.meta-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8rpx;
}
.stock {
  color: #909399;
  font-size: 22rpx;
}
.status-tag {
  font-size: 22rpx;
  padding: 4rpx 12rpx;
  border-radius: 4rpx;
}
.status-tag.status-running {
  background: rgba(245, 108, 108, 0.1);
  color: #f56c6c;
}
.status-tag.status-pending {
  background: rgba(230, 162, 60, 0.1);
  color: #e6a23c;
}
.status-tag.status-end {
  background: rgba(144, 147, 153, 0.1);
  color: #909399;
}
.countdown {
  font-size: 22rpx;
  color: #f56c6c;
}
</style>
