import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import PointsPage from '../index.vue'
import { getCheckInStatus, getPointsBalance, getPointsDetail, getPointsRules } from '@/api/points'

const uniAppMock = vi.hoisted(() => ({
  onShowCallbacks: [] as Array<() => void>,
}))

vi.mock('@dcloudio/uni-app', () => ({
  onShow: vi.fn((callback: () => void) => uniAppMock.onShowCallbacks.push(callback)),
  onReachBottom: vi.fn(),
  onPullDownRefresh: vi.fn(),
}))

vi.mock('@/api/points', () => ({
  getPointsBalance: vi.fn(),
  getPointsDetail: vi.fn(),
  checkIn: vi.fn(),
  getCheckInStatus: vi.fn(),
  getPointsRules: vi.fn(),
}))

beforeEach(() => {
  vi.clearAllMocks()
  uniAppMock.onShowCallbacks = []
  vi.mocked(getPointsBalance).mockResolvedValue({ balance: 10, totalEarned: 10, totalSpent: 0 } as any)
  vi.mocked(getCheckInStatus).mockResolvedValue({ checked: true, continuous: 3, todayPoints: 1 } as any)
  vi.mocked(getPointsDetail).mockResolvedValue({ list: [], total: 0 } as any)
  vi.mocked(getPointsRules).mockResolvedValue([] as any)
  ;(globalThis as any).uni = {
    showToast: vi.fn(),
    stopPullDownRefresh: vi.fn(),
  }
})

describe('积分中心前台刷新', () => {
  it('再次 onShow 时重新读取签到与余额，跨日后不会卡在已签到', async () => {
    const wrapper = mount(PointsPage, {
      global: { stubs: { Loading: true } },
    })

    uniAppMock.onShowCallbacks.at(-1)?.()
    await flushPromises()
    expect(wrapper.find('.balance-value').text()).toBe('10')
    expect(wrapper.find('.checkin-text').text()).toBe('已签到')

    vi.mocked(getPointsBalance).mockResolvedValueOnce({ balance: 20, totalEarned: 20, totalSpent: 0 } as any)
    vi.mocked(getCheckInStatus).mockResolvedValueOnce({ checked: false, continuous: 0, todayPoints: 0 } as any)

    uniAppMock.onShowCallbacks.at(-1)?.()
    await flushPromises()

    expect(wrapper.find('.balance-value').text()).toBe('20')
    expect(wrapper.find('.checkin-text').text()).toBe('签到')
    expect(getCheckInStatus).toHaveBeenCalledTimes(2)
  })
})
