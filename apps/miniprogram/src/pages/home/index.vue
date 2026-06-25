<template>
  <view class="home-page page-shell">
    <view class="brand-panel">
      <view class="brand-top">
        <view>
          <text class="brand-title">禧孕优选</text>
          <text class="brand-subtitle">科学育儿 · 品质之选</text>
        </view>
        <view class="brand-badge">
          <text class="brand-badge-text">自营母婴精品</text>
        </view>
      </view>
      <view class="search-bar" @tap="goSearch">
        <view class="search-input">
          <text class="search-icon">⌕</text>
          <text class="search-placeholder">搜索母婴好物</text>
        </view>
      </view>
    </view>

    <view class="hero-card">
      <swiper class="banner-swiper" indicator-dots autoplay circular :interval="4000">
        <swiper-item v-for="banner in homeData.banners" :key="banner.id" @tap="handleBannerTap(banner)">
          <image class="banner-image" :src="banner.image" mode="aspectFill" />
          <view class="banner-mask"></view>
          <view class="banner-copy">
            <text class="banner-kicker">XIYUN SELECT</text>
            <text class="banner-title">安心母婴好物</text>
            <text class="banner-desc">严选品质 · 温柔送达</text>
          </view>
        </swiper-item>
      </swiper>
    </view>

    <view v-if="homeData.announcement" class="home-announcement surface-card">
      <text class="announcement-mark">告</text>
      <text class="announcement-text">{{ homeData.announcement }}</text>
    </view>

    <view class="quick-entries surface-card">
      <view v-for="entry in homeData.quickEntries" :key="entry.id" class="entry-item" @tap="handleEntryTap(entry)">
        <view class="entry-icon-wrap">
          <image class="entry-icon" :src="entry.icon" mode="aspectFit" />
        </view>
        <text class="entry-name">{{ entry.name }}</text>
      </view>
    </view>

    <view class="trust-strip">
      <view class="trust-item">
        <text class="trust-mark">正</text>
        <text class="trust-text">自营正品</text>
      </view>
      <view class="trust-item">
        <text class="trust-mark peach">达</text>
        <text class="trust-text">极速发货</text>
      </view>
      <view class="trust-item">
        <text class="trust-mark sage">护</text>
        <text class="trust-text">贴心售后</text>
      </view>
    </view>

    <view v-if="homeData.monthRecommend.length" class="section">
      <view class="section-header">
        <view>
          <text class="section-title">月龄推荐</text>
          <text class="section-subtitle">按宝宝成长阶段精选</text>
        </view>
      </view>
      <scroll-view scroll-x class="month-scroll">
        <view class="month-list">
          <ProductCard v-for="item in homeData.monthRecommend" :key="item.id" :product="item" class="month-item" />
        </view>
      </scroll-view>
    </view>

    <view v-if="homeData.hotProducts.length" class="section">
      <view class="section-header">
        <view>
          <text class="section-title">热门推荐</text>
          <text class="section-subtitle">妈妈们正在回购</text>
        </view>
        <text class="section-more" @tap="goProductList('hot')">更多 ›</text>
      </view>
      <view class="product-grid">
        <ProductCard v-for="item in homeData.hotProducts" :key="item.id" :product="item" />
      </view>
    </view>

    <view v-if="homeData.newProducts.length" class="section">
      <view class="section-header">
        <view>
          <text class="section-title">新品上架</text>
          <text class="section-subtitle">更适合当季育儿需求</text>
        </view>
        <text class="section-more" @tap="goProductList('new')">更多 ›</text>
      </view>
      <view class="product-grid">
        <ProductCard v-for="item in homeData.newProducts" :key="item.id" :product="item" />
      </view>
    </view>

    <view v-if="homeData.activities.length" class="section">
      <view class="section-header">
        <view>
          <text class="section-title">限时福利</text>
          <text class="section-subtitle">秒杀、会员与新人礼</text>
        </view>
        <text class="section-more" @tap="goActivityList">更多 ›</text>
      </view>
      <scroll-view scroll-x class="activity-scroll">
        <view class="activity-list">
          <view v-for="(act, index) in homeData.activities" :key="act.id" class="activity-card" @tap="goActivityDetail(act.id)">
            <image class="activity-image" :src="act.image" mode="aspectFill" />
            <view class="activity-badge">{{ activityLabels[index % activityLabels.length] }}</view>
            <view class="activity-info">
              <text class="activity-name">{{ act.name }}</text>
              <CountdownTimer :endTime="act.endTime" :showLabel="true" />
            </view>
          </view>
        </view>
      </scroll-view>
    </view>

    <view class="section activity-content-entry-section">
      <view class="activity-content-entry" @tap="goActivityContentList">
        <view class="entry-info">
          <text class="entry-title">活动专区</text>
          <text class="entry-subtitle">图文 · 视频 · 商品推荐</text>
        </view>
        <view class="entry-arrow">
          <text class="entry-arrow-text">进入 ›</text>
        </view>
      </view>
    </view>

    <view class="section">
      <view class="section-header">
        <view>
          <text class="section-title">猜你喜欢</text>
          <text class="section-subtitle">为你的家庭清单继续精选</text>
        </view>
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
const activityLabels = ['限时秒杀', '会员专享', '新人礼包']

