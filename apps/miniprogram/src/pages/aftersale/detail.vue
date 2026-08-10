<template>
  <view class="aftersale-detail-page page-shell">
    <view class="status-section" :class="getStatusClass(detail.status)">
      <text class="status-text">{{ displayStatusText }}</text>
    </view>

    <view class="progress-section card">
      <text class="section-title">售后进度</text>
      <view v-for="(log, index) in detail.logs" :key="index" class="progress-item">
        <view class="progress-dot" :class="{ active: index === 0 }"></view>
        <view class="progress-info">
          <text class="progress-content">{{ log.content }}</text>
          <text class="progress-time">{{ log.time }}</text>
        </view>
      </view>
    </view>

    <view class="product-section card">
      <view class="product-row">
        <image class="product-image" :src="detail.productImage" mode="aspectFill" />
        <view class="product-info">
          <text class="product-name">{{ detail.productName }}</text>
          <text class="product-sku">{{ detail.skuName }}</text>
          <view class="product-bottom">
            <PriceDisplay :price="detail.price" />
            <text class="product-qty">x{{ detail.quantity }}</text>
          </view>
        </view>
      </view>
    </view>

    <view class="info-section card">
      <view class="info-row">
        <text class="info-label">售后类型</text>
        <text class="info-value">{{ detail.type === 1 ? '退款' : detail.type === 2 ? '退货退款' : '换货' }}</text>
      </view>
      <view class="info-row">
        <text class="info-label">退款原因</text>
        <text class="info-value">{{ detail.reason }}</text>
      </view>
      <view class="info-row">
        <text class="info-label">问题描述</text>
        <text class="info-value">{{ detail.description }}</text>
      </view>
      <view v-if="detail.refundAmount" class="info-row">
        <text class="info-label">退款金额</text>
        <text class="info-value price">¥{{ formatPrice(detail.refundAmount) }}</text>
      </view>
      <view v-if="detail.images?.length" class="info-row vertical">
        <text class="info-label">凭证图片</text>
        <view class="image-list">
          <image v-for="(img, index) in displayImages" :key="index" class="evidence-image" :src="img" mode="aspectFill" @tap="previewImage(img)" />
        </view>
      </view>
    </view>

    <view class="bottom-bar bottom-action-bar">
      <view class="cs-btn" @tap="goCustomerService">联系客服</view>
      <view v-if="canCancelAftersale" class="cancel-btn" @tap="handleCancel">取消申请</view>
      <view v-if="canFillReturnLogistics" class="return-logistics-btn" @tap="openReturnLogisticsForm">填写退货物流</view>
    </view>

    <view v-if="showReturnLogisticsForm" class="logistics-modal-mask" @tap="closeReturnLogisticsForm">
      <view class="logistics-modal card" @tap.stop>
        <text class="modal-title">填写退货物流</text>
        <view class="modal-field">
          <text class="modal-label">物流公司</text>
          <input class="modal-input return-company-input" v-model="returnLogisticsForm.returnLogisticsCompany" placeholder="请输入物流公司" placeholder-class="native-input-placeholder" />
        </view>
        <view class="modal-field">
          <text class="modal-label">物流单号</text>
          <input class="modal-input return-no-input" v-model="returnLogisticsForm.returnLogisticsNo" placeholder="请输入物流单号" placeholder-class="native-input-placeholder" />
        </view>
        <view class="modal-field">
          <text class="modal-label">联系电话</text>
          <input class="modal-input return-phone-input" v-model="returnLogisticsForm.contactPhone" placeholder="选填" placeholder-class="native-input-placeholder" />
        </view>
        <view class="modal-field">
          <text class="modal-label">备注</text>
          <textarea class="modal-textarea return-remark-input" v-model="returnLogisticsForm.remark" placeholder="选填" placeholder-class="native-textarea-placeholder" />
        </view>
        <view class="modal-actions">
          <view class="modal-cancel-btn" @tap="closeReturnLogisticsForm">取消</view>
          <view class="modal-submit-btn submit-logistics-btn" @tap="submitReturnLogistics">提交</view>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { getAftersaleDetail, cancelAftersale, fillReturnLogistics, type AftersaleDetail } from '@/api/aftersale'
import { formatAftersaleStatus, formatPrice, normalizeAftersaleStatus } from '@/utils/format'
import { resolvePrivateFileUrls } from '@/utils/private-file'
import PriceDisplay from '@/components/PriceDisplay.vue'

const detail = ref<AftersaleDetail>({
  id: '', orderId: '', orderNo: '', type: 1, reason: '', description: '',
  images: [], status: 0, refundAmount: 0, productName: '', productImage: '',
  skuName: '', price: 0, quantity: 0, logs: [], createTime: ''
})
const displayImages = ref<string[]>([])
const showReturnLogisticsForm = ref(false)
const returnLogisticsForm = ref({
  returnLogisticsCompany: '',
  returnLogisticsNo: '',
  contactPhone: '',
  remark: ''
})

