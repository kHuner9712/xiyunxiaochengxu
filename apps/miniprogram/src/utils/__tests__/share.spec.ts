import { beforeEach, describe, expect, it, vi } from 'vitest'
import { handleShareBindOnLogin, savePendingInvite } from '../share'
import { bindInvite } from '@/api/share'

vi.mock('@/api/share', () => ({
  recordVisit: vi.fn(),
  bindInvite: vi.fn(),
}))

const storage = new Map<string, string>()

beforeEach(() => {
  vi.clearAllMocks()
  storage.clear()
  ;(globalThis as any).uni = {
    getStorageSync: vi.fn((key: string) => storage.get(key) || ''),
    setStorageSync: vi.fn((key: string, value: string) => storage.set(key, value)),
    removeStorageSync: vi.fn((key: string) => storage.delete(key)),
  }
})

describe('分享邀请绑定', () => {
  it('分享进入未登录时保存 pending_invite', () => {
    savePendingInvite({ inviter: '100', shareRecordId: 'record-1' })

    expect((globalThis as any).uni.setStorageSync).toHaveBeenCalledWith(
      'pending_invite',
      JSON.stringify({ inviter: '100', shareRecordId: 'record-1' }),
    )
  })

  it('只有 shareRecordId 的分享也会保存 pending_invite', () => {
    savePendingInvite({ shareRecordId: 'record-2' })

    expect((globalThis as any).uni.setStorageSync).toHaveBeenCalledWith(
      'pending_invite',
      JSON.stringify({ shareRecordId: 'record-2' }),
    )
  })

  it('登录后绑定 pending_invite 并清理，避免重复绑定', async () => {
    storage.set('pending_invite', JSON.stringify({ inviter: '100', shareRecordId: 'record-1' }))
    vi.mocked(bindInvite).mockResolvedValue({})

    await handleShareBindOnLogin()
    await handleShareBindOnLogin()

    expect(bindInvite).toHaveBeenCalledTimes(1)
    expect(bindInvite).toHaveBeenCalledWith({ inviter: '100', shareRecordId: 'record-1' })
    expect(storage.has('pending_invite')).toBe(false)
  })
})
