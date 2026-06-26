<template>
  <view class="group-buy-detail-page page-shell">
    <view v-if="activity" class="detail-card card">
      <image
        v-if="activity.coverImage"
        class="cover"
        :src="activity.coverImage"
        mode="aspectFill"
      />
      <view class="info">
        <view class="name">{{ activity.name }}</view>
        <view class="price-row">
          <text class="price">¥{{ formatPrice(activity.groupPrice) }}</text>
          <text v-if="activity.originalPrice" class="original">¥{{ formatPrice(activity.originalPrice) }}</text>
          <text class="size">{{ activity.groupSize }}人成团</text>
          <text class="expire">{{ activity.groupExpireHours }}h内成团</text>
        </view>
        <view v-if="activity.description" class="desc">{{ activity.description }}</view>
        <view class="meta">
          <text>已售 {{ activity.soldCount }}</text>
          <text v-if="activity.stockLimit != null"> / 限 {{ activity.stockLimit }}</text>
          <text v-if="activity.limitPerUser > 0" class="limit">每人限购{{ activity.limitPerUser }}次</text>
        </view>
      </view>
    </view>

    <!-- 可参与的团 -->
    <view class="section">
      <view class="section-title">正在拼团，可直接参与</view>
      <view v-if="availableGroups.length === 0" class="empty-tip">暂无可参与的团，快来开团吧</view>
      <view v-for="g in availableGroups" :key="g.id" class="group-card card">
        <view class="group-info">
          <view class="group-leader">
            <image v-if="g.leader?.avatar" class="avatar" :src="g.leader.avatar" mode="aspectFill" />
            <view v-else class="avatar avatar-placeholder" />
            <text class="leader-name">{{ g.leader?.nickname || '用户' + g.leaderUserId }}</text>
          </view>
          <view class="group-progress">
            <text class="progress-text">{{ g.currentCount }}/{{ g.targetCount }}人</text>
            <text class="remain">剩 {{ remainTime(g.expiresAt) }}</text>
          </view>
        </view>
        <button class="join-btn" size="mini" @tap="handleJoin(g.id)">参与拼团</button>
      </view>
    </view>

    <view class="bottom-bar">
      <button class="start-btn" @tap="handleStart">我要开团</button>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { onLoad, onShareAppMessage } from '@dcloudio/uni-app'
import { groupBuyApi, type GroupBuyActivity, type GroupBuyGroup } from '@/api/group-buy'
import { useUserStore } from '@/stores/user'
import { getPromotionSourceForOrder } from '@/utils/share'
import { createPayment, wxPay } from '@/api/payment'

const userStore = useUserStore()
const activity = ref<GroupBuyActivity | null>(null)
const availableGroups = ref<GroupBuyGroup[]>([])
const submitting = ref(false)

function formatPrice(cents: number): string {
  return (cents / 100).toFixed(2)
}

function remainTime(expiresAt: string): string {
  const ms = new Date(expiresAt).getTime() - Date.now()
  if (ms <= 0) return '已过期'
  const hours = Math.floor(ms / 3600000)
  const mins = Math.floor((ms % 3600000) / 60000)
  return hours > 0 ? `${hours}h${mins}m` : `${mins}m`
}

async function loadDetail(id: string) {
  try {
    const data = await groupBuyApi.getDetail(id)
    activity.value = data
    await loadAvailableGroups(id)
  } catch {
    uni.showToast({ title: '加载失败', icon: 'none' })
  }
}

async function loadAvailableGroups(activityId: string) {
  try {
    const data = await groupBuyApi.getAvailableGroups(activityId)
    availableGroups.value = data || []
  } catch {
    availableGroups.value = []
  }
}

async function payOrder(orderId: string) {
  try {
    const payment = await createPayment({ orderId })
    await wxPay(payment)
    uni.showToast({ title: '支付成功', icon: 'success' })
    setTimeout(() => {
      uni.redirectTo({ url: `/pages/group-buy/group?id=${lastGroupId.value}` })
    }, 1500)
  } catch (err: any) {
    const msg = err?.errMsg || err?.message || ''
    if (msg.includes('cancel')) {
      uni.showModal({
        title: '支付未完成',
        content: '请尽快在订单列表中完成支付',
        showCancel: false,
        confirmText: '查看订单',
        success: () => {
          uni.redirectTo({ url: `/pages/order/detail?id=${orderId}` })
        },
      })
      return
    }
    uni.showToast({ title: '支付失败', icon: 'none' })
  }
}

const lastGroupId = ref('')

async function handleStart() {
  if (!activity.value) return
  if (submitting.value) return
  if (!userStore.isLoggedIn) {
    userStore.requireLogin(() => handleStart())
    return
  }
  if (!activity.value.skuId) {
    uni.showToast({ title: '该活动未指定规格，请联系客服', icon: 'none' })
    return
  }
  submitting.value = true
  try {
    const result = await groupBuyApi.start({
      activityId: Number(activity.value.id),
      skuId: activity.value.skuId ? Number(activity.value.skuId) : undefined,
      quantity: 1,
      fulfillmentType: 'delivery',
    })
    lastGroupId.value = result.groupId
    uni.showToast({ title: '开团成功，请支付', icon: 'success' })
    setTimeout(() => payOrder(result.orderId), 800)
  } catch (err: any) {
    uni.showToast({ title: err?.message || '开团失败', icon: 'none' })
  } finally {
    submitting.value = false
  }
}

