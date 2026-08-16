import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useCartStore } from '../cart'
import { del, get, getToken } from '@/utils/request'

vi.mock('@/utils/request', () => ({
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  del: vi.fn(),
  getToken: vi.fn(),
}))

function cartItem(id: string) {
  return {
    id,
    productId: `product-${id}`,
    skuId: `sku-${id}`,
    productName: `商品${id}`,
    productImage: '',
    skuName: '默认规格',
    price: 1000,
    quantity: 1,
    stock: 10,
    isValid: true,
    checked: true,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  setActivePinia(createPinia())
  vi.mocked(getToken).mockReturnValue('token-a')
  ;(globalThis as any).uni = {
    setTabBarBadge: vi.fn(),
    removeTabBarBadge: vi.fn(),
    showToast: vi.fn(),
  }
})

describe('购物车批量删除收敛', () => {
  it('部分 DELETE 已成功、另一条失败时仍刷新服务器真相，不把已删除项留在页面', async () => {
    vi.mocked(get)
      .mockResolvedValueOnce([cartItem('1'), cartItem('2')] as any)
      .mockResolvedValueOnce([cartItem('2')] as any)
    vi.mocked(del).mockImplementation((path: string) => {
      if (path.endsWith('/1')) return Promise.resolve({} as any)
      return Promise.reject(new Error('temporary delete failure'))
    })

    const store = useCartStore()
    await store.fetchCart()

    await expect(store.removeSelected()).rejects.toThrow('temporary delete failure')

    expect(del).toHaveBeenCalledTimes(2)
    expect(get).toHaveBeenCalledTimes(2)
    expect(store.items.map((item) => item.id)).toEqual(['2'])
    expect(store.items[0].checked).toBe(true)
  })
})
