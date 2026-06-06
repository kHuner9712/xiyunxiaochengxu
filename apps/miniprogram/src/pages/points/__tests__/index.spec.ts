import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import PointsPage from '../index.vue'
import { checkIn, getCheckInStatus, getPointsBalance, getPointsDetail, getPointsRules } from '@/api/points'

vi.mock('@dcloudio/uni-app', () => ({
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
  vi.mocked(getPointsBalance).mockResolvedValue({ balance: 88, totalEarned: 120, totalSpent: 32 })
  vi.mocked(getCheckInStatus).mockResolvedValue({ checked: false, continuous: 3, todayPoints: 16 })
  vi.mocked(getPointsDetail).mockResolvedValue({ list: [], total: 0 })
  vi.mocked(getPointsRules).mockResolvedValue([
    { action: '每日签到', points: 10, dailyLimit: 1, description: '每日签到得积分' },
    { action: '积分抵扣', points: 0, dailyLimit: 0, description: '每100积分抵扣1元' },
  ])
  vi.mocked(checkIn).mockResolvedValue({ points: 18, continuous: 4 })
  ;(globalThis as any).uni = {
    showToast: vi.fn(),
    stopPullDownRefresh: vi.fn(),
  }
})

describe('积分中心', () => {
  it('渲染余额、签到状态和积分规则数组', async () => {
    const wrapper = mount(PointsPage, {
      global: {
        stubs: {
          Loading: true,
        },
      },
    })
    await flushPromises()

    expect(wrapper.text()).toContain('88')
    expect(wrapper.text()).toContain('120')
    expect(wrapper.text()).toContain('32')
    expect(wrapper.text()).toContain('已连续签到3天')
    expect(wrapper.text()).toContain('每日签到')
    expect(wrapper.text()).toContain('积分抵扣')
    expect(wrapper.text()).not.toContain('undefined')
  })

  it('签到成功后刷新连续天数、积分和明细', async () => {
    const wrapper = mount(PointsPage, {
      global: {
        stubs: {
          Loading: true,
        },
      },
    })
    await flushPromises()

    await wrapper.find('.checkin-btn').trigger('tap')
    await flushPromises()

    expect(checkIn).toHaveBeenCalled()
    expect(wrapper.text()).toContain('已连续签到4天')
    expect((globalThis as any).uni.showToast).toHaveBeenCalledWith({
      title: '签到成功，+18积分',
      icon: 'none',
    })
    expect(getPointsBalance).toHaveBeenCalledTimes(2)
    expect(getPointsDetail).toHaveBeenLastCalledWith({ page: 1, pageSize: 10 })
  })
})
