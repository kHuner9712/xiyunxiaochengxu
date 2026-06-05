<template>
  <view class="profile-page page-shell">
    <view class="profile-header card">
      <button class="avatar-picker" open-type="chooseAvatar" @chooseavatar="handleChooseAvatar">
        <image class="user-avatar" :src="avatarPreview" mode="aspectFill" />
        <view class="avatar-edit">
          <text class="edit-text">修改</text>
        </view>
      </button>
    </view>

    <view class="form-section card">
      <view class="form-item">
        <text class="form-label">昵称</text>
        <input
          v-model="form.nickname"
          class="nickname-input"
          type="nickname"
          placeholder="请输入昵称"
          maxlength="20"
        />
      </view>
      <view class="form-item">
        <text class="form-label">手机号</text>
        <text class="form-value">{{ formatPhone(userStore.userInfo?.phone || '') }}</text>
      </view>
      <view class="form-item" @tap="goMember">
        <text class="form-label">会员等级</text>
        <text class="form-value">{{ userStore.memberLevelName }}</text>
        <text class="form-arrow">›</text>
      </view>
    </view>

    <button class="save-btn" :disabled="submitting" :loading="submitting" @tap="handleSubmit">
      保存资料
    </button>

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
import { computed, reactive, ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { useUserStore } from '@/stores/user'
import { uploadImage } from '@/api/upload'
import { formatPhone } from '@/utils/format'

const userStore = useUserStore()
const submitting = ref(false)
const selectedAvatarPath = ref('')
const form = reactive({
  nickname: '',
  avatar: ''
})

const avatarPreview = computed(() => form.avatar || userStore.avatar || '/static/default-avatar.png')

function syncForm() {
  form.nickname = userStore.userInfo?.nickname || ''
  form.avatar = userStore.userInfo?.avatar || userStore.userInfo?.avatarUrl || ''
  selectedAvatarPath.value = ''
}

onShow(async () => {
  if (!userStore.isLoggedIn) return
  try {
    await userStore.fetchUserInfo()
  } catch (err) {
    console.error('[baby-mall] profile fetchUserInfo failed:', err)
  } finally {
    syncForm()
  }
})

function handleChooseAvatar(e: any) {
  const avatarUrl = e?.detail?.avatarUrl
  if (!avatarUrl) {
    uni.showToast({ title: '未获取到头像', icon: 'none' })
    return
  }
  selectedAvatarPath.value = avatarUrl
  form.avatar = avatarUrl
}

async function handleSubmit() {
  if (submitting.value) return

  const nickname = form.nickname.trim()
  if (!nickname) {
    uni.showToast({ title: '请输入昵称', icon: 'none' })
    return
  }
  if (!form.avatar) {
    uni.showToast({ title: '请选择头像', icon: 'none' })
    return
  }

  submitting.value = true
  try {
    let avatar = form.avatar
    if (selectedAvatarPath.value) {
      const uploaded = await uploadImage(selectedAvatarPath.value, 'user-avatar')
      avatar = uploaded.url
    }
    await userStore.updateProfile({ nickname, avatar })
    form.avatar = avatar
    selectedAvatarPath.value = ''
    uni.showToast({ title: '保存成功', icon: 'success' })
  } catch (err) {
    console.error('[baby-mall] update profile failed:', err)
    uni.showToast({ title: '保存失败，请稍后重试', icon: 'none' })
    try {
      await userStore.fetchUserInfo()
      syncForm()
    } catch {
      // ignore secondary refresh failure; the primary save error has already been shown
    }
  } finally {
    submitting.value = false
  }
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
  margin: $spacing-md;
  background: $gradient-peach;
}

.avatar-picker {
  position: relative;
  padding: 0;
  margin: 0;
  background: transparent;
  border: none;
  line-height: normal;

  &::after {
    border: none;
  }
}

.user-avatar {
  width: 160rpx;
  height: 160rpx;
  border-radius: 50%;
  border: 6rpx solid rgba(255, 255, 255, 0.86);
  box-shadow: $shadow-md;
}

.avatar-edit {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  background: rgba($text-color, 0.58);
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
  background: rgba(255, 255, 255, 0.9);
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
  font-weight: 800;
}

.form-value {
  flex: 1;
  font-size: $font-md;
  color: $text-secondary;
  text-align: right;
}

.nickname-input {
  flex: 1;
  min-width: 0;
  height: 56rpx;
  color: $text-color;
  font-size: $font-md;
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

.save-btn {
  @include flex-center;
  width: calc(100% - 64rpx);
  min-height: 88rpx;
  margin: $spacing-lg 32rpx $spacing-md;
  padding: 0;
  background: $gradient-coral;
  border-radius: $radius-round;
  color: #FFFFFF;
  font-size: $font-md;
  font-weight: 800;
  line-height: 88rpx;
  box-shadow: $shadow-coral;

  &::after {
    border: none;
  }

  &[disabled] {
    opacity: 0.72;
  }
}
</style>
