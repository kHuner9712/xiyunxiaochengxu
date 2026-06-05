<template>
  <view class="category-page page-shell">
    <view class="category-top">
      <view class="search-pill" @tap="goSearch">
        <text class="search-icon">⌕</text>
        <text class="search-text">搜索奶粉、纸尿裤、洗护好物</text>
      </view>
      <view class="category-trust">
        <text>自营正品</text>
        <text>严选母婴</text>
        <text>安心售后</text>
      </view>
    </view>

    <view class="category-body">
      <scroll-view scroll-y class="category-left">
        <view class="category-brand">
          <text class="brand-text">优选</text>
          <text class="brand-sub">分类</text>
        </view>
        <view
          v-for="item in categories"
          :key="item.id"
          class="category-item"
          :class="{ active: currentCategoryId === item.id }"
          @tap="selectCategory(item)"
        >
          <text class="category-name">{{ item.name }}</text>
        </view>
      </scroll-view>

      <scroll-view scroll-y class="category-right">
        <view class="category-panel">
          <view class="panel-head">
            <view>
              <text class="panel-title">{{ currentCategoryName }}</text>
              <text class="panel-subtitle">按宝宝和妈妈所需挑选安心好物</text>
            </view>
            <text class="panel-badge">精选</text>
          </view>

          <view v-if="currentChildren.length" class="sub-categories">
            <view v-for="sub in currentChildren" :key="sub.id" class="sub-category" @tap="goProductList(sub.id)">
              <view class="sub-icon-wrap">
                <image class="sub-icon" :src="sub.icon" mode="aspectFit" />
              </view>
              <text class="sub-name">{{ sub.name }}</text>
            </view>
          </view>
          <Empty v-else text="暂无分类" />
        </view>
      </scroll-view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { getCategoryTree, type CategoryItem } from '@/api/category'
import Empty from '@/components/Empty.vue'

const categories = ref<CategoryItem[]>([])
const currentCategoryId = ref('')

const currentChildren = computed(() => {
  const current = categories.value.find(c => c.id === currentCategoryId.value)
  return current?.children || []
})

const currentCategoryName = computed(() => {
  const current = categories.value.find(c => c.id === currentCategoryId.value)
  return current?.name || '母婴分类'
})

async function loadCategories() {
  try {
    const data = await getCategoryTree()
    categories.value = Array.isArray(data) ? data : []
    const firstWithChildren = categories.value.find(item => item.children?.length)
    const firstCategory = firstWithChildren || categories.value[0]
    if (firstCategory) {
      currentCategoryId.value = firstCategory.id
    } else {
      currentCategoryId.value = ''
    }
  } catch (err) {
    console.error('[baby-mall] loadCategories failed:', err)
    uni.showToast({ title: '分类加载失败', icon: 'none' })
  }
}

function selectCategory(item: CategoryItem) {
  currentCategoryId.value = item.id
}

function goProductList(categoryId: string) {
  uni.navigateTo({ url: `/pages/product/list?categoryId=${categoryId}` })
}

function goSearch() {
  uni.navigateTo({ url: '/pages/search/index' })
}

onMounted(() => {
  loadCategories()
})
</script>

<style lang="scss" scoped>
.category-page {
  min-height: 100vh;
}

.category-top {
  padding: 24rpx $spacing-md 18rpx;
  background:
    radial-gradient(circle at 88% 0%, rgba($success-color, 0.18) 0%, rgba($success-color, 0) 240rpx),
    linear-gradient(180deg, rgba(255, 252, 247, 0.96) 0%, rgba(255, 247, 242, 0.78) 100%);
}

.search-pill {
  display: flex;
  align-items: center;
  min-height: 78rpx;
  padding: 0 24rpx;
  border-radius: $radius-round;
  background: rgba(255, 255, 255, 0.82);
  border: 1rpx solid rgba(255, 255, 255, 0.82);
  box-shadow: $shadow-sm;
}

.search-icon {
  margin-right: 12rpx;
  color: $primary-dark;
  font-size: $font-lg;
  font-weight: 800;
}

