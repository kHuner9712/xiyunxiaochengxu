import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createActivityOrder, previewActivityOrder, type ActivityOrderPreview } from '../activity'
import { post } from '@/utils/request'

vi.mock('@/utils/request', () => ({
  get: vi.fn(),
  post: vi.fn(),
}))

vi.mock('@/utils/checkout-idempotency', () => ({
  runIdempotentCheckout: vi.fn(),
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

function quote(payAmount: number): ActivityOrderPreview {
  return {
    activityId: '1',
    activityProductId: '10',
    activityType: '1',
    promotionLabel: '活动价',
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
    fulfillmentType: 'delivery',
    isZeroPay: false,
    promotionStackingDisabled: true,
    maxQuantity: 5,
  }
}

const baseInput = {
  activityProductId: '10',
  skuId: '20',
  quantity: 1,
  fulfillmentType: 'delivery' as const,
  addressId: '30',
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('activity checkout preview concurrency', () => {
  it('a slower stale activity quote converges to the newest user choice', async () => {
    const oldRequest = deferred<ActivityOrderPreview>()
    const latestRequest = deferred<ActivityOrderPreview>()
    vi.mocked(post)
      .mockImplementationOnce(() => oldRequest.promise as any)
      .mockImplementationOnce(() => latestRequest.promise as any)

    const oldCall = previewActivityOrder('1', baseInput)
    const latestCall = previewActivityOrder('1', { ...baseInput, quantity: 2 })

    latestRequest.resolve(quote(3600))
    await expect(latestCall).resolves.toMatchObject({ payAmount: 3600 })

    oldRequest.resolve(quote(1800))
    await expect(oldCall).resolves.toMatchObject({ payAmount: 3600 })
  })

  it('does not create an activity order while the newest matching quote is unsettled', async () => {
    const pending = deferred<ActivityOrderPreview>()
    vi.mocked(post).mockImplementationOnce(() => pending.promise as any)
    const changedInput = { ...baseInput, quantity: 3 }

    const previewPromise = previewActivityOrder('1', changedInput)
    await expect(createActivityOrder('1', changedInput)).rejects.toThrow('活动金额正在重新计算，请稍后再提交')

    pending.resolve(quote(5400))
    await expect(previewPromise).resolves.toMatchObject({ payAmount: 5400 })
  })
})
