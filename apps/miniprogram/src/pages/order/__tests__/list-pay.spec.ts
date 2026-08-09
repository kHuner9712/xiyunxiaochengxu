import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import OrderListPage from '../list.vue'
import { createPayment, wxPay } from '@/api/payment'

vi.mock('@dcloudio/uni-app', () => ({
  onLoad: vi.fn(),
  onReachBottom: vi.fn(),
  onPullDownRefresh: vi.fn(),
}))

vi.mock('@/api/order', () => ({
  getOrderList: vi.fn().mockResolvedValue({ list: [], total: 0 }),
  cancelOrder: vi.fn(),
  confirmReceive: vi.fn(),
  normalizeOrderStatus: vi.fn((status) => status),
}))

vi.mock('@/api/payment', () => ({
  createPayment: vi.fn(),
  wxPay: vi.fn(),
}))

const order = {
  id: 'order-1',
  orderNo: 'XY20260606001',
  status: 'pending_payment',
  totalAmount: 1000,
  payAmount: 1000,
  createTime: '2026-06-06 12:00:00',
  items: [],
} as any

function mountList() {
  return mount(OrderListPage, {
    global: {
      stubs: {
        PriceDisplay: true,
        Loading: true,
        Empty: true,
      },
    },
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(createPayment).mockResolvedValue({
    timeStamp: '1',
    nonceStr: 'nonce',
    package: 'prepay_id=1',
    signType: 'RSA',
    paySign: 'sign',
  })
  vi.mocked(wxPay).mockResolvedValue()
  ;(globalThis as any).uni = {
    redirectTo: vi.fn(),
    showToast: vi.fn(),
    showModal: vi.fn(),
    navigateTo: vi.fn(),
  }
})

describe('订单列表支付处理', () => {
  it('支付成功进入成功结果页并标记 list 场景', async () => {
    const wrapper = mountList()

    await (wrapper.vm as any).handlePay(order)

    expect((globalThis as any).uni.navigateTo).toHaveBeenCalledWith({
      url: '/pages/order/pay-result?orderId=order-1&payScene=list&payIntent=success',
    })
  })

  it('用户取消支付时不误跳成功结果页', async () => {
    vi.mocked(wxPay).mockRejectedValueOnce({ errMsg: 'requestPayment:fail cancel' })
    const wrapper = mountList()

    await (wrapper.vm as any).handlePay(order)

    expect((globalThis as any).uni.navigateTo).not.toHaveBeenCalled()
    expect((globalThis as any).uni.showToast).toHaveBeenCalledWith({
      title: '已取消支付，可稍后继续支付',
      icon: 'none',
    })
  })

  it('支付客户端异常时保留真实失败原因', async () => {
    vi.mocked(wxPay).mockRejectedValueOnce(new Error('requestPayment:fail system error'))
    const wrapper = mountList()

    await (wrapper.vm as any).handlePay(order)

    expect((globalThis as any).uni.showModal).toHaveBeenCalledWith(
      expect.objectContaining({
        title: '支付未完成',
        content: 'requestPayment:fail system error',
        confirmText: '我知道了',
      }),
    )
    expect((globalThis as any).uni.navigateTo).not.toHaveBeenCalled()
  })

  it('支付单创建失败时展示服务端真实原因', async () => {
    vi.mocked(createPayment).mockRejectedValueOnce(new Error('订单状态已变化，请刷新后重试'))
    const wrapper = mountList()

    await (wrapper.vm as any).handlePay(order)

    expect((globalThis as any).uni.showModal).toHaveBeenCalledWith(
      expect.objectContaining({
        title: '支付未完成',
        content: '订单状态已变化，请刷新后重试',
        confirmText: '我知道了',
      }),
    )
    expect(wxPay).not.toHaveBeenCalled()
  })
})
