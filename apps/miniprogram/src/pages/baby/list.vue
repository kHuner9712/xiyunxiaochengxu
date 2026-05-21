<template>
  <view class="baby-list-page">
    <view class="baby-list">
      <view v-for="item in babies" :key="item.id" class="baby-card card">
        <image class="baby-avatar" :src="item.avatar || '/static/default-baby.png'" mode="aspectFill" />
        <view class="baby-info">
          <text class="baby-name">{{ item.nickname }}</text>
          <text class="baby-meta">{{ item.gender === 1 ? '男' : '女' }} · {{ formatBabyAge(item.birthday) }}</text>
        </view>
        <view class="baby-actions">
          <view class="action-btn" @tap="editBaby(item)">
            <text class="action-text">编辑</text>
          </view>
          <view class="action-btn delete" @tap="deleteBaby(item)">
            <text class="action-text">删除</text>
          </view>
        </view>
      </view>
    </view>

    <Empty v-if="babies.length === 0" text="暂无宝宝档案" actionText="添加宝宝" @action="addBaby" />

    <view class="add-btn-wrap">
      <view class="add-btn" @tap="addBaby">
        <text class="add-text">+ 添加宝宝</text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { getBabyList, deleteBaby as deleteBabyApi, type BabyItem } from '@/api/baby'
import { formatBabyAge } from '@/utils/format'
import Empty from '@/components/Empty.vue'

const babies = ref<BabyItem[]>([])

async function loadBabies() {
  try {
    babies.value = await getBabyList()
  } catch {}
}

function addBaby() {
  uni.navigateTo({ url: '/pages/baby/edit' })
}

function editBaby(item: BabyItem) {
  uni.navigateTo({ url: `/pages/baby/edit?id=${item.id}` })
}

async function deleteBaby(item: BabyItem) {
  uni.showModal({
    title: '提示',
    content: `确定删除${item.nickname}的档案吗？`,
    success: async (res) => {
      if (res.confirm) {
        await deleteBabyApi(item.id)
        await loadBabies()
      }
    }
  })
}

onShow(() => {
  loadBabies()
})
</script>

<style lang="scss" scoped>
.baby-list-page {
  min-height: 100vh;
  background: $bg-color;
  padding: $spacing-md;
  padding-bottom: 120rpx;
}

.baby-card {
  display: flex;
  align-items: center;
}

.baby-avatar {
  width: 100rpx;
  height: 100rpx;
  border-radius: 50%;
  flex-shrink: 0;
}

.baby-info {
  flex: 1;
  margin-left: $spacing-md;
}

.baby-name {
  font-size: $font-lg;
  font-weight: 600;
  color: $text-color;
  display: block;
}

.baby-meta {
  font-size: $font-sm;
  color: $text-hint;
  margin-top: 4rpx;
  display: block;
}

.baby-actions {
  display: flex;
  gap: $spacing-sm;
}

.action-btn {
  padding: 8rpx 20rpx;
  border: 2rpx solid $border-color;
  border-radius: $radius-round;

  &.delete {
    border-color: $danger-color;
    .action-text { color: $danger-color; }
  }
}

.action-text {
  font-size: $font-xs;
  color: $text-secondary;
}

.add-btn-wrap {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  padding: $spacing-sm $spacing-md;
  background: $bg-white;
  @include safe-bottom;
}

.add-btn {
  background: linear-gradient(135deg, $primary-color, $primary-light);
  border-radius: $radius-round;
  padding: 24rpx 0;
  text-align: center;
}

.add-text {
  color: #FFFFFF;
  font-size: $font-md;
  font-weight: 500;
}
</style>
