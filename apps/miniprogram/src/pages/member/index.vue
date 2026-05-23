<template>
  <view class="member-page">
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
const isDemo = ref(false)

const demoMemberInfo: MemberInfo = {
  level: 1, levelName: '普通会员', growthValue: 50,
  nextLevelGrowth: 100, currentLevelGrowth: 50, rights: []
}

const demoRights: MemberRight[] = [
  { id: '1', name: '专属折扣', description: '享受9.8折优惠', icon: '/static/member-discount.png' },
  { id: '2', name: '积分加速', description: '购物积分1.2倍', icon: '/static/member-points.png' },
  { id: '3', name: '生日礼包', description: '生日当月专享', icon: '/static/member-birthday.png' },
  { id: '4', name: '优先发货', description: '订单优先处理', icon: '/static/member-priority.png' },
]

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
  if (isDemo.value) {
    memberInfo.value = demoMemberInfo
    return
  }
  try {
    memberInfo.value = await getMemberInfo()
  } catch {
    uni.showToast({ title: '会员信息加载失败', icon: 'none' })
  }
}

async function loadRights() {
  if (isDemo.value) {
    rights.value = demoRights
    return
  }
  try {
    rights.value = await getMemberRights()
  } catch {
    uni.showToast({ title: '权益加载失败', icon: 'none' })
  }
}

onMounted(() => {
  const pages = getCurrentPages()
  const currentPage = pages[pages.length - 1]
  isDemo.value = (currentPage as any)?.$page?.options?.demo === '1' || (currentPage as any)?.options?.demo === '1'
  loadMemberInfo()
  loadRights()
})
</script>

<style lang="scss" scoped>
.member-page {
  min-height: 100vh;
  background: $bg-color;
}

.member-header {
  background: linear-gradient(135deg, $primary-color, $primary-dark);
  padding: $spacing-xl $spacing-md;
}

.member-card {
  background: rgba(255, 255, 255, 0.15);
  border-radius: $radius-xl;
  padding: $spacing-lg;
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
  color: #FFFFFF;
  font-weight: 600;
  display: block;
}

.level-badge {
  display: inline-flex;
  background: rgba(255, 255, 255, 0.2);
  border-radius: $radius-round;
  padding: 4rpx 16rpx;
  margin-top: 8rpx;
}

.level-text {
  font-size: $font-xs;
  color: #FFFFFF;
}

.growth-bar {
  height: 12rpx;
  background: rgba(255, 255, 255, 0.2);
  border-radius: 6rpx;
  overflow: hidden;
}

.growth-progress {
  height: 100%;
  background: #FFFFFF;
  border-radius: 6rpx;
  transition: width 0.3s;
}

.growth-text {
  font-size: $font-xs;
  color: rgba(255, 255, 255, 0.8);
  margin-top: 8rpx;
  display: block;
}

.rights-section {
  margin: $spacing-md;
}

.section-title {
  font-size: $font-lg;
  font-weight: 600;
  color: $text-color;
  display: block;
  margin-bottom: $spacing-md;
}

.rights-list {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: $spacing-md;
}

.right-item {
  @include flex-center;
  @include flex-column;
}

.right-icon {
  width: 64rpx;
  height: 64rpx;
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
}
</style>
