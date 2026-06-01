<template>
  <view class="product-list-page page-shell">
    <view class="list-top sticky-glass">
      <view class="list-title-row">
        <view>
          <text class="list-title">严选好物</text>
          <text class="list-subtitle">自营母婴精品 · 安心选购</text>
        </view>
        <view class="filter-entry">
          <text class="filter-entry-icon">筛</text>
        </view>
      </view>
      <view class="search-box" @tap="goSearch">
        <text class="search-icon">⌕</text>
        <text class="search-placeholder">{{ keyword || '搜索母婴好物' }}</text>
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
    <Empty v-if="!loading && products.length === 0" text="暂无商品" />
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { onLoad, onReachBottom, onPullDownRefresh } from '@dcloudio/uni-app'
import { getProductList, type ProductDetail } from '@/api/product'
import ProductCard from '@/components/ProductCard.vue'
import Loading from '@/components/Loading.vue'
import Empty from '@/components/Empty.vue'

const filters = [
  { label: '综合', value: 'default' },
  { label: '销量', value: 'sales' },
  { label: '价格↑', value: 'price_asc' },
  { label: '价格↓', value: 'price_desc' },
  { label: '新品', value: 'new' }
]

const currentSort = ref('default')
const products = ref<any[]>([])
const loading = ref(false)
const page = ref(1)
const finished = ref(false)
const categoryId = ref(0)
const keyword = ref('')

async function loadProducts(reset = false) {
  if (loading.value) return
  if (!reset && finished.value) return
  if (reset) {
    page.value = 1
    finished.value = false
    products.value = []
  }
  loading.value = true
  try {
    const params: any = {
      sort: currentSort.value,
      page: page.value,
      pageSize: 10
    }
    if (categoryId.value) params.categoryId = categoryId.value
    if (keyword.value) params.keyword = keyword.value
    const data = await getProductList(params)
    products.value.push(...data.list)
    finished.value = products.value.length >= data.total
    page.value++
  } catch {
    uni.showToast({ title: '商品加载失败', icon: 'none' })
  } finally {
    loading.value = false
  }
}

function switchSort(value: string) {
  currentSort.value = value
  loadProducts(true)
}

function goSearch() {
  uni.navigateTo({ url: '/pages/search/index' })
}

onLoad((options) => {
  if (options?.categoryId) categoryId.value = Number(options.categoryId)
  if (options?.sort) currentSort.value = options.sort
  if (options?.keyword) keyword.value = options.keyword
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
  padding: 24rpx $spacing-md $spacing-md;
  border-radius: 0 0 $radius-xxl $radius-xxl;
}

.list-title-row {
  @include flex-between;
  align-items: flex-start;
  margin-bottom: $spacing-md;
}

.list-title {
  display: block;
  font-size: $font-xl;
  line-height: 1.16;
  color: $text-color;
  font-weight: 900;
}

.list-subtitle {
  display: block;
  margin-top: 8rpx;
  font-size: $font-xs;
  color: $text-hint;
}

.filter-entry {
  @include flex-center;
  width: 64rpx;
  height: 64rpx;
  border-radius: 24rpx;
  background: $success-soft;
  border: 1rpx solid rgba($success-color, 0.18);
}

.filter-entry-icon {
  font-size: $font-xs;
  color: $success-dark;
  font-weight: 800;
}

.search-box {
  display: flex;
  align-items: center;
  min-height: 76rpx;
  padding: 0 26rpx;
  margin-bottom: $spacing-sm;
  border-radius: $radius-round;
  background: rgba(255, 255, 255, 0.92);
  border: 1rpx solid rgba($border-color, 0.8);
}

.search-icon {
  margin-right: 10rpx;
  color: $primary-color;
  font-size: $font-lg;
}

.search-placeholder {
  flex: 1;
  font-size: $font-sm;
  color: $text-hint;
  @include text-ellipsis;
}

.filter-bar {
  overflow: hidden;
}

.filter-item {
  flex: 1;
  min-width: 0;

  &.active {
    .filter-text {
      color: $primary-dark;
      font-weight: 700;
    }
  }
}

.filter-text {
  font-size: $font-sm;
  color: $text-secondary;
  white-space: nowrap;
}

.product-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 22rpx;
  padding: $spacing-md $spacing-md $spacing-xl;
}
</style>
