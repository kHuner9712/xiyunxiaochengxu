<template>
  <view class="activity-detail-page">
    <image class="activity-banner" :src="activity.image" mode="aspectFill" />

    <view class="activity-info card">
      <text class="activity-name">{{ activity.name }}</text>
      <view class="activity-meta">
        <CountdownTimer :endTime="activity.endTime" label="距结束" />
      </view>
      <text v-if="activity.description" class="activity-desc">{{ activity.description }}</text>
    </view>

    <view v-if="activity.rules" class="rules-section card">
      <text class="section-title">活动规则</text>
      <text class="rules-content">{{ activity.rules }}</text>
    </view>

    <view class="products-section">
      <text class="section-title">活动商品</text>
      <view class="product-grid">
        <ProductCard v-for="item in products" :key="item.productId" :product="{
          id: item.productId,
          name: item.name,
          image: item.image,
          price: item.activityPrice,
          originalPrice: item.originalPrice,
          sales: 0
        }" />
      </view>
      <Loading v-if="loading" />
      <Empty v-if="!loading && products.length === 0" text="暂无活动商品" />
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { onLoad, onReachBottom, onShareAppMessage } from '@dcloudio/uni-app'
import { getActivityDetail, getActivityProducts, type ActivityDetail, type ActivityProduct } from '@/api/activity'
import ProductCard from '@/components/ProductCard.vue'
import CountdownTimer from '@/components/CountdownTimer.vue'
import Loading from '@/components/Loading.vue'
import Empty from '@/components/Empty.vue'

const activity = ref<ActivityDetail>({
  id: 0, name: '', image: '', description: '', type: 0,
  startTime: 0, endTime: 0, rules: ''
})
const products = ref<ActivityProduct[]>([])
const loading = ref(false)
const page = ref(1)
const finished = ref(false)

async function loadActivity(id: number) {
  try {
    activity.value = await getActivityDetail(id)
  } catch {}
}

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
    const data = await getActivityProducts({ activityId: activity.value.id, page: page.value, pageSize: 10 })
    products.value.push(...data.list)
    finished.value = products.value.length >= data.total
    page.value++
  } catch {} finally {
    loading.value = false
  }
}

onShareAppMessage(() => ({
  title: activity.value.name,
  path: `/pages/activity/detail?id=${activity.value.id}`
}))

onLoad((options) => {
  if (options?.id) {
    const id = Number(options.id)
    loadActivity(id)
  }
})

onReachBottom(() => {
  loadProducts()
})

onMounted(() => {
  if (activity.value.id) loadProducts()
})
</script>

<style lang="scss" scoped>
.activity-detail-page {
  min-height: 100vh;
  background: $bg-color;
  padding-bottom: 40rpx;
}

.activity-banner {
  width: 100%;
  height: 400rpx;
}

.activity-info {
  margin: $spacing-sm $spacing-md;
}

.activity-name {
  font-size: $font-xl;
  font-weight: 600;
  color: $text-color;
  display: block;
  margin-bottom: $spacing-sm;
}

.activity-meta {
  margin-bottom: $spacing-sm;
}

.activity-desc {
  font-size: $font-sm;
  color: $text-secondary;
  line-height: 1.6;
}

.rules-section {
  margin: $spacing-sm $spacing-md;
}

.section-title {
  font-size: $font-lg;
  font-weight: 600;
  color: $text-color;
  display: block;
  margin-bottom: $spacing-sm;
}

.rules-content {
  font-size: $font-sm;
  color: $text-secondary;
  line-height: 1.6;
}

.products-section {
  padding: 0 $spacing-md;
  margin-top: $spacing-sm;
}

.product-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: $spacing-sm;
}
</style>