onShareAppMessage(() => ({
  title: '禧孕优选 - 品质母婴好物',
  path: `/pages/home/index?inviter=${userStore.userInfo?.id || ''}`
}))

const homeData = reactive<{
  banners: BannerItem[]
  quickEntries: QuickEntry[]
  announcement: string
  monthRecommend: ProductItem[]
  hotProducts: ProductItem[]
  newProducts: ProductItem[]
  activities: ActivityItem[]
}>({
  banners: [],
  quickEntries: [],
  announcement: '',
  monthRecommend: [],
  hotProducts: [],
  newProducts: [],
  activities: []
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
  const url = routes[entry.linkValue] || entry.linkUrl || entry.linkValue
  if (!url) return
  if (['/pages/home/index', '/pages/category/index', '/pages/activity/index', '/pages/cart/index', '/pages/user/index'].includes(url)) {
    uni.switchTab({ url })
  } else if (url.startsWith('/pages/')) {
    uni.navigateTo({ url })
  }
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

function goActivityContentList() {
  uni.navigateTo({ url: '/pages/activity-content/list' })
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
  padding-bottom: 48rpx;
}

.brand-panel {
  padding: 34rpx $spacing-md 18rpx;
}

.brand-top {
  @include flex-between;
  align-items: flex-start;
  margin-bottom: $spacing-md;
}

.brand-title {
  display: block;
  font-size: 52rpx;
  line-height: 1.12;
  font-weight: 900;
  color: $text-color;
}

.brand-subtitle {
  display: block;
  margin-top: 10rpx;
  font-size: $font-sm;
  color: $text-secondary;
}

.brand-badge {
  padding: 12rpx 18rpx;
  border-radius: $radius-round;
  background: rgba($success-color, 0.12);
  border: 1rpx solid rgba($success-color, 0.18);
}

.brand-badge-text {
  font-size: $font-xs;
  color: $success-dark;
  font-weight: 700;
}

.search-bar {
  background: transparent;
}

.search-input {
  display: flex;
  align-items: center;
  min-height: 82rpx;
  background: rgba(255, 255, 255, 0.9);
  border-radius: $radius-round;
  padding: 0 28rpx;
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

.hero-card {
  margin: 0 $spacing-md $spacing-md;
  border-radius: $radius-xxl;
  overflow: hidden;
  box-shadow: $shadow-md;
  border: 1rpx solid rgba(255, 255, 255, 0.78);
  background: $gradient-peach;
}

.banner-swiper {
  height: 356rpx;
}

.banner-image {
  width: 100%;
  height: 100%;
}

.banner-mask {
  position: absolute;
  left: 0;
  top: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(90deg, rgba(58, 48, 44, 0.28) 0%, rgba(58, 48, 44, 0.04) 62%, rgba(58, 48, 44, 0) 100%);
}

.banner-copy {
  position: absolute;
  left: 34rpx;
  bottom: 34rpx;
  display: flex;
  flex-direction: column;
}

.banner-kicker {
  font-size: 18rpx;
  color: rgba(255, 255, 255, 0.86);
  font-weight: 700;
}

.banner-title {
  margin-top: 8rpx;
  font-size: 42rpx;
  color: #FFFFFF;
  font-weight: 900;
  line-height: 1.16;
}

.banner-desc {
  margin-top: 8rpx;
  font-size: $font-sm;
  color: rgba(255, 255, 255, 0.9);
}

.quick-entries {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  row-gap: $spacing-md;
  column-gap: $spacing-xs;
  margin: $spacing-sm $spacing-md;
  padding: $spacing-lg $spacing-sm;
}

.entry-item {
  @include flex-center;
  @include flex-column;
  min-width: 0;
}

.entry-icon-wrap {
  @include flex-center;
  width: 92rpx;
  height: 92rpx;
  margin-bottom: 10rpx;
  border-radius: 34rpx;
  background: linear-gradient(135deg, $primary-soft 0%, $secondary-soft 100%);
  box-shadow: inset 0 -8rpx 18rpx rgba($primary-color, 0.06);
}

.entry-icon {
  width: 58rpx;
  height: 58rpx;
}

.entry-name {
  font-size: $font-xs;
  color: $text-secondary;
  max-width: 126rpx;
  @include text-ellipsis;
}

.trust-strip {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: $spacing-sm;
  margin: $spacing-sm $spacing-md 0;
}

.trust-item {
  @include flex-center;
  min-height: 72rpx;
  border-radius: $radius-round;
  background: rgba(255, 255, 255, 0.78);
  border: 1rpx solid rgba($border-color, 0.74);
  box-shadow: $shadow-xs;
}

.trust-mark {
  @include flex-center;
  width: 36rpx;
  height: 36rpx;
  margin-right: 8rpx;
  border-radius: 50%;
  background: $primary-soft;
  color: $primary-dark;
  font-size: 20rpx;
  font-weight: 800;

  &.peach {
    background: $secondary-soft;
    color: $secondary-color;
  }

  &.sage {
    background: $success-soft;
    color: $success-dark;
  }
}

.trust-text {
  font-size: $font-xs;
  color: $text-secondary;
  font-weight: 700;
}

.section {
  margin-top: 42rpx;
}

.section-header {
  @include flex-between;
  padding: 0 $spacing-md;
  margin-bottom: $spacing-md;
}

.section-title {
  display: block;
  font-size: $font-lg;
  font-weight: 800;
  color: $text-color;
  line-height: 1.2;
}

.section-subtitle {
  display: block;
  margin-top: 8rpx;
  font-size: $font-xs;
  color: $text-hint;
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
  gap: $spacing-md;
}

.month-item {
  width: 252rpx;
  flex-shrink: 0;
}

.product-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 22rpx;
  padding: 0 $spacing-md;
}

.activity-scroll {
  white-space: nowrap;
}

.activity-list {
  display: inline-flex;
  padding: 0 $spacing-md;
  gap: $spacing-md;
}

.activity-card {
  position: relative;
  width: 520rpx;
  flex-shrink: 0;
  background: $gradient-card;
  border-radius: $radius-xxl;
  overflow: hidden;
  border: 1rpx solid rgba($border-color, 0.78);
  box-shadow: $shadow-sm;
}

.activity-image {
  width: 100%;
  height: 238rpx;
}

.activity-badge {
  position: absolute;
  left: 18rpx;
  top: 18rpx;
  padding: 8rpx 18rpx;
  border-radius: $radius-round;
  background: rgba(255, 255, 255, 0.92);
  color: $primary-dark;
  font-size: $font-xs;
  font-weight: 700;
  box-shadow: $shadow-xs;
}

.activity-info {
  padding: $spacing-md;
}

.activity-name {
  font-size: $font-md;
  color: $text-color;
  font-weight: 700;
  @include text-ellipsis;
  display: block;
  margin-bottom: 12rpx;
}

.home-announcement {
  display: flex;
  align-items: center;
  gap: 12rpx;
  margin: $spacing-sm $spacing-md;
  padding: 18rpx 22rpx;
  border-radius: $radius-round;
}

.announcement-mark {
  @include flex-center;
  width: 42rpx;
  height: 42rpx;
  flex-shrink: 0;
  border-radius: 50%;
  background: $primary-soft;
  color: $primary-dark;
  font-size: 22rpx;
  font-weight: 800;
}

.announcement-text {
  flex: 1;
  min-width: 0;
  font-size: $font-xs;
  color: $text-secondary;
  line-height: 1.45;
  @include text-ellipsis;
}

.home-page :deep(.countdown-wrap) {
  min-height: 44rpx;
  padding: 4rpx 8rpx 4rpx 14rpx;
  border-radius: $radius-round;
  background: rgba($primary-color, 0.08);
}

.home-page :deep(.countdown-label) {
  color: $primary-dark;
  font-size: $font-xs;
  font-weight: 700;
}

.home-page :deep(.countdown-block) {
  min-width: 38rpx;
  border-radius: $radius-round;
  background: rgba(255, 255, 255, 0.92);
  box-shadow: $shadow-xs;
}

.home-page :deep(.countdown-num) {
  color: $primary-dark;
  font-size: $font-xs;
  font-weight: 800;
}

.home-page :deep(.countdown-sep) {
  color: $primary-color;
  font-size: $font-xs;
}

.home-page :deep(.countdown-expired) {
  min-height: 40rpx;
  padding: 0 16rpx;
  border-radius: $radius-round;
  background: rgba($bg-gray, 0.86);
  color: $text-hint;
  font-size: $font-xs;
  line-height: 40rpx;
}

.activity-content-entry-section {
  margin-top: 24rpx;
}

.activity-content-entry {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin: 0 $spacing-md;
  padding: 28rpx $spacing-md;
  border-radius: $radius-xxl;
  background:
    radial-gradient(circle at 90% 10%, rgba($secondary-color, 0.16), rgba($secondary-color, 0) 220rpx),
    linear-gradient(135deg, rgba(255, 255, 255, 0.96) 0%, rgba(255, 240, 230, 0.92) 100%);
  border: 1rpx solid rgba($border-color, 0.78);
  box-shadow: $shadow-md;
}

.entry-info {
  flex: 1;
  min-width: 0;
}

.entry-title {
  display: block;
  font-size: $font-lg;
  font-weight: 900;
  color: $text-color;
  line-height: 1.28;
}

.entry-subtitle {
  display: block;
  margin-top: 8rpx;
  font-size: $font-xs;
  color: $text-secondary;
}

.entry-arrow {
  padding: 12rpx 22rpx;
  border-radius: $radius-round;
  background: $gradient-coral;
  box-shadow: $shadow-coral;
  flex-shrink: 0;
}

.entry-arrow-text {
  color: #FFFFFF;
  font-size: $font-sm;
  font-weight: 800;
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
