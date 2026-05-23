<template>
  <view class="baby-edit-page">
    <view class="form-section card">
      <view class="form-item">
        <text class="form-label">昵称</text>
        <input class="form-input" v-model="form.nickname" placeholder="请输入宝宝昵称" />
      </view>
      <view class="form-item">
        <text class="form-label">性别</text>
        <view class="gender-select">
          <view class="gender-option" :class="{ active: form.gender === 1 }" @tap="form.gender = 1">
            <text class="gender-text">男</text>
          </view>
          <view class="gender-option" :class="{ active: form.gender === 2 }" @tap="form.gender = 2">
            <text class="gender-text">女</text>
          </view>
        </view>
      </view>
      <view class="form-item">
        <text class="form-label">生日</text>
        <picker mode="date" :value="form.birthday" @change="onDateChange">
          <text class="form-value" :class="{ placeholder: !form.birthday }">{{ form.birthday || '请选择生日' }}</text>
        </picker>
      </view>
      <view class="form-item">
        <text class="form-label">头像</text>
        <view class="avatar-upload" @tap="uploadAvatar">
          <image v-if="form.avatar" class="avatar-preview" :src="form.avatar" mode="aspectFill" />
          <text v-else class="avatar-placeholder">+</text>
        </view>
      </view>
    </view>

    <view class="submit-btn" @tap="handleSubmit">
      <text class="submit-text">{{ isEdit ? '保存' : '添加' }}</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { getBabyDetail, createBaby, updateBaby, type BabyForm } from '@/api/baby'
import { chooseAndUploadImage } from '@/api/upload'

const form = ref<BabyForm & { id?: number }>({
  nickname: '',
  gender: 1,
  birthday: '',
  avatar: ''
})

const isEdit = ref(false)

async function loadBaby(id: number) {
  try {
    const data = await getBabyDetail(id)
    form.value = { ...data, id: data.id }
    isEdit.value = true
  } catch {
    uni.showToast({ title: '加载失败', icon: 'none' })
  }
}

function onDateChange(e: any) {
  form.value.birthday = e.detail.value
}

async function uploadAvatar() {
  try {
    const results = await chooseAndUploadImage(1)
    if (results.length) {
      form.value.avatar = results[0].url
    }
  } catch {
    uni.showToast({ title: '图片上传失败', icon: 'none' })
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
  if (!validate()) return
  try {
    if (isEdit.value && form.value.id) {
      await updateBaby(form.value as any)
    } else {
      await createBaby(form.value)
    }
    uni.showToast({ title: '保存成功', icon: 'success' })
    setTimeout(() => uni.navigateBack(), 1500)
  } catch {
    uni.showToast({ title: '保存失败', icon: 'none' })
  }
}

onLoad((options) => {
  if (options?.id) loadBaby(Number(options.id))
})
</script>

<style lang="scss" scoped>
.baby-edit-page {
  min-height: 100vh;
  background: $bg-color;
  padding: $spacing-md;
}

.form-section {
  margin-bottom: $spacing-lg;
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
}

.form-input {
  flex: 1;
  font-size: $font-md;
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
  padding: 12rpx 32rpx;
  border-radius: $radius-round;
  border: 2rpx solid $border-color;

  &.active {
    background: rgba($primary-color, 0.1);
    border-color: $primary-color;

    .gender-text { color: $primary-color; }
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
  background: $bg-gray;
  @include flex-center;
  overflow: hidden;
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
  background: linear-gradient(135deg, $primary-color, $primary-light);
  border-radius: $radius-round;
  padding: 24rpx 0;
  text-align: center;
}

.submit-text {
  color: #FFFFFF;
  font-size: $font-lg;
  font-weight: 500;
}
</style>
