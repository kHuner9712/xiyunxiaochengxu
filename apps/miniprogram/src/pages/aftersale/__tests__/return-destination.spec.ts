import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import AftersaleDetailPage from '../detail.vue'
import { getAftersaleDetail } from '@/api/aftersale'

const uniAppMock = vi.hoisted(() => ({
  onLoadCallbacks: [] as Array<(options?: Record<string, any>) => void | Promise<void>>,
  onShowCallbacks: [] as Array<() => void | Promise<void>>,
}))

vi.mock('@dcloudio/uni-app', () => ({
  onLoad: vi.fn((callback: (options?: Record<string, any>) => void | Promise<void>) => {
    uniAppMock.onLoadCallbacks.push(callback)
  }),
  onShow: vi.fn((callback: () => void | Promise<void>) => {
    uniAppMock.onShowCallbacks.push(callback)
  }),
}))

vi.mock('@/api/aftersale', () => ({
  getAftersaleDetail: vi.fn(),
  cancelAftersale: vi.fn(),
  fillReturnLogistics: vi.fn(),
}))

vi.mock('@/utils/private-file', () => ({
  resolvePrivateFileUrls: vi.fn(async (urls: string[]) => urls),
}))

function detail(overrides: Record<string, any> = {}) {
  return {
    id: '9',
    orderId: '1',
    orderNo: 'ORDER-1',
    type: 2,
    reason: '不合适',
    description: '申请退货',
    images: [],
    status: 'approved',
    refundAmount: 10000,
    productName: '测试商品',
    productImage: '',
    skuName: '标准装',
    price: 10000,
    quantity: 1,
    aftersaleLogs: [],
    returnReceiverName: '售后仓',
    returnReceiverPhone: '021-12345678',
    returnAddress: '上海市浦东新区测试路88号',
    createTime: '2026-08-10T00:00:00.000Z',
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  uniAppMock.onLoadCallbacks = []
  uniAppMock.onShowCallbacks = []
  vi.mocked(getAftersaleDetail).mockResolvedValue(detail() as any)
  ;(globalThis as any).uni = {
    showToast: vi.fn(),
    showModal: vi.fn(),
    navigateTo: vi.fn(),
    previewImage: vi.fn(),
    setClipboardData: vi.fn(),
    makePhoneCall: vi.fn(),
  }
})

describe('退货退款寄送信息', () => {
  it('审核通过后先展示退货地址，再允许填写退货物流', async () => {
    const wrapper = mount(AftersaleDetailPage, {
      global: { stubs: { PriceDisplay: true } },
    })
    await uniAppMock.onLoadCallbacks.at(-1)?.({ id: '9' })
    await flushPromises()

    expect(wrapper.text()).toContain('退货寄送信息')
    expect(wrapper.text()).toContain('售后仓')
    expect(wrapper.text()).toContain('021-12345678')
    expect(wrapper.text()).toContain('上海市浦东新区测试路88号')
    expect(wrapper.find('.return-logistics-btn').exists()).toBe(true)
  })

  it('历史已通过单缺少退货地址时阻止用户盲目寄件', async () => {
    vi.mocked(getAftersaleDetail).mockResolvedValue(detail({
      returnReceiverName: null,
      returnReceiverPhone: null,
      returnAddress: null,
    }) as any)

    const wrapper = mount(AftersaleDetailPage, {
      global: { stubs: { PriceDisplay: true } },
    })
    await uniAppMock.onLoadCallbacks.at(-1)?.({ id: '9' })
    await flushPromises()

    expect(wrapper.text()).toContain('退货地址尚未补齐')
    expect(wrapper.text()).toContain('请先联系客服')
    expect(wrapper.find('.return-logistics-btn').exists()).toBe(false)
  })
})
