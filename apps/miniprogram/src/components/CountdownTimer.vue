<template>
  <view class="countdown-timer">
    <text v-if="expired" class="countdown-expired">已结束</text>
    <view v-else class="countdown-wrap">
      <text v-if="showLabel" class="countdown-label">{{ label }}</text>
      <view class="countdown-blocks">
        <view v-if="days > 0" class="countdown-block">
          <text class="countdown-num">{{ padZero(days) }}</text>
        </view>
        <text v-if="days > 0" class="countdown-sep">天</text>
        <view class="countdown-block">
          <text class="countdown-num">{{ padZero(hours) }}</text>
        </view>
        <text class="countdown-sep">:</text>
        <view class="countdown-block">
          <text class="countdown-num">{{ padZero(minutes) }}</text>
        </view>
        <text class="countdown-sep">:</text>
        <view class="countdown-block">
          <text class="countdown-num">{{ padZero(seconds) }}</text>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue'
import { normalizeTimeToTimestamp, type CompatibleTime } from '@/utils/time'

const props = withDefaults(defineProps<{
  endTime: CompatibleTime
  label?: string
  showLabel?: boolean
}>(), {
  label: '距结束',
  showLabel: true
})

const days = ref(0)
const hours = ref(0)
const minutes = ref(0)
const seconds = ref(0)
const expired = ref(false)

let timer: ReturnType<typeof setInterval> | null = null

function padZero(n: number): string {
  return String(n).padStart(2, '0')
}

function stopTimer() {
  if (timer) {
    clearInterval(timer)
    timer = null
  }
}

function update() {
  const now = Date.now()
  const endTimestamp = normalizeTimeToTimestamp(props.endTime)
  const diff = endTimestamp - now
  if (!Number.isFinite(endTimestamp) || diff <= 0) {
    days.value = 0
    hours.value = 0
    minutes.value = 0
    seconds.value = 0
    expired.value = true
    stopTimer()
    return
  }
  expired.value = false
  days.value = Math.floor(diff / (1000 * 60 * 60 * 24))
  hours.value = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
  minutes.value = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
  seconds.value = Math.floor((diff % (1000 * 60)) / 1000)
}

function startTimer() {
  stopTimer()
  update()
  if (!expired.value) {
    timer = setInterval(update, 1000)
  }
}

onMounted(() => {
  startTimer()
})

watch(() => props.endTime, () => {
  startTimer()
})

onUnmounted(() => {
  stopTimer()
})
</script>

<style lang="scss" scoped>
.countdown-timer {
  display: inline-flex;
  align-items: center;
}

.countdown-expired {
  font-size: $font-sm;
  color: $text-hint;
}

.countdown-wrap {
  display: flex;
  align-items: center;
}

.countdown-label {
  font-size: $font-sm;
  color: $text-secondary;
  margin-right: 8rpx;
}

.countdown-blocks {
  display: flex;
  align-items: center;
}

.countdown-block {
  background: $primary-color;
  border-radius: $radius-sm;
  padding: 4rpx 8rpx;
  min-width: 40rpx;
  text-align: center;
}

.countdown-num {
  font-size: $font-sm;
  color: #FFFFFF;
  font-weight: 600;
}

.countdown-sep {
  font-size: $font-sm;
  color: $primary-color;
  margin: 0 4rpx;
  font-weight: 600;
}
</style>
