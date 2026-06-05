<template>
  <view class="cs-page page-shell">
    <view v-if="config.notice" class="notice-section card">
      <text class="notice-text">{{ config.notice }}</text>
    </view>

    <view v-if="hasWechatContact || hasPhone || config.serviceTime" class="entry-section card">
      <button v-if="hasWechatContact" class="entry-item contact-entry" open-type="contact">
        <view class="entry-icon-wrap wechat">
          <text class="entry-icon-text">微</text>
        </view>
        <view class="entry-info">
          <text class="entry-name">微信客服</text>
          <text class="entry-desc">点击进入微信客服</text>
        </view>
        <text class="entry-arrow">›</text>
      </button>

      <view v-if="hasPhone" class="entry-item" @tap="handlePhone">
        <view class="entry-icon-wrap phone">
          <text class="entry-icon-text">电</text>
        </view>
        <view class="entry-info">
          <text class="entry-name">电话客服</text>
          <text class="entry-desc">{{ config.phone }}</text>
        </view>
        <text class="entry-arrow">›</text>
      </view>

      <view v-if="config.serviceTime" class="entry-item">
        <view class="entry-icon-wrap time">
          <text class="entry-icon-text">时</text>
        </view>
        <view class="entry-info">
          <text class="entry-name">服务时间</text>
          <text class="entry-desc">{{ config.serviceTime }}</text>
        </view>
      </view>
    </view>

    <view v-if="showUnavailableFallback" class="unavailable-section card">
      <text class="section-title">客服暂不可用</text>
      <text class="unavailable-text">{{ unavailableText }}</text>
    </view>

    <view v-if="hasQrCode" class="qrcode-section card">
      <text class="section-title">微信客服二维码</text>
      <image class="qrcode-image" :src="config.wechatQrCode" mode="widthFix" @tap="previewQrCode" />
      <text class="qrcode-tip">长按识别或截图扫码添加客服</text>
    </view>

    <view v-if="faqList.length" class="faq-section card">
      <text class="section-title">常见问题</text>
      <view v-for="(item, index) in faqList" :key="index" class="faq-item">
        <view class="faq-q" @tap="toggleFaq(index)">
          <text class="faq-q-text">{{ item.question }}</text>
          <text class="faq-arrow" :class="{ expanded: item.expanded }">›</text>
        </view>
        <view v-if="item.expanded" class="faq-a">
          <text class="faq-a-text">{{ item.answer }}</text>
        </view>
      </view>
    </view>

    <view v-if="config.autoReplyText" class="reply-section card">
      <text class="section-title">温馨提示</text>
      <text class="reply-text">{{ config.autoReplyText }}</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { getCustomerServiceConfig, type CustomerServiceConfig } from '@/api/customer-service'

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

interface FaqItem {
  question: string
  answer: string
  expanded: boolean
}

const faqList = ref<FaqItem[]>([])
const normalizedType = computed(() => config.value.type || 'phone')
const allowsWechat = computed(() => normalizedType.value === 'wechat' || normalizedType.value === 'both')
const allowsPhone = computed(() => normalizedType.value === 'phone' || normalizedType.value === 'both')
const hasWechatContact = computed(() => !!config.value.enabled && allowsWechat.value)
const hasPhone = computed(() => !!config.value.enabled && allowsPhone.value && !!config.value.phone)
const hasQrCode = computed(() => !!config.value.enabled && allowsWechat.value && !!config.value.wechatQrCode)
const showUnavailableFallback = computed(() => !hasWechatContact.value && !hasPhone.value && !hasQrCode.value)
const unavailableText = computed(() => config.value.notice || '服务暂不可用，请稍后再试')

async function loadConfig() {
  try {
    config.value = await getCustomerServiceConfig()
    if (config.value.faqContent) {
      try {
        const list = JSON.parse(config.value.faqContent)
        faqList.value = (Array.isArray(list) ? list : []).map((item: any) => ({
          question: item.question || '',
          answer: item.answer || '',
          expanded: false
        }))
      } catch {
        faqList.value = []
      }
    }
  } catch {
    uni.showToast({ title: '加载失败', icon: 'none' })
  }
}

