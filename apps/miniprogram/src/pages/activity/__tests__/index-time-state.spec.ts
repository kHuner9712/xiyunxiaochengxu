import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import ActivityIndexPage from '../index.vue'
import { getActivityFeed } from '@/api/activity'

const now = new Date('2026-06-06T00:00:00.000Z')

const uniAppMock = vi.hoisted(() => ({
  onShowCallbacks: [] as Array<() => void>,
  onHideCallbacks: [] as Array<() => void>,
  onUnloadCallbacks: [] as Array<() => void>,
}))

vi.mock('@dcloudio/uni-app', () => ({
  onReachBottom: vi.fn(),
  onPullDownRefresh: vi.fn(),
  onShow: vi.fn((callback: () => void) => {
    uniAppMock.onShowCallbacks.push(callback)
  }),
  onHide: vi.fn((callback: () => void) => {
    uniAppMock.onHideCallbacks.push(callback)
  }),
  onUnload: vi.fn((callback: () => void) => {
    uniAppMock.onUnloadCallbacks.push(callback)
  }),
}))

vi.mock('@/api/activity', () => ({
  getActivityFeed: vi.fn(),
}))

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(now)
  vi.clearAllMocks()
  uniAppMock.onShowCallbacks = []
  uniAppMock.onHideCallbacks = []
  uniAppMock.onUnloadCallbacks = []
  vi.mocked(getActivityFeed).mockResolvedValue({
    list: [{
      id: '1',
      type: 'activity',
      title: '即将开始活动',
      image: '',
      summary: '',
      startTime: new Date(now.getTime() + 1000).toISOString(),
      endTime: new Date(now.getTime() + 60 * 1000).toISOString(),
      activityType: '1',
    }],
    total: 1,
  } as any)
  ;(globalThis as any).uni = {
    showToast: vi.fn(),
    navigateTo: vi.fn(),
    stopPullDownRefresh: vi.fn(),
  }
})

afterEach(() => {
  vi.useRealTimers()
})

describe('活动列表实时状态', () => {
  it('跨过开始时间后卡片状态无需刷新即可从即将开始变为进行中', async () => {
    const wrapper = mount(ActivityIndexPage, {
      global: {
        stubs: {
          CountdownTimer: true,
          Loading: true,
          Empty: true,
        },
      },
    })
    await flushPromises()
    uniAppMock.onShowCallbacks.at(-1)?.()
    await flushPromises()

    expect(wrapper.find('.feed-status').text()).toBe('即将开始')

    await vi.advanceTimersByTimeAsync(1500)
    await flushPromises()

    expect(wrapper.find('.feed-status').text()).toBe('进行中')
    uniAppMock.onHideCallbacks.at(-1)?.()
    wrapper.unmount()
  })
})
