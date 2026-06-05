<template>
  <view class="aftersale-apply-page page-shell">
    <view class="apply-guide card">
      <text class="guide-title">申请售后</text>
      <text class="guide-desc">请准确选择原因并补充凭证，平台将依据订单与商品信息处理。</text>
    </view>
    <view class="form-section card">
      <view class="form-item">
        <text class="form-label">售后类型</text>
        <view class="type-select">
          <view class="type-option" :class="{ active: form.type === 1 }" @tap="form.type = 1">
            <text class="type-text">退款</text>
          </view>
          <view class="type-option" :class="{ active: form.type === 2 }" @tap="form.type = 2">
            <text class="type-text">退货退款</text>
          </view>
        </view>
      </view>

      <view class="form-item">
        <text class="form-label">退款原因</text>
        <picker :range="reasons" @change="onReasonChange">
          <text class="form-value" :class="{ placeholder: !form.reason }">{{ form.reason || '请选择原因' }}</text>
        </picker>
      </view>

      <view class="form-item vertical">
        <text class="form-label">问题描述</text>
        <textarea class="form-textarea" v-model="form.description" placeholder="请描述具体问题" />
      </view>

      <view class="form-item vertical">
        <text class="form-label">上传凭证</text>
        <view class="image-list">
          <view v-for="(img, index) in displayImageList" :key="index" class="image-item">
            <image class="upload-image" :src="img" mode="aspectFill" />
            <view class="image-delete" @tap="removeImage(index)">✕</view>
          </view>
          <view v-if="imageList.length < 5" class="image-add" @tap="addImage">
            <text class="add-icon">+</text>
          </view>
        </view>
      </view>
    </view>

    <view class="submit-btn" @tap="handleSubmit">
      <text class="submit-text">提交申请</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { applyAftersale } from '@/api/aftersale'
import { getOrderDetail } from '@/api/order'
import { chooseAndUploadImage } from '@/api/upload'
import { resolvePrivateFileUrl } from '@/utils/private-file'
import { useUserStore } from '@/stores/user'

const orderId = ref('')
const orderItemId = ref('')
const reasons = ref<string[]>(['不想要了', '商品与描述不符', '质量问题', '收到商品损坏', '其他原因'])
const imageList = ref<string[]>([])
const displayImageList = ref<string[]>([])
const userStore = useUserStore()

const form = ref({
  type: 1,
  reason: '',
  description: '',
  images: [] as string[]
})

function onReasonChange(e: any) {
  form.value.reason = reasons.value[e.detail.value]
}

async function addImage() {
  try {
    const results = await chooseAndUploadImage(5 - imageList.value.length, 'aftersale')
    for (const r of results) {
      imageList.value.push(r.url)
      form.value.images.push(r.url)
      displayImageList.value.push(await resolvePrivateFileUrl(r.url))
    }
  } catch {
    uni.showToast({ title: '图片上传失败', icon: 'none' })
  }
}

function removeImage(index: number) {
  imageList.value.splice(index, 1)
  displayImageList.value.splice(index, 1)
  form.value.images.splice(index, 1)
}

async function handleSubmit() {
  if (!userStore.isLoggedIn) {
    userStore.requireLogin(() => {})
    return
  }
  if (!userStore.phone) {
    uni.showModal({
      title: '需要绑定手机号',
      content: '请先绑定手机号，便于售后联系。',
      showCancel: false,
      confirmText: '去绑定',
      success: () => {
        uni.switchTab({ url: '/pages/user/index' })
      }
    })
    return
  }
  if (!orderId.value) {
    uni.showToast({ title: '缺少订单信息，请从订单详情页申请售后', icon: 'none' })
    return
  }
  if (!orderItemId.value) {
    uni.showToast({ title: '缺少商品信息，请从订单详情页申请售后', icon: 'none' })
    return
  }
  if (!form.value.reason) {
    uni.showToast({ title: '请选择原因', icon: 'none' })
    return
  }
  try {
    await applyAftersale({
      orderId: orderId.value,
      orderItemId: orderItemId.value,
      type: form.value.type,
      reason: form.value.reason,
      description: form.value.description,
      images: form.value.images
    })
    uni.showToast({ title: '申请已提交', icon: 'success' })
    setTimeout(() => uni.navigateBack(), 1500)
  } catch {
    uni.showToast({ title: '提交失败', icon: 'none' })
  }
}

