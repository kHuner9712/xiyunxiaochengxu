<template>
  <view class="user-page page-shell">
    <view class="user-header">
      <view class="header-brand-row">
        <text class="brand-pill">禧孕优选自营</text>
        <text class="brand-copy">安心育儿好物</text>
      </view>
      <view class="user-info" @tap="goProfile">
        <image class="user-avatar" :src="userStore.avatar || '/static/default-avatar.png'" mode="aspectFill" />
        <view class="user-detail">
          <text class="user-name">{{ userStore.isLoggedIn ? userStore.nickname : '欢迎来到禧孕优选' }}</text>
          <view class="member-badge" @tap.stop="goMember">
            <text class="member-text">{{ userStore.isLoggedIn ? userStore.memberLevelName : '登录后查看会员权益' }}</text>
          </view>
        </view>
      </view>
      <view v-if="!userStore.isLoggedIn" class="login-btn" @tap="handleLogin">
        <text class="login-text">微信快捷登录</text>
      </view>
      <button
        v-if="userStore.isLoggedIn && !userStore.phone"
        class="phone-btn"
        open-type="getPhoneNumber"
        @getphonenumber="handleGetPhoneNumber"
      >
        绑定手机号
      </button>
      <view v-if="userStore.isLoggedIn && !userStore.isProfileComplete" class="profile-btn" @tap="goProfile">
        <text class="profile-text">完善资料</text>
      </view>
      <view v-if="!userStore.isLoggedIn" class="login-agreement">
        <text class="agreement-prefix">登录即视为同意</text>
        <text class="agreement-link" @tap.stop="openPolicy('/pages/agreement/index')">《用户协议》</text>
        <text class="agreement-prefix">与</text>
        <text class="agreement-link" @tap.stop="openPolicy('/pages/privacy/index')">《隐私政策》</text>
      </view>
      <view class="header-trust">
        <text>自营正品</text>
        <text>会员福利</text>
        <text>贴心售后</text>
      </view>
    </view>

    <view class="order-section card">
      <view class="section-header">
        <view>
          <text class="section-title">我的订单</text>
          <text class="section-subtitle">查看履约进度与售后服务</text>
        </view>
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
        <view class="menu-left">
          <text class="menu-icon">券</text>
          <text class="menu-text">我的优惠券</text>
        </view>
        <text class="menu-arrow">›</text>
      </view>
      <view class="menu-item" @tap="navigateTo('/pages/points/index')">
        <view class="menu-left">
          <text class="menu-icon sage">分</text>
          <text class="menu-text">积分中心</text>
        </view>
        <text class="menu-arrow">›</text>
      </view>
      <view class="menu-item" @tap="navigateTo('/pages/member/index')">
        <view class="menu-left">
          <text class="menu-icon peach">会</text>
          <text class="menu-text">会员中心</text>
        </view>
        <text class="menu-arrow">›</text>
      </view>
      <view class="menu-item" @tap="navigateTo('/pages/baby/list')">
        <view class="menu-left">
          <text class="menu-icon mint">宝</text>
          <text class="menu-text">宝宝档案</text>
        </view>
        <text class="menu-arrow">›</text>
      </view>
      <view class="menu-item" @tap="navigateTo('/pages/address/list')">
        <view class="menu-left">
          <text class="menu-icon sage">址</text>
          <text class="menu-text">地址管理</text>
        </view>
        <text class="menu-arrow">›</text>
      </view>
      <view class="menu-item" @tap="navigateTo('/pages/share/invite')">
        <view class="menu-left">
          <text class="menu-icon peach">邀</text>
          <text class="menu-text">邀请好友</text>
        </view>
        <text class="menu-arrow">›</text>
      </view>
      <view class="menu-item" @tap="navigateTo('/pages/benefit-package/my')">
        <view class="menu-left">
          <text class="menu-icon mint">权</text>
          <text class="menu-text">我的权益</text>
        </view>
        <text class="menu-arrow">›</text>
      </view>
      <view class="menu-item" @tap="navigateTo('/pages/customer-service/index')">
        <view class="menu-left">
          <text class="menu-icon">客</text>
          <text class="menu-text">客服与帮助</text>
        </view>
        <text class="menu-arrow">›</text>
      </view>
      <view class="menu-item" @tap="navigateTo('/pages/agreement/index')">
        <view class="menu-left">
          <text class="menu-icon muted">协</text>
          <text class="menu-text">用户协议</text>
        </view>
        <text class="menu-arrow">›</text>
      </view>
      <view class="menu-item" @tap="navigateTo('/pages/privacy/index')">
        <view class="menu-left">
          <text class="menu-icon muted">隐</text>
          <text class="menu-text">隐私政策</text>
        </view>
        <text class="menu-arrow">›</text>
      </view>
      <view class="menu-item" @tap="navigateTo('/pages/food-safety/index')">
        <view class="menu-left">
          <text class="menu-icon sage">安</text>
          <text class="menu-text">食品安全与售后</text>
        </view>
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
import { navigateToStoredRedirect } from '@/utils/request'

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

