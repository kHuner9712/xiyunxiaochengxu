<template>
  <view class="activity-detail-page page-shell">
    <view class="banner-wrap">
      <image class="activity-banner" :src="activity.image" mode="aspectFill" />
    </view>

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
  } catch {
    uni.showToast({ title: '活动加载失败', icon: 'none' })
  }
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
  padding-bottom: 40rpx;
}

.banner-wrap {
  padding: $spacing-md $spacing-md 0;
}

.activity-banner {
  width: 100%;
  height: 420rpx;
  border-radius: $radius-xxl;
  background: $bg-gray;
  box-shadow: $shadow-sm;
}

.activity-info {
  margin: $spacing-md $spacing-md $spacing-sm;
  border-radius: $radius-xxl;
}

.activity-name {
  font-size: $font-xl;
  font-weight: 800;
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
  line-height: 1.8;
}

.rules-section {
  margin: $spacing-sm $spacing-md;
}

.section-title {
  font-size: $font-lg;
  font-weight: 800;
  color: $text-color;
  display: block;
  margin-bottom: $spacing-sm;
}

.rules-content {
  font-size: $font-sm;
  color: $text-secondary;
  line-height: 1.8;
}
</style>
