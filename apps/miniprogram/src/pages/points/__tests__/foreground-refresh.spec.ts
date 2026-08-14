import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import PointsPage from '../index.vue'
import { checkIn, getCheckInStatus, getPointsBalance, getPointsDetail, getPointsRules } from '@/api/points'

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

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

function record(id: string, description: string) {
  return {
    id,
    type: 1,
    points: 10,
    balance: 10,
    source: 'test',
    description,
    createdAt: '2026-08-11T00:00:00.000Z',
  } as any
}

beforeEach(() => {
  vi.clearAllMocks()
  uniAppMock.onShowCallbacks = []
  vi.mocked(getPointsBalance).mockResolvedValue({ balance: 10, totalEarned: 10, totalSpent: 0 } as any)
  vi.mocked(getCheckInStatus).mockResolvedValue({ checked: true, continuous: 3, todayPoints: 1 } as any)
  vi.mocked(getPointsDetail).mockResolvedValue({ list: [], total: 0 } as any)
  vi.mocked(getPointsRules).mockResolvedValue([] as any)
  vi.mocked(checkIn).mockResolvedValue({ points: 10, continuous: 4 } as any)
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

  it('签到成功后，之前发出的旧未签到状态晚到也不能重新打开签到按钮', async () => {
    const staleStatus = deferred<any>()
    vi.mocked(getCheckInStatus).mockImplementationOnce(() => staleStatus.promise)
    const wrapper = mount(PointsPage, {
      global: { stubs: { Loading: true } },
    })

    uniAppMock.onShowCallbacks.at(-1)?.()
    await Promise.resolve()

    const vm = wrapper.vm as any
    await vm.handleCheckIn()
    await flushPromises()
    expect(vm.checkInStatus.checked).toBe(true)
    expect(wrapper.find('.checkin-text').text()).toBe('已签到')

    staleStatus.resolve({ checked: false, continuous: 0, todayPoints: 0 })
    await flushPromises()

    expect(vm.checkInStatus.checked).toBe(true)
    expect(wrapper.find('.checkin-text').text()).toBe('已签到')
  })

  it('新的积分明细先返回后，旧分页请求晚到不能恢复旧账本', async () => {
    const first = deferred<any>()
    const second = deferred<any>()
    vi.mocked(getPointsDetail)
      .mockImplementationOnce(() => first.promise)
      .mockImplementationOnce(() => second.promise)

    const wrapper = mount(PointsPage, {
      global: { stubs: { Loading: true } },
    })

    uniAppMock.onShowCallbacks.at(-1)?.()
    await Promise.resolve()
    uniAppMock.onShowCallbacks.at(-1)?.()
    await Promise.resolve()
    expect(getPointsDetail).toHaveBeenCalledTimes(2)

    second.resolve({ list: [record('new', '最新积分记录')], total: 1 })
    await flushPromises()
    expect((wrapper.vm as any).pointsDetail.map((item: any) => item.id)).toEqual(['new'])
    expect(wrapper.text()).toContain('最新积分记录')

    first.resolve({ list: [record('old', '旧积分记录')], total: 1 })
    await flushPromises()

    expect((wrapper.vm as any).pointsDetail.map((item: any) => item.id)).toEqual(['new'])
    expect(wrapper.text()).not.toContain('旧积分记录')
    expect((wrapper.vm as any).loading).toBe(false)
  })
})
