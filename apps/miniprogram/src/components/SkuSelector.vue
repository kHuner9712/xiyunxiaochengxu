<template>
  <view class="sku-selector">
    <view v-for="(spec, specIndex) in specs" :key="specIndex" class="spec-group">
      <text class="spec-name">{{ spec.name }}</text>
      <view class="spec-values">
        <view
          v-for="(value, valueIndex) in spec.values"
          :key="valueIndex"
          class="spec-value"
          :class="{
            active: selectedSpecs[specIndex] === valueIndex,
            disabled: isSpecDisabled(specIndex, valueIndex)
          }"
          @tap="selectSpec(specIndex, valueIndex)"
        >
          {{ value }}
        </view>
      </view>
    </view>
    <view class="sku-quantity">
      <text class="spec-name">数量</text>
      <view class="quantity-control">
        <view class="quantity-btn" @tap="changeQuantity(-1)">-</view>
        <text class="quantity-value">{{ quantity }}</text>
        <view class="quantity-btn" @tap="changeQuantity(1)">+</view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, reactive, watch } from 'vue'

interface SpecGroup {
  name: string
  values: string[]
}

interface SkuItem {
  id: number
  specs: Record<string, string> | string
  specText: string
  price: number
  originalPrice: number
  stock: number
  image: string
}

const props = defineProps<{
  specs: SpecGroup[]
  skus: SkuItem[]
}>()

const emit = defineEmits<{
  change: [skuId: number, quantity: number]
}>()

const selectedSpecs = reactive<Record<number, number>>({})
const quantity = ref(1)

const currentSku = ref<SkuItem | null>(null)

function buildSpecTextByIndexes(indexMap: Record<number, number>): string {
  if (!props.specs.length) return ''
  return props.specs
    .map((spec, i) => `${spec.name}：${spec.values[indexMap[i]] || ''}`)
    .join(' / ')
}

function selectSpec(specIndex: number, valueIndex: number) {
  if (isSpecDisabled(specIndex, valueIndex)) return
  selectedSpecs[specIndex] = valueIndex
  quantity.value = 1
  matchSku()
}

function isSpecDisabled(specIndex: number, valueIndex: number): boolean {
  if (!props.specs.length) {
    return !props.skus.some((sku) => sku.stock > 0)
  }
  const tempSpecs = { ...selectedSpecs, [specIndex]: valueIndex }
  const specText = buildSpecTextByIndexes(tempSpecs)
  return !props.skus.some((sku) => sku.specText === specText && sku.stock > 0)
}

function matchSku() {
  const matched =
    !props.specs.length
      ? props.skus.find((sku) => sku.stock > 0) || props.skus[0]
      : props.skus.find((sku) => sku.specText === buildSpecTextByIndexes(selectedSpecs))
  currentSku.value = matched || null
  if (matched) {
    emit('change', matched.id, quantity.value)
  }
}

function initSelection() {
  Object.keys(selectedSpecs).forEach((key) => {
    delete selectedSpecs[Number(key)]
  })
  props.specs.forEach((_, index) => {
    selectedSpecs[index] = 0
  })

  if (!props.specs.length) {
    quantity.value = 1
    matchSku()
    return
  }

  const firstAvailable = props.skus.find((sku) => sku.stock > 0) || props.skus[0]
  if (firstAvailable?.specText) {
    props.specs.forEach((spec, specIndex) => {
      const hit = spec.values.findIndex((value) => firstAvailable.specText.includes(`${spec.name}：${value}`))
      selectedSpecs[specIndex] = hit >= 0 ? hit : 0
    })
  }
  quantity.value = 1
  matchSku()
}

function changeQuantity(delta: number) {
  const newQty = quantity.value + delta
  if (newQty < 1) return
  if (currentSku.value && newQty > currentSku.value.stock) {
    uni.showToast({ title: '库存不足', icon: 'none' })
    return
  }
  quantity.value = newQty
  if (currentSku.value) {
    emit('change', currentSku.value.id, quantity.value)
  }
}

watch(() => [props.specs, props.skus], () => {
  initSelection()
}, { immediate: true, deep: true })
</script>

<style lang="scss" scoped>
.sku-selector {
  padding: 6rpx 0 $spacing-sm;
}

.spec-group {
  margin-bottom: 34rpx;
}

.spec-name {
  font-size: $font-md;
  color: $text-color;
  font-weight: 900;
  margin-bottom: $spacing-sm;
  display: block;
}

.spec-values {
  display: flex;
  flex-wrap: wrap;
  gap: 14rpx;
}

.spec-value {
  min-height: 68rpx;
  max-width: 100%;
  padding: 0 28rpx;
  font-size: $font-sm;
  color: $text-secondary;
  background: rgba(255, 255, 255, 0.86);
  border-radius: $radius-round;
  border: 2rpx solid rgba($border-color, 0.78);
  box-shadow: $shadow-xs;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  line-height: 1.35;
  text-align: center;

  &.active {
    color: $primary-dark;
    background: linear-gradient(180deg, $primary-soft 0%, #FFFFFF 100%);
    border-color: rgba($primary-color, 0.44);
    font-weight: 800;
    box-shadow: 0 8rpx 18rpx rgba(242, 118, 120, 0.1);
  }

  &.disabled {
    color: $text-disabled;
    background: rgba($bg-gray, 0.54);
    border-color: rgba($border-color, 0.45);
    box-shadow: none;
    text-decoration: line-through;
  }
}

.sku-quantity {
  @include flex-between;
  min-height: 96rpx;
  margin-top: $spacing-sm;
  padding: $spacing-md $spacing-md 0;
  border-top: 1rpx solid $divider-color;
  background: rgba(255, 255, 255, 0.58);
  border-radius: $radius-xl;
}

.quantity-control {
  display: flex;
  align-items: center;
  min-height: 68rpx;
  background: rgba($bg-soft, 0.92);
  border-radius: $radius-round;
  padding: 6rpx;
  border: 1rpx solid rgba($border-color, 0.7);
}

.quantity-btn {
  @include flex-center;
  width: 58rpx;
  height: 58rpx;
  background: $bg-white;
  border-radius: $radius-round;
  font-size: $font-lg;
  color: $primary-dark;
  font-weight: 700;
  box-shadow: $shadow-xs;
}

.quantity-value {
  width: 80rpx;
  text-align: center;
  font-size: $font-md;
}
</style>
