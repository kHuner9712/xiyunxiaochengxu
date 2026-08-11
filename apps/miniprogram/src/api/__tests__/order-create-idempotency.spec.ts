import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createOrder } from '../order'
import { post } from '@/utils/request'

vi.mock('@/utils/request', () => ({
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
}))

const storage = new Map<string, any>()

beforeEach(() => {
  vi.clearAllMocks()
  storage.clear()
  ;(globalThis as any).uni = {
    getStorageSync: vi.fn((key: string) => storage.get(key) ?? ''),
    setStorageSync: vi.fn((key: string, value: any) => storage.set(key, value)),
    removeStorageSync: vi.fn((key: string) => storage.delete(key)),
  }
})

const payload = {
  addressId: '10',
  fulfillmentType: 'delivery',
  items: [{ skuId: '20', quantity: 1 }],
}

const successResult = {
  orderId: '99',
  orderNo: 'XY20260811120000abcdef123456',
  payAmount: 1990,
  isZeroPay: false,
  status: 'pending_payment' as const,
  fulfillmentType: 'delivery',
}

describe('createOrder client request identity', () => {
  it('reuses the same persisted clientRequestId after an ambiguous network failure', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(1786449600000)
    vi.spyOn(Math, 'random').mockReturnValue(0.123456789)
    vi.mocked(post)
      .mockRejectedValueOnce(new Error('请求超时，请稍后重试'))
      .mockResolvedValueOnce(successResult)

    await expect(createOrder(payload)).rejects.toThrow('请求超时')
    const firstRequest = vi.mocked(post).mock.calls[0][1] as any
    expect(firstRequest.clientRequestId).toMatch(/^\d{13}-[a-z0-9]{16,40}$/i)
    expect(storage.size).toBe(1)

    await expect(createOrder(payload)).resolves.toEqual(successResult)
    const secondRequest = vi.mocked(post).mock.calls[1][1] as any
    expect(secondRequest.clientRequestId).toBe(firstRequest.clientRequestId)
    expect(storage.size).toBe(0)
  })

  it('clears the pending request identity only after a confirmed success response', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(1786449600000)
    vi.spyOn(Math, 'random').mockReturnValue(0.222222222)
    vi.mocked(post).mockResolvedValueOnce(successResult)

    await createOrder(payload)

    expect(storage.size).toBe(0)
  })

  it('discards an expired local request identity and creates a fresh one', async () => {
    storage.set('baby_mall_pending_order_create', {
      clientRequestId: '1786449600000-abcdefghijklmnopqrstuvwx',
      createdAt: 1786449600000,
    })
    vi.spyOn(Date, 'now').mockReturnValue(1786449600000 + 3 * 60 * 60 * 1000)
    vi.spyOn(Math, 'random').mockReturnValue(0.333333333)
    vi.mocked(post).mockResolvedValueOnce(successResult)

    await createOrder(payload)

    const request = vi.mocked(post).mock.calls[0][1] as any
    expect(request.clientRequestId).not.toBe('1786449600000-abcdefghijklmnopqrstuvwx')
  })
})
