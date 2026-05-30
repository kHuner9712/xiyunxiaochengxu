<template>
  <view class="aftersale-list-page page-shell">
    <view class="aftersale-list">
      <view v-for="item in list" :key="item.id" class="aftersale-card card" @tap="goDetail(item.id)">
        <view class="card-header">
          <text class="order-no">{{ item.orderNo }}</text>
          <text class="status-text" :class="getStatusClass(item.status)">{{ formatAftersaleStatus(item.status) }}</text>
        </view>
        <view class="card-content">
          <image class="product-image" :src="item.productImage" mode="aspectFill" />
          <view class="product-info">
            <text class="product-name">{{ item.productName }}</text>
            <text class="aftersale-reason">{{ item.reason }}</text>
          </view>
          <view class="refund-amount">
            <text class="amount-label">退款金额</text>
            <text class="amount-value">¥{{ formatPrice(item.refundAmount) }}</text>
          </view>
        </view>
      </view>
    </view>

    <Loading v-if="loading" />
    <Empty v-if="!loading && list.length === 0" text="暂无售后记录" />
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { onReachBottom, onPullDownRefresh } from '@dcloudio/uni-app'
import { getAftersaleList, type AftersaleItem } from '@/api/aftersale'
import { formatAftersaleStatus, formatPrice } from '@/utils/format'
import Loading from '@/components/Loading.vue'
import Empty from '@/components/Empty.vue'

const list = ref<AftersaleItem[]>([])
const loading = ref(false)
const page = ref(1)
const finished = ref(false)

async function loadList(reset = false) {
  if (loading.value) return
  if (!reset && finished.value) return
  if (reset) {
    page.value = 1
    finished.value = false
    list.value = []
  }
  loading.value = true
  try {
    const data = await getAftersaleList({ page: page.value, pageSize: 10 })
    list.value.push(...data.list)
    finished.value = list.value.length >= data.total
    page.value++
  } catch {
    uni.showToast({ title: '加载失败', icon: 'none' })
  } finally {
    loading.value = false
  }
}

function goDetail(id: string) {
  uni.navigateTo({ url: `/pages/aftersale/detail?id=${id}` })
}

function getStatusClass(status: number): string {
  const map: Record<number, string> = {
    10: 'pending',
    20: 'processing',
    30: 'completed',
    40: 'rejected',
    50: 'cancelled'
  }
  return map[status] || ''
}

onPullDownRefresh(async () => {
  await loadList(true)
  uni.stopPullDownRefresh()
})

onReachBottom(() => {
  loadList()
})

onMounted(() => {
  loadList()
})
</script>

<style lang="scss" scoped>
.aftersale-list-page {
  min-height: 100vh;
  padding-top: $spacing-sm;
}

.aftersale-card {
  margin: $spacing-sm $spacing-md $spacing-md;
  border-radius: $radius-xxl;
}

.card-header {
  @include flex-between;
  padding-bottom: $spacing-sm;
  border-bottom: 1rpx solid $divider-color;
}

.order-no {
  font-size: $font-xs;
  color: $text-hint;
}

.status-text {
  font-size: $font-sm;
  font-weight: 500;
  @extend .status-badge;

  &.pending { @extend .status-warning; }
  &.processing { @extend .status-info; }
  &.completed { @extend .status-success; }
  &.rejected { @extend .status-danger; }
  &.cancelled { background: $bg-gray; color: $text-hint; }
}

.card-content {
  display: flex;
  align-items: flex-start;
  padding-top: $spacing-md;
}

.product-image {
  width: 144rpx;
  height: 144rpx;
  border-radius: $radius-lg;
  flex-shrink: 0;
  background: $bg-gray;
}

.product-info {
  flex: 1;
  margin-left: $spacing-sm;
  overflow: hidden;
}

.product-name {
  font-size: $font-sm;
  color: $text-color;
  font-weight: 600;
  @include text-ellipsis-2;
  display: block;
  line-height: 1.4;
}

.aftersale-reason {
  font-size: $font-xs;
  color: $text-hint;
  display: block;
  margin-top: 4rpx;
}

.refund-amount {
  text-align: right;
  margin-left: $spacing-sm;
}

.amount-label {
  font-size: $font-xs;
  color: $text-hint;
  display: block;
}

.amount-value {
  font-size: $font-md;
  color: $primary-color;
  font-weight: 800;
}
</style>
