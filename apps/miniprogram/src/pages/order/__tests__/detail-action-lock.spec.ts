import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import OrderDetailPage from '../detail.vue'

const uniAppMock = vi.hoisted(() => ({
  onLoadCallbacks: [] as Array<(options?: Record<string, any>) => void>,
  onShowCallbacks: [] as Array<() => void>,
}))

const orderMock = vi.hoisted(() => ({
  getOrderDetail: vi.fn(),
  getOrderDetailByNo: vi.fn(),
  cancelOrder: vi.fn(),
  confirmReceive: vi.fn(),
}))

const paymentMock = vi.hoisted(() => ({
  createPayment: vi.fn(),
  getPaymentStatus: vi.fn(),
  wxPay: vi.fn(),
}))

vi.mock('@dcloudio/uni-app', () => ({
  onLoad: vi.fn((callback: (options?: Record<string, any>) => void) => uniAppMock.onLoadCallbacks.push(callback)),
  onShow: vi.fn((callback: () => void) => uniAppMock.onShowCallbacks.push(callback)),
}))

vi.mock('@/api/order', () => orderMock)
vi.mock('@/api/payment', () => paymentMock)

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

const pendingOrder = {
  id: '101',
  orderNo: 'O101',
  status: 'pending_payment',
  totalAmount: 1000,
  payAmount: 1000,
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
  createTime: '2026-08-14 10:00:00',
}

const terminalPaymentStatus = {
  orderId: '101',
  orderNo: 'O101',
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
}

beforeEach(() => {
  vi.clearAllMocks()
  uniAppMock.onLoadCallbacks = []
  uniAppMock.onShowCallbacks = []
  orderMock.getOrderDetail.mockResolvedValue({ ...pendingOrder })
  paymentMock.getPaymentStatus.mockResolvedValue(undefined)
  paymentMock.wxPay.mockResolvedValue(undefined)
  ;(globalThis as any).uni = {
    showToast: vi.fn(),
    showModal: vi.fn(),
    redirectTo: vi.fn(),
    navigateTo: vi.fn(),
    pageScrollTo: vi.fn(),
    setClipboardData: vi.fn(),
    makePhoneCall: vi.fn(),
  }
})

describe('订单详情状态写操作锁', () => {
  it('支付请求未结束时重复点击不会再次创建支付', async () => {
    const payment = deferred<any>()
    paymentMock.createPayment.mockImplementation(() => payment.promise)

    const wrapper = mount(OrderDetailPage, {
      global: { stubs: { PriceDisplay: true } },
    })
    uniAppMock.onLoadCallbacks.at(-1)?.({ id: '101' })
    await flushPromises()

    const vm = wrapper.vm as any
    const firstPay = vm.handlePay()
    await flushPromises()

    expect(vm.orderActionBusy).toBe(true)
    expect(paymentMock.createPayment).toHaveBeenCalledTimes(1)

    await vm.handlePay()
    expect(paymentMock.createPayment).toHaveBeenCalledTimes(1)

    payment.resolve({
      timeStamp: '1',
      nonceStr: 'n',
      package: 'prepay_id=p',
      signType: 'RSA',
      paySign: 's',
    })
    await firstPay
    await flushPromises()

    expect(paymentMock.wxPay).toHaveBeenCalledTimes(1)
    expect(vm.orderActionBusy).toBe(false)
    expect((globalThis as any).uni.redirectTo).toHaveBeenCalledWith({
      url: '/pages/order/pay-result?orderId=101&payScene=detail&payIntent=success',
    })

    wrapper.unmount()
  })

  it('微信支付已终止时隐藏支付入口并禁止 handlePay 绕过服务端终态', async () => {
    paymentMock.getPaymentStatus.mockResolvedValue(terminalPaymentStatus)

    const wrapper = mount(OrderDetailPage, {
      global: { stubs: { PriceDisplay: true } },
    })
    uniAppMock.onLoadCallbacks.at(-1)?.({ id: '101' })
    await flushPromises()

    const vm = wrapper.vm as any
    expect(paymentMock.getPaymentStatus).toHaveBeenCalledWith('101', { showError: false })
    expect(vm.paymentRetryBlocked).toBe(true)
    expect(wrapper.find('.payment-terminal-hint').text()).toContain('取消订单后重新下单')
    expect(wrapper.find('.action-btn.primary').exists()).toBe(false)

    await vm.handlePay()
    await flushPromises()

    expect(paymentMock.createPayment).not.toHaveBeenCalled()
    expect(paymentMock.wxPay).not.toHaveBeenCalled()
    expect((globalThis as any).uni.showModal).toHaveBeenCalledWith(
      expect.objectContaining({
        title: '当前支付不可继续',
        content: '微信支付已终止，请取消订单后重新下单',
        showCancel: false,
      }),
    )
    expect(vm.orderActionBusy).toBe(false)

    wrapper.unmount()
  })

  it('支付状态预检暂时失败时不阻断首次有效支付创建', async () => {
    paymentMock.getPaymentStatus.mockRejectedValue(new Error('支付记录不存在'))
    paymentMock.createPayment.mockResolvedValue({
      timeStamp: '1',
      nonceStr: 'n',
      package: 'prepay_id=p',
      signType: 'RSA',
      paySign: 's',
    })

    const wrapper = mount(OrderDetailPage, {
      global: { stubs: { PriceDisplay: true } },
    })
    uniAppMock.onLoadCallbacks.at(-1)?.({ id: '101' })
    await flushPromises()

    await (wrapper.vm as any).handlePay()
    await flushPromises()

    expect(paymentMock.createPayment).toHaveBeenCalledTimes(1)
    expect(paymentMock.wxPay).toHaveBeenCalledTimes(1)

    wrapper.unmount()
  })

  it('商品总件数按各订单项购买数量求和而不是按 SKU 行数统计', async () => {
    orderMock.getOrderDetail.mockResolvedValueOnce({
      ...pendingOrder,
      items: [
        { id: 'item-1', quantity: 3 },
        { id: 'item-2', quantity: 2 },
      ],
    })

    const wrapper = mount(OrderDetailPage, {
      global: { stubs: { PriceDisplay: true } },
    })
    uniAppMock.onLoadCallbacks.at(-1)?.({ id: '101' })
    await flushPromises()

    const vm = wrapper.vm as any
    expect(vm.getOrderItemCount()).toBe(5)
    expect(wrapper.find('.section-count').text()).toContain('共 5 件')

    wrapper.unmount()
  })
})
