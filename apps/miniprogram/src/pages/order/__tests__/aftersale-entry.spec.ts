import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import OrderListPage from '../list.vue'
import OrderDetailPage from '../detail.vue'
import { getOrderDetail } from '@/api/order'

const uniAppMock = vi.hoisted(() => ({
  onLoadCallbacks: [] as Array<(options?: Record<string, any>) => void>,
}))

vi.mock('@dcloudio/uni-app', () => ({
  onLoad: vi.fn((callback: (options?: Record<string, any>) => void) => {
    uniAppMock.onLoadCallbacks.push(callback)
  }),
  onReachBottom: vi.fn(),
  onPullDownRefresh: vi.fn(),
}))

vi.mock('@/api/order', () => ({
  getOrderList: vi.fn().mockResolvedValue({ list: [], total: 0 }),
  getOrderDetail: vi.fn(),
  cancelOrder: vi.fn(),
  confirmReceive: vi.fn(),
  normalizeOrderStatus: vi.fn((status) => status),
}))

vi.mock('@/api/payment', () => ({
  createPayment: vi.fn(),
  wxPay: vi.fn(),
}))

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

function mountDetail() {
  return mount(OrderDetailPage, {
    global: {
      stubs: {
        PriceDisplay: true,
      },
    },
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  uniAppMock.onLoadCallbacks = []
  ;(globalThis as any).uni = {
    navigateTo: vi.fn(),
    showToast: vi.fn(),
    showModal: vi.fn(),
    pageScrollTo: vi.fn(),
  }
})

describe('订单售后入口', () => {
  it('单商品订单从列表直接进入售后申请', () => {
    const wrapper = mountList()

    ;(wrapper.vm as any).handleAftersale({
      id: 'order-1',
      items: [{ id: 'item-1', canApplyAftersale: true }],
    })

    expect((globalThis as any).uni.navigateTo).toHaveBeenCalledWith({
      url: '/pages/aftersale/apply?orderId=order-1&orderItemId=item-1',
    })
  })

  it('多商品订单进入详情并提示选择要售后的商品', async () => {
    vi.mocked(getOrderDetail).mockResolvedValue({
      id: 'order-2',
      orderNo: 'XY20260606002',
      status: 'completed',
      totalAmount: 2000,
      payAmount: 2000,
      freightAmount: 0,
      couponAmount: 0,
      pointsAmount: 0,
      addressName: '',
      addressPhone: '',
      addressDetail: '',
      items: [
        { id: 'item-1', productId: 'p1', skuId: 's1', productName: '商品1', productImage: '', skuName: '', price: 1000, quantity: 1, canApplyAftersale: true },
        { id: 'item-2', productId: 'p2', skuId: 's2', productName: '商品2', productImage: '', skuName: '', price: 1000, quantity: 1, canApplyAftersale: true },
      ],
      createTime: '2026-06-06 12:00:00',
    } as any)

    const wrapper = mountDetail()
    uniAppMock.onLoadCallbacks.at(-1)?.({ id: 'order-2', selectAftersale: '1' })
    await flushPromises()

    expect((globalThis as any).uni.showToast).toHaveBeenCalledWith({
      title: '请选择要申请售后的商品',
      icon: 'none',
    })
    expect((globalThis as any).uni.pageScrollTo).toHaveBeenCalledWith({
      selector: '.products-section',
      duration: 300,
    })
    expect((wrapper.vm as any).selectAftersaleMode).toBe(true)
  })

  it('不可售后商品点击后展示原因', () => {
    const wrapper = mountDetail()
    ;(wrapper.vm as any).order = {
      id: 'order-3',
      items: [],
    }

    ;(wrapper.vm as any).goAftersale({
      id: 'item-3',
      canApplyAftersale: false,
      aftersaleDisabledReason: '已超过售后期',
    })

    expect((globalThis as any).uni.showToast).toHaveBeenCalledWith({
      title: '已超过售后期',
      icon: 'none',
    })
  })
})
