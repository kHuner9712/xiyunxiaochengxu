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
  padding: $spacing-md;
}

.spec-group {
  margin-bottom: $spacing-md;
}

.spec-name {
  font-size: $font-md;
  color: $text-color;
  font-weight: 500;
  margin-bottom: $spacing-sm;
  display: block;
}

.spec-values {
  display: flex;
  flex-wrap: wrap;
  gap: $spacing-sm;
}

.spec-value {
  padding: 12rpx 28rpx;
  font-size: $font-sm;
  color: $text-secondary;
  background: $bg-gray;
  border-radius: $radius-md;
  border: 2rpx solid transparent;

  &.active {
    color: $primary-color;
    background: rgba($primary-color, 0.08);
    border-color: $primary-color;
  }

  &.disabled {
    color: $text-disabled;
    background: $bg-gray;
    text-decoration: line-through;
  }
}

.sku-quantity {
  @include flex-between;
  margin-top: $spacing-md;
}

.quantity-control {
  display: flex;
  align-items: center;
}

.quantity-btn {
  @include flex-center;
  width: 56rpx;
  height: 56rpx;
  background: $bg-gray;
  border-radius: $radius-sm;
  font-size: $font-lg;
  color: $text-color;
}

.quantity-value {
  width: 80rpx;
  text-align: center;
  font-size: $font-md;
}
</style>
