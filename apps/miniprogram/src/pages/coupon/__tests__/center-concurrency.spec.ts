import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import CouponCenterPage from '../center.vue'
import { getClaimableCoupons } from '@/api/coupon'

const uniAppMock = vi.hoisted(() => ({
  onShowCallbacks: [] as Array<() => void>,
}))

vi.mock('@dcloudio/uni-app', () => ({
  onShow: vi.fn((callback: () => void) => uniAppMock.onShowCallbacks.push(callback)),
  onReachBottom: vi.fn(),
  onPullDownRefresh: vi.fn(),
}))

vi.mock('@/stores/user', () => ({
  useUserStore: () => ({
    isLoggedIn: true,
    requireLogin: vi.fn(),
  }),
}))

vi.mock('@/api/coupon', () => ({
  getClaimableCoupons: vi.fn(),
  getCouponCenter: vi.fn(),
  receiveCoupon: vi.fn(),
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

function coupon(id: string, name: string) {
  return {
    id,
    name,
    type: 1,
    value: 1000,
    minAmount: 5000,
    startTime: '2026-08-01',
    endTime: '2026-08-31',
    remainCount: 1,
    received: false,
  } as any
}

beforeEach(() => {
  vi.clearAllMocks()
  uniAppMock.onShowCallbacks = []
  ;(globalThis as any).uni = {
    showToast: vi.fn(),
    stopPullDownRefresh: vi.fn(),
  }
})

describe('优惠券中心资格刷新并发', () => {
  it('新的登录态资格先返回后，旧请求晚到不能恢复旧可领券', async () => {
    const first = deferred<any[]>()
    const second = deferred<any[]>()
    vi.mocked(getClaimableCoupons)
      .mockImplementationOnce(() => first.promise)
      .mockImplementationOnce(() => second.promise)

    const wrapper = mount(CouponCenterPage, {
      global: { stubs: { Loading: true, Empty: true } },
    })

    uniAppMock.onShowCallbacks.at(-1)?.()
    await Promise.resolve()
    uniAppMock.onShowCallbacks.at(-1)?.()
    await Promise.resolve()
    expect(getClaimableCoupons).toHaveBeenCalledTimes(2)

    second.resolve([coupon('new', '最新可领券')])
    await flushPromises()
    expect((wrapper.vm as any).coupons.map((item: any) => item.id)).toEqual(['new'])
    expect(wrapper.text()).toContain('最新可领券')

    first.resolve([coupon('old', '旧资格优惠券')])
    await flushPromises()

    expect((wrapper.vm as any).coupons.map((item: any) => item.id)).toEqual(['new'])
    expect(wrapper.text()).not.toContain('旧资格优惠券')
    expect((wrapper.vm as any).loading).toBe(false)
  })
})
