<template>
  <view class="search-page page-shell">
    <view class="search-hero">
      <text class="hero-title">搜索母婴好物</text>
      <text class="hero-subtitle">自营正品 · 按需严选</text>
    </view>
    <view class="search-header">
      <view class="search-input-wrap">
        <view class="search-leading-icon"></view>
        <input
          class="search-input"
          v-model="keyword"
          placeholder="输入商品名称或品类"
          confirm-type="search"
          @confirm="doSearch"
          focus
        />
      </view>
      <view class="search-btn" @tap="doSearch">
        <text class="search-btn-text">搜索</text>
      </view>
    </view>

    <view v-if="!hasSearched" class="search-suggest">
      <view v-if="hotKeywords.length" class="section suggest-card">
        <text class="section-title">热门搜索</text>
        <view class="keyword-list">
          <view v-for="kw in hotKeywords" :key="kw" class="keyword-tag" @tap="searchByKeyword(kw)">
            <text class="keyword-text">{{ kw }}</text>
          </view>
        </view>
      </view>

      <view v-if="searchHistory.length" class="section suggest-card">
        <view class="section-header">
          <text class="section-title">搜索历史</text>
          <text class="clear-btn" @tap="clearHistory">清空</text>
        </view>
        <view class="keyword-list">
          <view v-for="kw in searchHistory" :key="kw" class="keyword-tag history-tag" @tap="searchByKeyword(kw)">
            <text class="keyword-text">{{ kw }}</text>
          </view>
        </view>
      </view>
    </view>

    <view v-else class="search-result">
      <view class="result-summary">
        <text class="result-keyword">“{{ keyword.trim() }}”</text>
        <text class="result-count">{{ total }} 件结果</text>
      </view>
      <view class="product-grid">
        <ProductCard v-for="item in products" :key="item.id" :product="item" />
      </view>
      <Loading v-if="loading" />
      <Empty
        v-if="!loading && products.length === 0"
        text="未找到相关商品"
        hint="换个关键词，或从热门搜索中选择"
      />
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { onReachBottom, onPullDownRefresh } from '@dcloudio/uni-app'
import { searchProducts, getHotKeywords, getSearchHistory, clearSearchHistory } from '@/api/search'
import { useUserStore } from '@/stores/user'
import ProductCard from '@/components/ProductCard.vue'
import Loading from '@/components/Loading.vue'
import Empty from '@/components/Empty.vue'

const userStore = useUserStore()
const keyword = ref('')
const hasSearched = ref(false)
const hotKeywords = ref<string[]>([])
const searchHistory = ref<string[]>([])
const products = ref<any[]>([])
const total = ref(0)
const loading = ref(false)
const page = ref(1)
const finished = ref(false)

async function loadHotKeywords() {
  try {
    hotKeywords.value = await getHotKeywords()
  } catch {
    hotKeywords.value = []
  }
}

async function loadSearchHistory() {
  if (!userStore.isLoggedIn) {
    searchHistory.value = []
    return
  }

  try {
    searchHistory.value = await getSearchHistory()
  } catch {
    searchHistory.value = []
  }
}

async function doSearch() {
  keyword.value = keyword.value.trim()
  if (!keyword.value) {
    uni.showToast({ title: '请输入搜索关键词', icon: 'none' })
    return
  }
  hasSearched.value = true
  page.value = 1
  total.value = 0
  finished.value = false
  products.value = []
  await loadProducts()
  if (userStore.isLoggedIn) {
    loadSearchHistory()
  }
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
    total.value = data.total
    finished.value = products.value.length >= data.total
    page.value++
  } catch {
    uni.showToast({ title: '搜索失败', icon: 'none' })
  } finally {
    loading.value = false
  }
}

async function clearHistory() {
  if (!userStore.isLoggedIn) {
    searchHistory.value = []
    uni.showToast({ title: '登录后可管理搜索历史', icon: 'none' })
    return
  }

  try {
    await clearSearchHistory()
    searchHistory.value = []
  } catch {
    uni.showToast({ title: '操作失败', icon: 'none' })
  }
}