.search-text {
  color: $text-hint;
  font-size: $font-sm;
}

.category-trust {
  display: flex;
  align-items: center;
  gap: 10rpx;
  margin-top: 14rpx;

  text {
    min-height: 38rpx;
    padding: 0 16rpx;
    border-radius: $radius-round;
    background: rgba($success-color, 0.11);
    color: $success-dark;
    font-size: $font-xs;
    line-height: 38rpx;
    font-weight: 700;
  }
}

.category-body {
  display: flex;
  height: calc(100vh - 174rpx);
  min-height: 720rpx;
}

.category-left {
  width: 190rpx;
  background: transparent;
  height: 100%;
  padding: $spacing-sm 0 $spacing-md $spacing-md;
}

.category-brand {
  @include flex-center;
  flex-direction: column;
  height: 92rpx;
  margin: 0 10rpx $spacing-sm 0;
  border-radius: 30rpx;
  background: $gradient-coral;
  box-shadow: $shadow-coral;
}

.brand-text {
  color: #FFFFFF;
  font-size: $font-sm;
  font-weight: 800;
}

.brand-sub {
  margin-top: 2rpx;
  color: rgba(255, 255, 255, 0.82);
  font-size: 18rpx;
}

.category-item {
  @include flex-center;
  min-height: 90rpx;
  padding: 0 14rpx;
  margin: 0 10rpx 12rpx 0;
  position: relative;
  border-radius: 30rpx;
  background: rgba(255, 255, 255, 0.48);
  border: 1rpx solid rgba($border-color, 0.42);

  &.active {
    background: $primary-soft;
    box-shadow: $shadow-sm;
    border: 1rpx solid rgba($primary-color, 0.2);

    &::before {
      content: '';
      position: absolute;
      left: 8rpx;
      top: 50%;
      transform: translateY(-50%);
      width: 8rpx;
      height: 36rpx;
      background: $gradient-coral;
      border-radius: $radius-round;
    }

    .category-name {
      color: $primary-color;
      font-weight: 600;
    }
  }
}

.category-name {
  font-size: $font-sm;
  color: $text-secondary;
  text-align: center;
  @include text-ellipsis;
}

.category-right {
  flex: 1;
  padding: $spacing-sm $spacing-md $spacing-md $spacing-sm;
  height: 100%;
}

.category-panel {
  min-height: 100%;
  padding: $spacing-md;
  border-radius: $radius-xxl;
  background: rgba(255, 255, 255, 0.74);
  border: 1rpx solid rgba(255, 255, 255, 0.78);
  box-shadow: $shadow-sm;
}

.panel-head {
  @include flex-between;
  align-items: flex-start;
  margin-bottom: $spacing-md;
}

.panel-title {
  display: block;
  font-size: $font-lg;
  color: $text-color;
  font-weight: 900;
}

.panel-subtitle {
  display: block;
  margin-top: 8rpx;
  color: $text-hint;
  font-size: $font-xs;
}

.panel-badge {
  flex-shrink: 0;
  min-height: 38rpx;
  padding: 0 16rpx;
  border-radius: $radius-round;
  background: $secondary-soft;
  color: $secondary-color;
  font-size: $font-xs;
  line-height: 38rpx;
  font-weight: 800;
}

.sub-categories {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 18rpx;
}

.sub-category {
  @include flex-center;
  @include flex-column;
  min-height: 190rpx;
  background: $gradient-card;
  border-radius: 30rpx;
  border: 1rpx solid rgba($border-color, 0.68);
  box-shadow: $shadow-xs;
  padding: 14rpx 10rpx;
}

.sub-icon-wrap {
  @include flex-center;
  width: 104rpx;
  height: 104rpx;
  border-radius: 36rpx;
  background: linear-gradient(135deg, $primary-soft, $secondary-soft);
  margin-bottom: 12rpx;
  overflow: hidden;
}

.sub-icon {
  width: 82rpx;
  height: 82rpx;
}

.sub-name {
  font-size: $font-sm;
  color: $text-secondary;
  text-align: center;
  line-height: 1.35;
  @include text-ellipsis-2;
}
</style>
