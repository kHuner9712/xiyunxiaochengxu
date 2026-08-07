import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { get, post, put, del } from '@/utils/request'

interface CartItem {
  id: string
  productId: string
  skuId: string
  productName: string
  productImage: string
  skuName: string
  price: number
  quantity: number
  stock: number
  isValid?: boolean
  checked: boolean
}

export const useCartStore = defineStore('cart', () => {
  const items = ref<CartItem[]>([])
  const loading = ref(false)

  function isPurchasable(item: CartItem) {
    return item.isValid !== false
      && Number.isInteger(item.quantity)
      && item.quantity > 0
      && Number.isFinite(item.stock)
      && item.stock >= item.quantity
      && item.price >= 0
  }

  const totalCount = computed(() => {
    return items.value.reduce((sum, item) => sum + item.quantity, 0)
  })

  const checkedItems = computed(() => {
    return items.value.filter(item => item.checked && isPurchasable(item))
  })

  const checkedCount = computed(() => {
    return checkedItems.value.reduce((sum, item) => sum + item.quantity, 0)
  })

  const totalPrice = computed(() => {
    return checkedItems.value.reduce((sum, item) => sum + item.price * item.quantity, 0)
  })

  const purchasableItems = computed(() => items.value.filter(isPurchasable))

  const allChecked = computed(() => {
    return purchasableItems.value.length > 0
      && purchasableItems.value.every(item => item.checked)
  })

  function updateTabBadge() {
    const count = totalCount.value
    if (count > 0) {
      uni.setTabBarBadge({
        index: 3,
        text: count > 99 ? '99+' : String(count)
      })
    } else {
      uni.removeTabBarBadge({ index: 3 })
    }
  }

  async function fetchCart() {
    loading.value = true
    try {
      const data = await get<CartItem[]>('/weapp/cart/list')
      const prevCheckedIds = new Set(items.value.filter(i => i.checked).map(i => i.id))
      const hadPreviousState = items.value.length > 0
      items.value = data.map(item => {
        const purchasable = isPurchasable(item)
        return {
          ...item,
          checked: purchasable && (hadPreviousState ? prevCheckedIds.has(item.id) : true),
        }
      })
      updateTabBadge()
    } catch {
      items.value = []
      updateTabBadge()
    } finally {
      loading.value = false
    }
  }

  async function addToCart(params: { productId: string; skuId: string; quantity: number }) {
    await post('/weapp/cart/add', params)
    await fetchCart()
  }

  async function updateQuantity(cartItemId: string, quantity: number) {
    await put('/weapp/cart/update', { id: cartItemId, quantity })
    await fetchCart()
  }

  async function removeItem(cartItemId: string) {
    await del(`/weapp/cart/delete/${encodeURIComponent(cartItemId)}`)
    await fetchCart()
  }

  async function removeSelected() {
    const selectedIds = checkedItems.value.map(item => item.id)
    await Promise.all(selectedIds.map(id => del(`/weapp/cart/delete/${encodeURIComponent(id)}`)))
    await fetchCart()
  }

  function toggleCheck(index: number) {
    const item = items.value[index]
    if (!item || !isPurchasable(item)) {
      uni.showToast({ title: '该商品已下架或库存不足', icon: 'none' })
      return
    }
    item.checked = !item.checked
  }

  function toggleCheckAll() {
    const checked = !allChecked.value
    items.value.forEach(item => {
      item.checked = isPurchasable(item) ? checked : false
    })
  }

  return {
    items,
    loading,
    totalCount,
    checkedItems,
    checkedCount,
    totalPrice,
    allChecked,
    fetchCart,
    addToCart,
    updateQuantity,
    removeItem,
    removeSelected,
    toggleCheck,
    toggleCheckAll,
    updateTabBadge
  }
})