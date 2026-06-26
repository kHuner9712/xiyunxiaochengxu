<template>
  <view class="group-buy-list-page page-shell">
    <view v-for="act in activityList" :key="act.id" class="act-card card" @tap="goDetail(act.id)">
      <image
        v-if="act.coverImage"
        class="act-cover"
        :src="act.coverImage"
        mode="aspectFill"
      />
      <view v-else class="act-cover act-cover-placeholder">
        <text class="placeholder-text">拼团</text>
      </view>
      <view class="act-info">
        <view class="act-name">{{ act.name }}</view>
        <view class="act-meta">
          <text class="act-price">¥{{ formatPrice(act.groupPrice) }}</text>
          <text v-if="act.originalPrice" class="act-original">¥{{ formatPrice(act.originalPrice) }}</text>
          <text class="act-size">{{ act.groupSize }}人团</text>
        </view>
        <view class="act-time">剩 {{ remainHours(act) }}h</view>
      </view>
    </view>
    <Loading v-if="loading" />
    <Empty v-if="!loading && activityList.length === 0" text="暂无拼团活动" />
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { onLoad, onReachBottom } from '@dcloudio/uni-app'
import { groupBuyApi, type GroupBuyActivity } from '@/api/group-buy'
import Loading from '@/components/Loading.vue'
import Empty from '@/components/Empty.vue'

const activityList = ref<GroupBuyActivity[]>([])
const loading = ref(false)
const page = ref(1)
const finished = ref(false)

function formatPrice(cents: number): string {
  return (cents / 100).toFixed(2)
}

function remainHours(act: GroupBuyActivity): number {
  const ms = new Date(act.endTime).getTime() - Date.now()
  return Math.max(0, Math.floor(ms / 3600000))
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
    const data = await groupBuyApi.getList({ page: page.value, pageSize: 20 })
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
  uni.navigateTo({ url: `/pages/group-buy/detail?id=${id}` })
}

onLoad(() => loadList())
onReachBottom(() => loadList())
</script>

<style lang="scss" scoped>
.group-buy-list-page {
  min-height: 100vh;
  padding: 16rpx;
}
.act-card {
  display: flex;
  margin-bottom: 16rpx;
  padding: 16rpx;
  background: #fff;
  border-radius: 16rpx;
}
.act-cover {
  width: 200rpx;
  height: 200rpx;
  border-radius: 12rpx;
  background: #f5f5f5;
}
.act-cover-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
}
.placeholder-text {
  color: #ccc;
  font-size: 24rpx;
}
.act-info {
  flex: 1;
  margin-left: 16rpx;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
}
.act-name {
  font-size: 28rpx;
  font-weight: 600;
  color: #333;
}
.act-meta {
  display: flex;
  align-items: baseline;
  gap: 8rpx;
}
.act-price {
  color: #f56c6c;
  font-size: 32rpx;
  font-weight: 600;
}
.act-original {
  color: #999;
  font-size: 24rpx;
  text-decoration: line-through;
}
.act-size {
  color: #e6a23c;
  font-size: 24rpx;
  margin-left: 8rpx;
}
.act-time {
  color: #909399;
  font-size: 24rpx;
}
</style>