const normalizedStatus = computed(() => normalizeAftersaleStatus(detail.value.status))
const canCancelAftersale = computed(() => normalizedStatus.value === 'pending_review')
const canFillReturnLogistics = computed(() => detail.value.type === 2 && normalizedStatus.value === 'approved')
const displayStatusText = computed(() => {
  if (normalizedStatus.value === 'approved') {
    return detail.value.type === 2 ? '已通过/待退货' : '已通过/待退款'
  }
  return formatAftersaleStatus(detail.value.status)
})

async function loadDetail(id: string) {
  try {
    detail.value = normalizeDetail(await getAftersaleDetail(id))
    displayImages.value = await resolvePrivateFileUrls(detail.value.images || [])
  } catch {
    uni.showToast({ title: '加载失败', icon: 'none' })
  }
}

function normalizeDetail(data: any): AftersaleDetail {
  const logs = Array.isArray(data.logs)
    ? data.logs
    : (data.aftersaleLogs || []).map((log: any) => ({
        time: log.time || log.createdAt || '',
        content: log.content || '',
        status: data.status,
      }))

  return {
    ...data,
    id: String(data.id || ''),
    orderId: String(data.orderId || data.order?.id || ''),
    orderNo: data.orderNo || data.order?.orderNo || '',
    productName: data.productName || data.orderItem?.productName || '',
    productImage: data.productImage || data.orderItem?.productImage || '',
    skuName: data.skuName || data.orderItem?.skuName || '',
    price: data.price ?? data.orderItem?.price ?? 0,
    quantity: data.quantity ?? data.orderItem?.quantity ?? 0,
    refundAmount: data.refundAmount ?? 0,
    images: Array.isArray(data.images) ? data.images : [],
    logs,
    createTime: data.createTime || data.createdAt || '',
  }
}

function getStatusClass(status: string | number): string {
  const map: Record<string, string> = {
    pending_review: 'pending',
    approved: 'processing',
    returned: 'processing',
    pending_refund: 'processing',
    refunded: 'completed',
    rejected: 'rejected',
    closed: 'cancelled',
    '10': 'pending',
    '20': 'processing',
    '30': 'completed',
    '40': 'rejected',
    '50': 'cancelled'
  }
  return map[normalizeAftersaleStatus(status)] || map[String(status)] || ''
}

function previewImage(url: string) {
  uni.previewImage({ urls: displayImages.value, current: url })
}

async function handleCancel() {
  uni.showModal({
    title: '提示',
    content: '确定取消售后申请吗？',
    success: async (res) => {
      if (res.confirm) {
        try {
          await cancelAftersale(detail.value.id)
          await loadDetail(detail.value.id)
        } catch {
          uni.showToast({ title: '取消失败', icon: 'none' })
        }
      }
    }
  })
}

function goCustomerService() {
  uni.navigateTo({ url: '/pages/customer-service/index' })
}

function openReturnLogisticsForm() {
  returnLogisticsForm.value = {
    returnLogisticsCompany: detail.value.returnLogisticsCompany || '',
    returnLogisticsNo: detail.value.returnLogisticsNo || '',
    contactPhone: '',
    remark: ''
  }
  showReturnLogisticsForm.value = true
}

function closeReturnLogisticsForm() {
  showReturnLogisticsForm.value = false
}

async function submitReturnLogistics() {
  const payload = {
    returnLogisticsCompany: returnLogisticsForm.value.returnLogisticsCompany.trim(),
    returnLogisticsNo: returnLogisticsForm.value.returnLogisticsNo.trim(),
    contactPhone: returnLogisticsForm.value.contactPhone.trim(),
    remark: returnLogisticsForm.value.remark.trim()
  }

  if (!payload.returnLogisticsCompany) {
    uni.showToast({ title: '请输入物流公司', icon: 'none' })
    return
  }
  if (!payload.returnLogisticsNo) {
    uni.showToast({ title: '请输入物流单号', icon: 'none' })
    return
  }

  try {
    await fillReturnLogistics(detail.value.id, payload)
    uni.showToast({ title: '提交成功', icon: 'success' })
    closeReturnLogisticsForm()
    await loadDetail(detail.value.id)
  } catch {
    uni.showToast({ title: '提交失败', icon: 'none' })
  }
}

onLoad((options) => {
  const id = Array.isArray(options?.id) ? options?.id[0] : options?.id
  if (id) loadDetail(String(id))
})

defineExpose({
  detail,
  returnLogisticsForm,
  showReturnLogisticsForm,
  canFillReturnLogistics,
  submitReturnLogistics,
  openReturnLogisticsForm,
})
</script>

<style lang="scss" scoped>
.aftersale-detail-page {
  min-height: 100vh;
  padding-bottom: 168rpx;
}

.status-section {
  margin: $spacing-md;
  padding: $spacing-lg;
  border-radius: $radius-xxl;
  border: 1rpx solid rgba(255, 255, 255, 0.78);
  box-shadow: $shadow-md;

  &.pending { background: $warning-soft; }
  &.processing { background: $info-soft; }
  &.completed { background: $success-soft; }
  &.rejected { background: $danger-soft; }
  &.cancelled { background: $bg-gray; }
}