async function handleJoin(groupId: string | number) {
  if (!activity.value) return
  if (submitting.value) return
  if (!userStore.isLoggedIn) {
    userStore.requireLogin(() => handleJoin(groupId))
    return
  }
  submitting.value = true
  try {
    const result = await groupBuyApi.join({
      groupId: Number(groupId),
      quantity: 1,
      fulfillmentType: 'delivery',
    })
    lastGroupId.value = result.groupId
    uni.showToast({ title: '参团成功，请支付', icon: 'success' })
    setTimeout(() => payOrder(result.orderId), 800)
  } catch (err: any) {
    uni.showToast({ title: err?.message || '参团失败', icon: 'none' })
  } finally {
    submitting.value = false
  }
}

onLoad((options) => {
  if (options?.id) {
    loadDetail(options.id)
  }
})

onShareAppMessage(() => ({
  title: activity.value?.name || '快来一起拼团',
  path: `/pages/group-buy/detail?id=${activity.value?.id || ''}&inviter=${userStore.userInfo?.id || ''}`,
}))
</script>

<style lang="scss" scoped>
.group-buy-detail-page {
  min-height: 100vh;
  padding: $spacing-sm $spacing-md;
  padding-bottom: 180rpx;
}

.detail-card {
  background: $gradient-card;
  border-radius: $radius-xxl;
  overflow: hidden;
  margin-bottom: $spacing-md;
  border: 1rpx solid rgba($border-color, 0.78);
  box-shadow: $shadow-md;
}

.cover {
  width: 100%;
  height: 400rpx;
  background: $bg-ivory;
}

.info {
  padding: $spacing-md;
}

.name {
  font-size: $font-lg;
  font-weight: 800;
  color: $text-color;
  margin-bottom: $spacing-sm;
  line-height: 1.4;
}

.price-row {
  display: flex;
  align-items: baseline;
  gap: $spacing-sm;
  margin-bottom: $spacing-sm;
  flex-wrap: wrap;
}

.price {
  color: $price-color;
  font-size: 44rpx;
  font-weight: 800;
}

.original {
  color: $text-hint;
  font-size: $font-md;
  text-decoration: line-through;
}

.size {
  color: $warning-color;
  font-size: $font-sm;
}

.expire {
  color: $text-hint;
  font-size: $font-sm;
}

.desc {
  color: $text-secondary;
  font-size: $font-sm;
  margin: $spacing-sm 0;
  line-height: 1.55;
}

.meta {
  color: $text-hint;
  font-size: $font-sm;
}

.limit {
  margin-left: $spacing-sm;
  color: $price-color;
}

.section {
  margin-top: $spacing-md;
}

.section-title {
  font-size: $font-md;
  font-weight: 700;
  color: $text-color;
  margin-bottom: $spacing-sm;
  padding: 0 $spacing-xs;
}

.empty-tip {
  color: $text-hint;
  font-size: $font-sm;
  text-align: center;
  padding: 48rpx 0;
}

.group-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: $gradient-card;
  border-radius: $radius-xl;
  padding: $spacing-md;
  margin-bottom: $spacing-sm;
  border: 1rpx solid rgba($border-color, 0.78);
  box-shadow: $shadow-xs;
}

.group-info {
  flex: 1;
  min-width: 0;
}

.group-leader {
  display: flex;
  align-items: center;
  gap: $spacing-sm;
  margin-bottom: $spacing-xs;
}

.avatar {
  width: 56rpx;
  height: 56rpx;
  border-radius: 50%;
  background: $bg-ivory;
}

.avatar-placeholder {
  background: $bg-gray;
}

.leader-name {
  font-size: $font-sm;
  color: $text-color;
  @include text-ellipsis;
}

.group-progress {
  display: flex;
  align-items: center;
  gap: $spacing-md;
}

.progress-text {
  color: $price-color;
  font-size: $font-md;
  font-weight: 700;
}

.remain {
  color: $text-hint;
  font-size: $font-sm;
}

.join-btn {
  flex-shrink: 0;
  background: $gradient-coral;
  color: #FFFFFF;
  border-radius: $radius-round;
  font-size: $font-sm;
  font-weight: 700;
  margin: 0;
  padding: 0 28rpx;
  line-height: 64rpx;
  min-height: 64rpx;

  &::after {
    border: none;
  }
}

.bottom-bar {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  padding: $spacing-sm $spacing-md;
  background: rgba(255, 252, 247, 0.96);
  border-top: 1rpx solid rgba($border-color, 0.82);
  box-shadow: 0 -12rpx 36rpx rgba(131, 91, 78, 0.08);
  z-index: 20;
  @include safe-bottom;
}

.start-btn {
  width: 100%;
  border-radius: $radius-round;
  background: $gradient-coral;
  color: #FFFFFF;
  font-size: $font-md;
  font-weight: 700;
  box-shadow: $shadow-coral;

  &::after {
    border: none;
  }
}
</style>
