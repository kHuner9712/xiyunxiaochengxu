<template>
  <view class="pickup-store-page">
    <view v-for="store in storeList" :key="store.id" class="store-card card" @tap="selectStore(store)">
      <view class="store-name">{{ store.name }}</view>
      <view class="store-address">{{ store.fullAddress }}</view>
      <view v-if="store.businessHours" class="store-hours">营业时间：{{ store.businessHours }}</view>
      <view v-if="store.contactPhone" class="store-phone" @tap.stop="callPhone(store.contactPhone)">
        <text class="phone-text">{{ store.contactPhone }}</text>
      </view>
    </view>
    <Loading v-if="loading" />
    <Empty v-if="!loading && storeList.length === 0" text="暂无自提点" />
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { onLoad, onReachBottom } from '@dcloudio/uni-app'
import { getPickupStoreList, type PickupStoreItem } from '@/api/pickup-store'
import Loading from '@/components/Loading.vue'
import Empty from '@/components/Empty.vue'

const storeList = ref<PickupStoreItem[]>([])
const loading = ref(false)
const page = ref(1)
const finished = ref(false)
let selectMode = false
let eventChannel: any = null

async function loadStores(reset = false) {
  if (loading.value) return
  if (!reset && finished.value) return
  if (reset) {
    page.value = 1
    finished.value = false
    storeList.value = []
  }
  loading.value = true
  try {
    const data = await getPickupStoreList({ page: page.value, pageSize: 20 })
    storeList.value.push(...data.list)
    finished.value = storeList.value.length >= data.total
    page.value++
  } catch {
    uni.showToast({ title: '加载失败', icon: 'none' })
  } finally {
    loading.value = false
  }
}

function selectStore(store: PickupStoreItem) {
  if (!selectMode) return
  eventChannel?.emit('selectStore', store)
  uni.navigateBack()
}

function callPhone(phone: string) {
  uni.makePhoneCall({ phoneNumber: phone })
}

onLoad((options) => {
  selectMode = options?.select === 'true'
  const pages = getCurrentPages()
  const currentPage = pages[pages.length - 1]
  eventChannel = (currentPage as any).getOpenerEventChannel?.()
  loadStores()
})

onReachBottom(() => loadStores())
</script>

<style lang="scss" scoped>
.pickup-store-page {
  min-height: 100vh;
  background: $bg-color;
  padding: $spacing-sm $spacing-md;
}

.store-card {
  margin-bottom: $spacing-sm;
}

.store-name {
  font-size: $font-md;
  font-weight: 600;
  color: $text-color;
  margin-bottom: 8rpx;
}

.store-address {
  font-size: $font-sm;
  color: $text-secondary;
  margin-bottom: 4rpx;
}

.store-hours {
  font-size: $font-xs;
  color: $text-hint;
  margin-bottom: 4rpx;
}

.phone-text {
  font-size: $font-sm;
  color: $primary-color;
}
</style>
