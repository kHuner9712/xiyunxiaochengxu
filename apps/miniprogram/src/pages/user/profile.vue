<template>
  <view class="profile-page page-shell">
    <view class="profile-header card">
      <view class="avatar-section" @tap="changeAvatar">
        <image class="user-avatar" :src="userStore.avatar || '/static/default-avatar.png'" mode="aspectFill" />
        <view class="avatar-edit">
          <text class="edit-text">修改</text>
        </view>
      </view>
    </view>

    <view class="form-section card">
      <view class="form-item" @tap="editNickname">
        <text class="form-label">昵称</text>
        <text class="form-value">{{ userStore.nickname }}</text>
        <text class="form-arrow">›</text>
      </view>
      <view class="form-item">
        <text class="form-label">手机号</text>
        <text class="form-value">{{ formatPhone(userStore.userInfo?.phone || '') }}</text>
        <text class="form-arrow">›</text>
      </view>
      <view class="form-item" @tap="goMember">
        <text class="form-label">会员等级</text>
        <text class="form-value">{{ userStore.memberLevelName }}</text>
        <text class="form-arrow">›</text>
      </view>
    </view>

    <view class="menu-section card">
      <view class="menu-item" @tap="goAddress">
        <text class="menu-text">地址管理</text>
        <text class="menu-arrow">›</text>
      </view>
      <view class="menu-item" @tap="goBaby">
        <text class="menu-text">宝宝档案</text>
        <text class="menu-arrow">›</text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { useUserStore } from '@/stores/user'
import { chooseAndUploadImage } from '@/api/upload'
import { formatPhone } from '@/utils/format'

const userStore = useUserStore()

async function changeAvatar() {
  try {
    const results = await chooseAndUploadImage(1)
    if (results.length) {
      await userStore.fetchUserInfo()
    }
  } catch {
    uni.showToast({ title: '头像上传失败', icon: 'none' })
  }
}

function editNickname() {
  uni.showModal({
    title: '修改昵称',
    editable: true,
    placeholderText: '请输入新昵称',
    success: async (res) => {
      if (res.confirm && res.content) {
        await userStore.fetchUserInfo()
      }
    }
  })
}

function goMember() {
  uni.navigateTo({ url: '/pages/member/index' })
}

function goAddress() {
  uni.navigateTo({ url: '/pages/address/list' })
}

function goBaby() {
  uni.navigateTo({ url: '/pages/baby/list' })
}
</script>

<style lang="scss" scoped>
.profile-page {
  min-height: 100vh;
}

.profile-header {
  @include flex-center;
  padding: $spacing-xl;
}

.avatar-section {
  position: relative;
}

.user-avatar {
  width: 160rpx;
  height: 160rpx;
  border-radius: 50%;
}

.avatar-edit {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  background: rgba(0, 0, 0, 0.5);
  border-radius: 0 0 80rpx 80rpx;
  text-align: center;
  padding: 4rpx 0;
}

.edit-text {
  font-size: $font-xs;
  color: #FFFFFF;
}

.form-section,
.menu-section {
  margin: $spacing-sm $spacing-md;
}

.form-item {
  display: flex;
  align-items: center;
  padding: $spacing-md 0;
  border-bottom: 1rpx solid $divider-color;

  &:last-child { border-bottom: none; }
}

.form-label {
  font-size: $font-md;
  color: $text-color;
  width: 160rpx;
}

.form-value {
  flex: 1;
  font-size: $font-md;
  color: $text-secondary;
  text-align: right;
}

.form-arrow {
  font-size: $font-lg;
  color: $text-hint;
  margin-left: 8rpx;
}

.menu-item {
  @include flex-between;
  padding: $spacing-md 0;
  border-bottom: 1rpx solid $divider-color;

  &:last-child { border-bottom: none; }
}

.menu-text {
  font-size: $font-md;
  color: $text-color;
}

.menu-arrow {
  font-size: $font-lg;
  color: $text-hint;
}
</style>
