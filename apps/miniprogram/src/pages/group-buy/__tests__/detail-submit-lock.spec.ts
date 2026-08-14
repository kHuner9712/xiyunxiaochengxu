import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import GroupBuyDetailPage from '../detail.vue'

const now = new Date('2026-08-10T12:00:00.000Z')

const uniAppMock = vi.hoisted(() => ({
  onLoadCallbacks: [] as Array<(options?: Record<string, any>) => void | Promise<void>>,
  onShowCallbacks: [] as Array<() => void>,
  onHideCallbacks: [] as Array<() => void>,
  onUnloadCallbacks: [] as Array<() => void>,
}))

const groupBuyMock = vi.hoisted(() => ({
  getDetail: vi.fn(),
  getAvailableGroups: vi.fn(),
  start: vi.fn(),
  join: vi.fn(),
}))

const paymentMock = vi.hoisted(() => ({
  createPayment: vi.fn(),
  wxPay: vi.fn(),
}))

const fulfillmentMock = vi.hoisted(() => ({
  resolvePromotionFulfillment: vi.fn(),
}))

vi.mock('@dcloudio/uni-app', () => ({
  onLoad: vi.fn((callback: (options?: Record<string, any>) => void | Promise<void>) => uniAppMock.onLoadCallbacks.push(callback)),
  onShow: vi.fn((callback: () => void) => uniAppMock.onShowCallbacks.push(callback)),
  onHide: vi.fn((callback: () => void) => uniAppMock.onHideCallbacks.push(callback)),
  onUnload: vi.fn((callback: () => void) => uniAppMock.onUnloadCallbacks.push(callback)),
  onShareAppMessage: vi.fn(),
}))

vi.mock('@/api/group-buy', () => ({
  groupBuyApi: groupBuyMock,
}))

vi.mock('@/api/payment', () => paymentMock)
vi.mock('@/utils/promotion-fulfillment', () => fulfillmentMock)
vi.mock('@/stores/user', () => ({
  useUserStore: () => ({
    isLoggedIn: true,
    requireLogin: vi.fn(),
    userInfo: { id: '99' },
  }),
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

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(now)
  vi.clearAllMocks()
  uniAppMock.onLoadCallbacks = []
  uniAppMock.onShowCallbacks = []
  uniAppMock.onHideCallbacks = []
  uniAppMock.onUnloadCallbacks = []

  groupBuyMock.getDetail.mockResolvedValue({
    id: '20',
    name: '双击保护测试拼团',
    productId: '30',
    skuId: '40',
    groupPrice: 9900,
    groupSize: 2,
    groupExpireHours: 24,
    soldCount: 0,
    limitPerUser: 0,
    startTime: new Date(now.getTime() - 60_000).toISOString(),
    endTime: new Date(now.getTime() + 60_000).toISOString(),
    status: 1,
    sortOrder: 0,
  })
  groupBuyMock.getAvailableGroups.mockResolvedValue([])
  groupBuyMock.start.mockResolvedValue({
    groupId: '50',
    groupNo: 'G50',
    orderId: '60',
    role: 'leader',
    isZeroPay: false,
  })
  fulfillmentMock.resolvePromotionFulfillment.mockResolvedValue({
    fulfillmentType: 'delivery',
    addressId: '70',
  })
  paymentMock.wxPay.mockResolvedValue(undefined)

  ;(globalThis as any).uni = {
    showToast: vi.fn(),
    showModal: vi.fn(),
    redirectTo: vi.fn(),
  }
})

afterEach(() => {
  vi.useRealTimers()
})

describe('拼团提交锁', () => {
  it('下单成功后直到支付发起完成前保持锁定，重复点击不会创建第二张订单', async () => {
    const payment = deferred<any>()
    paymentMock.createPayment.mockImplementation(() => payment.promise)

    const wrapper = mount(GroupBuyDetailPage)
    await uniAppMock.onLoadCallbacks.at(-1)?.({ id: '20' })
    uniAppMock.onShowCallbacks.at(-1)?.()
    await flushPromises()

    expect(wrapper.find('.start-btn').attributes('disabled')).toBeUndefined()

    await wrapper.find('.start-btn').trigger('tap')
    await Promise.resolve()
    await Promise.resolve()

    expect(groupBuyMock.start).toHaveBeenCalledTimes(1)
    expect(paymentMock.createPayment).toHaveBeenCalledWith({ orderId: '60' })
    expect(wrapper.find('.start-btn').attributes('disabled')).toBeDefined()

    await wrapper.find('.start-btn').trigger('tap')
    await Promise.resolve()
    expect(groupBuyMock.start).toHaveBeenCalledTimes(1)

    payment.resolve({
      timeStamp: '1',
      nonceStr: 'n',
      package: 'prepay_id=p',
      signType: 'RSA',
      paySign: 's',
    })
    await flushPromises()

    expect(paymentMock.wxPay).toHaveBeenCalledTimes(1)
    expect((globalThis as any).uni.redirectTo).toHaveBeenCalledWith({
      url: '/pages/order/pay-result?orderId=60&payScene=group&groupId=50&payIntent=success',
    })
    expect(wrapper.find('.start-btn').attributes('disabled')).toBeUndefined()

    uniAppMock.onHideCallbacks.at(-1)?.()
    wrapper.unmount()
  })
})
