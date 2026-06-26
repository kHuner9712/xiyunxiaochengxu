<template>
  <view class="my-group-page page-shell">
    <view v-for="g in groupList" :key="g.id" class="group-card card" @tap="goGroupDetail(g.id)">
      <view v-if="g.activity?.coverImage" class="cover-wrap">
        <image class="cover" :src="g.activity.coverImage" mode="aspectFill" />
      </view>
      <view v-else class="cover-wrap">
        <view class="cover cover-placeholder">
          <text class="placeholder-text">拼团</text>
        </view>
      </view>
      <view class="info">
        <view class="name">{{ g.activity?.name || '拼团活动' }}</view>
        <view class="meta-row">
          <text class="status-tag" :class="`status-${g.status}`">{{ statusText(g.status) }}</text>
          <text class="progress">{{ g.currentCount }}/{{ g.targetCount }}人</text>
        </view>
        <view class="meta-bottom">
          <text class="group-no">团号：{{ g.groupNo }}</text>
          <text v-if="g.status === 'forming'" class="remain">剩 {{ remainTime(g.expiresAt) }}</text>
          <text v-else class="time">{{ formatDateTime(g.createdAt) }} 开团</text>
        </view>
      </view>
    </view>
    <Loading v-if="loading" />
    <Empty v-if="!loading && groupList.length === 0" text="暂无拼团记录" />
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { onShow, onReachBottom } from '@dcloudio/uni-app'
import { groupBuyApi, type GroupBuyGroup } from '@/api/group-buy'
import Loading from '@/components/Loading.vue'
import Empty from '@/components/Empty.vue'

const groupList = ref<GroupBuyGroup[]>([])
const loading = ref(false)
const page = ref(1)
const finished = ref(false)

function remainTime(expiresAt: string): string {
  const ms = new Date(expiresAt).getTime() - Date.now()
  if (ms <= 0) return '已过期'
  const hours = Math.floor(ms / 3600000)
  const mins = Math.floor((ms % 3600000) / 60000)
  return hours > 0 ? `${hours}h${mins}m` : `${mins}m`
}

function formatDate(s: string): string {
  const d = new Date(s)
  if (isNaN(d.getTime())) return s
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function formatDateTime(s: string): string {
  const d = new Date(s)
  if (isNaN(d.getTime())) return s
  return `${formatDate(s)} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function statusText(status: string): string {
  switch (status) {
    case 'forming': return '组团中'
    case 'success': return '已成团'
    case 'failed': return '已失败'
    case 'cancelled': return '已取消'
    default: return status
  }
}

async function loadList(reset = false) {
  if (loading.value) return
  if (!reset && finished.value) return
  if (reset) {
    page.value = 1
    finished.value = false
    groupList.value = []
  }
  loading.value = true
  try {
    const data = await groupBuyApi.getMyGroups({ page: page.value, pageSize: 20 })
    groupList.value.push(...data.list)
    finished.value = groupList.value.length >= data.total
    page.value++
  } catch {
    uni.showToast({ title: '加载失败', icon: 'none' })
  } finally {
    loading.value = false
  }
}

function goGroupDetail(id: string) {
  uni.navigateTo({ url: `/pages/group-buy/group?id=${id}` })
}

onShow(() => loadList(true))
onReachBottom(() => loadList())
</script>

<style lang="scss" scoped>
.my-group-page {
  min-height: 100vh;
  padding: 16rpx;
}
.group-card {
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
  width: 180rpx;
  height: 180rpx;
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
  margin-bottom: 12rpx;
}
.meta-row {
  display: flex;
  align-items: center;
  gap: 12rpx;
  margin-bottom: 12rpx;
}
.status-tag {
  font-size: 22rpx;
  padding: 4rpx 12rpx;
  border-radius: 4rpx;
  font-weight: 600;
}
.status-tag.status-forming {
  background: rgba(245, 108, 108, 0.1);
  color: #f56c6c;
}
.status-tag.status-success {
  background: rgba(103, 194, 58, 0.1);
  color: #67c23a;
}
.status-tag.status-failed,
.status-tag.status-cancelled {
  background: rgba(144, 147, 153, 0.1);
  color: #909399;
}
.progress {
  color: #e6a23c;
  font-size: 24rpx;
}
.meta-bottom {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.group-no {
  color: #909399;
  font-size: 22rpx;
}
.remain {
  color: #f56c6c;
  font-size: 22rpx;
}
.time {
  color: #c0c4cc;
  font-size: 22rpx;
}
</style>
