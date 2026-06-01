<template>
  <view class="cs-btn" @tap="handleTap">
    <text class="cs-icon">讯</text>
    <text v-if="showText" class="cs-text">{{ text || '客服' }}</text>
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { getCustomerServiceConfig, type CustomerServiceConfig } from '@/api/customer-service'

const props = withDefaults(defineProps<{
  showText?: boolean
  text?: string
}>(), {
  showText: false,
  text: '客服'
})

const config = ref<CustomerServiceConfig>({
  enabled: false,
  type: 'phone',
  phone: '',
  wechatQrCode: '',
  serviceTime: '',
  autoReplyText: '',
  faqContent: '',
  notice: ''
})

async function loadConfig() {
  try {
    config.value = await getCustomerServiceConfig()
  } catch {}
}

function handleTap() {
  uni.navigateTo({ url: '/pages/customer-service/index' })
}

onMounted(() => {
  loadConfig()
})
</script>

<style lang="scss" scoped>
.cs-btn {
  @include flex-center;
  @include flex-column;
  width: 92rpx;
  height: 92rpx;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.94);
  border: 1rpx solid rgba($border-color, 0.78);
  box-shadow: $shadow-md;
}

.cs-icon {
  font-size: $font-md;
  font-weight: 800;
  color: $primary-dark;
}

.cs-text {
  font-size: $font-xs;
  color: $text-hint;
  margin-top: 4rpx;
}
</style>
