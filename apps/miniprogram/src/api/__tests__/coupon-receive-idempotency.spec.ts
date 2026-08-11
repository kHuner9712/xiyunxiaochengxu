import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { post } from '@/utils/request'
import { receiveCoupon } from '../coupon'

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

describe('coupon receive weak-network idempotency', () => {
  it('reuses one request identity after timeout and clears it only after concrete success', async () => {
    const dateSpy = vi.spyOn(Date, 'now').mockReturnValue(1786449600000)
    vi.spyOn(Math, 'random').mockReturnValue(0.246813579)
    vi.mocked(post)
      .mockRejectedValueOnce(new Error('请求超时，请稍后重试'))
      .mockResolvedValueOnce({ id: '9001', couponId: '11' })
      .mockResolvedValueOnce({ id: '9002', couponId: '11' })

    await expect(receiveCoupon('11')).rejects.toThrow('请求超时')
    const firstRequestId = (vi.mocked(post).mock.calls[0][1] as any).clientRequestId
    expect(firstRequestId).toMatch(/^\d{13}-[a-z0-9]{16,40}$/i)
    expect(storage.size).toBe(1)

    await expect(receiveCoupon('11')).resolves.toMatchObject({ id: '9001' })
    const retryRequestId = (vi.mocked(post).mock.calls[1][1] as any).clientRequestId
    expect(retryRequestId).toBe(firstRequestId)
    expect(storage.size).toBe(0)

    dateSpy.mockReturnValue(1786449601000)
    await expect(receiveCoupon('11')).resolves.toMatchObject({ id: '9002' })
    const intentionalSecondRequestId = (vi.mocked(post).mock.calls[2][1] as any).clientRequestId
    expect(intentionalSecondRequestId).not.toBe(firstRequestId)
    expect(storage.size).toBe(0)
  })
})
