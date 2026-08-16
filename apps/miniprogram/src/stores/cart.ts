import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { get, post, put, del, getToken } from '@/utils/request'
import { runPersistentIdempotentAction } from '@/utils/checkout-idempotency'

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
  let fetchVersion = 0
  let ownerToken = ''

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

  function clearCart() {
    fetchVersion += 1
    ownerToken = ''
    items.value = []
    loading.value = false
    updateTabBadge()
  }

  async function fetchCart() {
    const currentToken = getToken()
    if (!currentToken) {
      clearCart()
      return false
    }

    // Never expose one account's in-memory cart to another account while the new account's
    // first network request is pending or failing.
    if (ownerToken && ownerToken !== currentToken) {
      clearCart()
    }

    const version = ++fetchVersion
    loading.value = true
    try {
      const data = await get<CartItem[]>('/weapp/cart/list')
      if (version !== fetchVersion) return false

      const prevCheckedIds = new Set(items.value.filter(i => i.checked).map(i => i.id))
      const hadPreviousState = items.value.length > 0
      items.value = data.map(item => {
        const purchasable = isPurchasable(item)
        return {
          ...item,
          checked: purchasable && (hadPreviousState ? prevCheckedIds.has(item.id) : true),
        }
      })
      ownerToken = currentToken
      updateTabBadge()
      return true
    } catch {
      if (version !== fetchVersion) return false

      // A 401 clears the persisted token in request.ts. In that case the cart must be erased.
      // For ordinary network/server failures keep the last known cart instead of pretending it is empty.
      if (!getToken()) {
        clearCart()
      } else {
        uni.showToast({ title: '购物车加载失败，请稍后重试', icon: 'none' })
      }
      return false
    } finally {
      if (version === fetchVersion) {
        loading.value = false
      }
    }
  }

  async function addToCart(params: { productId: string; skuId: string; quantity: number }) {
    await runPersistentIdempotentAction(
      `cart:add:${params.skuId}`,
      params,
      (clientRequestId) => post('/weapp/cart/add', { ...params, clientRequestId }),
    )
    await fetchCart()
  }

  async function updateQuantity(cartItemId: string, quantity: number) {
    await put('/weapp/cart/update', { id: cartItemId, quantity })

    // The write already succeeded. Reflect that fact locally before the authoritative refresh so
    // a transient GET failure cannot leave the UI showing the pre-write quantity.
    const localItem = items.value.find(item => item.id === cartItemId)
    if (localItem) {
      localItem.quantity = quantity
      updateTabBadge()
    }
    await fetchCart()
  }

  async function removeItem(cartItemId: string) {
    await del(`/weapp/cart/delete/${encodeURIComponent(cartItemId)}`)
    items.value = items.value.filter(item => item.id !== cartItemId)
    updateTabBadge()
    await fetchCart()
  }

  async function removeSelected() {
    const selectedIds = checkedItems.value.map(item => item.id)
    if (selectedIds.length === 0) return

    // Selection is intentionally local-only in the miniprogram, so the backend's
    // /remove-selected endpoint cannot safely represent what the user currently sees selected.
    // Settle every per-row delete instead of Promise.all short-circuiting on the first failure:
    // some requests may already have committed, and the UI must converge to that durable state.
    const results = await Promise.allSettled(
      selectedIds.map(id => del(`/weapp/cart/delete/${encodeURIComponent(id)}`)),
    )
    const succeededIds = selectedIds.filter((_, index) => results[index].status === 'fulfilled')
    if (succeededIds.length > 0) {
      const succeededSet = new Set(succeededIds)
      items.value = items.value.filter(item => !succeededSet.has(item.id))
      updateTabBadge()
    }

    // Always reconcile with the server after a partial batch. Individual cart deletion is
    // idempotent server-side, so a response-loss retry cannot corrupt the cart.
    await fetchCart()

    const failed = results.find((result) => result.status === 'rejected') as PromiseRejectedResult | undefined
    if (failed) {
      throw failed.reason instanceof Error ? failed.reason : new Error('部分商品删除失败，请重试')
    }
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
    clearCart,
    addToCart,
    updateQuantity,
    removeItem,
    removeSelected,
    toggleCheck,
    toggleCheckAll,
    updateTabBadge
  }
})