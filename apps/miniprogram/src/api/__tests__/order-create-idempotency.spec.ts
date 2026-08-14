import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createOrder, previewOrder, type CreateOrderRequest, type OrderPreview } from '../order'
import { post } from '@/utils/request'

vi.mock('@/utils/request', () => ({
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
}))

const storage = new Map<string, any>()

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

const payload: CreateOrderRequest = {
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

function quote(payAmount = 1990): OrderPreview {
  return {
    items: [],
    totalAmount: payAmount,
    discountAmount: 0,
    couponAmount: 0,
    activityDiscountAmount: 0,
    pointsAmount: 0,
    pointsDeducted: 0,
    availablePoints: 0,
    maxPointsDeduct: 0,
    pointsDeductRate: 100,
    pointsDeductMaxPercent: 0,
    freightAmount: 0,
    payAmount,
  }
}

function toPreviewInput(data: CreateOrderRequest) {
  return {
    items: data.items.map((item) => ({ skuId: item.skuId, quantity: item.quantity })),
    addressId: data.addressId,
    pickupStoreId: data.pickupStoreId,
    fulfillmentType: data.fulfillmentType,
    couponId: data.couponId,
    pointsDeduct: data.pointsDeduct,
  }
}

async function primePreview(data: CreateOrderRequest = payload) {
  vi.mocked(post).mockReset()
  vi.mocked(post).mockResolvedValueOnce(quote())
  await previewOrder(toPreviewInput(data))
  vi.mocked(post).mockReset()
}

beforeEach(async () => {
  vi.clearAllMocks()
  storage.clear()
  ;(globalThis as any).uni = {
    getStorageSync: vi.fn((key: string) => storage.get(key) ?? ''),
    setStorageSync: vi.fn((key: string, value: any) => storage.set(key, value)),
    removeStorageSync: vi.fn((key: string) => storage.delete(key)),
  }
  await primePreview(payload)
})

afterEach(() => {
  vi.restoreAllMocks()
})

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

  it('does not reuse an ambiguous request identity after the purchase intent changes', async () => {
    vi.spyOn(Date, 'now')
      .mockReturnValueOnce(1786449600000)
      .mockReturnValueOnce(1786449600000)
      .mockReturnValueOnce(1786449601000)
      .mockReturnValueOnce(1786449601000)
    vi.spyOn(Math, 'random')
      .mockReturnValueOnce(0.111111111)
      .mockReturnValueOnce(0.111111111)
      .mockReturnValueOnce(0.111111111)
      .mockReturnValueOnce(0.777777777)
      .mockReturnValueOnce(0.777777777)
      .mockReturnValueOnce(0.777777777)
    vi.mocked(post).mockRejectedValueOnce(new Error('请求超时，请稍后重试'))

    await expect(createOrder(payload)).rejects.toThrow('请求超时')
    const firstRequest = vi.mocked(post).mock.calls[0][1] as any

    const changedPayload = {
      ...payload,
      couponId: '88',
    }
    await primePreview(changedPayload)
    vi.mocked(post).mockResolvedValueOnce(successResult)
    await createOrder(changedPayload)
    const secondRequest = vi.mocked(post).mock.calls[0][1] as any

    expect(secondRequest.clientRequestId).not.toBe(firstRequest.clientRequestId)
  })

  it('clears the pending request identity only after a confirmed success response', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(1786449600000)
    vi.spyOn(Math, 'random').mockReturnValue(0.222222222)
    vi.mocked(post).mockResolvedValueOnce(successResult)

    await createOrder(payload)

    expect(storage.size).toBe(0)
  })

  it('clears a recovered cancelled order identity and asks for a fresh submission', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(1786449600000)
    vi.spyOn(Math, 'random').mockReturnValue(0.222222222)
    vi.mocked(post).mockResolvedValueOnce({
      ...successResult,
      status: 'cancelled',
    })

    await expect(createOrder(payload)).rejects.toThrow('上次提交对应订单已取消')
    expect(storage.size).toBe(0)
  })

  it('discards an expired local request identity and creates a fresh one', async () => {
    storage.set('baby_mall_pending_order_create', {
      clientRequestId: '1786449600000-abcdefghijklmnopqrstuvwx',
      createdAt: 1786449600000,
      fingerprint: 'stale-fingerprint',
    })
    vi.spyOn(Date, 'now').mockReturnValue(1786449600000 + 3 * 60 * 60 * 1000)
    vi.spyOn(Math, 'random').mockReturnValue(0.333333333)
    vi.mocked(post).mockResolvedValueOnce(successResult)

    await createOrder(payload)

    const request = vi.mocked(post).mock.calls[0][1] as any
    expect(request.clientRequestId).not.toBe('1786449600000-abcdefghijklmnopqrstuvwx')
  })

  it('blocks order creation while the matching newest quote is still in flight', async () => {
    const changedPayload = { ...payload, couponId: 'pending-coupon' }
    const pendingQuote = deferred<OrderPreview>()
    vi.mocked(post).mockImplementationOnce(() => pendingQuote.promise as any)

    const previewPromise = previewOrder(toPreviewInput(changedPayload))

    await expect(createOrder(changedPayload)).rejects.toThrow('订单金额正在重新计算，请稍后再提交')
    expect(vi.mocked(post)).toHaveBeenCalledTimes(1)
    expect(vi.mocked(post).mock.calls[0][0]).toBe('/weapp/order/confirm')

    pendingQuote.resolve(quote(1880))
    await expect(previewPromise).resolves.toMatchObject({ payAmount: 1880 })
  })

  it('blocks order creation when the current purchase intent differs from the latest settled quote', async () => {
    const changedPayload = { ...payload, pointsDeduct: 100 }

    await expect(createOrder(changedPayload)).rejects.toThrow('订单金额正在重新计算，请稍后再提交')
    expect(vi.mocked(post)).not.toHaveBeenCalled()
  })
})
