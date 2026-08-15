import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import OrderListPage from '../list.vue'
import { createPayment, getPaymentStatus, wxPay } from '@/api/payment'

vi.mock('@dcloudio/uni-app', () => ({
  onLoad: vi.fn(),
  onShow: vi.fn(),
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
  getPaymentStatus: vi.fn(),
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

const terminalPaymentStatus = {
  orderId: 'order-1',
  orderNo: 'XY20260606001',
  orderStatus: 'pending_payment',
  paymentStatus: 3,
  paymentMethod: 'wechat',
  amount: 1000,
  paidAt: null,
  transactionId: null,
  confirming: false,
  tradeState: 'CLOSED',
  displayStatus: 'closed',
  canRetryPay: false,
  message: '微信支付已终止，请取消订单后重新下单',
} as any

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

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
  vi.mocked(getPaymentStatus).mockRejectedValue(new Error('支付记录不存在'))
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

  it('支付请求未完成时重复点击只创建一次支付', async () => {
    const payment = deferred<any>()
    vi.mocked(createPayment).mockImplementationOnce(() => payment.promise)
    const wrapper = mountList()
    const vm = wrapper.vm as any

    const first = vm.handlePay(order)
    const second = vm.handlePay(order)
    await flushPromises()

    expect(vm.isOrderActionBusy('order-1')).toBe(true)
    expect(createPayment).toHaveBeenCalledTimes(1)
    expect(wxPay).not.toHaveBeenCalled()

    payment.resolve({
      timeStamp: '1',
      nonceStr: 'nonce',
      package: 'prepay_id=1',
      signType: 'RSA',
      paySign: 'sign',
    })
    await Promise.all([first, second])

    expect(createPayment).toHaveBeenCalledTimes(1)
    expect(wxPay).toHaveBeenCalledTimes(1)
    expect(vm.isOrderActionBusy('order-1')).toBe(false)
  })

  it('微信支付已终止时从列表阻断再次创建支付并记住终态', async () => {
    vi.mocked(getPaymentStatus).mockResolvedValue(terminalPaymentStatus)
    const wrapper = mountList()
    const vm = wrapper.vm as any

    await vm.handlePay(order)

    expect(getPaymentStatus).toHaveBeenCalledWith('order-1', { showError: false })
    expect(createPayment).not.toHaveBeenCalled()
    expect(wxPay).not.toHaveBeenCalled()
    expect(vm.isPaymentRetryBlocked('order-1')).toBe(true)
    expect(vm.getPaymentRetryBlockMessage('order-1')).toContain('取消订单后重新下单')
    expect((globalThis as any).uni.showModal).toHaveBeenCalledWith(
      expect.objectContaining({
        title: '当前支付不可继续',
        content: '微信支付已终止，请取消订单后重新下单',
        showCancel: false,
      }),
    )
  })

  it('用户取消支付时不误跳成功结果页且不再承诺一定可重试', async () => {
    vi.mocked(wxPay).mockRejectedValueOnce({ errMsg: 'requestPayment:fail cancel' })
    const wrapper = mountList()

    await (wrapper.vm as any).handlePay(order)

    expect((globalThis as any).uni.navigateTo).not.toHaveBeenCalled()
    expect((globalThis as any).uni.showToast).toHaveBeenCalledWith({
      title: '已取消本次支付，请以订单最新状态为准',
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
