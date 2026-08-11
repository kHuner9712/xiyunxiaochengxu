import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import AftersaleListPage from '../list.vue'
import { getAftersaleList } from '@/api/aftersale'

const uniAppMock = vi.hoisted(() => ({
  onShowCallbacks: [] as Array<() => void>,
}))

vi.mock('@dcloudio/uni-app', () => ({
  onShow: vi.fn((callback: () => void) => uniAppMock.onShowCallbacks.push(callback)),
  onReachBottom: vi.fn(),
  onPullDownRefresh: vi.fn(),
}))

vi.mock('@/api/aftersale', () => ({
  getAftersaleList: vi.fn(),
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

function row(status: string) {
  return {
    id: '50',
    orderId: '1',
    orderNo: 'XY20260810001',
    type: 2,
    reason: '质量问题',
    description: '',
    images: [],
    status,
    refundAmount: 9900,
    productName: '测试商品',
    productImage: 'https://api.example.com/p.jpg',
    createTime: '2026-08-10T00:00:00.000Z',
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  uniAppMock.onShowCallbacks = []
  vi.mocked(getAftersaleList).mockResolvedValue({ list: [row('pending_review')], total: 1 } as any)
  ;(globalThis as any).uni = {
    showToast: vi.fn(),
    navigateTo: vi.fn(),
    stopPullDownRefresh: vi.fn(),
  }
})

describe('售后列表前台刷新', () => {
  it('从详情返回后重新读取服务端状态，不保留旧审核状态', async () => {
    const wrapper = mount(AftersaleListPage, {
      global: { stubs: { Loading: true, Empty: true } },
    })

    uniAppMock.onShowCallbacks.at(-1)?.()
    await flushPromises()
    expect(wrapper.find('.status-text').classes()).toContain('pending')

    vi.mocked(getAftersaleList).mockResolvedValueOnce({ list: [row('refunded')], total: 1 } as any)
    uniAppMock.onShowCallbacks.at(-1)?.()
    await flushPromises()

    expect(wrapper.find('.status-text').classes()).toContain('completed')
    expect(getAftersaleList).toHaveBeenCalledTimes(2)
  })

  it('返回详情触发的新请求先完成后，旧请求晚到不能恢复旧售后状态', async () => {
    const first = deferred<any>()
    const second = deferred<any>()
    vi.mocked(getAftersaleList)
      .mockImplementationOnce(() => first.promise)
      .mockImplementationOnce(() => second.promise)

    const wrapper = mount(AftersaleListPage, {
      global: { stubs: { Loading: true, Empty: true } },
    })

    uniAppMock.onShowCallbacks.at(-1)?.()
    await Promise.resolve()
    uniAppMock.onShowCallbacks.at(-1)?.()
    await Promise.resolve()
    expect(getAftersaleList).toHaveBeenCalledTimes(2)

    second.resolve({ list: [row('refunded')], total: 1 })
    await flushPromises()
    expect(wrapper.find('.status-text').classes()).toContain('completed')

    first.resolve({ list: [row('pending_review')], total: 1 })
    await flushPromises()

    expect(wrapper.find('.status-text').classes()).toContain('completed')
    expect(wrapper.find('.status-text').classes()).not.toContain('pending')
  })
})
