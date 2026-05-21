<template>
  <view class="activity-detail-page">
    <image class="activity-banner" :src="activity.image" mode="aspectFill" />

    <view class="activity-info card">
      <text class="activity-name">{{ activity.name }}</text>
      <view class="activity-meta">
        <CountdownTimer :endTime="activity.endTime" label="距结束" />
      </view>
      <text v-if="activity.description" class="activity-desc">{{ activity.description }}</text>
    </view>

    <view v-if="activity.rules" class="rules-section card">
      <text class="section-title">活动规则</text>
      <text class="rules-content">{{ activity.rules }}</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { onLoad, onShareAppMessage } from '@dcloudio/uni-app'
import { getActivityDetail, type ActivityDetail } from '@/api/activity'
import CountdownTimer from '@/components/CountdownTimer.vue'

const activity = ref<ActivityDetail>({
  id: 0, name: '', image: '', description: '', type: 0,
  startTime: 0, endTime: 0, rules: ''
})

async function loadActivity(id: number) {
  try {
    activity.value = await getActivityDetail(id)
  } catch {}
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
  background: $bg-color;
  padding-bottom: 40rpx;
}

.activity-banner {
  width: 100%;
  height: 400rpx;
}

.activity-info {
  margin: $spacing-sm $spacing-md;
}

.activity-name {
  font-size: $font-xl;
  font-weight: 600;
  color: $text-color;
  display: block;
  margin-bottom: $spacing-sm;
}

.activity-meta {
  margin-bottom: $spacing-sm;
}

.activity-desc {
  font-size: $font-sm;
  color: $text-secondary;
  line-height: 1.6;
}

.rules-section {
  margin: $spacing-sm $spacing-md;
}

.section-title {
  font-size: $font-lg;
  font-weight: 600;
  color: $text-color;
  display: block;
  margin-bottom: $spacing-sm;
}

.rules-content {
  font-size: $font-sm;
  color: $text-secondary;
  line-height: 1.6;
}
</style>
