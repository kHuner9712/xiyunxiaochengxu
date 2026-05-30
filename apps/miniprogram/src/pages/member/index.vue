<template>
  <view class="member-page page-shell">
    <view class="member-header">
      <view class="member-card">
        <view class="card-top">
          <image class="member-avatar" :src="userStore.avatar || '/static/default-avatar.png'" mode="aspectFill" />
          <view class="member-info">
            <text class="member-name">{{ userStore.nickname }}</text>
            <view class="level-badge">
              <text class="level-text">{{ memberInfo.levelName }}</text>
            </view>
          </view>
        </view>
        <view class="growth-bar">
          <view class="growth-progress" :style="{ width: growthPercent + '%' }"></view>
        </view>
        <text class="growth-text">成长值 {{ memberInfo.currentLevelGrowth }} / {{ memberInfo.nextLevelGrowth }}</text>
      </view>
    </view>

    <view class="rights-section card">
      <text class="section-title">会员权益</text>
      <view class="rights-list">
        <view v-for="right in rights" :key="right.id" class="right-item">
          <image class="right-icon" :src="right.icon" mode="aspectFit" />
          <text class="right-name">{{ right.name }}</text>
          <text class="right-desc">{{ right.description }}</text>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useUserStore } from '@/stores/user'
import { getMemberInfo, getMemberRights, type MemberInfo, type MemberRight } from '@/api/member'

const userStore = useUserStore()

const memberInfo = ref<MemberInfo>({
  level: 0, levelName: '普通用户', growthValue: 0,
  nextLevelGrowth: 100, currentLevelGrowth: 0, rights: []
})
const rights = ref<MemberRight[]>([])

const growthPercent = computed(() => {
  if (memberInfo.value.nextLevelGrowth <= 0) return 100
  return Math.min(100, (memberInfo.value.currentLevelGrowth / memberInfo.value.nextLevelGrowth) * 100)
})

async function loadMemberInfo() {
  try {
    memberInfo.value = await getMemberInfo()
  } catch {
    uni.showToast({ title: '会员信息加载失败', icon: 'none' })
  }
}

async function loadRights() {
  try {
    rights.value = await getMemberRights()
  } catch {
    uni.showToast({ title: '权益加载失败', icon: 'none' })
  }
}

onMounted(() => {
  if (!userStore.isLoggedIn) {
    uni.showModal({
      title: '需要登录',
      content: '请先登录后使用',
      showCancel: false,
      success: () => uni.navigateBack()
    })
    return
  }
  loadMemberInfo()
  loadRights()
})
</script>

<style lang="scss" scoped>
.member-page {
  min-height: 100vh;
}

.member-header {
  background: linear-gradient(135deg, #FFE5DF 0%, #FFF4E4 60%, #F2FBF7 100%);
  padding: $spacing-xl $spacing-md $spacing-lg;
  border-radius: 0 0 $radius-xxl $radius-xxl;
}

.member-card {
  background: rgba(255, 255, 255, 0.72);
  border-radius: $radius-xxl;
  padding: $spacing-lg;
  border: 1rpx solid rgba(255, 255, 255, 0.82);
  box-shadow: $shadow-md;
}

.card-top {
  display: flex;
  align-items: center;
  margin-bottom: $spacing-md;
}

.member-avatar {
  width: 100rpx;
  height: 100rpx;
  border-radius: 50%;
  border: 4rpx solid rgba(255, 255, 255, 0.5);
}

.member-info {
  margin-left: $spacing-md;
}

.member-name {
  font-size: $font-lg;
  color: $text-color;
  font-weight: 800;
  display: block;
}

.level-badge {
  display: inline-flex;
  background: $primary-soft;
  border-radius: $radius-round;
  padding: 4rpx 16rpx;
  margin-top: 8rpx;
}

.level-text {
  font-size: $font-xs;
  color: $primary-dark;
}

.growth-bar {
  height: 12rpx;
  background: rgba($primary-color, 0.14);
  border-radius: 6rpx;
  overflow: hidden;
}

.growth-progress {
  height: 100%;
  background: linear-gradient(90deg, $primary-color, $secondary-color);
  border-radius: 6rpx;
  transition: width 0.3s;
}

.growth-text {
  font-size: $font-xs;
  color: $text-secondary;
  margin-top: 8rpx;
  display: block;
}

.rights-section {
  margin: $spacing-md;
}

.section-title {
  font-size: $font-lg;
  font-weight: 800;
  color: $text-color;
  display: block;
  margin-bottom: $spacing-md;
}

.rights-list {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: $spacing-md;
}

.right-item {
  @include flex-center;
  @include flex-column;
  min-height: 168rpx;
  border-radius: $radius-xl;
  background: $bg-soft;
  padding: $spacing-sm;
}

.right-icon {
  width: 72rpx;
  height: 72rpx;
  border-radius: 28rpx;
  background: $primary-soft;
  margin-bottom: 8rpx;
}

.right-name {
  font-size: $font-xs;
  color: $text-color;
  font-weight: 500;
}

.right-desc {
  font-size: 20rpx;
  color: $text-hint;
  margin-top: 4rpx;
  text-align: center;
}
</style>