.status-text {
  font-size: $font-xl;
  font-weight: 800;
  color: $text-color;
}

.progress-section,
.product-section,
.info-section {
  margin: $spacing-sm $spacing-md;
  background: rgba(255, 255, 255, 0.9);
}

.section-title {
  font-size: $font-md;
  font-weight: 800;
  color: $text-color;
  display: block;
  margin-bottom: $spacing-md;
}

.progress-item {
  display: flex;
  align-items: flex-start;
  padding-bottom: $spacing-md;
  position: relative;
  padding-left: 32rpx;

  &::before {
    content: '';
    position: absolute;
    left: 9rpx;
    top: 24rpx;
    bottom: 0;
    width: 2rpx;
    background: $divider-color;
  }

  &:last-child::before { display: none; }
}

.progress-dot {
  position: absolute;
  left: 0;
  top: 8rpx;
  width: 20rpx;
  height: 20rpx;
  border-radius: 50%;
  background: $border-color;

  &.active { background: $primary-color; box-shadow: 0 0 0 8rpx rgba($primary-color, 0.12); }
}

.progress-info {
  flex: 1;
}

.progress-content {
  font-size: $font-sm;
  color: $text-color;
  display: block;
  line-height: 1.5;
}

.progress-time {
  font-size: $font-xs;
  color: $text-hint;
  margin-top: 4rpx;
  display: block;
}

.product-row {
  display: flex;
}

.product-image {
  width: 140rpx;
  height: 140rpx;
  border-radius: 26rpx;
  background: $bg-gray;
}

.product-info {
  flex: 1;
  margin-left: $spacing-sm;
}

.product-name {
  font-size: $font-sm;
  color: $text-color;
  @include text-ellipsis-2;
  display: block;
}

.product-sku {
  font-size: $font-xs;
  color: $text-secondary;
  margin-top: 8rpx;
  display: block;
}

.product-bottom {
  display: flex;
  align-items: center;
  margin-top: $spacing-sm;
}

.product-qty {
  font-size: $font-xs;
  color: $text-hint;
  margin-left: $spacing-sm;
}

.info-row {
  @include flex-between;
  padding: 8rpx 0;

  &.vertical {
    flex-direction: column;
    align-items: flex-start;
  }
}

.info-label {
  font-size: $font-sm;
  color: $text-hint;
}

.info-value {
  font-size: $font-sm;
  color: $text-color;

  &.price { color: $price-color; font-weight: 700; }
}

.image-list {
  display: flex;
  flex-wrap: wrap;
  gap: $spacing-sm;
  margin-top: $spacing-sm;
}

.evidence-image {
  width: 150rpx;
  height: 150rpx;
  border-radius: $radius-lg;
}

.bottom-bar {
  justify-content: flex-end;
  gap: $spacing-sm;
}

.cs-btn,
.cancel-btn,
.return-logistics-btn {
  min-height: 64rpx;
  padding: 0 32rpx;
  border-radius: $radius-round;
  @include flex-center;
  font-size: $font-sm;
}

.cs-btn,
.cancel-btn {
  color: $text-secondary;
  border: 2rpx solid $border-color;
  background: $bg-white;
}

.return-logistics-btn {
  color: #FFFFFF;
  border: 2rpx solid transparent;
  background: $gradient-coral;
  font-weight: 700;
  box-shadow: $shadow-coral;
}

.logistics-modal-mask {
  position: fixed;
  inset: 0;
  z-index: 1000;
  background: rgba(0, 0, 0, 0.46);
  @include flex-center;
  padding: $spacing-md;
}

.logistics-modal {
  width: 100%;
  max-width: 680rpx;
}

.modal-title {
  display: block;
  font-size: $font-lg;
  font-weight: 800;
  color: $text-color;
  margin-bottom: $spacing-md;
}

.modal-field {
  margin-bottom: $spacing-md;
}

.modal-label {
  display: block;
  font-size: $font-sm;
  color: $text-secondary;
  margin-bottom: 8rpx;
}

.modal-input,
.modal-textarea {
  width: 100%;
  box-sizing: border-box;
  border-radius: $radius-lg;
  background: $bg-soft;
  border: 1rpx solid $border-color;
  padding: 18rpx 20rpx;
  min-height: 80rpx;
  line-height: 44rpx;
  font-size: $font-sm;
  color: $text-color;
}

.modal-input {
  min-height: 80rpx;
  line-height: 44rpx;
}

.modal-textarea {
  min-height: 150rpx;
  line-height: 44rpx;
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: $spacing-sm;
  margin-top: $spacing-md;
}

.modal-cancel-btn,
.modal-submit-btn {
  min-height: 64rpx;
  padding: 0 32rpx;
  border-radius: $radius-round;
  @include flex-center;
  font-size: $font-sm;
}

.modal-cancel-btn {
  border: 1rpx solid $border-color;
  color: $text-secondary;
}

.modal-submit-btn {
  background: $gradient-coral;
  color: #FFFFFF;
  font-weight: 700;
}
</style>
