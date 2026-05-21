<template>
  <view class="search-page">
    <view class="search-header">
      <view class="search-input-wrap">
        <input
          class="search-input"
          v-model="keyword"
          placeholder="搜索商品"
          confirm-type="search"
          @confirm="doSearch"
          focus
        />
      </view>
      <text class="search-btn" @tap="doSearch">搜索</text>
    </view>

    <view v-if="!hasSearched" class="search-suggest">
      <view v-if="hotKeywords.length" class="section">
        <text class="section-title">热门搜索</text>
        <view class="keyword-list">
          <view v-for="kw in hotKeywords" :key="kw" class="keyword-tag" @tap="searchByKeyword(kw)">
            <text class="keyword-text">{{ kw }}</text>
          </view>
        </view>
      </view>

      <view v-if="searchHistory.length" class="section">
        <view class="section-header">
          <text class="section-title">搜索历史</text>
          <text class="clear-btn" @tap="clearHistory">清空</text>
        </view>
        <view class="keyword-list">
          <view v-for="kw in searchHistory" :key="kw" class="keyword-tag" @tap="searchByKeyword(kw)">
            <text class="keyword-text">{{ kw }}</text>
          </view>
        </view>
      </view>
    </view>

    <view v-else class="search-result">
      <view class="product-grid">
        <ProductCard v-for="item in products" :key="item.id" :product="item" />
      </view>
      <Loading v-if="loading" />
      <Empty v-if="!loading && products.length === 0" text="未找到相关商品" />
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { searchProducts, getHotKeywords, getSearchHistory, clearSearchHistory } from '@/api/search'
import ProductCard from '@/components/ProductCard.vue'
import Loading from '@/components/Loading.vue'
import Empty from '@/components/Empty.vue'

const keyword = ref('')
const hasSearched = ref(false)
const hotKeywords = ref<string[]>([])
const searchHistory = ref<string[]>([])
const products = ref<any[]>([])
const loading = ref(false)
const page = ref(1)
const finished = ref(false)

async function loadHotKeywords() {
  try {
    hotKeywords.value = await getHotKeywords()
  } catch {}
}

async function loadSearchHistory() {
  try {
    searchHistory.value = await getSearchHistory()
  } catch {}
}

async function doSearch() {
  if (!keyword.value.trim()) {
    uni.showToast({ title: '请输入搜索关键词', icon: 'none' })
    return
  }
  hasSearched.value = true
  page.value = 1
  finished.value = false
  products.value = []
  await loadProducts()
  loadSearchHistory()
}

function searchByKeyword(kw: string) {
  keyword.value = kw
  doSearch()
}

async function loadProducts() {
  if (loading.value || finished.value) return
  loading.value = true
  try {
    const data = await searchProducts({
      keyword: keyword.value,
      page: page.value,
      pageSize: 10
    })
    products.value.push(...data.list)
    finished.value = products.value.length >= data.total
    page.value++
  } catch {} finally {
    loading.value = false
  }
}

async function clearHistory() {
  try {
    await clearSearchHistory()
    searchHistory.value = []
  } catch {}
}

onMounted(() => {
  loadHotKeywords()
  loadSearchHistory()
})
</script>

<style lang="scss" scoped>
.search-page {
  min-height: 100vh;
  background: $bg-color;
}

.search-header {
  display: flex;
  align-items: center;
  padding: $spacing-sm $spacing-md;
  background: $bg-white;
}

.search-input-wrap {
  flex: 1;
  background: $bg-gray;
  border-radius: $radius-round;
  padding: 12rpx 24rpx;
}

.search-input {
  font-size: $font-md;
  width: 100%;
}

.search-btn {
  margin-left: $spacing-sm;
  color: $primary-color;
  font-size: $font-md;
  padding: 12rpx;
}

.search-suggest {
  padding: $spacing-md;
}

.section {
  margin-bottom: $spacing-lg;
}

.section-header {
  @include flex-between;
  margin-bottom: $spacing-sm;
}

.section-title {
  font-size: $font-md;
  font-weight: 600;
  color: $text-color;
}

.clear-btn {
  font-size: $font-sm;
  color: $text-hint;
}

.keyword-list {
  display: flex;
  flex-wrap: wrap;
  gap: $spacing-sm;
}

.keyword-tag {
  background: $bg-white;
  border-radius: $radius-round;
  padding: 12rpx 24rpx;
}

.keyword-text {
  font-size: $font-sm;
  color: $text-secondary;
}

.search-result {
  padding: $spacing-sm $spacing-md;
}

.product-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: $spacing-sm;
}
</style>
