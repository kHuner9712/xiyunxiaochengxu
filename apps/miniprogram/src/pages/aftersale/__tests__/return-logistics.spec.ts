import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import AftersaleDetailPage from '../detail.vue'
import { fillReturnLogistics, getAftersaleDetail } from '@/api/aftersale'

const uniAppMock = vi.hoisted(() => ({
  onLoadCallbacks: [] as Array<(options?: Record<string, any>) => void | Promise<void>>,
}))

vi.mock('@dcloudio/uni-app', () => ({
  onLoad: vi.fn((callback: (options?: Record<string, any>) => void | Promise<void>) => {
    uniAppMock.onLoadCallbacks.push(callback)
  }),
}))

vi.mock('@/api/aftersale', () => ({
  getAftersaleDetail: vi.fn(),
  cancelAftersale: vi.fn(),
  fillReturnLogistics: vi.fn(),
}))

vi.mock('@/utils/private-file', () => ({
  resolvePrivateFileUrls: vi.fn((urls: string[]) => Promise.resolve(urls)),
}))

function aftersaleDetail(overrides: Record<string, any> = {}) {
  return {
    id: '50',
    orderId: '1',
    orderNo: 'XY20260606001',
    type: 2,
    reason: '质量问题',
    description: '需要退货',
    images: [],
    status: 'approved',
    refundAmount: 9900,
    productName: '测试商品',
    productImage: 'https://api.example.com/product.jpg',
    skuName: '默认规格',
    price: 9900,
    quantity: 1,
    logs: [{ time: '2026-06-06', content: '审核通过', status: 'approved' }],
    createTime: '2026-06-06',
    ...overrides,
  }
}

function mountDetail() {
  return mount(AftersaleDetailPage, {
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
  vi.mocked(getAftersaleDetail).mockResolvedValue(aftersaleDetail() as any)
  vi.mocked(fillReturnLogistics).mockResolvedValue({} as any)
  ;(globalThis as any).uni = {
    showToast: vi.fn(),
    showModal: vi.fn(),
    navigateTo: vi.fn(),
    previewImage: vi.fn(),
  }
})

describe('售后退货物流填写', () => {
  it('待退货状态显示填写物流入口', async () => {
    const wrapper = mountDetail()
    await uniAppMock.onLoadCallbacks.at(-1)?.({ id: '50' })
    await flushPromises()

    expect(wrapper.text()).toContain('已通过/待退货')
    expect(wrapper.find('.return-logistics-btn').exists()).toBe(true)
  })

  it('仅退款不显示填写物流入口', async () => {
    vi.mocked(getAftersaleDetail).mockResolvedValueOnce(aftersaleDetail({ type: 1 }) as any)
    const wrapper = mountDetail()
    await uniAppMock.onLoadCallbacks.at(-1)?.({ id: '50' })
    await flushPromises()

    expect(wrapper.text()).toContain('已通过/待退款')
    expect(wrapper.find('.return-logistics-btn').exists()).toBe(false)
  })

  it('提交物流成功后刷新详情', async () => {
    vi.mocked(getAftersaleDetail)
      .mockResolvedValueOnce(aftersaleDetail() as any)
      .mockResolvedValueOnce(aftersaleDetail({ status: 'returned' }) as any)
    const wrapper = mountDetail()
    await uniAppMock.onLoadCallbacks.at(-1)?.({ id: '50' })
    await flushPromises()

    await wrapper.find('.return-logistics-btn').trigger('tap')
    await wrapper.find('.return-company-input').setValue('顺丰速运')
    await wrapper.find('.return-no-input').setValue('SF123456789')
    await wrapper.find('.return-phone-input').setValue('13800000000')
    await wrapper.find('.return-remark-input').setValue('已寄出')
    await wrapper.find('.submit-logistics-btn').trigger('tap')
    await flushPromises()

    expect(fillReturnLogistics).toHaveBeenCalledWith('50', {
      returnLogisticsCompany: '顺丰速运',
      returnLogisticsNo: 'SF123456789',
      contactPhone: '13800000000',
      remark: '已寄出',
    })
    expect(getAftersaleDetail).toHaveBeenCalledTimes(2)
  })

  it('缺少物流公司或单号时前端拦截', async () => {
    const wrapper = mountDetail()
    await uniAppMock.onLoadCallbacks.at(-1)?.({ id: '50' })
    await flushPromises()

    await wrapper.find('.return-logistics-btn').trigger('tap')
    await wrapper.find('.submit-logistics-btn').trigger('tap')
    await flushPromises()

    expect(fillReturnLogistics).not.toHaveBeenCalled()
    expect((globalThis as any).uni.showToast).toHaveBeenCalledWith({ title: '请输入物流公司', icon: 'none' })

    await wrapper.find('.return-company-input').setValue('顺丰速运')
    await wrapper.find('.submit-logistics-btn').trigger('tap')
    await flushPromises()

    expect(fillReturnLogistics).not.toHaveBeenCalled()
    expect((globalThis as any).uni.showToast).toHaveBeenCalledWith({ title: '请输入物流单号', icon: 'none' })
  })
})
