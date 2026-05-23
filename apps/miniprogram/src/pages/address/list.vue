<template>
  <view class="address-list-page">
    <view class="address-list">
      <view v-for="item in addresses" :key="item.id" class="address-card card" @tap="handleSelect(item)">
        <view class="address-info">
          <view class="address-top">
            <text class="address-name">{{ item.name }}</text>
            <text class="address-phone">{{ item.phone }}</text>
            <view v-if="item.isDefault" class="default-tag">默认</view>
          </view>
          <text class="address-detail">{{ item.province }}{{ item.city }}{{ item.district }}{{ item.detail }}</text>
        </view>
        <view class="address-actions">
          <view class="action-item" @tap.stop="setDefault(item)" v-if="!item.isDefault">
            <text class="action-text">设为默认</text>
          </view>
          <view class="action-item" @tap.stop="editAddress(item)">
            <text class="action-text">编辑</text>
          </view>
          <view class="action-item" @tap.stop="deleteAddress(item)">
            <text class="action-text delete">删除</text>
          </view>
        </view>
      </view>
    </view>

    <Empty v-if="!loading && addresses.length === 0" text="暂无收货地址" actionText="新增地址" @action="addAddress" />

    <view class="bottom-bar">
      <view class="add-btn" @tap="addAddress">
        <text class="add-text">新增收货地址</text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { onLoad, onShow } from '@dcloudio/uni-app'
import { getAddressList, deleteAddress as deleteAddressApi, setDefaultAddress, type AddressItem } from '@/api/address'
import Empty from '@/components/Empty.vue'

const addresses = ref<AddressItem[]>([])
const loading = ref(false)
const isSelectMode = ref(false)

async function loadAddresses() {
  loading.value = true
  try {
    addresses.value = await getAddressList()
  } catch {
    uni.showToast({ title: '地址加载失败', icon: 'none' })
  } finally {
    loading.value = false
  }
}

function handleSelect(item: AddressItem) {
  if (!isSelectMode.value) return
  const pages = getCurrentPages()
  const prevPage = pages[pages.length - 2] as any
  if (prevPage?.$vm?.selectAddressCallback) {
    prevPage.$vm.selectAddressCallback(item)
  }
  uni.navigateBack()
}

function addAddress() {
  uni.navigateTo({ url: '/pages/address/edit' })
}

function editAddress(item: AddressItem) {
  uni.navigateTo({ url: `/pages/address/edit?id=${item.id}` })
}

async function setDefault(item: AddressItem) {
  try {
    await setDefaultAddress(item.id)
    await loadAddresses()
  } catch {
    uni.showToast({ title: '设置失败', icon: 'none' })
  }
}

async function deleteAddress(item: AddressItem) {
  uni.showModal({
    title: '提示',
    content: '确定删除该地址吗？',
    success: async (res) => {
      if (res.confirm) {
        try {
          await deleteAddressApi(item.id)
          await loadAddresses()
        } catch {
          uni.showToast({ title: '删除失败', icon: 'none' })
        }
      }
    }
  })
}

onLoad((options) => {
  if (options?.select) isSelectMode.value = true
})

onShow(() => {
  loadAddresses()
})
</script>

<style lang="scss" scoped>
.address-list-page {
  min-height: 100vh;
  background: $bg-color;
  padding-bottom: 120rpx;
}

.address-card {
  margin: $spacing-sm $spacing-md;
}

.address-info {
  padding-bottom: $spacing-sm;
  border-bottom: 1rpx solid $divider-color;
}

.address-top {
  display: flex;
  align-items: center;
  margin-bottom: 8rpx;
}

.address-name {
  font-size: $font-md;
  font-weight: 600;
  margin-right: $spacing-sm;
}

.address-phone {
  font-size: $font-sm;
  color: $text-secondary;
  margin-right: $spacing-sm;
}

.default-tag {
  background: rgba($primary-color, 0.1);
  color: $primary-color;
  font-size: $font-xs;
  padding: 2rpx 12rpx;
  border-radius: $radius-sm;
}

.address-detail {
  font-size: $font-sm;
  color: $text-secondary;
  line-height: 1.5;
}

.address-actions {
  display: flex;
  justify-content: flex-end;
  gap: $spacing-lg;
  padding-top: $spacing-sm;
}

.action-item {
  padding: 4rpx 0;
}

.action-text {
  font-size: $font-sm;
  color: $text-secondary;

  &.delete { color: $danger-color; }
}

.bottom-bar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  padding: $spacing-sm $spacing-md;
  background: $bg-white;
  @include safe-bottom;
}

.add-btn {
  background: linear-gradient(135deg, $primary-color, $primary-light);
  border-radius: $radius-round;
  padding: 24rpx 0;
  text-align: center;
}

.add-text {
  color: #FFFFFF;
  font-size: $font-md;
  font-weight: 500;
}
</style>
