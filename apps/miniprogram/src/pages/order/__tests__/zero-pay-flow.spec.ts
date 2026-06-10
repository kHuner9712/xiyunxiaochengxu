import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ConfirmPage from '../confirm.vue'
import PayResultPage from '../pay-result.vue'
import { createOrder, previewOrder } from '@/api/order'
import { createPayment, getPaymentStatus, wxPay } from '@/api/payment'

const uniAppMock = vi.hoisted(() => ({
  onLoadCallbacks: [] as Array<(options?: Record<string, any>) => void>,
  onUnloadCallbacks: [] as Array<() => void>,
  onHideCallbacks: [] as Array<() => void>,
  onShowCallbacks: [] as Array<() => void>,
}))

const storeMock = vi.hoisted(() => ({
  userStore: {
    isLoggedIn: true,
    phone: '13800138000',
    points: 500,
    requireLogin: vi.fn(),
  },
}))

vi.mock('@dcloudio/uni-app', () => ({
  onLoad: vi.fn((callback: (options?: Record<string, any>) => void) => {
    uniAppMock.onLoadCallbacks.push(callback)
  }),
  onUnload: vi.fn((callback: () => void) => {
    uniAppMock.onUnloadCallbacks.push(callback)
  }),
  onHide: vi.fn((callback: () => void) => {
    uniAppMock.onHideCallbacks.push(callback)
  }),
  onShow: vi.fn((callback: () => void) => {
    uniAppMock.onShowCallbacks.push(callback)
  }),
}))

vi.mock('@/api/order', () => ({
  createOrder: vi.fn(),
  previewOrder: vi.fn(),
  getOrderDetail: vi.fn(),
}))

vi.mock('@/stores/user', () => ({
  useUserStore: () => storeMock.userStore,
}))

vi.mock('@/api/payment', () => ({
  createPayment: vi.fn(),
  getPaymentStatus: vi.fn(),
  wxPay: vi.fn(),
}))

vi.mock('@/api/address', () => ({
  getAddressList: vi.fn(),
}))

vi.mock('@/api/pickup-store', () => ({
  getPickupStoreList: vi.fn(),
}))

vi.mock('@/api/coupon', () => ({
  getAvailableCoupons: vi.fn(),
}))

const orderApiMock = vi.mocked(await import('@/api/order'))
const paymentApiMock = vi.mocked(await import('@/api/payment'))

function mountConfirm() {
  return mount(ConfirmPage, {
    global: {
      stubs: {
        PriceDisplay: true,
      },
    },
  })
}

function fillConfirmReadyState(wrapper: ReturnType<typeof mountConfirm>, fulfillmentType: 'delivery' | 'pickup') {
  const vm = wrapper.vm as any
  vm.agreedToLegal = true
  vm.fulfillmentType = fulfillmentType
  vm.address = fulfillmentType === 'delivery'
    ? { id: 'addr-1', name: '张三', phone: '13800138000' }
    : null
  vm.selectedPickupStore = fulfillmentType === 'pickup'
    ? { id: 'store-1', name: '门店', fullAddress: '测试地址' }
    : null
  vm.orderItems = [{
    productId: 'product-1',
    skuId: 'sku-1',
    quantity: 1,
    productName: '测试商品',
    productImage: 'https://example.com/product.png',
    skuName: '默认',
    price: 100,
  }]
  vm.preview = {
    items: [],
    totalAmount: 100,
    discountAmount: 0,
    couponAmount: 0,
    activityDiscountAmount: 0,
    pointsAmount: 0,
    freightAmount: 0,
    payAmount: 0,
    pointsDeducted: 0,
    availablePoints: 500,
    maxPointsDeduct: 500,
    pointsDeductRate: 100,
    pointsDeductMaxPercent: 30,
    fulfillmentType,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  uniAppMock.onLoadCallbacks = []
  uniAppMock.onUnloadCallbacks = []
  uniAppMock.onHideCallbacks = []
  uniAppMock.onShowCallbacks = []
  ;(globalThis as any).uni = {
    redirectTo: vi.fn(),
    showToast: vi.fn(),
    showModal: vi.fn(),
    navigateTo: vi.fn(),
    switchTab: vi.fn(),
  }
  storeMock.userStore.isLoggedIn = true
  storeMock.userStore.phone = '13800138000'
  storeMock.userStore.points = 500
})