onMounted(() => {
  loadHotKeywords()
  if (userStore.isLoggedIn) {
    loadSearchHistory()
  }
})

onReachBottom(() => {
  if (hasSearched.value) {
    loadProducts()
  }
})

onPullDownRefresh(async () => {
  if (hasSearched.value) {
    page.value = 1
    total.value = 0
    finished.value = false
    products.value = []
    await loadProducts()
  } else {
    await Promise.all([loadHotKeywords(), loadSearchHistory()])
  }
  uni.stopPullDownRefresh()
})

defineExpose({
  searchHistory,
  clearHistory,
})
</script>

<style lang="scss" scoped>
.search-page {
  min-height: 100vh;
}

.search-hero {
  padding: 24rpx $spacing-md 8rpx;
}

.hero-title {
  display: block;
  color: $text-color;
  font-size: 38rpx;
  font-weight: 900;
  line-height: 1.18;
}

.hero-subtitle {
  display: block;
  margin-top: 5rpx;
  color: $text-secondary;
  font-size: 22rpx;
}

.search-header {
  display: flex;
  align-items: center;
  padding: 10rpx $spacing-md 18rpx;
}

.search-input-wrap {
  display: flex;
  align-items: center;
  flex: 1;
  min-width: 0;
  min-height: 74rpx;
  padding: 0 22rpx;
  border: 1rpx solid rgba($border-color, 0.68);
  border-radius: $radius-round;
  background: rgba(255, 255, 255, 0.94);
}

.search-leading-icon {
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

.search-input {
  flex: 1;
  min-width: 0;
  width: 100%;
  font-size: 25rpx;
}

.search-btn {
  @include flex-center;
  min-width: 104rpx;
  min-height: 72rpx;
  margin-left: 12rpx;
  padding: 0 24rpx;
  border-radius: $radius-round;
  background: $gradient-coral;
  box-shadow: $shadow-coral;
}

.search-btn-text {
  color: #FFFFFF;
  font-size: 25rpx;
  font-weight: 800;
}

.search-suggest {
  padding: 4rpx $spacing-md $spacing-lg;
}

.section {
  margin-bottom: 18rpx;
}

.suggest-card {
  padding: 22rpx;
  border: 1rpx solid rgba($border-color, 0.64);
  border-radius: 28rpx;
  background: rgba(255, 255, 255, 0.86);
}

.section-header {
  @include flex-between;
  margin-bottom: 16rpx;
}

.section-title {
  display: block;
  margin-bottom: 16rpx;
  color: $text-color;
  font-size: 28rpx;
  font-weight: 800;
}

.section-header .section-title {
  margin-bottom: 0;
}

.clear-btn {
  padding: 8rpx 4rpx;
  color: $text-hint;
  font-size: 22rpx;
}

.keyword-list {
  display: flex;
  flex-wrap: wrap;
  gap: 10rpx;
}

.keyword-tag {
  padding: 11rpx 20rpx;
  border: 1rpx solid rgba($primary-color, 0.12);
  border-radius: $radius-round;
  background: rgba($primary-color, 0.07);
}

.history-tag {
  border-color: rgba($border-color, 0.62);
  background: rgba(255, 255, 255, 0.88);
}

.keyword-text {
  color: $text-secondary;
  font-size: 23rpx;
}

.search-result {
  padding: 4rpx $spacing-md $spacing-xl;
}

.result-summary {
  @include flex-between;
  min-height: 54rpx;
  margin-bottom: 12rpx;
  padding: 0 4rpx;
}

.result-keyword {
  max-width: 500rpx;
  color: $text-color;
  font-size: 25rpx;
  font-weight: 700;
  @include text-ellipsis;
}

.result-count {
  color: $text-hint;
  font-size: 21rpx;
}

.product-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 18rpx;
}
</style>
