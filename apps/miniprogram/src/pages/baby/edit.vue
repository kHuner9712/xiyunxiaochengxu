<template>
  <view class="baby-edit-page page-shell">
    <view class="intro-card card">
      <text class="intro-title">{{ isEdit ? '编辑宝宝档案' : '添加宝宝档案' }}</text>
      <text class="intro-desc">{{ loadingDetail ? '正在加载宝宝资料...' : '用于更准确的月龄推荐，信息仅在小程序服务内使用。' }}</text>
    </view>
    <view class="form-section card" :class="{ disabled: formLocked }">
      <view class="form-item">
        <text class="form-label">昵称</text>
        <input
          class="form-input"
          v-model="form.nickname"
          :disabled="formLocked"
          placeholder="请输入宝宝昵称"
          placeholder-class="native-input-placeholder"
        />
      </view>
      <view class="form-item">
        <text class="form-label">性别</text>
        <view class="gender-select">
          <view class="gender-option" :class="{ active: form.gender === 1 }" @tap="setGender(1)">
            <text class="gender-text">男</text>
          </view>
          <view class="gender-option" :class="{ active: form.gender === 2 }" @tap="setGender(2)">
            <text class="gender-text">女</text>
          </view>
        </view>
      </view>
      <view class="form-item">
        <text class="form-label">生日</text>
        <picker mode="date" :disabled="formLocked" :value="form.birthday" @change="onDateChange">
          <text class="form-value" :class="{ placeholder: !form.birthday }">{{ form.birthday || '请选择生日' }}</text>
        </picker>
      </view>
      <view class="form-item">
        <text class="form-label">头像</text>
        <view class="avatar-upload" :class="{ disabled: uploading || formLocked }" @tap="uploadAvatar">
          <image v-if="avatarPreview" class="avatar-preview" :src="avatarPreview" mode="aspectFill" />
          <text v-else class="avatar-placeholder">{{ uploading ? '…' : '+' }}</text>
        </view>
      </view>
    </view>

    <view class="submit-btn" :class="{ disabled: uploading || submitting || formLocked }" @tap="handleSubmit">
      <text class="submit-text">{{ loadingDetail ? '资料加载中...' : (uploading ? '头像上传中...' : (submitting ? '保存中...' : (isEdit ? '保存' : '添加'))) }}</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { getBabyDetail, createBaby, updateBaby, type BabyForm } from '@/api/baby'
import { chooseAndUploadImage } from '@/api/upload'

const form = ref<BabyForm & { id?: string }>({
  nickname: '',
  gender: 1,
  birthday: '',
  avatar: '',
  avatarUrl: ''
})

const isEdit = ref(false)
const editTargetId = ref('')
const loadingDetail = ref(false)
const detailLoaded = ref(true)
const uploading = ref(false)
const submitting = ref(false)
const avatarPreview = computed(() => form.value.avatar || form.value.avatarUrl || '')
const formLocked = computed(() =>
  loadingDetail.value || submitting.value || (isEdit.value && !detailLoaded.value)
)

async function loadBaby(id: string) {
  // Lock the page into edit mode before the network request starts. Otherwise a slow detail
  // request leaves the page temporarily behaving like "create", and a fast user tap can create a
  // duplicate baby instead of updating the requested one.
  isEdit.value = true
  editTargetId.value = id
  detailLoaded.value = false
  loadingDetail.value = true
  try {
    const data = await getBabyDetail(id)
    // This page currently has a single onLoad identity, but retain the target check so a stale
    // response can never bind a different record if route reuse is introduced later.
    if (editTargetId.value !== id) return
    const avatar = data.avatar || data.avatarUrl || ''
    form.value = { ...data, id: String(data.id), avatar, avatarUrl: avatar }
    detailLoaded.value = true
  } catch {
    if (editTargetId.value === id) {
      detailLoaded.value = false
      uni.showToast({ title: '宝宝资料加载失败，请返回重试', icon: 'none' })
    }
  } finally {
    if (editTargetId.value === id) loadingDetail.value = false
  }
}

function setGender(gender: 1 | 2) {
  if (formLocked.value) return
  form.value.gender = gender
}

function onDateChange(e: any) {
  if (formLocked.value) return
  form.value.birthday = e.detail.value
}

async function uploadAvatar() {
  if (uploading.value || formLocked.value) return
  uploading.value = true
  try {
    const results = await chooseAndUploadImage(1, 'baby-avatar')
    if (results.length) {
      form.value.avatar = results[0].url
      form.value.avatarUrl = results[0].url
    }
  } catch {
    uni.showToast({ title: '图片上传失败', icon: 'none' })
  } finally {
    uploading.value = false
  }
}

