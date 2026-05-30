<template>
  <view v-if="mounted" class="bottom-sheet" :class="{ visible: active }">
    <view class="bottom-sheet-mask" @tap="handleClose" />
    <view class="bottom-sheet-panel">
      <slot />
    </view>
  </view>
</template>

<script setup lang="ts">
import { nextTick, watch, ref } from 'vue'

const props = defineProps<{
  show: boolean
}>()

const emit = defineEmits<{
  'update:show': [value: boolean]
  close: []
}>()

const mounted = ref(props.show)
const active = ref(props.show)
let hideTimer: ReturnType<typeof setTimeout> | undefined

watch(
  () => props.show,
  async (value) => {
    if (hideTimer) {
      clearTimeout(hideTimer)
      hideTimer = undefined
    }
    if (value) {
      mounted.value = true
      await nextTick()
      active.value = true
      return
    }
    active.value = false
    hideTimer = setTimeout(() => {
      mounted.value = false
    }, 220)
  },
)

function handleClose() {
  emit('update:show', false)
  emit('close')
}
</script>

<style lang="scss" scoped>
.bottom-sheet {
  position: fixed;
  left: 0;
  right: 0;
  top: 0;
  bottom: 0;
  z-index: 100;
  pointer-events: none;
}

.bottom-sheet-mask {
  position: absolute;
  left: 0;
  right: 0;
  top: 0;
  bottom: 0;
  background: rgba(47, 40, 37, 0.42);
  opacity: 0;
  transition: opacity 0.2s ease;
}

.bottom-sheet-panel {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  transform: translateY(100%);
  transition: transform 0.22s ease;
  padding-bottom: constant(safe-area-inset-bottom);
  padding-bottom: env(safe-area-inset-bottom);
}

.bottom-sheet.visible {
  pointer-events: auto;

  .bottom-sheet-mask {
    opacity: 1;
  }

  .bottom-sheet-panel {
    transform: translateY(0);
  }
}
</style>
