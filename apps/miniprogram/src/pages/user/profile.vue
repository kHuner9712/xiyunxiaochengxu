<template>
  <view class="profile-page page-shell">
    <view class="profile-header card">
      <button
        class="avatar-picker"
        open-type="chooseAvatar"
        :disabled="submitting || cancellingAccount"
        @chooseavatar="handleChooseAvatar"
      >
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
          placeholder-class="native-input-placeholder"
          maxlength="20"
          :disabled="submitting || cancellingAccount"
          @input="markDirty"
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

    <button class="save-btn" :disabled="submitting || cancellingAccount" :loading="submitting" @tap="handleSubmit">
      {{ submitting ? '保存中...' : '保存资料' }}
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

    <view class="account-section card">
      <view class="account-copy">
        <text class="account-title">账号管理</text>
        <text class="account-desc">注销前会检查未完成订单、售后与退款。注销成功后，个人资料、地址、宝宝档案和购物车等账号信息将清除，且无法恢复。</text>
      </view>
      <button
        class="cancel-account-btn"
        :disabled="submitting || cancellingAccount"
        :loading="cancellingAccount"
        @tap="handleCancelAccount"
      >
        {{ cancellingAccount ? '注销处理中...' : '注销账号' }}
      </button>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { useUserStore } from '@/stores/user'
import { cancelAccount } from '@/api/auth'
import { uploadImage } from '@/api/upload'
import { formatPhone } from '@/utils/format'

const userStore = useUserStore()
const submitting = ref(false)
const cancellingAccount = ref(false)
const selectedAvatarPath = ref('')
const dirty = ref(false)
const form = reactive({
  nickname: '',
  avatar: ''
})

const avatarPreview = computed(() => form.avatar || userStore.avatar || '/static/default-avatar.png')

function syncForm() {
  form.nickname = userStore.userInfo?.nickname || ''
  form.avatar = userStore.userInfo?.avatar || userStore.userInfo?.avatarUrl || ''
  selectedAvatarPath.value = ''
  dirty.value = false
}

function markDirty() {
  if (!submitting.value && !cancellingAccount.value) dirty.value = true
}

onShow(async () => {
  if (!userStore.isLoggedIn) return
  const wasDirty = dirty.value
  try {
    await userStore.fetchUserInfo()
  } catch (err) {
    console.error('[baby-mall] profile fetchUserInfo failed:', err)
  } finally {
    // A slow foreground refresh must not erase edits made while it was in flight.
    if (!wasDirty && !dirty.value && !submitting.value && !cancellingAccount.value) {
      syncForm()
    }
  }
})

function handleChooseAvatar(e: any) {
  if (submitting.value || cancellingAccount.value) return
  const avatarUrl = e?.detail?.avatarUrl
  if (!avatarUrl) {
    uni.showToast({ title: '未获取到头像', icon: 'none' })
    return
  }
  selectedAvatarPath.value = avatarUrl
  form.avatar = avatarUrl
  dirty.value = true
}

async function handleSubmit() {
  if (submitting.value || cancellingAccount.value) return

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
    dirty.value = false
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

function confirmModal(options: UniApp.ShowModalOptions): Promise<boolean> {
  return new Promise((resolve) => {
    uni.showModal({
      ...options,
      success: (res) => resolve(!!res.confirm),
      fail: () => resolve(false),
    })
  })
}

async function handleCancelAccount() {
  if (submitting.value || cancellingAccount.value) return

  const firstConfirmed = await confirmModal({
    title: '注销账号',
    content: '账号注销不可恢复。系统会先检查未完成订单、售后和退款；如仍有待处理业务，本次注销会被拒绝。是否继续？',
    confirmText: '继续注销',
    confirmColor: '#D14343',
    cancelText: '取消',
  })
  if (!firstConfirmed) return

  const finalConfirmed = await confirmModal({
    title: '再次确认',
    content: '注销成功后，个人资料、收货地址、宝宝档案、购物车等账号信息将被清除。确认永久注销当前账号？',
    confirmText: '确认注销',
    confirmColor: '#D14343',
    cancelText: '返回',
  })
  if (!finalConfirmed) return

  cancellingAccount.value = true
  try {
    await cancelAccount()
    uni.showToast({ title: '账号已注销', icon: 'success' })
    // logout() clears token, in-memory user state and cart before returning to the public home page.
    // The redundant server-side logout request is best-effort and safely ignored because account
    // cancellation has already revoked all sessions transactionally on the backend.
    userStore.logout()
  } catch (err: any) {
    console.error('[baby-mall] cancel account failed:', err)
    uni.showModal({
      title: '暂时无法注销',
      content: err?.message || '账号注销失败，请稍后重试',
      showCancel: false,
      confirmText: '我知道了',
    })
  } finally {
    cancellingAccount.value = false
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

defineExpose({
  form,
  dirty,
  submitting,
  cancellingAccount,
  handleChooseAvatar,
  handleSubmit,
  handleCancelAccount,
})
</script>

<style lang="scss" scoped>
.profile-page {
  min-height: 100vh;
  padding-bottom: $spacing-lg;
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

  &[disabled] {
    opacity: 0.6;
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
.menu-section,
.account-section {
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
  height: 64rpx;
  min-height: 64rpx;
  line-height: 64rpx;
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

.account-section {
  margin-top: $spacing-lg;
}

.account-copy {
  padding-bottom: $spacing-md;
}

.account-title {
  display: block;
  font-size: $font-md;
  font-weight: 800;
  color: $text-color;
}

.account-desc {
  display: block;
  margin-top: $spacing-xs;
  font-size: $font-xs;
  line-height: 1.6;
  color: $text-hint;
}

.cancel-account-btn {
  width: 100%;
  min-height: 76rpx;
  margin: 0;
  border-radius: $radius-round;
  border: 1rpx solid rgba(209, 67, 67, 0.45);
  background: rgba(209, 67, 67, 0.06);
  color: #D14343;
  font-size: $font-sm;
  font-weight: 700;
  line-height: 76rpx;

  &::after {
    border: none;
  }

  &[disabled] {
    opacity: 0.55;
  }
}
</style>