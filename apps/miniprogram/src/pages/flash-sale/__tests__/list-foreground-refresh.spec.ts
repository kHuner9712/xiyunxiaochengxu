import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import FlashSaleListPage from '../list.vue'
import { flashSaleApi } from '@/api/flash-sale'

const uniAppMock = vi.hoisted(() => ({
  onShowCallbacks: [] as Array<() => void>,
  onHideCallbacks: [] as Array<() => void>,
  onUnloadCallbacks: [] as Array<() => void>,
}))

vi.mock('@dcloudio/uni-app', () => ({
  onShow: vi.fn((callback: () => void) => uniAppMock.onShowCallbacks.push(callback)),
  onHide: vi.fn((callback: () => void) => uniAppMock.onHideCallbacks.push(callback)),
  onUnload: vi.fn((callback: () => void) => uniAppMock.onUnloadCallbacks.push(callback)),
  onReachBottom: vi.fn(),
}))

vi.mock('@/api/flash-sale', () => ({
  flashSaleApi: {
    getList: vi.fn(),
  },
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

function activity(lockedCount: number) {
  return {
    id: 'flash-1',
    name: '真库秒杀',
    flashPrice: 990,
    originalPrice: 1290,
    stockLimit: 10,
    soldCount: 0,
    lockedCount,
    startTime: '2026-08-11T00:00:00.000Z',
    endTime: '2026-08-12T00:00:00.000Z',
    coverImage: '',
  } as any
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-08-11T08:00:00.000Z'))
  uniAppMock.onShowCallbacks = []
  uniAppMock.onHideCallbacks = []
  uniAppMock.onUnloadCallbacks = []
  ;(globalThis as any).uni = {
    showToast: vi.fn(),
    navigateTo: vi.fn(),
  }
})

afterEach(() => {
  uniAppMock.onHideCallbacks.at(-1)?.()
  vi.useRealTimers()
})

describe('秒杀列表前台库存刷新', () => {
  it('返回前台的新库存先到后，旧请求晚到不能恢复旧剩余库存', async () => {
    const first = deferred<any>()
    const second = deferred<any>()
    vi.mocked(flashSaleApi.getList)
      .mockImplementationOnce(() => first.promise)
      .mockImplementationOnce(() => second.promise)

    const wrapper = mount(FlashSaleListPage, {
      global: { stubs: { Loading: true, Empty: true } },
    })

    uniAppMock.onShowCallbacks.at(-1)?.()
    await Promise.resolve()
    uniAppMock.onHideCallbacks.at(-1)?.()
    uniAppMock.onShowCallbacks.at(-1)?.()
    await Promise.resolve()
    expect(flashSaleApi.getList).toHaveBeenCalledTimes(2)

    second.resolve({ list: [activity(5)], total: 1, page: 1, pageSize: 20 })
    await flushPromises()

    const vm = wrapper.vm as any
    expect(vm.activityList).toHaveLength(1)
    expect(vm.remainStock(vm.activityList[0])).toBe(5)
    expect(wrapper.text()).toContain('剩余 5 件')

    first.resolve({ list: [activity(0)], total: 1, page: 1, pageSize: 20 })
    await flushPromises()

    expect(vm.remainStock(vm.activityList[0])).toBe(5)
    expect(wrapper.text()).toContain('剩余 5 件')
    expect(wrapper.text()).not.toContain('剩余 10 件')
  })
})
