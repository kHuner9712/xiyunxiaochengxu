import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { post } from '@/utils/request'
import { flashSaleApi } from '../flash-sale'
import { groupBuyApi } from '../group-buy'
import { createActivityOrder, previewActivityOrder } from '../activity'

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

afterEach(() => vi.restoreAllMocks())

const flashPayload = {
  activityId: '101',
  quantity: 1,
  addressId: '10',
  fulfillmentType: 'delivery',
}

const flashResult = {
  flashSaleOrderId: '301',
  orderId: '201',
  flashPrice: 990,
  quantity: 1,
  lockExpireAt: '2026-08-11T14:00:00.000Z',
  isZeroPay: false,
  orderStatus: 'pending_payment',
  fulfillmentType: 'delivery',
}

describe('promotion checkout request identities', () => {
  it('reuses the same flash-sale request id after an ambiguous network failure', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(1786449600000)
    vi.spyOn(Math, 'random').mockReturnValue(0.123456789)
    vi.mocked(post)
      .mockRejectedValueOnce(new Error('请求超时，请稍后重试'))
      .mockResolvedValueOnce(flashResult)

    await expect(flashSaleApi.buy(flashPayload)).rejects.toThrow('请求超时')
    const first = vi.mocked(post).mock.calls[0][1] as any
    expect(first.clientRequestId).toMatch(/^\d{13}-[a-z0-9]{16,40}$/i)
    expect(storage.size).toBe(1)

    await expect(flashSaleApi.buy(flashPayload)).resolves.toEqual(flashResult)
    const second = vi.mocked(post).mock.calls[1][1] as any
    expect(second.clientRequestId).toBe(first.clientRequestId)
    expect(storage.size).toBe(0)
  })

  it('creates a new request id when the promotion purchase intent changes', async () => {
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
    vi.mocked(post)
      .mockRejectedValueOnce(new Error('请求超时，请稍后重试'))
      .mockResolvedValueOnce(flashResult)

    await expect(flashSaleApi.buy(flashPayload)).rejects.toThrow('请求超时')
    const first = vi.mocked(post).mock.calls[0][1] as any

    await flashSaleApi.buy({ ...flashPayload, addressId: '11' })
    const second = vi.mocked(post).mock.calls[1][1] as any
    expect(second.clientRequestId).not.toBe(first.clientRequestId)
  })

  it('keeps start and join group-buy pending state isolated by operation and target', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(1786449600000)
    vi.spyOn(Math, 'random').mockReturnValue(0.333333333)
    vi.mocked(post)
      .mockRejectedValueOnce(new Error('请求超时'))
      .mockResolvedValueOnce({
        groupId: '501',
        groupNo: 'GB501',
        orderId: '601',
        role: 'member',
        isZeroPay: false,
        orderStatus: 'pending_payment',
      })

    await expect(groupBuyApi.start({
      activityId: '401',
      addressId: '10',
      fulfillmentType: 'delivery',
    })).rejects.toThrow('请求超时')

    const startKey = 'baby_mall_pending_promotion_checkout:group-buy:start:401'
    const joinKey = 'baby_mall_pending_promotion_checkout:group-buy:join:501'
    const startPending = storage.get(startKey)
    expect(startPending?.clientRequestId).toMatch(/^\d{13}-[a-z0-9]{16,40}$/i)
    expect(storage.has(joinKey)).toBe(false)

    await groupBuyApi.join({
      groupId: '501',
      addressId: '10',
      fulfillmentType: 'delivery',
    })

    // The join operation may coincidentally generate the same random request-id string, but its
    // persisted scope and server-side deterministic-order scope are distinct. Clearing a successful
    // join must therefore never erase the unresolved start request.
    expect(storage.has(joinKey)).toBe(false)
    expect(storage.get(startKey)).toEqual(startPending)
  })

  it('adds request identity only to activity create, not preview', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(1786449600000)
    vi.spyOn(Math, 'random').mockReturnValue(0.444444444)
    vi.mocked(post)
      .mockResolvedValueOnce({ payAmount: 990 })
      .mockResolvedValueOnce({
        orderId: '701',
        orderNo: 'XY20260811200000abcdef123456',
        payAmount: 990,
        isZeroPay: false,
        status: 'pending_payment',
        fulfillmentType: 'delivery',
        activityId: '801',
        activityProductId: '901',
      })

    const payload = {
      activityProductId: '901',
      skuId: '1001',
      quantity: 1,
      addressId: '10',
      fulfillmentType: 'delivery' as const,
    }
    await previewActivityOrder('801', payload)
    expect((vi.mocked(post).mock.calls[0][1] as any).clientRequestId).toBeUndefined()

    await createActivityOrder('801', payload)
    expect((vi.mocked(post).mock.calls[1][1] as any).clientRequestId)
      .toMatch(/^\d{13}-[a-z0-9]{16,40}$/i)
    expect(storage.size).toBe(0)
  })

  it('clears a recovered cancelled promotion order identity before asking for a fresh submission', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(1786449600000)
    vi.spyOn(Math, 'random').mockReturnValue(0.555555555)
    vi.mocked(post).mockResolvedValueOnce({ ...flashResult, orderStatus: 'cancelled' })

    await expect(flashSaleApi.buy(flashPayload)).rejects.toThrow('上次提交对应秒杀订单已取消')
    expect(storage.size).toBe(0)
  })
})
