<template>
  <view class="product-list-page">
    <view class="filter-bar">
      <view
        v-for="filter in filters"
        :key="filter.value"
        class="filter-item"
        :class="{ active: currentSort === filter.value }"
        @tap="switchSort(filter.value)"
      >
        <text class="filter-text">{{ filter.label }}</text>
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
  background: $bg-color;
}

.filter-bar {
  display: flex;
  background: $bg-white;
  padding: $spacing-sm 0;
  position: sticky;
  top: 0;
  z-index: 10;
}

.filter-item {
  flex: 1;
  @include flex-center;
  padding: 16rpx 0;

  &.active {
    .filter-text {
      color: $primary-color;
      font-weight: 600;
    }
  }
}

.filter-text {
  font-size: $font-sm;
  color: $text-secondary;
}

.product-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: $spacing-sm;
  padding: $spacing-sm $spacing-md;
}
</style>
