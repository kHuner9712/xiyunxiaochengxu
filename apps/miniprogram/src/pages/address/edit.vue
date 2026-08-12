<template>
  <view class="address-edit-page page-shell">
    <view class="form-section card">
      <view class="form-item">
        <text class="form-label">收货人</text>
        <input class="form-input" v-model="form.name" placeholder="请输入收货人姓名" placeholder-class="native-input-placeholder" />
      </view>
      <view class="form-item">
        <text class="form-label">手机号</text>
        <input class="form-input" v-model="form.phone" placeholder="请输入手机号" placeholder-class="native-input-placeholder" type="number" maxlength="11" />
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
        <textarea class="form-textarea" v-model="form.detail" placeholder="请输入详细地址" placeholder-class="native-textarea-placeholder" />
      </view>
      <view class="form-item switch-item">
        <text class="form-label">设为默认地址</text>
        <switch :checked="form.isDefault" @change="onDefaultChange" color="#F27678" />
      </view>
    </view>

    <view class="submit-btn" :class="{ disabled: submitting || deleting }" @tap="handleSubmit">
      <text class="submit-text">{{ submitting ? '保存中...' : (isEdit ? '保存' : '新增') }}</text>
    </view>

    <view v-if="isEdit" class="delete-btn" :class="{ disabled: submitting || deleting }" @tap="handleDelete">
      <text class="delete-text">{{ deleting ? '删除中...' : '删除地址' }}</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { getAddressDetail, createAddress, updateAddress, deleteAddress as deleteAddressApi, type AddressForm } from '@/api/address'

const form = ref<AddressForm & { id?: string }>({
  name: '',
  phone: '',
  province: '',
  city: '',
  district: '',
  detail: '',
  isDefault: false
})

const isEdit = ref(false)
const submitting = ref(false)
const deleting = ref(false)

const regionText = computed(() => {
  if (form.value.province) {
    return `${form.value.province} ${form.value.city} ${form.value.district}`
  }
  return ''
})

const regionValue = ref<string[]>([])

function onRegionChange(e: any) {
  const { value } = e.detail
  regionValue.value = value
  form.value.province = value[0]
  form.value.city = value[1]
  form.value.district = value[2]
}

function onDefaultChange(e: any) {
  form.value.isDefault = !!e.detail.value
}

async function loadAddress(id: string) {
  try {
    const data = await getAddressDetail(id)
    form.value = { ...data, id: String(data.id) }
    if (data.province) {
      regionValue.value = [data.province, data.city || '', data.district || '']
    }
    isEdit.value = true
  } catch {
    uni.showToast({ title: '地址加载失败', icon: 'none' })
  }
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
  if (submitting.value || deleting.value) return
  if (!validate()) return
  submitting.value = true
  try {
    const { id, ...payload } = form.value
    if (isEdit.value && id) {
      await updateAddress({ ...payload, id })
    } else {
      await createAddress(payload)
    }
    uni.showToast({ title: '保存成功', icon: 'success' })
    setTimeout(() => uni.navigateBack(), 1500)
  } catch {
    uni.showToast({ title: '保存失败', icon: 'none' })
  } finally {
    submitting.value = false
  }
}

async function handleDelete() {
  if (submitting.value || deleting.value) return
  const id = form.value.id
  if (!id) return
  uni.showModal({
    title: '提示',
    content: '确定删除该地址吗？',
    success: async (res) => {
      if (res.confirm) {
        deleting.value = true
        try {
          await deleteAddressApi(id)
          uni.navigateBack()
        } catch {
          uni.showToast({ title: '删除失败', icon: 'none' })
        } finally {
          deleting.value = false
        }
      }
    }
  })
}

onLoad((options) => {
  if (options?.id) loadAddress(String(options.id))
})
</script>

<style lang="scss" scoped>
.address-edit-page {
  min-height: 100vh;
  padding: $spacing-md;
}

.form-section {
  margin-bottom: $spacing-lg;
  background: rgba(255, 255, 255, 0.9);
  border-radius: $radius-xxl;
}

.form-item {
  display: flex;
  align-items: center;
  padding: $spacing-md 0;
  border-bottom: 1rpx solid $divider-color;

  &:last-child { border-bottom: none; }

  &.switch-item {
    justify-content: space-between;

    .form-label {
      width: auto;
      white-space: nowrap;
    }
  }
}

.form-label {
  font-size: $font-md;
  color: $text-color;
  width: 160rpx;
  flex-shrink: 0;
  font-weight: 800;
}

.form-input {
  flex: 1;
  min-width: 0;
  height: 72rpx;
  min-height: 72rpx;
  line-height: 72rpx;
  padding: 0 20rpx;
  background: $bg-soft;
  border-radius: $radius-lg;
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
  min-width: 0;
  height: 260rpx;
  min-height: 260rpx;
  padding: 18rpx 20rpx;
  background: $bg-soft;
  border-radius: $radius-lg;
  font-size: $font-md;
  line-height: 1.6;
}

.submit-btn {
  background: $gradient-coral;
  border-radius: $radius-round;
  padding: 24rpx 0;
  text-align: center;
  box-shadow: $shadow-coral;
}

.submit-btn.disabled,
.delete-btn.disabled {
  opacity: 0.55;
  pointer-events: none;
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
  border-radius: $radius-round;
  background: rgba($danger-color, 0.08);
}

.delete-text {
  color: $danger-color;
  font-size: $font-md;
}
</style>
