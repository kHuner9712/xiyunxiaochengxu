<template>
  <view class="entitlement-page page-shell">
    <Loading v-if="loading" />
    <template v-else>
      <!-- 单个权益码详情 -->
      <view v-if="mode === 'detail' && detail" class="detail-wrap">
        <view class="code-card card">
          <view class="code-label">权益核销码</view>
          <view class="code-value">{{ detail.verifyCode }}</view>
          <view class="code-status" :class="`status-${detail.status}`">{{ statusText(detail.status) }}</view>
          <view v-if="detail.status === 'unused'" class="code-tip">到店后向工作人员出示此核销码</view>
          <view v-if="detail.usedAt" class="code-used">核销时间：{{ formatDateTime(detail.usedAt) }}</view>
        </view>

        <view class="section card">
          <view class="row">
            <text class="row-label">权益名称</text>
            <text class="row-value">{{ detail.itemName }}</text>
          </view>
          <view class="row">
            <text class="row-label">所属权益卡</text>
            <text class="row-value">{{ detail.packageName }}</text>
          </view>
          <view v-if="detail.itemDescription" class="row">
            <text class="row-label">权益说明</text>
            <text class="row-value">{{ detail.itemDescription }}</text>
          </view>
          <view class="row">
            <text class="row-label">有效期</text>
            <text class="row-value">
              {{ formatDate(detail.validFrom) }} 至 {{ detail.validTo ? formatDate(detail.validTo) : '长期' }}
            </text>
          </view>
          <view v-if="detail.pickupStoreId" class="row">
            <text class="row-label">核销门店</text>
            <text class="row-value">门店ID：{{ detail.pickupStoreId }}</text>
          </view>
          <view v-if="detail.merchantPromotionSourceId" class="row">
            <text class="row-label">商家来源</text>
            <text class="row-value">商家ID：{{ detail.merchantPromotionSourceId }}</text>
          </view>
        </view>
      </view>

      <!-- 某权益包下的所有权益列表 -->
      <view v-else-if="mode === 'list'" class="list-wrap">
        <view v-for="e in entitlementList" :key="e.id" class="ent-card card" @tap="goDetail(e.id)">
          <view class="ent-header">
            <view class="ent-name">{{ e.itemName }}</view>
            <view class="ent-status" :class="`status-${e.status}`">{{ statusText(e.status) }}</view>
          </view>
          <view class="ent-code">核销码：{{ e.verifyCode }}</view>
          <view v-if="e.usedAt" class="ent-used">核销时间：{{ formatDateTime(e.usedAt) }}</view>
        </view>
        <Empty v-if="entitlementList.length === 0" text="该权益卡下暂无权益" />
      </view>

      <Empty v-else text="权益不存在" />
    </template>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { onLoad, onReachBottom } from '@dcloudio/uni-app'
import {
  getBenefitEntitlement,
  getMyBenefitEntitlements,
  type UserBenefitEntitlementSummary,
  type UserBenefitEntitlementDetail
} from '@/api/benefit-package'
import Loading from '@/components/Loading.vue'
import Empty from '@/components/Empty.vue'

type Mode = 'detail' | 'list'
const mode = ref<Mode>('detail')
const loading = ref(false)
const detail = ref<UserBenefitEntitlementDetail | null>(null)
const entitlementList = ref<UserBenefitEntitlementSummary[]>([])
const page = ref(1)
const finished = ref(false)
let currentPackageId = ''

function statusText(status: string): string {
  switch (status) {
    case 'unused': return '未使用'
    case 'used': return '已使用'
    case 'expired': return '已过期'
    case 'cancelled': return '已取消'
    case 'refunded': return '已退款'
    default: return status
  }
}

