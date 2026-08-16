import { beforeEach, describe, expect, it, vi } from 'vitest'
import { cancelAccount } from '../auth'
import { del, removeToken, REDIRECT_AFTER_LOGIN_KEY } from '@/utils/request'
import { clearShareAttributionState } from '@/utils/share'
import { clearPersistentIdempotencyState } from '@/utils/checkout-idempotency'

vi.mock('@/utils/request', () => ({
  del: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  removeToken: vi.fn(),
  REDIRECT_AFTER_LOGIN_KEY: 'baby_mall_redirect_after_login',
}))

vi.mock('@/utils/share', () => ({
  clearShareAttributionState: vi.fn(),
}))

vi.mock('@/utils/checkout-idempotency', () => ({
  clearPersistentIdempotencyState: vi.fn(),
}))

beforeEach(() => {
  vi.clearAllMocks()
  ;(globalThis as any).uni = {
    removeStorageSync: vi.fn(),
  }
})

describe('account cancellation device cleanup', () => {
  it('only clears account-bound device state after the server confirms cancellation', async () => {
    vi.mocked(del).mockResolvedValue({
      cancelled: true,
      cancelledAt: '2026-08-17T03:00:00.000Z',
    } as any)

    await expect(cancelAccount()).resolves.toMatchObject({ cancelled: true })

    expect(del).toHaveBeenCalledWith('/weapp/user/account')
    expect(removeToken).toHaveBeenCalledTimes(1)
    expect((globalThis as any).uni.removeStorageSync).toHaveBeenCalledWith(REDIRECT_AFTER_LOGIN_KEY)
    expect(clearShareAttributionState).toHaveBeenCalledTimes(1)
    expect(clearPersistentIdempotencyState).toHaveBeenCalledTimes(1)
  })

  it('keeps local account context intact when the server rejects cancellation', async () => {
    vi.mocked(del).mockRejectedValue(new Error('存在处理中售后单'))

    await expect(cancelAccount()).rejects.toThrow('存在处理中售后单')

    expect(removeToken).not.toHaveBeenCalled()
    expect((globalThis as any).uni.removeStorageSync).not.toHaveBeenCalled()
    expect(clearShareAttributionState).not.toHaveBeenCalled()
    expect(clearPersistentIdempotencyState).not.toHaveBeenCalled()
  })
})
