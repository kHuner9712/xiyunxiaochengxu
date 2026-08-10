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

function coupon(name: string) {
  return {
    id: name,
    couponId: name,
    name,
    type: 1,
    value: 1000,
    minAmount: 5000,
    startTime: '2026-08-01T00:00:00.000Z',
    endTime: '2026-08-31T00:00:00.000Z',
    status: 1,
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
})
