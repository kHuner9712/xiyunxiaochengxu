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

beforeEach(() => {
  vi.clearAllMocks()
  uniAppMock.onLoadCallbacks = []
  uniAppMock.onShowCallbacks = []
  orderMock.getOrderDetail.mockResolvedValue({ ...pendingOrder })
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
    await Promise.resolve()

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
})