function validate(): boolean {
  if (!form.value.nickname.trim()) {
    uni.showToast({ title: '请输入昵称', icon: 'none' })
    return false
  }
  if (!form.value.birthday) {
    uni.showToast({ title: '请选择生日', icon: 'none' })
    return false
  }
  return true
}

async function handleSubmit() {
  if (submitting.value) return
  if (loadingDetail.value) {
    uni.showToast({ title: '宝宝资料仍在加载，请稍后保存', icon: 'none' })
    return
  }
  if (isEdit.value && (!detailLoaded.value || !form.value.id || form.value.id !== editTargetId.value)) {
    uni.showToast({ title: '宝宝资料未加载成功，请返回重试', icon: 'none' })
    return
  }
  if (uploading.value) {
    uni.showToast({ title: '头像仍在上传，请稍后保存', icon: 'none' })
    return
  }
  if (!validate()) return

  submitting.value = true
  try {
    const { id, ...payload } = form.value
    const normalizedPayload: BabyForm = {
      ...payload,
      avatarUrl: payload.avatarUrl || payload.avatar || ''
    }
    if (isEdit.value && id) {
      await updateBaby({ ...normalizedPayload, id })
    } else {
      await createBaby(normalizedPayload)
    }
    uni.showToast({ title: '保存成功', icon: 'success' })
    uni.navigateBack()
  } catch {
    uni.showToast({ title: '保存失败', icon: 'none' })
  } finally {
    submitting.value = false
  }
}

onLoad((options) => {
  if (options?.id) {
    const id = String(options.id)
    isEdit.value = true
    editTargetId.value = id
    detailLoaded.value = false
    void loadBaby(id)
  }
})

defineExpose({
  form,
  isEdit,
  editTargetId,
  loadingDetail,
  detailLoaded,
  formLocked,
  handleSubmit,
  uploadAvatar,
  avatarPreview,
  uploading,
  submitting,
})
</script>

<style lang="scss" scoped>
.baby-edit-page {
  min-height: 100vh;
  padding: $spacing-md;
}

.intro-card {
  background: $gradient-sage;
  border-color: rgba($success-color, 0.18);
}

.intro-title {
  display: block;
  font-size: $font-xl;
  font-weight: 800;
  color: $text-color;
}

.intro-desc {
  display: block;
  margin-top: 8rpx;
  font-size: $font-sm;
  color: $text-hint;
  line-height: 1.5;
}

.form-section {
  margin-bottom: $spacing-lg;
  border-radius: $radius-xxl;

  &.disabled {
    opacity: 0.65;
    pointer-events: none;
  }
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
  width: 120rpx;
  flex-shrink: 0;
  font-weight: 700;
}

.form-input {
  flex: 1;
  height: 72rpx;
  min-height: 72rpx;
  line-height: 72rpx;
  font-size: $font-md;
  background: $bg-soft;
  border-radius: $radius-lg;
  padding: 0 20rpx;
  box-sizing: border-box;
}

.form-value {
  flex: 1;
  font-size: $font-md;
  color: $text-color;

  &.placeholder { color: $text-hint; }
}

.gender-select {
  display: flex;
  gap: $spacing-sm;
}

.gender-option {
  min-height: 60rpx;
  padding: 0 32rpx;
  border-radius: $radius-round;
  border: 2rpx solid $border-color;
  @include flex-center;

  &.active {
    background: $primary-soft;
    border-color: rgba($primary-color, 0.34);

    .gender-text { color: $primary-dark; font-weight: 700; }
  }
}

.gender-text {
  font-size: $font-sm;
  color: $text-secondary;
}

.avatar-upload {
  width: 120rpx;
  height: 120rpx;
  border-radius: 50%;
  background: $primary-soft;
  @include flex-center;
  overflow: hidden;
  border: 4rpx solid #FFFFFF;
  box-shadow: $shadow-sm;

  &.disabled {
    opacity: 0.55;
    pointer-events: none;
  }
}

.avatar-preview {
  width: 100%;
  height: 100%;
}

.avatar-placeholder {
  font-size: 48rpx;
  color: $text-hint;
}

.submit-btn {
  background: $gradient-coral;
  border-radius: $radius-round;
  padding: 24rpx 0;
  text-align: center;
  box-shadow: $shadow-coral;

  &.disabled {
    opacity: 0.55;
    pointer-events: none;
  }
}

.submit-text {
  color: #FFFFFF;
  font-size: $font-lg;
  font-weight: 500;
}
</style>
