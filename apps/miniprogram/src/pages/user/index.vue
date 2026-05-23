<template>
  <view class="user-page">
    <view class="user-header">
      <view class="user-info" @tap="goProfile">
        <image class="user-avatar" :src="userStore.avatar || '/static/default-avatar.png'" mode="aspectFill" />
        <view class="user-detail">
          <text class="user-name">{{ userStore.nickname }}</text>
          <view class="member-badge" @tap.stop="goMember">
            <text class="member-text">{{ userStore.memberLevelName }}</text>
          </view>
        </view>
      </view>
      <view v-if="!userStore.isLoggedIn" class="login-btn" @tap="handleLogin">
        <text class="login-text">点击登录</text>
      </view>
    </view>

    <view class="order-section card">
      <view class="section-header">
        <text class="section-title">我的订单</text>
        <text class="section-more" @tap="goOrderList()">全部订单 ›</text>
      </view>
      <view class="order-shortcuts">
        <view class="shortcut-item" @tap="goOrderList(10)">
          <view class="shortcut-icon">💰</view>
          <text class="shortcut-text">待付款</text>
          <view v-if="orderCount.unpaid" class="shortcut-badge">{{ orderCount.unpaid }}</view>
        </view>
        <view class="shortcut-item" @tap="goOrderList(20)">
          <view class="shortcut-icon">📦</view>
          <text class="shortcut-text">待发货</text>
          <view v-if="orderCount.unshipped" class="shortcut-badge">{{ orderCount.unshipped }}</view>
        </view>
        <view class="shortcut-item" @tap="goOrderList(30)">
          <view class="shortcut-icon">🚚</view>
          <text class="shortcut-text">待收货</text>
          <view v-if="orderCount.unreceived" class="shortcut-badge">{{ orderCount.unreceived }}</view>
        </view>
        <view class="shortcut-item" @tap="goOrderList(60)">
          <view class="shortcut-icon">🔄</view>
          <text class="shortcut-text">售后</text>
          <view v-if="orderCount.aftersale" class="shortcut-badge">{{ orderCount.aftersale }}</view>
        </view>
      </view>
    </view>

    <view class="menu-section card">
      <view class="menu-item" @tap="navigateTo('/pages/coupon/my')">
        <text class="menu-text">我的优惠券</text>
        <text class="menu-arrow">›</text>
      </view>
      <view class="menu-item" @tap="navigateTo('/pages/points/index')">
        <text class="menu-text">积分中心</text>
        <text class="menu-arrow">›</text>
      </view>
      <view class="menu-item" @tap="navigateTo('/pages/member/index')">
        <text class="menu-text">会员中心</text>
        <text class="menu-arrow">›</text>
      </view>
      <view class="menu-item" @tap="navigateTo('/pages/baby/list')">
        <text class="menu-text">宝宝档案</text>
        <text class="menu-arrow">›</text>
      </view>
      <view class="menu-item" @tap="navigateTo('/pages/address/list')">
        <text class="menu-text">地址管理</text>
        <text class="menu-arrow">›</text>
      </view>
      <view class="menu-item" @tap="navigateTo('/pages/content/list')">
        <text class="menu-text">育儿知识</text>
        <text class="menu-arrow">›</text>
      </view>
    </view>

    <view v-if="userStore.isLoggedIn" class="logout-btn" @tap="handleLogout">
      <text class="logout-text">退出登录</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { useUserStore } from '@/stores/user'
import { getOrderCount } from '@/api/order'

const userStore = useUserStore()
const orderCount = ref({
  unpaid: 0,
  unshipped: 0,
  unreceived: 0,
  aftersale: 0
})

async function loadOrderCount() {
  if (!userStore.isLoggedIn) return
  try {
    const data = await getOrderCount()
    orderCount.value = data
  } catch {
    uni.showToast({ title: '订单数量加载失败', icon: 'none' })
  }
}

function handleLogin() {
  userStore.wxLogin().catch((err: any) => {
    console.error('[baby-mall] wxLogin failed:', err)
    uni.showModal({
      title: '登录失败',
      content: '登录失败，请稍后重试。当前为演示版，你可以先浏览公开演示内容。',
      showCancel: false,
      confirmText: '我知道了'
    })
  })
}

function handleLogout() {
  uni.showModal({
    title: '提示',
    content: '确定退出登录吗？',
    success: (res) => {
      if (res.confirm) userStore.logout()
    }
  })
}

function goProfile() {
  if (!userStore.isLoggedIn) return
  uni.navigateTo({ url: '/pages/user/profile' })
}

function goMember() {
  smartNavigate('/pages/member/index', { allowDemo: true })
}

function goOrderList(status?: number) {
  if (!userStore.isLoggedIn) {
    showLoginRequired()
    return
  }
  const url = status ? `/pages/order/list?status=${status}` : '/pages/order/list'
  console.log('[baby-mall] navigateTo:', url)
  uni.navigateTo({
    url,
    fail: (err) => {
      console.error('[baby-mall] navigateTo failed:', url, err)
      uni.showToast({ title: '页面跳转失败', icon: 'none' })
    }
  })
}

