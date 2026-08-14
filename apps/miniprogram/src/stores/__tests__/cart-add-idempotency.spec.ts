import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useCartStore } from '../cart'
import { get, getToken, post } from '@/utils/request'

vi.mock('@/utils/request', () => ({
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  del: vi.fn(),
  getToken: vi.fn(),
}))

describe('购物车增量加购弱网幂等', () => {
  const storage = new Map<string, unknown>()

  beforeEach(() => {
    vi.clearAllMocks()
    storage.clear()
    setActivePinia(createPinia())
    vi.mocked(getToken).mockReturnValue('token-a')
    vi.mocked(get).mockResolvedValue([] as any)
    ;(globalThis as any).uni = {
      getStorageSync: vi.fn((key: string) => storage.get(key) ?? ''),
      setStorageSync: vi.fn((key: string, value: unknown) => storage.set(key, value)),
      removeStorageSync: vi.fn((key: string) => storage.delete(key)),
      setTabBarBadge: vi.fn(),
      removeTabBarBadge: vi.fn(),
      showToast: vi.fn(),
    }
  })

  it('response loss retries the same incremental add with the same clientRequestId', async () => {
    vi.mocked(post)
      .mockRejectedValueOnce(new Error('network response lost'))
      .mockResolvedValueOnce({ id: 'cart-1', quantity: 3 } as any)

    const params = { productId: '10', skuId: '20', quantity: 2 }
    const store = useCartStore()

    await expect(store.addToCart(params)).rejects.toThrow('network response lost')
    const firstBody = vi.mocked(post).mock.calls[0]?.[1] as any
    expect(firstBody.clientRequestId).toMatch(/^\d{13}-[a-z0-9]{16,40}$/i)
    expect(storage.size).toBe(1)

    await expect(store.addToCart(params)).resolves.toBeUndefined()
    const secondBody = vi.mocked(post).mock.calls[1]?.[1] as any

    expect(secondBody.clientRequestId).toBe(firstBody.clientRequestId)
    expect(vi.mocked(post)).toHaveBeenCalledTimes(2)
    expect(vi.mocked(get)).toHaveBeenCalledTimes(1)
    expect(storage.size).toBe(0)
  })
})
