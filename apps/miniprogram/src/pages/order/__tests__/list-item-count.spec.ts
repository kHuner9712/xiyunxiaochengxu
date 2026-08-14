import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import OrderListPage from '../list.vue'

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

describe('订单列表商品件数', () => {
  it('按购买数量求和而不是按 SKU 行数计数', () => {
    const wrapper = mountList()
    const order = {
      items: [
        { id: 'item-1', quantity: 3 },
        { id: 'item-2', quantity: 2 },
      ],
    } as any

    expect((wrapper.vm as any).getOrderItemCount(order)).toBe(5)
  })

  it('异常或非正数量不会污染展示件数', () => {
    const wrapper = mountList()
    const order = {
      items: [
        { id: 'item-1', quantity: 2 },
        { id: 'item-2', quantity: 0 },
        { id: 'item-3', quantity: Number.NaN },
      ],
    } as any

    expect((wrapper.vm as any).getOrderItemCount(order)).toBe(2)
  })
})