function handlePhone() {
  if (config.value.phone) {
    uni.makePhoneCall({ phoneNumber: config.value.phone })
  }
}

function previewQrCode() {
  uni.previewImage({ urls: [config.value.wechatQrCode] })
}

function toggleFaq(index: number) {
  faqList.value[index].expanded = !faqList.value[index].expanded
}

onMounted(() => {
  loadConfig()
})
</script>

<style lang="scss" scoped>
.cs-page {
  min-height: 100vh;
  padding: $spacing-md;
}

.notice-section {
  background: rgba($warning-color, 0.1);
  border: 1rpx solid rgba($warning-color, 0.18);
  margin-bottom: $spacing-md;
}

.notice-text {
  font-size: $font-sm;
  color: $warning-color;
  line-height: 1.6;
}

.entry-section {
  margin-bottom: $spacing-md;
  border-radius: $radius-xxl;
  background: rgba(255, 255, 255, 0.9);
}

.entry-item {
  @include flex-between;
  padding: $spacing-md 0;
  border-bottom: 1rpx solid $divider-color;
  width: 100%;
  background: transparent;
  border-radius: 0;
  border-left: none;
  border-right: none;
  border-top: none;
  text-align: left;

  &:last-child {
    border-bottom: none;
  }

  &::after {
    border: none;
  }
}

.contact-entry {
  margin: 0;
}

.entry-icon-wrap {
  width: 76rpx;
  height: 76rpx;
  border-radius: 28rpx;
  @include flex-center;
  margin-right: $spacing-md;

  &.wechat { background: rgba(#07C160, 0.1); }
  &.phone { background: rgba($primary-color, 0.1); }
  &.time { background: rgba($info-color, 0.1); }
}

.entry-icon-text {
  font-size: $font-md;
  font-weight: 800;
  color: $text-secondary;
}

.entry-info {
  flex: 1;
}

.entry-name {
  font-size: $font-md;
  color: $text-color;
  font-weight: 700;
  display: block;
}

.entry-desc {
  font-size: $font-xs;
  color: $text-hint;
  margin-top: 4rpx;
  display: block;
}

.entry-arrow {
  font-size: $font-lg;
  color: $text-hint;
}

.qrcode-section {
  @include flex-center;
  @include flex-column;
  margin-bottom: $spacing-md;
  background: rgba(255, 255, 255, 0.9);
}

.unavailable-section {
  margin-bottom: $spacing-md;
  background: rgba(255, 255, 255, 0.9);
}

.unavailable-text {
  font-size: $font-sm;
  color: $text-secondary;
  line-height: 1.7;
}

.section-title {
  font-size: $font-md;
  font-weight: 800;
  color: $text-color;
  display: block;
  margin-bottom: $spacing-md;
}

.qrcode-image {
  width: 360rpx;
  border-radius: $radius-xl;
  box-shadow: $shadow-sm;
}

.qrcode-tip {
  font-size: $font-xs;
  color: $text-hint;
  margin-top: $spacing-sm;
}

.faq-section {
  margin-bottom: $spacing-md;
  background: rgba(255, 255, 255, 0.9);
}

.faq-item {
  border-bottom: 1rpx solid $divider-color;

  &:last-child {
    border-bottom: none;
  }
}

.faq-q {
  @include flex-between;
  padding: $spacing-md 0;
}

.faq-q-text {
  font-size: $font-md;
  color: $text-color;
  font-weight: 600;
  flex: 1;
}

.faq-arrow {
  font-size: $font-lg;
  color: $text-hint;
  transition: transform 0.2s;

  &.expanded {
    transform: rotate(90deg);
  }
}

.faq-a {
  padding-bottom: $spacing-md;
}

.faq-a-text {
  font-size: $font-sm;
  color: $text-secondary;
  line-height: 1.8;
}

.reply-section {
  margin-bottom: $spacing-md;
  background: $gradient-sage;
}

.reply-text {
  font-size: $font-sm;
  color: $text-secondary;
  line-height: 1.8;
}
</style>
