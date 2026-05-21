<template>
  <view class="activity-page">
    <view class="tab-bar">
      <view
        v-for="tab in tabs"
        :key="tab.value"
        class="tab-item"
        :class="{ active: currentTab === tab.value }"
        @tap="switchTab(tab.value)"
      >
        <text class="tab-text">{{ tab.label }}</text>
      </view>
    </view>

    <view class="activity-list">
      <view v-for="item in activities" :key="item.id" class="activity-card" @tap="goDetail(item.id)">
        <image class="activity-image" :src="item.image" mode="aspectFill" />
        <view class="activity-info">
          <text class="activity-name">{{ item.name }}</text>
          <view class="activity-meta">
            <CountdownTimer :endTime="item.endTime" label="距结束" />
          </view>
        </view>
      </view>
    </view>

    <Loading v-if="loading" />
    <Empty v-if="!loading && activities.length === 0" text="暂无活动" />
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { onReachBottom, onPullDownRefresh } from '@dcloudio/uni-app'
import { getActivityList, type ActivityDetail } from '@/api/activity'
import CountdownTimer from '@/components/CountdownTimer.vue'
import Loading from '@/components/Loading.vue'
import Empty from '@/components/Empty.vue'

const tabs = [
  { label: '全部', value: 0 },
  { label: '限时折扣', value: 1 },
  { label: '满减', value: 2 },
  { label: '满赠', value: 3 },
  { label: '组合套餐', value: 4 }
]

const currentTab = ref(0)
const activities = ref<ActivityDetail[]>([])
const loading = ref(false)
const page = ref(1)
const finished = ref(false)

async function loadActivities(reset = false) {
  if (loading.value) return
  if (!reset && finished.value) return
  if (reset) {
    page.value = 1
    finished.value = false
    activities.value = []
  }
  loading.value = true
  try {
    const params: { type?: number; page: number; pageSize: number } = {
      page: page.value,
      pageSize: 10
    }
    if (currentTab.value) params.type = currentTab.value
    const data = await getActivityList(params)
    activities.value.push(...data.list)
    finished.value = activities.value.length >= data.total
    page.value++
  } catch {} finally {
    loading.value = false
  }
}

function switchTab(value: number) {
  currentTab.value = value
  loadActivities(true)
}

function goDetail(id: number) {
  uni.navigateTo({ url: `/pages/activity/detail?id=${id}` })
}

onPullDownRefresh(async () => {
  await loadActivities(true)
  uni.stopPullDownRefresh()
})

onReachBottom(() => {
  loadActivities()
})

onMounted(() => {
  loadActivities()
})
</script>

<style lang="scss" scoped>
.activity-page {
  padding: $spacing-md;
}

.tab-bar {
  display: flex;
  background: $bg-white;
  border-radius: $radius-round;
  padding: 6rpx;
  margin-bottom: $spacing-md;
}

.tab-item {
  flex: 1;
  @include flex-center;
  padding: 16rpx 0;
  border-radius: $radius-round;
  transition: all 0.3s;

  &.active {
    background: $primary-color;

    .tab-text {
      color: #FFFFFF;
    }
  }
}

.tab-text {
  font-size: $font-sm;
  color: $text-secondary;
}

.activity-card {
  background: $bg-white;
  border-radius: $radius-lg;
  overflow: hidden;
  margin-bottom: $spacing-md;
  box-shadow: $shadow-sm;
}

.activity-image {
  width: 100%;
  height: 300rpx;
}

.activity-info {
  padding: $spacing-md;
}

.activity-name {
  font-size: $font-lg;
  font-weight: 600;
  color: $text-color;
  display: block;
  margin-bottom: $spacing-sm;
}

.activity-meta {
  display: flex;
  align-items: center;
}
</style>
