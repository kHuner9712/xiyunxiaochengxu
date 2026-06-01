<template>
  <view class="baby-list-page page-shell">
    <view class="privacy-card card">
      <text class="privacy-title">宝宝档案</text>
      <text class="privacy-desc">资料仅用于月龄推荐与购物辅助，请按需维护。</text>
    </view>
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

    <view class="add-btn-wrap bottom-action-bar">
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
  } catch {
    uni.showToast({ title: '加载失败', icon: 'none' })
  }
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
        try {
          await deleteBabyApi(item.id)
          await loadBabies()
        } catch {
          uni.showToast({ title: '删除失败', icon: 'none' })
        }
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
  padding: $spacing-md;
  padding-bottom: 168rpx;
}

.privacy-card {
  background: $gradient-sage;
  border-color: rgba($success-color, 0.18);
}

.privacy-title {
  display: block;
  font-size: $font-xl;
  font-weight: 800;
  color: $text-color;
}

.privacy-desc {
  display: block;
  margin-top: 8rpx;
  font-size: $font-sm;
  color: $text-hint;
  line-height: 1.5;
}

.baby-card {
  display: flex;
  align-items: center;
  border-radius: $radius-xxl;
  background: $gradient-card;
}

.baby-avatar {
  width: 100rpx;
  height: 100rpx;
  border-radius: 50%;
  flex-shrink: 0;
  background: $primary-soft;
  border: 4rpx solid #FFFFFF;
  box-shadow: $shadow-sm;
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
  min-height: 54rpx;
  padding: 0 22rpx;
  border: 2rpx solid $border-color;
  border-radius: $radius-round;
  @include flex-center;

  &.delete {
    border-color: rgba($danger-color, 0.36);
    background: $danger-soft;
    .action-text { color: $danger-color; }
  }
}

.action-text {
  font-size: $font-xs;
  color: $text-secondary;
}

.add-btn-wrap {
  justify-content: center;
}

.add-btn {
  background: $gradient-coral;
  border-radius: $radius-round;
  min-height: 84rpx;
  padding: 0 120rpx;
  @include flex-center;
  text-align: center;
  box-shadow: $shadow-coral;
}

.add-text {
  color: #FFFFFF;
  font-size: $font-md;
  font-weight: 500;
}
</style>
