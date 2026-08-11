import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import MyGroupPage from '../my.vue'

const now = new Date('2026-08-10T12:00:00.000Z')

const uniAppMock = vi.hoisted(() => ({
  onShowCallbacks: [] as Array<() => void>,
  onHideCallbacks: [] as Array<() => void>,
  onUnloadCallbacks: [] as Array<() => void>,
}))

const groupBuyMock = vi.hoisted(() => ({
  getMyGroups: vi.fn(),
}))

vi.mock('@dcloudio/uni-app', () => ({
  onReachBottom: vi.fn(),
  onShow: vi.fn((callback: () => void) => uniAppMock.onShowCallbacks.push(callback)),
  onHide: vi.fn((callback: () => void) => uniAppMock.onHideCallbacks.push(callback)),
  onUnload: vi.fn((callback: () => void) => uniAppMock.onUnloadCallbacks.push(callback)),
}))

vi.mock('@/api/group-buy', () => ({
  groupBuyApi: groupBuyMock,
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

function group(status: string) {
  return {
    id: '10',
    activityId: '20',
    status,
    groupNo: 'G20260810001',
    currentCount: status === 'success' ? 2 : 1,
    targetCount: 2,
    expiresAt: new Date(now.getTime() + 1500).toISOString(),
    createdAt: now.toISOString(),
    activity: {
      id: '20',
      name: '测试拼团',
      coverImage: '',
      groupPrice: 9900,
      groupSize: 2,
    },
  }
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(now)
  vi.clearAllMocks()
  uniAppMock.onShowCallbacks = []
  uniAppMock.onHideCallbacks = []
  uniAppMock.onUnloadCallbacks = []
  groupBuyMock.getMyGroups.mockResolvedValue({
    list: [group('forming')],
    total: 1,
  })
  ;(globalThis as any).uni = {
    showToast: vi.fn(),
    navigateTo: vi.fn(),
  }
})

afterEach(() => {
  vi.useRealTimers()
})

describe('我的拼团实时状态', () => {
  it('跨过成团截止时间后无需重新请求即可显示已过期', async () => {
    const wrapper = mount(MyGroupPage, {
      global: { stubs: { Loading: true, Empty: true } },
    })

    uniAppMock.onShowCallbacks.at(-1)?.()
    await flushPromises()
    expect(wrapper.find('.status-tag').text()).toBe('组团中')

    await vi.advanceTimersByTimeAsync(2000)
    await flushPromises()

    expect(wrapper.find('.status-tag').text()).toBe('已过期')
    expect(wrapper.find('.remain').text()).toContain('已过期')

    uniAppMock.onHideCallbacks.at(-1)?.()
    wrapper.unmount()
  })

  it('返回前台后的已成团状态先到时，旧组团中请求晚到不能回滚状态', async () => {
    const first = deferred<any>()
    const second = deferred<any>()
    groupBuyMock.getMyGroups
      .mockImplementationOnce(() => first.promise)
      .mockImplementationOnce(() => second.promise)

    const wrapper = mount(MyGroupPage, {
      global: { stubs: { Loading: true, Empty: true } },
    })

    uniAppMock.onShowCallbacks.at(-1)?.()
    await Promise.resolve()
    uniAppMock.onHideCallbacks.at(-1)?.()
    uniAppMock.onShowCallbacks.at(-1)?.()
    await Promise.resolve()
    expect(groupBuyMock.getMyGroups).toHaveBeenCalledTimes(2)

    second.resolve({ list: [group('success')], total: 1 })
    await flushPromises()
    expect(wrapper.find('.status-tag').text()).toBe('已成团')

    first.resolve({ list: [group('forming')], total: 1 })
    await flushPromises()

    expect(wrapper.find('.status-tag').text()).toBe('已成团')
    expect((wrapper.vm as any).groupList[0].status).toBe('success')
    uniAppMock.onHideCallbacks.at(-1)?.()
    wrapper.unmount()
  })
})
