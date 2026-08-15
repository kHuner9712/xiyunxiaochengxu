import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import PayResultPage from '../pay-result.vue'
import { getOrderDetail } from '@/api/order'
import { getPaymentStatus } from '@/api/payment'

const uniAppMock = vi.hoisted(() => ({
  onLoadCallbacks: [] as Array<(options?: Record<string, any>) => void>,
  onShowCallbacks: [] as Array<() => void>,
}))

vi.mock('@dcloudio/uni-app', () => ({
  onLoad: vi.fn((callback: (options?: Record<string, any>) => void) => uniAppMock.onLoadCallbacks.push(callback)),
  onShow: vi.fn((callback: () => void) => uniAppMock.onShowCallbacks.push(callback)),
  onHide: vi.fn(),
  onUnload: vi.fn(),
}))

vi.mock('@/api/order', () => ({
  getOrderDetail: vi.fn(),
}))

vi.mock('@/api/payment', () => ({
  getPaymentStatus: vi.fn(),
}))

function order(overrides: Record<string, any> = {}) {
  return {
    id: '101',
    orderNo: 'O101',
    status: 'pending_delivery',
    totalAmount: 0,
    payAmount: 0,
    freightAmount: 0,
    discountAmount: 0,
    activityDiscountAmount: 0,
    couponAmount: 0,
    pointsAmount: 0,
    addressName: '测试用户',
    addressPhone: '13800000000',
    addressDetail: '测试地址',
    fulfillmentType: 'delivery',
    items: [],
    createTime: '2026-08-15 08:00:00',
    ...overrides,
  } as any
}

beforeEach(() => {
  vi.clearAllMocks()
  uniAppMock.onLoadCallbacks = []
  uniAppMock.onShowCallbacks = []
  ;(globalThis as any).uni = {
    showToast: vi.fn(),
    redirectTo: vi.fn(),
    switchTab: vi.fn(),
  }
})

describe('0元订单支付结果事实源', () => {
  it('真正0元且已进入履约态时才显示成功', async () => {
    vi.mocked(getOrderDetail).mockResolvedValueOnce(order())
    const wrapper = mount(PayResultPage)

    uniAppMock.onLoadCallbacks.at(-1)?.({ orderId: '101', zeroPay: '1' })
    await flushPromises()

    const vm = wrapper.vm as any
    expect(vm.zeroPay).toBe(true)
    expect(vm.paymentState).toBe('success')
    expect(wrapper.text()).toContain('订单提交成功')
    expect(getPaymentStatus).not.toHaveBeenCalled()

    wrapper.unmount()
  })

  it('付费待支付订单即使伪造 zeroPay=1 也不能显示成功', async () => {
    vi.mocked(getOrderDetail).mockResolvedValueOnce(order({
      status: 'pending_payment',
      totalAmount: 1990,
      payAmount: 1990,
    }))
    const wrapper = mount(PayResultPage)

    uniAppMock.onLoadCallbacks.at(-1)?.({ orderId: '101', zeroPay: '1' })
    await flushPromises()

    const vm = wrapper.vm as any
    expect(vm.zeroPay).toBe(true)
    expect(vm.paymentState).toBe('unknown')
    expect(wrapper.text()).not.toContain('订单提交成功')
    expect(wrapper.text()).toContain('支付结果未知')

    wrapper.unmount()
  })

  it('非法订单ID不发起查询并返回订单列表', async () => {
    const wrapper = mount(PayResultPage)

    uniAppMock.onLoadCallbacks.at(-1)?.({ orderId: '../bad', zeroPay: '1' })
    await flushPromises()

    expect(getOrderDetail).not.toHaveBeenCalled()
    expect(getPaymentStatus).not.toHaveBeenCalled()
    expect((globalThis as any).uni.redirectTo).toHaveBeenCalledWith({ url: '/pages/order/list' })

    wrapper.unmount()
  })
})
