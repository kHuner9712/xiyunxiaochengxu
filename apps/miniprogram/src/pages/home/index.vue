<template>
  <view class="home-page page-shell">
    <view class="search-bar" @tap="goSearch">
      <view class="search-input">
        <text class="search-icon">⌕</text>
        <text class="search-placeholder">搜索商品</text>
      </view>
    </view>

    <swiper class="banner-swiper" indicator-dots autoplay circular :interval="4000">
      <swiper-item v-for="banner in homeData.banners" :key="banner.id" @tap="handleBannerTap(banner)">
        <image class="banner-image" :src="banner.image" mode="aspectFill" />
      </swiper-item>
    </swiper>

    <view class="quick-entries">
      <view v-for="entry in homeData.quickEntries" :key="entry.id" class="entry-item" @tap="handleEntryTap(entry)">
        <image class="entry-icon" :src="entry.icon" mode="aspectFit" />
        <text class="entry-name">{{ entry.name }}</text>
      </view>
    </view>

    <view v-if="homeData.monthRecommend.length" class="section">
      <view class="section-header">
        <text class="section-title">月龄推荐</text>
      </view>
      <scroll-view scroll-x class="month-scroll">
        <view class="month-list">
          <ProductCard v-for="item in homeData.monthRecommend" :key="item.id" :product="item" class="month-item" />
        </view>
      </scroll-view>
    </view>

    <view v-if="homeData.hotProducts.length" class="section">
      <view class="section-header">
        <text class="section-title">热门推荐</text>
        <text class="section-more" @tap="goProductList('hot')">更多 ›</text>
      </view>
      <view class="product-grid">
        <ProductCard v-for="item in homeData.hotProducts" :key="item.id" :product="item" />
      </view>
    </view>

    <view v-if="homeData.newProducts.length" class="section">
      <view class="section-header">
        <text class="section-title">新品上架</text>
        <text class="section-more" @tap="goProductList('new')">更多 ›</text>
      </view>
      <view class="product-grid">
        <ProductCard v-for="item in homeData.newProducts" :key="item.id" :product="item" />
      </view>
    </view>

    <view v-if="homeData.activities.length" class="section">
      <view class="section-header">
        <text class="section-title">热门活动</text>
        <text class="section-more" @tap="goActivityList">更多 ›</text>
      </view>
      <scroll-view scroll-x class="activity-scroll">
        <view class="activity-list">
          <view v-for="act in homeData.activities" :key="act.id" class="activity-card" @tap="goActivityDetail(act.id)">
            <image class="activity-image" :src="act.image" mode="aspectFill" />
            <view class="activity-info">
              <text class="activity-name">{{ act.name }}</text>
              <CountdownTimer :endTime="act.endTime" :showLabel="true" />
            </view>
          </view>
        </view>
      </scroll-view>
    </view>

    <view class="section">
      <view class="section-header">
        <text class="section-title">猜你喜欢</text>
      </view>
      <view class="product-grid">
        <ProductCard v-for="item in guessProducts" :key="item.id" :product="item" />
      </view>
      <Loading v-if="guessLoading" />
      <Empty v-if="!guessLoading && guessProducts.length === 0" text="暂无推荐商品" />
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { onPullDownRefresh, onReachBottom, onShareAppMessage } from '@dcloudio/uni-app'
import { getHomeData, getGuessProducts, type BannerItem, type QuickEntry, type ProductItem, type ActivityItem } from '@/api/home'
import { useUserStore } from '@/stores/user'
import ProductCard from '@/components/ProductCard.vue'
import CountdownTimer from '@/components/CountdownTimer.vue'
import Loading from '@/components/Loading.vue'
import Empty from '@/components/Empty.vue'

const userStore = useUserStore()

onShareAppMessage(() => ({
  title: '禧孕优选 - 品质母婴好物',
  path: `/pages/home/index?inviter=${userStore.userInfo?.id || ''}`
}))

const homeData = reactive<{
  banners: BannerItem[]
  quickEntries: QuickEntry[]
  monthRecommend: ProductItem[]
  hotProducts: ProductItem[]
  newProducts: ProductItem[]
  activities: ActivityItem[]
  guessProducts: ProductItem[]
}>({
  banners: [],
  quickEntries: [],
  monthRecommend: [],
  hotProducts: [],
  newProducts: [],
  activities: [],
  guessProducts: []
})

const guessProducts = ref<ProductItem[]>([])
const guessLoading = ref(false)
const guessPage = ref(1)
const guessFinished = ref(false)

async function loadHomeData() {
  try {
    const data = await getHomeData()
    Object.assign(homeData, data)
  } catch {
    uni.showToast({ title: '首页加载失败', icon: 'none' })
  }
}

async function loadGuessProducts() {
  if (guessLoading.value || guessFinished.value) return
  guessLoading.value = true
  try {
    const data = await getGuessProducts({ page: guessPage.value, pageSize: 10 })
    guessProducts.value.push(...data.list)
    guessFinished.value = guessProducts.value.length >= data.total
    guessPage.value++
  } catch {
    uni.showToast({ title: '推荐加载失败', icon: 'none' })
  } finally {
    guessLoading.value = false
  }
}