describe('确认订单 0 元支付流程', () => {
  it('0 元快递订单不创建支付单，直接进入成功结果页', async () => {
    orderApiMock.createOrder.mockResolvedValue({
      orderId: 'order-1',
      orderNo: 'XY20260531001',
      payAmount: 0,
      isZeroPay: true,
      status: 'pending_delivery',
      fulfillmentType: 'delivery',
    })

    const wrapper = mountConfirm()
    fillConfirmReadyState(wrapper, 'delivery')

    await (wrapper.vm as any).handleSubmit()

    expect(createPayment).not.toHaveBeenCalled()
    expect(wxPay).not.toHaveBeenCalled()
    expect((globalThis as any).uni.redirectTo).toHaveBeenCalledWith({
      url: '/pages/order/pay-result?orderId=order-1&payIntent=success&zeroPay=1',
    })
  })

  it('非 0 元订单继续创建支付单并拉起微信支付', async () => {
    orderApiMock.createOrder.mockResolvedValue({
      orderId: 'order-2',
      orderNo: 'XY20260531002',
      payAmount: 100,
      isZeroPay: false,
      status: 'pending_payment',
      fulfillmentType: 'delivery',
    })
    paymentApiMock.createPayment.mockResolvedValue({
      timeStamp: '1',
      nonceStr: 'nonce',
      package: 'prepay_id=1',
      signType: 'RSA',
      paySign: 'sign',
    })
    paymentApiMock.wxPay.mockResolvedValue()

    const wrapper = mountConfirm()
    fillConfirmReadyState(wrapper, 'delivery')
    ;(wrapper.vm as any).preview.payAmount = 100

    await (wrapper.vm as any).handleSubmit()

    expect(createPayment).toHaveBeenCalledWith({ orderId: 'order-2' })
    expect(wxPay).toHaveBeenCalled()
    expect((globalThis as any).uni.redirectTo).toHaveBeenCalledWith({
      url: '/pages/order/pay-result?orderId=order-2&payScene=confirm&payIntent=success',
    })
  })
})

describe('确认订单积分抵扣', () => {
  it('无积分时不可开启抵扣', async () => {
    const wrapper = mountConfirm()
    ;(wrapper.vm as any).availablePoints = 0
    ;(wrapper.vm as any).maxPointsDeduct = 500

    await (wrapper.vm as any).togglePoints({ detail: { value: true } })

    expect((wrapper.vm as any).usePoints).toBe(false)
    expect((globalThis as any).uni.showToast).toHaveBeenCalledWith({
      title: '暂无可用积分',
      icon: 'none',
    })
  })

  it('有积分时按可用积分重新试算金额', async () => {
    orderApiMock.previewOrder.mockResolvedValue({
      items: [],
      totalAmount: 9900,
      discountAmount: 0,
      couponAmount: 0,
      activityDiscountAmount: 0,
      pointsAmount: 500,
      pointsDeducted: 500,
      availablePoints: 500,
      maxPointsDeduct: 500,
      pointsDeductRate: 100,
      pointsDeductMaxPercent: 30,
      freightAmount: 0,
      payAmount: 9400,
      fulfillmentType: 'delivery',
      isZeroPay: false,
    })

    const wrapper = mountConfirm()
    fillConfirmReadyState(wrapper, 'delivery')
    ;(wrapper.vm as any).availablePoints = 500
    ;(wrapper.vm as any).maxPointsDeduct = 500

    await (wrapper.vm as any).togglePoints({ detail: { value: true } })
    await flushPromises()

    expect(previewOrder).toHaveBeenCalledWith(
      expect.objectContaining({ pointsDeduct: 500 }),
    )
    expect((wrapper.vm as any).pointsDeduct).toBe(500)
    expect((wrapper.vm as any).payAmount).toBe(9400)
  })
})

describe('支付结果页 0 元订单展示', () => {
  it('0 元自提订单不轮询支付状态，并展示自提码', async () => {
    orderApiMock.getOrderDetail.mockResolvedValue({
      id: 'order-3',
      orderNo: 'XY20260531003',
      status: 'pending_pickup',
      totalAmount: 0,
      payAmount: 0,
      freightAmount: 0,
      couponAmount: 0,
      pointsAmount: 0,
      addressName: '',
      addressPhone: '',
      addressDetail: '',
      fulfillmentType: 'pickup',
      pickupCode: '12345678',
      items: [],
      createTime: '2026-05-31 12:00:00',
    })

    const wrapper = mount(PayResultPage)
    uniAppMock.onLoadCallbacks.at(-1)?.({
      orderId: 'order-3',
      payIntent: 'success',
      zeroPay: '1',
    })
    await flushPromises()

    expect(getPaymentStatus).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('订单提交成功')
    expect(wrapper.text()).toContain('12345678')
  })
})
