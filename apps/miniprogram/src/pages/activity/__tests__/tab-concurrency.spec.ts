import { mount, flushPromises } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ActivityPage from '../index.vue'
import { getActivityFeed } from '@/api/activity'

vi.mock('@dcloudio/uni-app', () => ({
  onHide: vi.fn(),
  onReachBottom: vi.fn(),
  onPullDownRefresh: vi.fn(),
  onShow: vi.fn(),
  onUnload: vi.fn(),
}))

vi.mock('@/api/activity', () => ({
  getActivityFeed: vi.fn(),
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

function mountPage() {
  return mount(ActivityPage, {
    global: {
      stubs: {
        CountdownTimer: true,
        Loading: true,
        Empty: true,
      },
    },
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  ;(globalThis as any).uni = {
    showToast: vi.fn(),
    navigateTo: vi.fn(),
    stopPullDownRefresh: vi.fn(),
  }
})

describe('activity feed tab concurrency', () => {
  it('keeps the latest tab when an older request resolves later', async () => {
    const oldRequest = deferred<any>()
    const latestRequest = deferred<any>()
    vi.mocked(getActivityFeed)
      .mockImplementationOnce(() => oldRequest.promise)
      .mockImplementationOnce(() => latestRequest.promise)

    const wrapper = mountPage()
    const vm = wrapper.vm as any

    const oldLoad = vm.refreshFeed()
    vm.switchTab('discount')

    expect(getActivityFeed).toHaveBeenNthCalledWith(1, expect.objectContaining({ tab: 'recommend', page: 1 }))
    expect(getActivityFeed).toHaveBeenNthCalledWith(2, expect.objectContaining({ tab: 'discount', page: 1 }))

    latestRequest.resolve({
      list: [{ type: 'activity', id: 'discount-1', title: '优惠活动' }],
      total: 1,
    })
    await flushPromises()

    expect(vm.currentTab).toBe('discount')
    expect(vm.feedList.map((item: any) => item.id)).toEqual(['discount-1'])

    oldRequest.resolve({
      list: [{ type: 'activity', id: 'recommend-1', title: '旧推荐' }],
      total: 1,
    })
    await oldLoad
    await flushPromises()

    expect(vm.currentTab).toBe('discount')
    expect(vm.feedList.map((item: any) => item.id)).toEqual(['discount-1'])
  })
})
