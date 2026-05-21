import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { get, post, put, del } from '@/utils/request'

interface CartItem {
  id: number
  productId: number
  skuId: number
  productName: string
  productImage: string
  skuName: string
  price: number
  quantity: number
  stock: number
  checked: boolean
}

export const useCartStore = defineStore('cart', () => {
  const items = ref<CartItem[]>([])
  const loading = ref(false)

  const totalCount = computed(() => {
    return items.value.reduce((sum, item) => sum + item.quantity, 0)
  })

  const checkedItems = computed(() => {
    return items.value.filter(item => item.checked)
  })

  const checkedCount = computed(() => {
    return checkedItems.value.reduce((sum, item) => sum + item.quantity, 0)
  })

  const totalPrice = computed(() => {
    return checkedItems.value.reduce((sum, item) => sum + item.price * item.quantity, 0)
  })

  const allChecked = computed(() => {
    return items.value.length > 0 && items.value.every(item => item.checked)
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
      items.value = data.map(item => ({ ...item, checked: true }))
      updateTabBadge()
    } catch {
      items.value = []
    } finally {
      loading.value = false
    }
  }

  async function addToCart(params: { productId: number; skuId: number; quantity: number }) {
    await post('/weapp/cart/add', params)
    await fetchCart()
  }

  async function updateQuantity(cartItemId: number, quantity: number) {
    await put('/weapp/cart/update', { id: cartItemId, quantity })
    await fetchCart()
  }

  async function removeItem(cartItemId: number) {
    await del(`/weapp/cart/delete/${cartItemId}`)
    await fetchCart()
  }

  async function removeSelected() {
    const selectedIds = checkedItems.value.map(item => item.id)
    for (const id of selectedIds) {
      await del(`/weapp/cart/delete/${id}`)
    }
    await fetchCart()
  }

  function toggleCheck(index: number) {
    items.value[index].checked = !items.value[index].checked
  }

  function toggleCheckAll() {
    const checked = !allChecked.value
    items.value.forEach(item => { item.checked = checked })
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
