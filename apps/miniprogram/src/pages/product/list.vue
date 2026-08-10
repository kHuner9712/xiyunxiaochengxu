<template>
  <view class="product-list-page page-shell">
    <view class="list-top sticky-glass">
      <view class="list-title-row">
        <view class="title-copy">
          <text class="list-title">严选好物</text>
          <text class="list-subtitle">自营母婴精品 · 安心选购</text>
        </view>
        <view class="result-count">
          <text v-if="loading && total === 0" class="result-count-main">严选</text>
          <template v-else>
            <text class="result-count-main">{{ total }}</text>
            <text class="result-count-unit">件好物</text>
          </template>
        </view>
      </view>
      <view class="search-box" @tap="goSearch">
        <view class="search-icon"></view>
        <text class="search-placeholder">{{ keyword || '搜索奶粉、纸尿裤、洗护用品' }}</text>
      </view>
      <view class="list-assurance">
        <view class="assurance-item">
          <text class="assurance-dot"></text>
          <text class="assurance-text">自营正品</text>
        </view>
        <view class="assurance-item">
          <text class="assurance-dot peach"></text>
          <text class="assurance-text">严选品质</text>
        </view>
        <view class="assurance-item">
          <text class="assurance-dot sage"></text>
          <text class="assurance-text">安心售后</text>
        </view>
      </view>
      <view class="filter-bar pill-tab-bar">
        <view
          v-for="filter in filters"
          :key="filter.value"
          class="filter-item pill-tab-item"
          :class="{ active: currentSort === filter.value }"
          @tap="switchSort(filter.value)"
        >
          <text class="filter-text">{{ filter.label }}</text>
        </view>
      </view>
    </view>

    <view class="product-grid">
      <ProductCard v-for="item in products" :key="item.id" :product="item" />
    </view>

    <Loading v-if="loading" />
    <Empty
      v-if="!loading && products.length === 0"
      text="暂无商品"
      hint="换个分类或关键词再试试"
    />
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { onLoad, onReachBottom, onPullDownRefresh } from '@dcloudio/uni-app'
import { getProductList } from '@/api/product'
import { normalizeProductCategoryId, normalizeProductListSort, type ProductListSort } from './product-list-query'
import ProductCard from '@/components/ProductCard.vue'
import Loading from '@/components/Loading.vue'
import Empty from '@/components/Empty.vue'

const filters: Array<{ label: string; value: ProductListSort }> = [
  { label: '综合', value: 'default' },
  { label: '销量', value: 'sales' },
  { label: '新品', value: 'new' },
  { label: '价格', value: 'price_asc' }
]

const currentSort = ref<ProductListSort>('default')
const products = ref<any[]>([])
const total = ref(0)
const loading = ref(false)
const page = ref(1)
const finished = ref(false)
const categoryId = ref('')
const keyword = ref('')

async function loadProducts(reset = false) {
  if (loading.value) return
  if (!reset && finished.value) return
  if (reset) {
    page.value = 1
    finished.value = false
    products.value = []
    total.value = 0
  }
  loading.value = true
  try {
    const params: {
      categoryId?: string
      keyword?: string
      sort: ProductListSort
      page: number
      pageSize: number
    } = {
      sort: currentSort.value,
      page: page.value,
      pageSize: 10
    }
    if (categoryId.value) params.categoryId = categoryId.value
    if (keyword.value) params.keyword = keyword.value
    const data = await getProductList(params)
    products.value.push(...data.list)
    total.value = data.total
    finished.value = products.value.length >= data.total
    page.value++
  } catch {
    uni.showToast({ title: '商品加载失败', icon: 'none' })
  } finally {
    loading.value = false
  }
}

function switchSort(value: ProductListSort) {
  if (currentSort.value === value) return
  currentSort.value = value
  loadProducts(true)
}

function goSearch() {
  uni.navigateTo({ url: '/pages/search/index' })
}

onLoad((options) => {
  categoryId.value = normalizeProductCategoryId(options?.categoryId)
  currentSort.value = normalizeProductListSort(options?.sort)
  if (options?.keyword) keyword.value = String(options.keyword)
  loadProducts()
})

