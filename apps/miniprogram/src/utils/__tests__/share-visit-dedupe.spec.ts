import { beforeEach, describe, expect, it, vi } from 'vitest'
import { handleShareVisit } from '../share'
import { recordVisit } from '@/api/share'

vi.mock('@/api/share', () => ({
  recordVisit: vi.fn(),
  bindInvite: vi.fn(),
}))

beforeEach(() => {
  vi.clearAllMocks()
  ;(globalThis as any).uni = {
    getStorageSync: vi.fn(() => ''),
    setStorageSync: vi.fn(),
    removeStorageSync: vi.fn(),
  }
})

describe('分享访问生命周期去重', () => {
  it('同一冷启动重复上报只计一次，不同访问或失败重试仍可上报', async () => {
    let now = 1_000_000
    vi.spyOn(Date, 'now').mockImplementation(() => now)
    vi.mocked(recordVisit).mockResolvedValue({ recorded: true } as any)

    const sameVisit = {
      inviter: '1001',
      shareRecordId: '2001',
      campaignId: '3001',
    }

    handleShareVisit(sameVisit)
    handleShareVisit(sameVisit)
    await Promise.resolve()

    expect(recordVisit).toHaveBeenCalledTimes(1)
    expect(recordVisit).toHaveBeenLastCalledWith({
      inviter: '1001',
      shareRecordId: '2001',
      campaignId: '3001',
      sceneCode: undefined,
    })

    now += 2_001
    handleShareVisit(sameVisit)
    await Promise.resolve()
    expect(recordVisit).toHaveBeenCalledTimes(2)

    now += 10
    handleShareVisit({ ...sameVisit, shareRecordId: '2002' })
    await Promise.resolve()
    expect(recordVisit).toHaveBeenCalledTimes(3)

    now += 10
    vi.mocked(recordVisit).mockRejectedValueOnce(new Error('network down'))
    const retryableVisit = { inviter: '1001', shareRecordId: '2003' }
    handleShareVisit(retryableVisit)
    await Promise.resolve()
    await Promise.resolve()
    expect(recordVisit).toHaveBeenCalledTimes(4)

    vi.mocked(recordVisit).mockResolvedValueOnce({ recorded: true } as any)
    handleShareVisit(retryableVisit)
    await Promise.resolve()
    expect(recordVisit).toHaveBeenCalledTimes(5)
  })
})