function goSearch() {
  uni.navigateTo({ url: '/pages/search/index' })
}

function handleBannerTap(banner: BannerItem) {
  if (banner.linkType === 1) {
    uni.navigateTo({ url: `/pages/product/detail?id=${banner.linkValue}` })
  } else if (banner.linkType === 2) {
    uni.navigateTo({ url: `/pages/activity/detail?id=${banner.linkValue}` })
  }
}

function handleEntryTap(entry: QuickEntry) {
  const routes: Record<string, string> = {
    'gift': '/pages/coupon/center',
    'discount': '/pages/activity/index',
    'points': '/pages/points/index',
    'member': '/pages/member/index'
  }
  const url = routes[entry.linkValue]
  if (url) uni.navigateTo({ url })
}

function goProductList(sort: string) {
  uni.navigateTo({ url: `/pages/product/list?sort=${sort}` })
}

function goActivityList() {
  uni.switchTab({ url: '/pages/activity/index' })
}

function goActivityDetail(id: number) {
  uni.navigateTo({ url: `/pages/activity/detail?id=${id}` })
}

onPullDownRefresh(async () => {
  guessPage.value = 1
  guessFinished.value = false
  guessProducts.value = []
  await Promise.all([loadHomeData(), loadGuessProducts()])
  uni.stopPullDownRefresh()
})

onReachBottom(() => {
  loadGuessProducts()
})

onMounted(() => {
  loadHomeData()
  loadGuessProducts()
})
</script>

<style lang="scss" scoped>
.home-page {
  padding-bottom: 32rpx;
}

.search-bar {
  padding: $spacing-md $spacing-md $spacing-sm;
  background: transparent;
}

.search-input {
  display: flex;
  align-items: center;
  background: rgba(255, 255, 255, 0.88);
  border-radius: $radius-round;
  padding: 18rpx 26rpx;
  border: 1rpx solid rgba($border-color, 0.86);
  box-shadow: $shadow-sm;
}

.search-icon {
  margin-right: 10rpx;
  font-size: $font-lg;
  color: $primary-color;
}

.search-placeholder {
  font-size: $font-sm;
  color: $text-hint;
}

.banner-swiper {
  height: 340rpx;
  margin: $spacing-sm $spacing-md;
  border-radius: $radius-xxl;
  overflow: hidden;
  box-shadow: $shadow-md;
}

.banner-image {
  width: 100%;
  height: 100%;
}

.quick-entries {
  display: flex;
  justify-content: space-around;
  padding: $spacing-md $spacing-sm;
  background: $bg-white;
  margin: $spacing-sm $spacing-md;
  border-radius: $radius-xl;
  border: 1rpx solid rgba($border-color, 0.72);
  box-shadow: $shadow-sm;
}

.entry-item {
  @include flex-center;
  @include flex-column;
}

.entry-icon {
  width: 88rpx;
  height: 88rpx;
  margin-bottom: 8rpx;
  border-radius: 30rpx;
  background: $primary-soft;
}

.entry-name {
  font-size: $font-xs;
  color: $text-secondary;
}

.section {
  margin-top: $spacing-lg;
}

.section-header {
  @include flex-between;
  padding: 0 $spacing-md;
  margin-bottom: $spacing-md;
}

.section-title {
  font-size: $font-lg;
  font-weight: 800;
  color: $text-color;
}

.section-more {
  font-size: $font-sm;
  color: $primary-dark;
}

.month-scroll {
  white-space: nowrap;
}

.month-list {
  display: inline-flex;
  padding: 0 $spacing-md;
  gap: $spacing-sm;
}

.month-item {
  width: 240rpx;
  flex-shrink: 0;
}

.product-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: $spacing-md;
  padding: 0 $spacing-md;
}

.activity-scroll {
  white-space: nowrap;
}

.activity-list {
  display: inline-flex;
  padding: 0 $spacing-md;
  gap: $spacing-sm;
}

.activity-card {
  width: 500rpx;
  flex-shrink: 0;
  background: $bg-white;
  border-radius: $radius-xl;
  overflow: hidden;
  border: 1rpx solid rgba($border-color, 0.72);
  box-shadow: $shadow-sm;
}

.activity-image {
  width: 100%;
  height: 250rpx;
}

.activity-info {
  padding: $spacing-sm;
}

.activity-name {
  font-size: $font-md;
  color: $text-color;
  @include text-ellipsis;
  display: block;
  margin-bottom: 8rpx;
}

.floating-cs {
  position: fixed;
  right: 24rpx;
  bottom: 200rpx;
  z-index: 100;
  background: $bg-white;
  border-radius: 50%;
  width: 96rpx;
  height: 96rpx;
  box-shadow: $shadow-md;
}
</style>
