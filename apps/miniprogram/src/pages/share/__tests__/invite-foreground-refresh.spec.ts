import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import InvitePage from '../invite.vue'
import { getMyRewards, getMyShareStats } from '@/api/share'

const uniAppMock = vi.hoisted(() => ({
  onShowCallbacks: [] as Array<() => void>,
}))

vi.mock('@dcloudio/uni-app', () => ({
  onShow: vi.fn((callback: () => void) => uniAppMock.onShowCallbacks.push(callback)),
  onShareAppMessage: vi.fn(),
}))

vi.mock('@/stores/user', () => ({
  useUserStore: () => ({
    userInfo: { id: '100' },
    isLoggedIn: true,
    requireLogin: vi.fn(),
  }),
}))

vi.mock('@/api/share', () => ({
  getMyShareStats: vi.fn(),
  getMyRewards: vi.fn(),
}))

beforeEach(() => {
  vi.clearAllMocks()
  uniAppMock.onShowCallbacks = []
  vi.mocked(getMyShareStats).mockResolvedValue({
    inviteCount: 1,
    totalRewardPoints: 0,
    recentInvites: [],
  } as any)
  vi.mocked(getMyRewards).mockResolvedValue({ list: [], total: 0 } as any)
  ;(globalThis as any).uni = {
    navigateTo: vi.fn(),
  }
})

describe('邀请奖励前台刷新', () => {
  it('好友完成首单后返回页面即可看到最新奖励和统计', async () => {
    const wrapper = mount(InvitePage)

    uniAppMock.onShowCallbacks.at(-1)?.()
    await flushPromises()
    expect(wrapper.text()).toContain('邀请人数')
    expect(wrapper.text()).not.toContain('首单奖励已到账')

    vi.mocked(getMyShareStats).mockResolvedValueOnce({
      inviteCount: 1,
      totalRewardPoints: 100,
      recentInvites: [],
    } as any)
    vi.mocked(getMyRewards).mockResolvedValueOnce({
      list: [{
        id: '1',
        rewardType: 'points',
        rewardName: '首单奖励已到账',
        sourceType: 'first_paid_order',
        status: 'issued',
        createdAt: '2026-08-10T00:00:00.000Z',
      }],
      total: 1,
    } as any)

    uniAppMock.onShowCallbacks.at(-1)?.()
    await flushPromises()

    expect(wrapper.text()).toContain('100')
    expect(wrapper.text()).toContain('首单奖励已到账')
    expect(getMyShareStats).toHaveBeenCalledTimes(2)
    expect(getMyRewards).toHaveBeenCalledTimes(2)
  })
})
