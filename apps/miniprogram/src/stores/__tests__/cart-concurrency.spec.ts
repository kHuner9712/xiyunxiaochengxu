import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useCartStore } from '../cart'
import { get } from '@/utils/request'

vi.mock('@/utils/request', () => ({
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  del: vi.fn(),
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

beforeEach(() => {
  vi.clearAllMocks()
  setActivePinia(createPinia())
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

    second.resolve([
      {
        id: 'cart-1',
        productId: 'product-1',
        skuId: 'sku-1',
        productName: '新购物车状态',
        productImage: '',
        skuName: '默认规格',
        price: 1000,
        quantity: 2,
        stock: 10,
        isValid: true,
        checked: true,
      },
    ])
    await newRefresh

    expect(store.items).toHaveLength(1)
    expect(store.items[0].quantity).toBe(2)
    expect(store.loading).toBe(false)

    first.resolve([
      {
        id: 'cart-1',
        productId: 'product-1',
        skuId: 'sku-1',
        productName: '旧购物车状态',
        productImage: '',
        skuName: '默认规格',
        price: 1000,
        quantity: 1,
        stock: 10,
        isValid: true,
        checked: true,
      },
    ])
    await oldRefresh

    expect(store.items[0].quantity).toBe(2)
    expect(store.items[0].productName).toBe('新购物车状态')
    expect(store.loading).toBe(false)
    expect((globalThis as any).uni.setTabBarBadge).toHaveBeenCalledTimes(1)
  })
})
