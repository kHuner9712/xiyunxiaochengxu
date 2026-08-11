import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import OrderListPage from '../list.vue'
import { getOrderList } from '@/api/order'

vi.mock('@dcloudio/uni-app', () => ({
  onLoad: (callback: (options?: Record<string, unknown>) => void) => callback({}),
  onShow: (callback: () => void) => callback(),
  onReachBottom: vi.fn(),
  onPullDownRefresh: vi.fn(),
}))

vi.mock('@/api/order', () => ({
  getOrderList: vi.fn(),
  cancelOrder: vi.fn(),
  confirmReceive: vi.fn(),
  normalizeOrderStatus: vi.fn((status) => status),
}))

vi.mock('@/api/payment', () => ({
  createPayment: vi.fn(),
  wxPay: vi.fn(),
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

function order(id: string, status: string) {
  return {
    id,
    orderNo: `ORDER-${id}`,
    status,
    totalAmount: 1000,
    payAmount: 1000,
    createTime: '2026-08-11 12:00:00',
    items: [],
  } as any
}

beforeEach(() => {
  vi.clearAllMocks()
  ;(globalThis as any).uni = {
    navigateTo: vi.fn(),
    showToast: vi.fn(),
    showModal: vi.fn(),
    stopPullDownRefresh: vi.fn(),
  }
})

describe('订单列表请求并发', () => {
  it('切换状态后旧 Tab 响应晚到时不能覆盖当前订单结果', async () => {
    const first = deferred<any>()
    const second = deferred<any>()
    vi.mocked(getOrderList)
      .mockImplementationOnce(() => first.promise)
      .mockImplementationOnce(() => second.promise)

    const wrapper = mount(OrderListPage, {
      global: {
        stubs: {
          PriceDisplay: true,
          Loading: true,
          Empty: true,
        },
      },
    })
    await Promise.resolve()

    const vm = wrapper.vm as any
    expect(getOrderList).toHaveBeenNthCalledWith(1, {
      page: 1,
      pageSize: 10,
    })

    vm.switchTab('completed')
    await Promise.resolve()

    expect(getOrderList).toHaveBeenNthCalledWith(2, {
      page: 1,
      pageSize: 10,
      status: 'completed',
    })

    second.resolve({
      list: [order('completed-new', 'completed')],
      total: 1,
      page: 1,
      pageSize: 10,
    })
    await flushPromises()

    expect(vm.currentTab).toBe('completed')
    expect(vm.orders.map((item: any) => item.id)).toEqual(['completed-new'])
    expect(vm.loading).toBe(false)

    first.resolve({
      list: [order('all-stale', 'pending_payment')],
      total: 1,
      page: 1,
      pageSize: 10,
    })
    await flushPromises()

    expect(vm.currentTab).toBe('completed')
    expect(vm.orders.map((item: any) => item.id)).toEqual(['completed-new'])
    expect(vm.loading).toBe(false)
    expect((globalThis as any).uni.showToast).not.toHaveBeenCalledWith({
      title: '订单加载失败',
      icon: 'none',
    })
  })
})
