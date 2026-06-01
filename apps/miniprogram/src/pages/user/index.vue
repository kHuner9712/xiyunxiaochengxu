<template>
  <view class="user-page page-shell">
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
      <view v-if="!userStore.isLoggedIn" class="login-agreement">
        <text class="agreement-prefix">登录即视为同意</text>
        <text class="agreement-link" @tap.stop="openPolicy('/pages/agreement/index')">《用户协议》</text>
        <text class="agreement-prefix">与</text>
        <text class="agreement-link" @tap.stop="openPolicy('/pages/privacy/index')">《隐私政策》</text>
      </view>
    </view>

    <view class="order-section card">
      <view class="section-header">
        <text class="section-title">我的订单</text>
        <text class="section-more" @tap="goOrderList()">全部订单 ›</text>
      </view>
      <view class="order-shortcuts">
        <view class="shortcut-item" @tap="goOrderList('pending_payment')">
          <view class="shortcut-icon">付</view>
          <text class="shortcut-text">待付款</text>
          <view v-if="orderCount.unpaid" class="shortcut-badge">{{ orderCount.unpaid }}</view>
        </view>
        <view class="shortcut-item" @tap="goOrderList('pending_delivery')">
          <view class="shortcut-icon">发</view>
          <text class="shortcut-text">待发货</text>
          <view v-if="orderCount.unshipped" class="shortcut-badge">{{ orderCount.unshipped }}</view>
        </view>
        <view class="shortcut-item" @tap="goOrderList('pending_pickup')">
          <view class="shortcut-icon">提</view>
          <text class="shortcut-text">待自提</text>
          <view v-if="orderCount.pendingPickup" class="shortcut-badge">{{ orderCount.pendingPickup }}</view>
        </view>
        <view class="shortcut-item" @tap="goOrderList('delivered')">
          <view class="shortcut-icon">收</view>
          <text class="shortcut-text">待收货</text>
          <view v-if="orderCount.unreceived" class="shortcut-badge">{{ orderCount.unreceived }}</view>
        </view>
        <view class="shortcut-item" @tap="goOrderList('aftersale')">
          <view class="shortcut-icon">售</view>
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
      <view class="menu-item" @tap="navigateTo('/pages/share/invite')">
        <text class="menu-text">邀请好友</text>
        <text class="menu-arrow">›</text>
      </view>
      <view class="menu-item" @tap="navigateTo('/pages/customer-service/index')">
        <text class="menu-text">客服与帮助</text>
        <text class="menu-arrow">›</text>
      </view>
      <view class="menu-item" @tap="navigateTo('/pages/agreement/index')">
        <text class="menu-text">用户协议</text>
        <text class="menu-arrow">›</text>
      </view>
      <view class="menu-item" @tap="navigateTo('/pages/privacy/index')">
        <text class="menu-text">隐私政策</text>
        <text class="menu-arrow">›</text>
      </view>
      <view class="menu-item" @tap="navigateTo('/pages/food-safety/index')">
        <text class="menu-text">食品安全与售后</text>
        <text class="menu-arrow">›</text>
      </view>
    </view>

    <view v-if="userStore.isLoggedIn" class="logout-btn" @tap="handleLogout">
      <text class="logout-text">退出登录</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { useUserStore } from '@/stores/user'
import { getOrderCount, normalizeOrderStatus, type OrderCount, type OrderStatus } from '@/api/order'

const userStore = useUserStore()
const orderCount = ref<OrderCount>({
  unpaid: 0,
  unshipped: 0,
  pendingPickup: 0,
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
      content: '登录失败，请稍后重试。',
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
  smartNavigate('/pages/member/index', { requireLogin: true })
}

function goOrderList(status?: OrderStatus | number) {
  if (!userStore.isLoggedIn) {
    showLoginRequired()
    return
  }
  const normalizedStatus = normalizeOrderStatus(status)
  const url = normalizedStatus ? `/pages/order/list?status=${normalizedStatus}` : '/pages/order/list'
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
}

function smartNavigate(url: string, options: NavOptions = {}) {
  const { requireLogin = false } = options

  if (!userStore.isLoggedIn) {
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
    content: '请先登录后使用',
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
  const publicPages = ['/pages/customer-service/index', '/pages/agreement/index', '/pages/privacy/index', '/pages/food-safety/index']
  const loginRequiredPages = ['/pages/baby/list', '/pages/address/list', '/pages/coupon/my', '/pages/coupon/center', '/pages/member/index', '/pages/points/index', '/pages/share/invite']

  if (publicPages.some(p => url.startsWith(p))) {
    uni.navigateTo({ url })
  } else if (loginRequiredPages.some(p => url.startsWith(p))) {
    smartNavigate(url, { requireLogin: true })
  } else {
    smartNavigate(url)
  }
}

function openPolicy(url: string) {
  uni.navigateTo({ url })
}

onShow(() => {
  loadOrderCount()
})
</script>

<style lang="scss" scoped>
.user-page {
  min-height: 100vh;
}

.user-header {
  background:
    radial-gradient(circle at 86% 20%, rgba($success-color, 0.18) 0%, rgba($success-color, 0) 220rpx),
    $gradient-peach;
  padding: 68rpx $spacing-md 58rpx;
  border-radius: 0 0 $radius-xxl $radius-xxl;
}

.user-info {
  display: flex;
  align-items: center;
}

.user-avatar {
  width: 120rpx;
  height: 120rpx;
  border-radius: 50%;
  border: 4rpx solid rgba(255, 255, 255, 0.9);
  box-shadow: $shadow-sm;
}

.user-detail {
  margin-left: $spacing-md;
}

.user-name {
  font-size: $font-xl;
  color: $text-color;
  font-weight: 800;
  display: block;
}

.member-badge {
  display: inline-flex;
  background: rgba($primary-color, 0.12);
  border-radius: $radius-round;
  padding: 4rpx 16rpx;
  margin-top: 8rpx;
}

.member-text {
  font-size: $font-xs;
  color: $primary-dark;
}

.login-btn {
  margin-top: $spacing-md;
  background: #FFFFFF;
  border-radius: $radius-round;
  padding: 16rpx 48rpx;
  display: inline-flex;
  box-shadow: $shadow-sm;
}

.login-text {
  color: $primary-dark;
  font-size: $font-md;
}

.login-agreement {
  margin-top: $spacing-sm;
}

.agreement-prefix {
  color: $text-secondary;
  font-size: $font-xs;
}

.agreement-link {
  color: $primary-dark;
  font-size: $font-xs;
  text-decoration: underline;
  margin: 0 6rpx;
}

.order-section {
  margin: -20rpx $spacing-md $spacing-md;
  position: relative;
  background: rgba(255, 255, 255, 0.92);
}

.section-header {
  @include flex-between;
  margin-bottom: $spacing-md;
}

.section-title {
  font-size: $font-md;
  font-weight: 800;
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
  width: 68rpx;
  height: 68rpx;
  border-radius: 26rpx;
  @include flex-center;
  background: $primary-soft;
  color: $primary-dark;
  font-size: $font-md;
  font-weight: 800;
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
  background: rgba(255, 255, 255, 0.9);
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
  background: rgba($danger-color, 0.08);
  border-radius: $radius-round;
}

.logout-text {
  font-size: $font-md;
  color: $danger-color;
}
</style>