interface NavOptions {
  requireLogin?: boolean
  allowDemo?: boolean
}

function smartNavigate(url: string, options: NavOptions = {}) {
  const { requireLogin = false, allowDemo = false } = options
  console.log('[baby-mall] smartNavigate:', url, options)

  if (!userStore.isLoggedIn) {
    if (allowDemo) {
      const separator = url.includes('?') ? '&' : '?'
      const fullUrl = `${url}${separator}demo=1`
      uni.navigateTo({
        url: fullUrl,
        fail: (err) => {
          console.error('[baby-mall] navigateTo failed:', fullUrl, err)
          uni.showToast({ title: '页面跳转失败', icon: 'none' })
        }
      })
      return
    }
    if (requireLogin) {
      showLoginRequired()
      return
    }
    showLoginRequired()
    return
  }

  uni.navigateTo({
    url,
    fail: (err) => {
      console.error('[baby-mall] navigateTo failed:', url, err)
      uni.showToast({ title: '页面跳转失败', icon: 'none' })
    }
  })
}

function showLoginRequired() {
  uni.showModal({
    title: '需要登录',
    content: '该功能需要登录后使用。当前为演示版，你也可以先浏览公开演示内容。',
    cancelText: '取消',
    confirmText: '去登录',
    success: (res) => {
      if (res.confirm) {
        handleLogin()
      }
    }
  })
}

function navigateTo(url: string) {
  const demoPages = ['/pages/coupon/my', '/pages/coupon/center', '/pages/member/index', '/pages/points/index', '/pages/content/list']
  const loginRequiredPages = ['/pages/baby/list', '/pages/address/list']

  if (demoPages.some(p => url.startsWith(p))) {
    smartNavigate(url, { allowDemo: true })
  } else if (loginRequiredPages.some(p => url.startsWith(p))) {
    smartNavigate(url, { requireLogin: true })
  } else {
    smartNavigate(url)
  }
}

onShow(() => {
  loadOrderCount()
})
</script>

<style lang="scss" scoped>
.user-page {
  min-height: 100vh;
  background: $bg-color;
}

.user-header {
  background: linear-gradient(135deg, $primary-color, $primary-light);
  padding: 60rpx $spacing-md 40rpx;
}

.user-info {
  display: flex;
  align-items: center;
}

.user-avatar {
  width: 120rpx;
  height: 120rpx;
  border-radius: 50%;
  border: 4rpx solid rgba(255, 255, 255, 0.5);
}

.user-detail {
  margin-left: $spacing-md;
}

.user-name {
  font-size: $font-xl;
  color: #FFFFFF;
  font-weight: 600;
  display: block;
}

.member-badge {
  display: inline-flex;
  background: rgba(255, 255, 255, 0.2);
  border-radius: $radius-round;
  padding: 4rpx 16rpx;
  margin-top: 8rpx;
}

.member-text {
  font-size: $font-xs;
  color: #FFFFFF;
}

.login-btn {
  margin-top: $spacing-md;
  background: rgba(255, 255, 255, 0.2);
  border-radius: $radius-round;
  padding: 16rpx 48rpx;
  display: inline-flex;
}

.login-text {
  color: #FFFFFF;
  font-size: $font-md;
}

.order-section {
  margin: -20rpx $spacing-md $spacing-md;
  position: relative;
}

.section-header {
  @include flex-between;
  margin-bottom: $spacing-md;
}

.section-title {
  font-size: $font-md;
  font-weight: 600;
  color: $text-color;
}

.section-more {
  font-size: $font-sm;
  color: $text-hint;
}

.order-shortcuts {
  display: flex;
  justify-content: space-around;
}

.shortcut-item {
  @include flex-center;
  @include flex-column;
  position: relative;
}

.shortcut-icon {
  font-size: 48rpx;
  margin-bottom: 8rpx;
}

.shortcut-text {
  font-size: $font-xs;
  color: $text-secondary;
}

.shortcut-badge {
  position: absolute;
  top: -8rpx;
  right: -16rpx;
  background: $danger-color;
  color: #FFFFFF;
  font-size: 20rpx;
  min-width: 32rpx;
  height: 32rpx;
  border-radius: 16rpx;
  @include flex-center;
  padding: 0 8rpx;
}

.menu-section {
  margin: 0 $spacing-md $spacing-md;
}

.menu-item {
  @include flex-between;
  padding: $spacing-md 0;
  border-bottom: 1rpx solid $divider-color;

  &:last-child {
    border-bottom: none;
  }
}

.menu-text {
  font-size: $font-md;
  color: $text-color;
}

.menu-arrow {
  font-size: $font-md;
  color: $text-hint;
}

.logout-btn {
  margin: $spacing-xl $spacing-md;
  padding: 24rpx;
  text-align: center;
  background: $bg-white;
  border-radius: $radius-lg;
}

.logout-text {
  font-size: $font-md;
  color: $danger-color;
}
</style>