onLoad(async (options) => {
  if (options?.orderId) orderId.value = options.orderId
  if (options?.orderItemId) orderItemId.value = options.orderItemId
  if (orderId.value) {
    try {
      const order = await getOrderDetail(orderId.value)
      if (order.status !== 'completed' && order.status !== 'delivered') {
        uni.showModal({
          title: '提示',
          content: '当前订单状态不允许申请售后',
          showCancel: false,
          success: () => uni.navigateBack()
        })
      }
      const selectedItem = order.items.find((item) => item.id === orderItemId.value)
      if (!selectedItem) {
        uni.showModal({
          title: '提示',
          content: '请选择要申请售后的商品',
          showCancel: false,
          success: () => uni.navigateBack()
        })
        return
      }
      if (selectedItem.canApplyAftersale === false) {
        uni.showModal({
          title: '提示',
          content: selectedItem.aftersaleDisabledReason || '当前商品不允许申请售后',
          showCancel: false,
          success: () => uni.navigateBack()
        })
      }
    } catch {
      uni.showToast({ title: '订单信息获取失败', icon: 'none' })
    }
  }
})

defineExpose({
  handleSubmit,
  orderId,
  orderItemId,
  form
})
</script>

<style lang="scss" scoped>
.aftersale-apply-page {
  min-height: 100vh;
  padding: $spacing-md;
}

.apply-guide {
  background: $gradient-sage;
  border-color: rgba($success-color, 0.18);
}

.guide-title {
  display: block;
  font-size: $font-xl;
  font-weight: 800;
  color: $text-color;
}

.guide-desc {
  display: block;
  margin-top: 8rpx;
  font-size: $font-sm;
  color: $text-hint;
  line-height: 1.55;
}

.form-section {
  margin-bottom: $spacing-lg;
  border-radius: $radius-xxl;
}

.form-item {
  padding: $spacing-md 0;
  border-bottom: 1rpx solid $divider-color;

  &:last-child { border-bottom: none; }

  &.vertical {
    flex-direction: column;
    align-items: flex-start;
  }
}

.form-label {
  font-size: $font-md;
  color: $text-color;
  font-weight: 700;
  display: block;
  margin-bottom: $spacing-sm;
}

.type-select {
  display: flex;
  gap: $spacing-sm;
}

.type-option {
  min-height: 64rpx;
  padding: 0 32rpx;
  border-radius: $radius-round;
  border: 2rpx solid $border-color;
  @include flex-center;

  &.active {
    background: $primary-soft;
    border-color: rgba($primary-color, 0.32);

    .type-text { color: $primary-dark; font-weight: 700; }
  }
}

.type-text {
  font-size: $font-sm;
  color: $text-secondary;
}

.form-value {
  font-size: $font-md;
  color: $text-color;

  &.placeholder { color: $text-hint; }
}

.form-textarea {
  width: 100%;
  min-height: 160rpx;
  font-size: $font-md;
  background: $bg-soft;
  border-radius: $radius-lg;
  padding: $spacing-sm;
  line-height: 1.6;
}

.image-list {
  display: flex;
  flex-wrap: wrap;
  gap: $spacing-sm;
}

.image-item {
  position: relative;
  width: 160rpx;
  height: 160rpx;
}

.upload-image {
  width: 100%;
  height: 100%;
  border-radius: $radius-lg;
}

.image-delete {
  position: absolute;
  top: -8rpx;
  right: -8rpx;
  width: 36rpx;
  height: 36rpx;
  background: rgba(0, 0, 0, 0.5);
  border-radius: 50%;
  @include flex-center;
  color: #FFFFFF;
  font-size: $font-xs;
}

.image-add {
  width: 160rpx;
  height: 160rpx;
  background: $bg-soft;
  border-radius: $radius-lg;
  @include flex-center;
  border: 2rpx dashed rgba($primary-color, 0.28);
}

.add-icon {
  font-size: 48rpx;
  color: $text-hint;
}

.submit-btn {
  background: $gradient-coral;
  border-radius: $radius-round;
  padding: 24rpx 0;
  text-align: center;
  box-shadow: $shadow-coral;
}

.submit-text {
  color: #FFFFFF;
  font-size: $font-lg;
  font-weight: 500;
}
</style>