function formatDate(s: string): string {
  const d = new Date(s)
  if (isNaN(d.getTime())) return s
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function formatDateTime(s: string): string {
  const d = new Date(s)
  if (isNaN(d.getTime())) return s
  return `${formatDate(s)} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

async function loadDetail(id: string) {
  loading.value = true
  try {
    detail.value = await getBenefitEntitlement(id)
  } catch {
    uni.showToast({ title: '加载失败', icon: 'none' })
  } finally {
    loading.value = false
  }
}

async function loadList(reset = false) {
  if (loading.value) return
  if (!reset && finished.value) return
  if (reset) {
    page.value = 1
    finished.value = false
    entitlementList.value = []
  }
  if (!currentPackageId) return
  loading.value = true
  try {
    const data = await getMyBenefitEntitlements({
      page: page.value,
      pageSize: 50,
      packageId: currentPackageId
    })
    entitlementList.value.push(...data.list)
    finished.value = entitlementList.value.length >= data.total
    page.value++
  } catch {
    uni.showToast({ title: '加载失败', icon: 'none' })
  } finally {
    loading.value = false
  }
}

function goDetail(id: string) {
  uni.navigateTo({ url: `/pages/benefit-package/entitlement?id=${id}` })
}

onLoad((options) => {
  const id = options?.id
  const packageId = options?.packageId
  if (id) {
    mode.value = 'detail'
    loadDetail(String(id))
  } else if (packageId) {
    mode.value = 'list'
    currentPackageId = String(packageId)
    loadList(true)
  }
})

onReachBottom(() => {
  if (mode.value === 'list') loadList()
})
</script>

<style lang="scss" scoped>
.entitlement-page {
  min-height: 100vh;
  padding: $spacing-md;
}

.detail-wrap {
  display: flex;
  flex-direction: column;
  gap: $spacing-md;
}

.code-card {
  padding: $spacing-xl $spacing-md;
  background: $gradient-card;
  border-radius: $radius-xxl;
  text-align: center;
}

.code-label {
  font-size: $font-sm;
  color: $text-secondary;
  margin-bottom: 16rpx;
}

.code-value {
  font-size: 72rpx;
  font-weight: 900;
  color: $primary-dark;
  letter-spacing: 12rpx;
  margin-bottom: 16rpx;
  font-family: 'Courier New', monospace;
}

.code-status {
  display: inline-block;
  font-size: $font-sm;
  padding: 6rpx 24rpx;
  border-radius: $radius-round;
  font-weight: 700;
  margin-bottom: 12rpx;

  &.status-unused {
    background: rgba($success-color, 0.15);
    color: $success-color;
  }

  &.status-used,
  &.status-expired {
    background: $bg-ivory;
    color: $text-hint;
  }

  &.status-cancelled,
  &.status-refunded {
    background: rgba($warning-color, 0.15);
    color: $warning-color;
  }
}

.code-tip {
  font-size: $font-xs;
  color: $text-hint;
}

.code-used {
  font-size: $font-xs;
  color: $text-hint;
  margin-top: 8rpx;
}

.section {
  padding: $spacing-md;
  background: $gradient-card;
  border-radius: $radius-xxl;
}

.row {
  display: flex;
  padding: 12rpx 0;
  border-bottom: 1rpx solid rgba(0, 0, 0, 0.04);

  &:last-child {
    border-bottom: none;
  }
}

.row-label {
  width: 180rpx;
  flex-shrink: 0;
  font-size: $font-sm;
  color: $text-hint;
}

.row-value {
  flex: 1;
  font-size: $font-sm;
  color: $text-color;
  font-weight: 600;
}

.list-wrap {
  display: flex;
  flex-direction: column;
  gap: $spacing-sm;
}

.ent-card {
  padding: $spacing-md;
  background: $gradient-card;
  border-radius: $radius-xxl;
}

.ent-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8rpx;
}

.ent-name {
  font-size: $font-md;
  font-weight: 800;
  color: $text-color;
  flex: 1;
  min-width: 0;
  @include text-ellipsis;
}

.ent-status {
  font-size: $font-xs;
  padding: 4rpx 14rpx;
  border-radius: $radius-round;
  font-weight: 700;

  &.status-unused {
    background: rgba($success-color, 0.15);
    color: $success-color;
  }

  &.status-used,
  &.status-expired {
    background: $bg-ivory;
    color: $text-hint;
  }

  &.status-cancelled,
  &.status-refunded {
    background: rgba($warning-color, 0.15);
    color: $warning-color;
  }
}

.ent-code {
  font-size: $font-sm;
  color: $primary-dark;
  font-weight: 800;
  letter-spacing: 2rpx;
  margin-bottom: 4rpx;
}

.ent-used {
  font-size: $font-xs;
  color: $text-hint;
}
</style>
