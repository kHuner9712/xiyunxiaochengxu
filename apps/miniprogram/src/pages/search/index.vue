<template>
  <view class="search-page page-shell">
    <view class="search-hero">
      <text class="hero-title">搜索母婴好物</text>
      <text class="hero-subtitle">自营正品 · 按需严选</text>
    </view>
    <view class="search-header">
      <view class="search-input-wrap">
        <input
          class="search-input"
          v-model="keyword"
          placeholder="搜索母婴好物"
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
const loading = ref(false)
const page = ref(1)
const finished = ref(false)

async function loadHotKeywords() {
  try {
    hotKeywords.value = await getHotKeywords()
  } catch {
    uni.showToast({ title: '热门搜索加载失败', icon: 'none' })
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
    uni.showToast({ title: '搜索历史加载失败', icon: 'none' })
  }
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
</script>

<style lang="scss" scoped>
.search-page {
  min-height: 100vh;
}

.search-hero {
  padding: 34rpx $spacing-md 10rpx;
}

.hero-title {
  display: block;
  font-size: $font-xl;
  color: $text-color;
  font-weight: 900;
  line-height: 1.18;
}

.hero-subtitle {
  display: block;
  margin-top: 8rpx;
  font-size: $font-sm;
  color: $text-secondary;
}

.search-header {
  display: flex;
  align-items: center;
  padding: $spacing-sm $spacing-md $spacing-md;
  background: transparent;
}

.search-input-wrap {
  flex: 1;
  background: rgba(255, 255, 255, 0.92);
  border-radius: $radius-round;
  padding: 18rpx 26rpx;
  border: 1rpx solid rgba($border-color, 0.78);
  box-shadow: $shadow-sm;
}

.search-input {
  font-size: $font-md;
  width: 100%;
}

.search-btn {
  margin-left: $spacing-sm;
  color: #FFFFFF;
  font-size: $font-md;
  padding: 18rpx 28rpx;
  border-radius: $radius-round;
  background: $gradient-coral;
  box-shadow: $shadow-coral;
  font-weight: 700;
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
  font-size: $font-lg;
  font-weight: 800;
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
  background: rgba(255, 255, 255, 0.88);
  border-radius: $radius-round;
  padding: 14rpx 26rpx;
  border: 1rpx solid rgba($border-color, 0.78);
  box-shadow: $shadow-xs;
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
  gap: 22rpx;
}
</style>