async function handleLogin() {
  try {
    await userStore.wxLogin()
    await loadOrderCount()
    uni.showToast({ title: '登录成功', icon: 'success' })
    setTimeout(() => {
      navigateToStoredRedirect()
    }, 300)
  } catch (err: any) {
    console.error('[baby-mall] wxLogin failed:', err)
    uni.showModal({
      title: '登录失败',
      content: '登录失败，请稍后重试。',
      showCancel: false,
      confirmText: '我知道了'
    })
  }
}

async function handleGetPhoneNumber(e: any) {
  const detail = e?.detail || {}
  if (detail.errMsg && !detail.errMsg.includes('ok')) {
    console.warn('[baby-mall] getPhoneNumber cancelled or failed:', detail.errMsg)
    uni.showToast({ title: '未完成手机号授权', icon: 'none' })
    return
  }

  let bindPayload: { code: string; encryptedData?: string; iv?: string } | null = null
  if (detail.code) {
    bindPayload = { code: detail.code }
  } else if (detail.encryptedData && detail.iv) {
    try {
      const loginRes = await new Promise<UniApp.LoginRes>((resolve, reject) => {
        uni.login({
          provider: 'weixin',
          success: resolve,
          fail: reject
        })
      })
      if (loginRes.code) {
        bindPayload = {
          code: loginRes.code,
          encryptedData: detail.encryptedData,
          iv: detail.iv
        }
      }
    } catch (err) {
      console.error('[baby-mall] uni.login for legacy bindPhone failed:', err)
    }
  }

  if (!bindPayload?.code) {
    console.error('[baby-mall] getPhoneNumber missing code and legacy encrypted data:', detail)
    uni.showToast({ title: '未获取到手机号授权凭证', icon: 'none' })
    return
  }

  try {
    if (!userStore.isLoggedIn) {
      await userStore.wxLogin()
    }
    await userStore.bindPhone(bindPayload)
    uni.showToast({ title: '手机号绑定成功', icon: 'success' })
  } catch (err) {
    console.error('[baby-mall] bindPhone failed:', err)
    uni.showModal({
      title: '绑定失败',
      content: '手机号绑定失败，请稍后重试。',
      showCancel: false,
      confirmText: '我知道了'
    })
  }
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
  const loginRequiredPages = ['/pages/baby/list', '/pages/address/list', '/pages/coupon/my', '/pages/coupon/center', '/pages/member/index', '/pages/points/index', '/pages/share/invite', '/pages/benefit-package/my']

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
  padding-bottom: $spacing-xl;
}

