<template>
  <view class="category-page">
    <scroll-view scroll-y class="category-left">
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
      <view v-if="currentChildren.length" class="sub-categories">
        <view v-for="sub in currentChildren" :key="sub.id" class="sub-category" @tap="goProductList(sub.id)">
          <image class="sub-icon" :src="sub.icon" mode="aspectFit" />
          <text class="sub-name">{{ sub.name }}</text>
        </view>
      </view>
      <Empty v-else text="暂无分类" />
    </scroll-view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { getCategoryTree, type CategoryItem } from '@/api/category'
import Empty from '@/components/Empty.vue'

const categories = ref<CategoryItem[]>([])
const currentCategoryId = ref(0)

const currentChildren = computed(() => {
  const current = categories.value.find(c => c.id === currentCategoryId.value)
  return current?.children || []
})

async function loadCategories() {
  try {
    const data = await getCategoryTree()
    categories.value = data
    if (data.length) {
      currentCategoryId.value = data[0].id
    }
  } catch {
    uni.showToast({ title: '分类加载失败', icon: 'none' })
  }
}

function selectCategory(item: CategoryItem) {
  currentCategoryId.value = item.id
}

function goProductList(categoryId: number) {
  uni.navigateTo({ url: `/pages/product/list?categoryId=${categoryId}` })
}

onMounted(() => {
  loadCategories()
})
</script>

<style lang="scss" scoped>
.category-page {
  display: flex;
  height: 100vh;
}

.category-left {
  width: 180rpx;
  background: $bg-gray;
  height: 100%;
}

.category-item {
  @include flex-center;
  padding: 32rpx 16rpx;
  position: relative;

  &.active {
    background: $bg-white;

    &::before {
      content: '';
      position: absolute;
      left: 0;
      top: 50%;
      transform: translateY(-50%);
      width: 6rpx;
      height: 40rpx;
      background: $primary-color;
      border-radius: 0 3rpx 3rpx 0;
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
}

.category-right {
  flex: 1;
  padding: $spacing-md;
  height: 100%;
}

.sub-categories {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: $spacing-md;
}

.sub-category {
  @include flex-center;
  @include flex-column;
}

.sub-icon {
  width: 100rpx;
  height: 100rpx;
  margin-bottom: 8rpx;
}

.sub-name {
  font-size: $font-sm;
  color: $text-secondary;
  text-align: center;
}
</style>
