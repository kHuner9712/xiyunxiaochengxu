import { beforeEach, describe, expect, it, vi } from 'vitest'
import { previewOrder, type OrderPreview } from '../order'
import { post } from '@/utils/request'

vi.mock('@/utils/request', () => ({
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
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

function quote(payAmount: number): OrderPreview {
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

beforeEach(() => {
  vi.clearAllMocks()
})

describe('previewOrder concurrency', () => {
  it('a slower stale quote resolves to the newest quote instead of overwriting it', async () => {
    const oldRequest = deferred<OrderPreview>()
    const latestRequest = deferred<OrderPreview>()
    vi.mocked(post)
      .mockImplementationOnce(() => oldRequest.promise as any)
      .mockImplementationOnce(() => latestRequest.promise as any)

    const oldCall = previewOrder({
      items: [{ skuId: '1', quantity: 1 }],
      addressId: '10',
      couponId: 'old-coupon',
    })
    const latestCall = previewOrder({
      items: [{ skuId: '1', quantity: 1 }],
      addressId: '10',
      couponId: 'latest-coupon',
    })

    latestRequest.resolve(quote(2000))
    await expect(latestCall).resolves.toMatchObject({ payAmount: 2000 })

    oldRequest.resolve(quote(9000))
    await expect(oldCall).resolves.toMatchObject({ payAmount: 2000 })
  })

  it('a stale request failure does not erase a newer successful quote', async () => {
    const oldRequest = deferred<OrderPreview>()
    const latestRequest = deferred<OrderPreview>()
    vi.mocked(post)
      .mockImplementationOnce(() => oldRequest.promise as any)
      .mockImplementationOnce(() => latestRequest.promise as any)

    const oldCall = previewOrder({ items: [{ skuId: '2', quantity: 1 }], addressId: '11' })
    const latestCall = previewOrder({ items: [{ skuId: '2', quantity: 1 }], addressId: '12' })

    oldRequest.reject(new Error('old quote timed out'))
    latestRequest.resolve(quote(3200))

    await expect(latestCall).resolves.toMatchObject({ payAmount: 3200 })
    await expect(oldCall).resolves.toMatchObject({ payAmount: 3200 })
  })

  it('the newest request still surfaces its own failure', async () => {
    vi.mocked(post).mockRejectedValueOnce(new Error('latest quote failed'))

    await expect(previewOrder({
      items: [{ skuId: '3', quantity: 1 }],
      addressId: '13',
    })).rejects.toThrow('latest quote failed')
  })
})