.user-header {
  position: relative;
  overflow: hidden;
  background:
    radial-gradient(circle at 86% 18%, rgba($success-color, 0.2) 0%, rgba($success-color, 0) 230rpx),
    radial-gradient(circle at 12% 8%, rgba($primary-color, 0.18) 0%, rgba($primary-color, 0) 260rpx),
    linear-gradient(135deg, #FFF8EC 0%, #FFE9DF 54%, #F7F7EA 100%);
  padding: 58rpx $spacing-md 50rpx;
  border-radius: 0 0 $radius-xxl $radius-xxl;
  box-shadow: 0 18rpx 40rpx rgba(131, 91, 78, 0.08);
}

.header-brand-row {
  @include flex-between;
  margin-bottom: $spacing-lg;
}

.brand-pill {
  min-height: 40rpx;
  padding: 0 18rpx;
  border-radius: $radius-round;
  background: rgba(255, 255, 255, 0.78);
  color: $primary-dark;
  font-size: $font-xs;
  line-height: 40rpx;
  font-weight: 800;
  box-shadow: $shadow-xs;
}

.brand-copy {
  color: $text-secondary;
  font-size: $font-xs;
  font-weight: 700;
}

.user-info {
  display: flex;
  align-items: center;
}

.user-avatar {
  width: 132rpx;
  height: 132rpx;
  border-radius: 50%;
  border: 4rpx solid rgba(255, 255, 255, 0.9);
  box-shadow: $shadow-md;
  background: $bg-ivory;
}

.user-detail {
  margin-left: $spacing-md;
  min-width: 0;
}

.user-name {
  font-size: $font-xl;
  color: $text-color;
  font-weight: 900;
  display: block;
  max-width: 420rpx;
  @include text-ellipsis;
}

.member-badge {
  display: inline-flex;
  align-items: center;
  min-height: 42rpx;
  background: rgba(255, 255, 255, 0.78);
  border: 1rpx solid rgba($primary-color, 0.16);
  border-radius: $radius-round;
  padding: 0 16rpx;
  margin-top: 10rpx;
}

.member-text {
  font-size: $font-xs;
  color: $primary-dark;
  font-weight: 700;
}

.login-btn {
  @include flex-center;
  width: 240rpx;
  min-height: 76rpx;
  margin-top: $spacing-lg;
  background: $gradient-coral;
  border-radius: $radius-round;
  box-shadow: $shadow-coral;
}

.login-text {
  color: #FFFFFF;
  font-size: $font-md;
  font-weight: 800;
}

.phone-btn {
  @include flex-center;
  width: 240rpx;
  min-height: 76rpx;
  margin: $spacing-lg 0 0;
  padding: 0;
  background: rgba(255, 255, 255, 0.9);
  border: 2rpx solid rgba($primary-color, 0.28);
  border-radius: $radius-round;
  color: $primary-dark;
  font-size: $font-md;
  font-weight: 800;
  line-height: 76rpx;

  &::after {
    border: none;
  }
}

.profile-btn {
  @include flex-center;
  width: 240rpx;
  min-height: 76rpx;
  margin-top: $spacing-sm;
  background: rgba($success-color, 0.12);
  border: 2rpx solid rgba($success-color, 0.24);
  border-radius: $radius-round;
}

.profile-text {
  color: $success-color;
  font-size: $font-md;
  font-weight: 800;
}

.login-agreement {
  margin-top: 14rpx;
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

.header-trust {
  display: flex;
  align-items: center;
  gap: 10rpx;
  margin-top: $spacing-lg;

  text {
    min-height: 38rpx;
    padding: 0 16rpx;
    border-radius: $radius-round;
    background: rgba($success-color, 0.12);
    color: $success-dark;
    font-size: $font-xs;
    line-height: 38rpx;
    font-weight: 700;
  }
}

.order-section {
  margin: -24rpx $spacing-md $spacing-md;
  position: relative;
  background:
    radial-gradient(circle at 90% 0%, rgba($primary-color, 0.1), rgba($primary-color, 0) 220rpx),
    rgba(255, 255, 255, 0.94);
  border-color: rgba(255, 255, 255, 0.78);
  box-shadow: $shadow-md;
}

.section-header {
  @include flex-between;
  margin-bottom: $spacing-md;
}

.section-title {
  display: block;
  font-size: $font-md;
  font-weight: 800;
  color: $text-color;
}

.section-subtitle {
  display: block;
  margin-top: 6rpx;
  font-size: $font-xs;
  color: $text-hint;
}

.section-more {
  font-size: $font-sm;
  color: $text-hint;
  flex-shrink: 0;
}

.order-shortcuts {
  display: flex;
  gap: 10rpx;
}

.shortcut-item {
  @include flex-center;
  @include flex-column;
  position: relative;
  flex: 1;
  min-width: 0;
  min-height: 132rpx;
  border-radius: 28rpx;
  background: rgba(255, 248, 244, 0.78);
  border: 1rpx solid rgba($border-color, 0.66);
}

.shortcut-icon {
  width: 62rpx;
  height: 62rpx;
  border-radius: 24rpx;
  @include flex-center;
  background: linear-gradient(135deg, $primary-soft, $secondary-soft);
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
  top: 8rpx;
  right: 8rpx;
  background: $gradient-coral;
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
  background: rgba(255, 255, 255, 0.92);
  border-color: rgba(255, 255, 255, 0.78);
}

.menu-item {
  @include flex-between;
  min-height: 94rpx;
  padding: 14rpx 0;
  border-bottom: 1rpx solid $divider-color;

  &:last-child {
    border-bottom: none;
  }
}

.menu-left {
  display: flex;
  align-items: center;
  min-width: 0;
}

.menu-icon {
  @include flex-center;
  width: 56rpx;
  height: 56rpx;
  margin-right: $spacing-sm;
  border-radius: 22rpx;
  background: $primary-soft;
  color: $primary-dark;
  font-size: $font-sm;
  font-weight: 900;
  flex-shrink: 0;

  &.sage {
    background: $success-soft;
    color: $success-dark;
  }

  &.peach {
    background: $secondary-soft;
    color: $secondary-color;
  }

  &.mint {
    background: rgba($mint-color, 0.14);
    color: $success-dark;
  }

  &.muted {
    background: rgba($bg-gray, 0.9);
    color: $text-secondary;
  }
}

.menu-text {
  font-size: $font-md;
  color: $text-color;
  font-weight: 600;
  @include text-ellipsis;
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
  border: 1rpx solid rgba($danger-color, 0.1);
}

.logout-text {
  font-size: $font-md;
  color: $danger-color;
}
</style>
