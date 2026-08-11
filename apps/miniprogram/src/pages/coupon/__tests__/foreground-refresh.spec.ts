import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import CouponPage from '../my.vue'
import { getMyCoupons } from '@/api/coupon'

const uniAppMock = vi.hoisted(() => ({
  onShowCallbacks: [] as Array<() => void>,
}))

vi.mock('@dcloudio/uni-app', () => ({
  onShow: vi.fn((callback: () => void) => uniAppMock.onShowCallbacks.push(callback)),
  onReachBottom: vi.fn(),
  onPullDownRefresh: vi.fn(),
}))

vi.mock('@/stores/user', () => ({
  useUserStore: () => ({ isLoggedIn: true }),
}))

vi.mock('@/api/coupon', () => ({
  getMyCoupons: vi.fn(),
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

function coupon(name: string, status = 1) {
  return {
    id: name,
    couponId: name,
    name,
    type: 1,
    value: 1000,
    minAmount: 5000,
    startTime: '2026-08-01T00:00:00.000Z',
    endTime: '2026-08-31T00:00:00.000Z',
    status,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  uniAppMock.onShowCallbacks = []
  vi.mocked(getMyCoupons).mockResolvedValue({ list: [coupon('首次可用券')], total: 1 } as any)
  ;(globalThis as any).uni = {
    showToast: vi.fn(),
    showModal: vi.fn(),
    switchTab: vi.fn(),
    stopPullDownRefresh: vi.fn(),
  }
})

describe('我的优惠券前台刷新', () => {
  it('再次 onShow 时丢弃旧缓存并读取最新可用券状态', async () => {
    const wrapper = mount(CouponPage, {
      global: { stubs: { Loading: true, Empty: true } },
    })

    uniAppMock.onShowCallbacks.at(-1)?.()
    await flushPromises()
    expect(wrapper.text()).toContain('首次可用券')

    vi.mocked(getMyCoupons).mockResolvedValueOnce({ list: [coupon('重新计算后的可用券')], total: 1 } as any)
    uniAppMock.onShowCallbacks.at(-1)?.()
    await flushPromises()

    expect(wrapper.text()).not.toContain('首次可用券')
    expect(wrapper.text()).toContain('重新计算后的可用券')
    expect(getMyCoupons).toHaveBeenCalledTimes(2)
  })

  it('切换优惠券状态后旧可用券响应晚到不能污染当前 Tab', async () => {
    const first = deferred<any>()
    const second = deferred<any>()
    vi.mocked(getMyCoupons)
      .mockImplementationOnce(() => first.promise)
      .mockImplementationOnce(() => second.promise)

    const wrapper = mount(CouponPage, {
      global: { stubs: { Loading: true, Empty: true } },
    })

    uniAppMock.onShowCallbacks.at(-1)?.()
    await Promise.resolve()

    const vm = wrapper.vm as any
    vm.switchTab(2)
    await Promise.resolve()

    expect(getMyCoupons).toHaveBeenNthCalledWith(1, { status: 1, page: 1, pageSize: 10 })
    expect(getMyCoupons).toHaveBeenNthCalledWith(2, { status: 2, page: 1, pageSize: 10 })

    second.resolve({ list: [coupon('已使用新券', 2)], total: 1 })
    await flushPromises()
    expect(vm.currentTab).toBe(2)
    expect(vm.coupons.map((item: any) => item.name)).toEqual(['已使用新券'])

    first.resolve({ list: [coupon('旧可用券', 1)], total: 1 })
    await flushPromises()

    expect(vm.currentTab).toBe(2)
    expect(vm.coupons.map((item: any) => item.name)).toEqual(['已使用新券'])
    expect(wrapper.text()).not.toContain('旧可用券')
  })
})
