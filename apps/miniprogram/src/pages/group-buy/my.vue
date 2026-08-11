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
          <text class="status-tag" :class="`status-${displayStatus(g)}`">{{ statusText(g) }}</text>
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
import { onHide, onReachBottom, onShow, onUnload } from '@dcloudio/uni-app'
import { groupBuyApi, type GroupBuyGroup } from '@/api/group-buy'
import Loading from '@/components/Loading.vue'
import Empty from '@/components/Empty.vue'

const groupList = ref<GroupBuyGroup[]>([])
const loading = ref(false)
const page = ref(1)
const finished = ref(false)
const nowMs = ref(Date.now())
let clockTimer: ReturnType<typeof setInterval> | null = null
let listVersion = 0
let loadingVersion = -1

function startClock() {
  stopClock()
  nowMs.value = Date.now()
  clockTimer = setInterval(() => {
    nowMs.value = Date.now()
  }, 1000)
}

function stopClock() {
  if (clockTimer) {
    clearInterval(clockTimer)
    clockTimer = null
  }
}

function remainTime(expiresAt: string): string {
  const ms = new Date(expiresAt).getTime() - nowMs.value
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

function displayStatus(group: GroupBuyGroup): string {
  if (group.status === 'forming' && new Date(group.expiresAt).getTime() <= nowMs.value) return 'expired'
  return group.status
}

function statusText(group: GroupBuyGroup): string {
  switch (displayStatus(group)) {
    case 'forming': return '组团中'
    case 'success': return '已成团'
    case 'failed': return '已失败'
    case 'cancelled': return '已取消'
    case 'expired': return '已过期'
    default: return group.status
  }
}

function resetList() {
  page.value = 1
  finished.value = false
  groupList.value = []
}

async function loadList(version = listVersion) {
  if (finished.value && version === listVersion) return
  if (loading.value && loadingVersion === version) return

  const requestPage = page.value
  loading.value = true
  loadingVersion = version
  try {
    const data = await groupBuyApi.getMyGroups({ page: requestPage, pageSize: 20 })
    if (version !== listVersion) return

    groupList.value.push(...data.list)
    finished.value = groupList.value.length >= data.total
    page.value = requestPage + 1
  } catch {
    if (version === listVersion) {
      uni.showToast({ title: '加载失败', icon: 'none' })
    }
  } finally {
    if (version === listVersion) {
      loading.value = false
      loadingVersion = -1
    }
  }
}

function refreshList() {
  const version = ++listVersion
  resetList()
  return loadList(version)
}

function goGroupDetail(id: string) {
  uni.navigateTo({ url: `/pages/group-buy/group?id=${id}` })
}

onShow(() => {
  startClock()
  void refreshList()
})
onHide(() => stopClock())
onUnload(() => stopClock())
onReachBottom(() => void loadList(listVersion))

defineExpose({
  groupList,
  loading,
  loadList,
  refreshList,
})
</script>

<style lang="scss" scoped>
.my-group-page {
  min-height: 100vh;
  padding: $spacing-sm $spacing-md $spacing-lg;
}

.group-card {
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
  width: 180rpx;
  height: 180rpx;
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
  margin-bottom: $spacing-sm;
  line-height: 1.4;
  @include text-ellipsis-2;
}

.meta-row {
  display: flex;
  align-items: center;
  gap: $spacing-sm;
  margin-bottom: $spacing-sm;
}

.status-tag {
  font-size: $font-xs;
  padding: 4rpx 16rpx;
  border-radius: $radius-round;
  font-weight: 700;
}

.status-tag.status-forming {
  background: $primary-soft;
  color: $primary-dark;
}

.status-tag.status-success {
  background: $success-soft;
  color: $success-dark;
}

.status-tag.status-failed,
.status-tag.status-cancelled,
.status-tag.status-expired {
  background: $info-soft;
  color: $text-hint;
}

.progress {
  color: $warning-color;
  font-size: $font-sm;
  font-weight: 700;
}

.meta-bottom {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.group-no {
  color: $text-hint;
  font-size: $font-xs;
  @include text-ellipsis;
}

.remain {
  color: $price-color;
  font-size: $font-xs;
  font-weight: 700;
}

.time {
  color: $text-hint;
  font-size: $font-xs;
}
</style>
