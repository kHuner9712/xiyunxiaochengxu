<template>
  <view class="my-benefit-page page-shell">
    <view class="tabs">
      <view
        v-for="t in tabs"
        :key="t.value"
        class="tab"
        :class="{ active: activeTab === t.value }"
        @tap="switchTab(t.value)"
      >
        {{ t.label }}
      </view>
    </view>

    <view v-if="activeTab === 'packages'" class="list-wrap">
      <view v-for="pkg in packageList" :key="pkg.id" class="pkg-card card">
        <view class="pkg-header">
          <view class="pkg-name">{{ pkg.packageName }}</view>
          <view class="pkg-status" :class="`status-${pkg.status}`">{{ statusText(pkg.status) }}</view>
        </view>
        <view class="pkg-meta">
          <text class="meta-label">有效期：</text>
          <text class="meta-value">{{ formatDate(pkg.validFrom) }} 至 {{ pkg.validTo ? formatDate(pkg.validTo) : '长期' }}</text>
        </view>
        <view class="pkg-action" @tap="goEntitlements(pkg.id)">查看权益项 ›</view>
      </view>
      <Loading v-if="loading" />
      <Empty v-if="!loading && packageList.length === 0" text="暂无权益卡" />
    </view>

    <view v-else class="list-wrap">
      <view v-for="e in entitlementList" :key="e.id" class="ent-card card" @tap="goEntitlementDetail(e.id)">
        <view class="ent-header">
          <view class="ent-name">{{ e.itemName }}</view>
          <view class="ent-status" :class="`status-${e.status}`">{{ statusText(e.status) }}</view>
        </view>
        <view class="ent-pkg">{{ e.packageName }}</view>
        <view class="ent-code">核销码：{{ e.verifyCode }}</view>
        <view v-if="e.usedAt" class="ent-used">核销时间：{{ formatDateTime(e.usedAt) }}</view>
      </view>
      <Loading v-if="loading" />
      <Empty v-if="!loading && entitlementList.length === 0" text="暂无权益" />
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { onShow, onReachBottom } from '@dcloudio/uni-app'
import {
  getMyBenefitPackages,
  getMyBenefitEntitlements,
  type UserBenefitPackageSummary,
  type UserBenefitEntitlementSummary
} from '@/api/benefit-package'
import Loading from '@/components/Loading.vue'
import Empty from '@/components/Empty.vue'

type TabValue = 'packages' | 'entitlements'
const tabs: { label: string; value: TabValue }[] = [
  { label: '我的权益卡', value: 'packages' },
  { label: '单项权益', value: 'entitlements' }
]

const activeTab = ref<TabValue>('packages')
const packageList = ref<UserBenefitPackageSummary[]>([])
const entitlementList = ref<UserBenefitEntitlementSummary[]>([])
const loading = ref(false)
const page = ref(1)
const finished = ref(false)

function statusText(status: string): string {
  switch (status) {
    case 'active': return '有效'
    case 'expired': return '已过期'
    case 'refunded': return '已退款'
    case 'cancelled': return '已取消'
    case 'unused': return '未使用'
    case 'used': return '已使用'
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

async function loadList(reset = false) {
  if (loading.value) return
  if (!reset && finished.value) return
  if (reset) {
    page.value = 1
    finished.value = false
    if (activeTab.value === 'packages') packageList.value = []
    else entitlementList.value = []
  }
  loading.value = true
  try {
    if (activeTab.value === 'packages') {
      const data = await getMyBenefitPackages({ page: page.value, pageSize: 20 })
      packageList.value.push(...data.list)
      finished.value = packageList.value.length >= data.total
    } else {
      const data = await getMyBenefitEntitlements({ page: page.value, pageSize: 20 })
      entitlementList.value.push(...data.list)
      finished.value = entitlementList.value.length >= data.total
    }
    page.value++
  } catch {
    uni.showToast({ title: '加载失败', icon: 'none' })
  } finally {
    loading.value = false
  }
}

function switchTab(v: TabValue) {
  if (activeTab.value === v) return
  activeTab.value = v
  loadList(true)
}

function goEntitlements(packageId: string) {
  uni.navigateTo({ url: `/pages/benefit-package/entitlement?packageId=${packageId}` })
}

function goEntitlementDetail(id: string) {
  uni.navigateTo({ url: `/pages/benefit-package/entitlement?id=${id}` })
}

onShow(() => loadList(true))
onReachBottom(() => loadList())
</script>

<style lang="scss" scoped>
.my-benefit-page {
  min-height: 100vh;
  padding: $spacing-md;
}

.tabs {
  display: flex;
  background: $gradient-card;
  border-radius: $radius-round;
  padding: 6rpx;
  margin-bottom: $spacing-md;
}

.tab {
  flex: 1;
  text-align: center;
  padding: 14rpx 0;
  font-size: $font-sm;
  color: $text-secondary;
  border-radius: $radius-round;
  font-weight: 700;

  &.active {
    background: $primary-color;
    color: #fff;
  }
}

.list-wrap {
  display: flex;
  flex-direction: column;
  gap: $spacing-sm;
}

.pkg-card,
.ent-card {
  padding: $spacing-md;
  background: $gradient-card;
  border-radius: $radius-xxl;
}

.pkg-header,
.ent-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8rpx;
}

.pkg-name,
.ent-name {
  font-size: $font-md;
  font-weight: 800;
  color: $text-color;
  flex: 1;
  min-width: 0;
  @include text-ellipsis;
}

.pkg-status,
.ent-status {
  font-size: $font-xs;
  padding: 4rpx 14rpx;
  border-radius: $radius-round;
  font-weight: 700;

  &.status-active,
  &.status-unused {
    background: rgba($success-color, 0.15);
    color: $success-color;
  }

  &.status-expired,
  &.status-used {
    background: $bg-ivory;
    color: $text-hint;
  }

  &.status-refunded,
  &.status-cancelled {
    background: rgba($warning-color, 0.15);
    color: $warning-color;
  }
}

.pkg-meta {
  font-size: $font-xs;
  color: $text-secondary;
  margin-bottom: 8rpx;
}

.meta-label {
  color: $text-hint;
}

.pkg-action {
  font-size: $font-xs;
  color: $primary-dark;
  font-weight: 700;
  text-align: right;
}

.ent-pkg {
  font-size: $font-xs;
  color: $text-secondary;
  margin-bottom: 6rpx;
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
