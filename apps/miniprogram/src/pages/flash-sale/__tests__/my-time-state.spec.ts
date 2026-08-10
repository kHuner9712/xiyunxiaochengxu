import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import MyFlashSalePage from '../my.vue'

const now = new Date('2026-08-10T12:00:00.000Z')

const uniAppMock = vi.hoisted(() => ({
  onShowCallbacks: [] as Array<() => void>,
  onHideCallbacks: [] as Array<() => void>,
  onUnloadCallbacks: [] as Array<() => void>,
}))

const flashSaleMock = vi.hoisted(() => ({
  getMyOrders: vi.fn(),
}))

vi.mock('@dcloudio/uni-app', () => ({
  onReachBottom: vi.fn(),
  onShow: vi.fn((callback: () => void) => uniAppMock.onShowCallbacks.push(callback)),
  onHide: vi.fn((callback: () => void) => uniAppMock.onHideCallbacks.push(callback)),
  onUnload: vi.fn((callback: () => void) => uniAppMock.onUnloadCallbacks.push(callback)),
}))

vi.mock('@/api/flash-sale', () => ({
  flashSaleApi: flashSaleMock,
}))

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(now)
  vi.clearAllMocks()
  uniAppMock.onShowCallbacks = []
  uniAppMock.onHideCallbacks = []
  uniAppMock.onUnloadCallbacks = []
  flashSaleMock.getMyOrders.mockResolvedValue({
    list: [{
      id: '30',
      activityId: '40',
      userId: '50',
      orderId: '60',
      quantity: 1,
      flashPrice: 9900,
      status: 'pending_payment',
      lockExpireAt: new Date(now.getTime() + 1500).toISOString(),
      createdAt: now.toISOString(),
    }],
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

describe('我的秒杀实时状态', () => {
  it('跨过库存锁截止时间后无需重新请求即可显示已过期', async () => {
    const wrapper = mount(MyFlashSalePage, {
      global: { stubs: { Loading: true, Empty: true } },
    })

    uniAppMock.onShowCallbacks.at(-1)?.()
    await flushPromises()
    expect(wrapper.find('.status-tag').text()).toBe('待支付')

    await vi.advanceTimersByTimeAsync(2000)
    await flushPromises()

    expect(wrapper.find('.status-tag').text()).toBe('已过期')
    expect(wrapper.find('.remain').text()).toContain('已过期')

    uniAppMock.onHideCallbacks.at(-1)?.()
    wrapper.unmount()
  })
})
