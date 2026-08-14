import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useCartStore } from '../cart'
import { get, getToken, put } from '@/utils/request'

vi.mock('@/utils/request', () => ({
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  del: vi.fn(),
  getToken: vi.fn(),
}))

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

function cartItem(quantity = 1) {
  return {
    id: 'cart-1',
    productId: 'product-1',
    skuId: 'sku-1',
    productName: '购物车商品',
    productImage: '',
    skuName: '默认规格',
    price: 1000,
    quantity,
    stock: 10,
    isValid: true,
    checked: true,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  setActivePinia(createPinia())
  vi.mocked(getToken).mockReturnValue('token-a')
  vi.mocked(put).mockResolvedValue({} as any)
  ;(globalThis as any).uni = {
    setTabBarBadge: vi.fn(),
    removeTabBarBadge: vi.fn(),
    showToast: vi.fn(),
  }
})

describe('购物车刷新并发', () => {
  it('旧购物车请求晚到时不能覆盖更新后的新数量', async () => {
    const first = deferred<any[]>()
    const second = deferred<any[]>()
    vi.mocked(get)
      .mockImplementationOnce(() => first.promise)
      .mockImplementationOnce(() => second.promise)

    const store = useCartStore()
    const oldRefresh = store.fetchCart()
    const newRefresh = store.fetchCart()

    second.resolve([{ ...cartItem(2), productName: '新购物车状态' }])
    await newRefresh

    expect(store.items).toHaveLength(1)
    expect(store.items[0].quantity).toBe(2)
    expect(store.loading).toBe(false)

    first.resolve([{ ...cartItem(1), productName: '旧购物车状态' }])
    await oldRefresh

    expect(store.items[0].quantity).toBe(2)
    expect(store.items[0].productName).toBe('新购物车状态')
    expect(store.loading).toBe(false)
    expect((globalThis as any).uni.setTabBarBadge).toHaveBeenCalledTimes(1)
  })

  it('临时网络错误保留最后一次成功购物车，不伪装成空购物车', async () => {
    vi.mocked(get)
      .mockResolvedValueOnce([cartItem(2)] as any)
      .mockRejectedValueOnce(new Error('network'))

    const store = useCartStore()
    await store.fetchCart()
    const refreshed = await store.fetchCart()

    expect(refreshed).toBe(false)
    expect(store.items).toHaveLength(1)
    expect(store.items[0].quantity).toBe(2)
    expect((globalThis as any).uni.showToast).toHaveBeenCalledWith({
      title: '购物车加载失败，请稍后重试',
      icon: 'none',
    })
  })

  it('数量写入成功后即使权威刷新失败也保留已写入的新数量', async () => {
    vi.mocked(get)
      .mockResolvedValueOnce([cartItem(1)] as any)
      .mockRejectedValueOnce(new Error('network'))

    const store = useCartStore()
    await store.fetchCart()
    await store.updateQuantity('cart-1', 2)

    expect(put).toHaveBeenCalledWith('/weapp/cart/update', { id: 'cart-1', quantity: 2 })
    expect(store.items[0].quantity).toBe(2)
    expect((globalThis as any).uni.showToast).toHaveBeenCalledWith({
      title: '购物车加载失败，请稍后重试',
      icon: 'none',
    })
  })

  it('会话失效时清空购物车而不是保留上一账号数据', async () => {
    vi.mocked(get).mockResolvedValueOnce([cartItem(1)] as any)
    const store = useCartStore()
    await store.fetchCart()
    expect(store.items).toHaveLength(1)

    vi.mocked(getToken).mockReturnValue('')
    const refreshed = await store.fetchCart()

    expect(refreshed).toBe(false)
    expect(store.items).toEqual([])
    expect((globalThis as any).uni.removeTabBarBadge).toHaveBeenCalled()
  })
})