onPullDownRefresh(async () => {
  await loadProducts(true)
  uni.stopPullDownRefresh()
})

onReachBottom(() => {
  loadProducts()
})
</script>

<style lang="scss" scoped>
.product-list-page {
  min-height: 100vh;
}

.list-top {
  padding: 22rpx $spacing-md 16rpx;
  border-bottom: 1rpx solid rgba($border-color, 0.68);
  border-radius: 0 0 30rpx 30rpx;
  background: linear-gradient(180deg, rgba(255, 252, 247, 0.97), rgba(255, 248, 242, 0.93));
  box-shadow: 0 10rpx 28rpx rgba(131, 91, 78, 0.06);
}

.list-title-row {
  @include flex-between;
  align-items: center;
  margin-bottom: 16rpx;
}

.title-copy {
  min-width: 0;
}

.list-title {
  display: block;
  color: $text-color;
  font-size: 38rpx;
  font-weight: 900;
  line-height: 1.16;
}

.list-subtitle {
  display: block;
  margin-top: 5rpx;
  color: $text-hint;
  font-size: 21rpx;
}

.result-count {
  display: inline-flex;
  align-items: baseline;
  flex-shrink: 0;
  min-height: 52rpx;
  margin-left: 18rpx;
  padding: 0 16rpx;
  border: 1rpx solid rgba($success-color, 0.16);
  border-radius: $radius-round;
  background: rgba($success-color, 0.09);
}

.result-count-main {
  color: $success-dark;
  font-size: 25rpx;
  font-weight: 900;
}

.result-count-unit {
  margin-left: 4rpx;
  color: $success-dark;
  font-size: 18rpx;
}

.search-box {
  display: flex;
  align-items: center;
  min-height: 72rpx;
  padding: 0 24rpx;
  margin-bottom: 12rpx;
  border: 1rpx solid rgba($border-color, 0.62);
  border-radius: $radius-round;
  background: rgba(255, 255, 255, 0.92);
}

.search-icon {
  position: relative;
  width: 28rpx;
  height: 28rpx;
  margin-right: 12rpx;
  flex-shrink: 0;

  &::before {
    content: '';
    position: absolute;
    left: 1rpx;
    top: 1rpx;
    width: 18rpx;
    height: 18rpx;
    border: 3rpx solid $primary-color;
    border-radius: 50%;
  }

  &::after {
    content: '';
    position: absolute;
    right: 1rpx;
    bottom: 2rpx;
    width: 10rpx;
    height: 3rpx;
    border-radius: 2rpx;
    background: $primary-color;
    transform: rotate(45deg);
  }
}

.search-placeholder {
  flex: 1;
  color: $text-hint;
  font-size: 24rpx;
  @include text-ellipsis;
}

.list-assurance {
  display: flex;
  align-items: center;
  gap: 10rpx;
  margin-bottom: 12rpx;
}

.assurance-item {
  display: inline-flex;
  align-items: center;
  min-width: 0;
}

.assurance-dot {
  width: 9rpx;
  height: 9rpx;
  margin-right: 6rpx;
  flex-shrink: 0;
  border-radius: 50%;
  background: $primary-color;

  &.peach { background: $secondary-color; }
  &.sage { background: $success-color; }
}

.assurance-text {
  color: $text-secondary;
  font-size: 20rpx;
  white-space: nowrap;
}

.filter-bar {
  min-height: 66rpx;
  overflow: hidden;
  border-color: rgba($border-color, 0.54);
  background: rgba(255, 255, 255, 0.66);
}

.filter-item {
  flex: 1;
  min-width: 0;

  &.active {
    background: $primary-soft;
    box-shadow: none;

    .filter-text {
      color: $text-color;
      font-weight: 700;
    }
  }
}

.filter-text {
  color: $text-secondary;
  font-size: 23rpx;
  white-space: nowrap;
}

.product-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 18rpx;
  padding: 22rpx $spacing-md $spacing-xl;
}
</style>
