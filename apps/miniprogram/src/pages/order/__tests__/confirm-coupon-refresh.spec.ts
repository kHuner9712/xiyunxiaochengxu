import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import OrderConfirmPage from '../confirm.vue'
import { previewOrder } from '@/api/order'
import { getAddressList } from '@/api/address'
import { getAvailableCoupons } from '@/api/coupon'

const uniAppMock = vi.hoisted(() => ({
  onLoadCallbacks: [] as Array<(options?: Record<string, any>) => void | Promise<void>>,
}))

vi.mock('@dcloudio/uni-app', () => ({
  onLoad: vi.fn((callback: (options?: Record<string, any>) => void | Promise<void>) => {
    uniAppMock.onLoadCallbacks.push(callback)
  }),
}))

vi.mock('@/api/order', () => ({
  previewOrder: vi.fn(),
  createOrder: vi.fn(),
}))

vi.mock('@/api/address', () => ({
  getAddressList: vi.fn(),
}))

vi.mock('@/api/coupon', () => ({
  getAvailableCoupons: vi.fn(),
}))

vi.mock('@/api/pickup-store', () => ({
  getPickupStoreList: vi.fn(),
}))

vi.mock('@/api/payment', () => ({
  createPayment: vi.fn(),
  wxPay: vi.fn(),
}))

vi.mock('@/utils/share', () => ({
  getPromotionSourceForOrder: vi.fn(() => ({})),
}))

vi.mock('@/stores/user', () => ({
  useUserStore: vi.fn(() => ({
    points: 0,
    isLoggedIn: true,
    phone: '13800138000',
    requireLogin: vi.fn(),
  })),
}))

const address = {
  id: '101',
  name: '张三',
  phone: '13800138000',
  province: '上海市',
  city: '上海市',
  district: '浦东新区',
  detail: '测试路 1 号',
  isDefault: false,
}

const largeCoupon = {
  id: '11',
  couponId: '21',
  name: '满100减80',
  type: 1,
  value: 8000,
  minAmount: 10000,
  startTime: '2026-08-01T00:00:00.000Z',
  endTime: '2026-09-01T00:00:00.000Z',
  status: 1,
}

beforeEach(() => {
  vi.clearAllMocks()
  uniAppMock.onLoadCallbacks = []
  vi.mocked(getAddressList).mockResolvedValue([] as any)
  vi.mocked(previewOrder).mockResolvedValue({
    items: [{
      productId: '2',
      skuId: '3',
      productName: '测试商品',
      productImage: 'https://api.example.com/p.jpg',
      skuSpecText: '标准装',
      price: 10000,
      quantity: 1,
    }],
    totalAmount: 10000,
    discountAmount: 0,
    activityDiscountAmount: 0,
    couponAmount: 0,
    pointsAmount: 0,
    pointsDeducted: 0,
    availablePoints: 0,
    maxPointsDeduct: 0,
    pointsDeductRate: 100,
    freightAmount: 0,
    payAmount: 10000,
  } as any)
  vi.mocked(getAvailableCoupons).mockResolvedValue([largeCoupon] as any)

  ;(globalThis as any).uni = {
    showToast: vi.fn(),
    navigateTo: vi.fn(),
    showModal: vi.fn(),
    switchTab: vi.fn(),
    redirectTo: vi.fn(),
  }
})

function mountPage() {
  return mount(OrderConfirmPage, {
    global: {
      stubs: {
        PriceDisplay: true,
      },
    },
  })
}

async function loadSingleProduct(wrapper: ReturnType<typeof mountPage>) {
  await uniAppMock.onLoadCallbacks.at(-1)?.({
    productId: '2',
    skuId: '3',
    quantity: '1',
  })
  await flushPromises()

  ;(wrapper.vm as any).selectAddress()
  const navigateArgs = (globalThis as any).uni.navigateTo.mock.calls.at(-1)?.[0]
  navigateArgs.events.selectAddress(address)
  await flushPromises()
}

describe('普通订单优惠券资格刷新', () => {
  it('无默认地址时不按临时 0 元查券，选地址并完成服务端试算后按 canonical 金额刷新', async () => {
    const wrapper = mountPage()

    await uniAppMock.onLoadCallbacks.at(-1)?.({
      productId: '2',
      skuId: '3',
      quantity: '1',
    })
    await flushPromises()

    expect(previewOrder).not.toHaveBeenCalled()
    expect(getAvailableCoupons).not.toHaveBeenCalled()

    ;(wrapper.vm as any).selectAddress()
    const navigateArgs = (globalThis as any).uni.navigateTo.mock.calls.at(-1)?.[0]
    expect(navigateArgs?.url).toBe('/pages/address/list?select=true')

    navigateArgs.events.selectAddress(address)
    await flushPromises()

    expect(previewOrder).toHaveBeenCalledWith(expect.objectContaining({
      addressId: '101',
      fulfillmentType: 'delivery',
      items: [{ skuId: '3', quantity: 1 }],
    }))
    expect(getAvailableCoupons).toHaveBeenCalledWith({
      amount: 10000,
      productIds: ['2'],
    })
    expect(wrapper.text()).toContain('选择优惠券')
  })

  it('先开启积分再选择大额券时按券后新上限重算积分，不提交旧上限', async () => {
    vi.mocked(previewOrder).mockImplementation(async (request: any) => {
      const common = {
        items: [{
          productId: '2',
          skuId: '3',
          productName: '测试商品',
          productImage: 'https://api.example.com/p.jpg',
          skuSpecText: '标准装',
          price: 10000,
          quantity: 1,
        }],
        totalAmount: 10000,
        discountAmount: 1000,
        activityDiscountAmount: 0,
        availablePoints: 3000,
        pointsDeductRate: 100,
        freightAmount: 0,
      }

      if (request.couponId === '11') {
        const deducted = Number(request.pointsDeduct || 0)
        return {
          ...common,
          couponAmount: 8000,
          pointsAmount: deducted,
          pointsDeducted: deducted,
          maxPointsDeduct: 1000,
          payAmount: Math.max(0, 1000 - deducted),
        } as any
      }

      const deducted = Number(request.pointsDeduct || 0)
      return {
        ...common,
        couponAmount: 0,
        pointsAmount: deducted,
        pointsDeducted: deducted,
        maxPointsDeduct: 2700,
        payAmount: Math.max(0, 9000 - deducted),
      } as any
    })

    const wrapper = mountPage()
    await loadSingleProduct(wrapper)

    expect((wrapper.vm as any).maxPointsDeduct).toBe(2700)
    ;(wrapper.vm as any).togglePoints({ detail: { value: true } })
    await flushPromises()

    expect(previewOrder).toHaveBeenLastCalledWith(expect.objectContaining({
      couponId: undefined,
      pointsDeduct: 2700,
    }))
    expect((wrapper.vm as any).usePoints).toBe(true)

    await (wrapper.vm as any).selectCoupon(largeCoupon)
    await flushPromises()

    const couponCalls = vi.mocked(previewOrder).mock.calls
      .map(([request]) => request as any)
      .filter((request) => request.couponId === '11')

    expect(couponCalls).toHaveLength(2)
    expect(couponCalls[0].pointsDeduct).toBe(0)
    expect(couponCalls[1].pointsDeduct).toBe(1000)
    expect(couponCalls.some((request) => request.pointsDeduct === 2700)).toBe(false)
    expect((wrapper.vm as any).maxPointsDeduct).toBe(1000)
    expect((wrapper.vm as any).usePoints).toBe(true)
    expect((wrapper.vm as any).pointsDeduct).toBe(1000)
    expect((wrapper.vm as any).payAmount).toBe(0)
  })
})
