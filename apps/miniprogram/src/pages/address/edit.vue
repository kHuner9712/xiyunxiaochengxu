<template>
  <view class="address-edit-page">
    <view class="form-section card">
      <view class="form-item">
        <text class="form-label">收货人</text>
        <input class="form-input" v-model="form.name" placeholder="请输入收货人姓名" />
      </view>
      <view class="form-item">
        <text class="form-label">手机号</text>
        <input class="form-input" v-model="form.phone" placeholder="请输入手机号" type="number" maxlength="11" />
      </view>
      <picker mode="region" @change="onRegionChange" :value="regionValue">
        <view class="form-item">
          <text class="form-label">所在地区</text>
          <text class="form-value" :class="{ placeholder: !regionText }">{{ regionText || '请选择省/市/区' }}</text>
          <text class="form-arrow">›</text>
        </view>
      </picker>
      <view class="form-item">
        <text class="form-label">详细地址</text>
        <textarea class="form-textarea" v-model="form.detail" placeholder="请输入详细地址" />
      </view>
      <view class="form-item switch-item">
        <text class="form-label">设为默认地址</text>
        <switch :checked="form.isDefault" @change="form.isDefault = $event.detail.value" color="#FF6B9D" />
      </view>
    </view>

    <view class="submit-btn" @tap="handleSubmit">
      <text class="submit-text">{{ isEdit ? '保存' : '新增' }}</text>
    </view>

    <view v-if="isEdit" class="delete-btn" @tap="handleDelete">
      <text class="delete-text">删除地址</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { getAddressDetail, createAddress, updateAddress, deleteAddress as deleteAddressApi, type AddressForm } from '@/api/address'

const form = ref<AddressForm & { id?: number }>({
  name: '',
  phone: '',
  province: '',
  city: '',
  district: '',
  detail: '',
  isDefault: false
})

const isEdit = ref(false)

const regionText = computed(() => {
  if (form.value.province) {
    return `${form.value.province} ${form.value.city} ${form.value.district}`
  }
  return ''
})

const regionValue = ref<string[]>([])

function onRegionChange(e: any) {
  const { value, code } = e.detail
  regionValue.value = value
  form.value.province = value[0]
  form.value.city = value[1]
  form.value.district = value[2]
}

async function loadAddress(id: number) {
  try {
    const data = await getAddressDetail(id)
    form.value = { ...data, id: data.id }
    if (data.province) {
      regionValue.value = [data.province, data.city || '', data.district || '']
    }
    isEdit.value = true
  } catch {}
}

function validate(): boolean {
  if (!form.value.name.trim()) {
    uni.showToast({ title: '请输入收货人', icon: 'none' })
    return false
  }
  if (!form.value.phone.trim() || form.value.phone.length !== 11) {
    uni.showToast({ title: '请输入正确的手机号', icon: 'none' })
    return false
  }
  if (!form.value.province) {
    uni.showToast({ title: '请选择地区', icon: 'none' })
    return false
  }
  if (!form.value.detail.trim()) {
    uni.showToast({ title: '请输入详细地址', icon: 'none' })
    return false
  }
  return true
}

async function handleSubmit() {
  if (!validate()) return
  try {
    if (isEdit.value && form.value.id) {
      await updateAddress(form.value as any)
    } else {
      await createAddress(form.value)
    }
    uni.showToast({ title: '保存成功', icon: 'success' })
    setTimeout(() => uni.navigateBack(), 1500)
  } catch {}
}

async function handleDelete() {
  if (!form.value.id) return
  uni.showModal({
    title: '提示',
    content: '确定删除该地址吗？',
    success: async (res) => {
      if (res.confirm) {
        await deleteAddressApi(form.value.id!)
        uni.navigateBack()
      }
    }
  })
}

onLoad((options) => {
  if (options?.id) loadAddress(Number(options.id))
})
</script>

<style lang="scss" scoped>
.address-edit-page {
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

  &.switch-item {
    justify-content: space-between;
  }
}

.form-label {
  font-size: $font-md;
  color: $text-color;
  width: 160rpx;
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

.form-arrow {
  font-size: $font-lg;
  color: $text-hint;
  margin-left: 8rpx;
}

.form-textarea {
  flex: 1;
  font-size: $font-md;
  min-height: 120rpx;
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

.delete-btn {
  margin-top: $spacing-md;
  padding: 24rpx 0;
  text-align: center;
}

.delete-text {
  color: $danger-color;
  font-size: $font-md;
}
</style>
