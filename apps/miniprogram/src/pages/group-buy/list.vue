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
  padding: $spacing-sm $spacing-md $spacing-lg;
}

.act-card {
  display: flex;
  margin-bottom: $spacing-md;
  padding: $spacing-sm;
  background: $gradient-card;
  border-radius: $radius-xxl;
  border: 1rpx solid rgba($border-color, 0.78);
  box-shadow: $shadow-sm;
}

.act-cover {
  width: 200rpx;
  height: 200rpx;
  border-radius: $radius-lg;
  background: $bg-ivory;
  flex-shrink: 0;
}

.act-cover-placeholder {
  @include flex-center;
}

.placeholder-text {
  color: $text-hint;
  font-size: $font-sm;
}

.act-info {
  flex: 1;
  min-width: 0;
  margin-left: $spacing-sm;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
}

.act-name {
  font-size: $font-md;
  font-weight: 700;
  color: $text-color;
  line-height: 1.4;
  @include text-ellipsis-2;
}

.act-meta {
  display: flex;
  align-items: baseline;
  gap: $spacing-xs;
}

.act-price {
  color: $price-color;
  font-size: $font-lg;
  font-weight: 800;
}

.act-original {
  color: $text-hint;
  font-size: $font-sm;
  text-decoration: line-through;
}

.act-size {
  color: $warning-color;
  font-size: $font-sm;
  margin-left: $spacing-xs;
}

.act-time {
  color: $text-hint;
  font-size: $font-sm;
}
</style>
