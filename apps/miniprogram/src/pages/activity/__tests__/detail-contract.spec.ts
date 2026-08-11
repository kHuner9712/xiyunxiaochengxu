import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import ActivityDetailPage from '../detail.vue'
import { getActivityDetail } from '@/api/activity'

const now = new Date('2026-06-06T00:00:00.000Z')

const uniAppMock = vi.hoisted(() => ({
  onLoadCallbacks: [] as Array<(options?: Record<string, any>) => void | Promise<void>>,
  onShowCallbacks: [] as Array<() => void>,
  onHideCallbacks: [] as Array<() => void>,
  onUnloadCallbacks: [] as Array<() => void>,
}))

vi.mock('@dcloudio/uni-app', () => ({
  onLoad: vi.fn((callback: (options?: Record<string, any>) => void | Promise<void>) => {
    uniAppMock.onLoadCallbacks.push(callback)
  }),
  onShow: vi.fn((callback: () => void) => {
    uniAppMock.onShowCallbacks.push(callback)
  }),
  onHide: vi.fn((callback: () => void) => {
    uniAppMock.onHideCallbacks.push(callback)
  }),
  onUnload: vi.fn((callback: () => void) => {
    uniAppMock.onUnloadCallbacks.push(callback)
  }),
  onShareAppMessage: vi.fn(),
}))

vi.mock('@/api/activity', () => ({
  getActivityDetail: vi.fn(),
}))

function activityDetail(overrides: Record<string, any> = {}) {
  return {
    id: '1',
    name: '限时活动',
    bannerImage: 'https://api.example.com/activity.jpg',
    description: '活动说明',
    type: '1',
    startTime: now.toISOString(),
    endTime: new Date(now.getTime() + 60 * 60 * 1000).toISOString(),
    rules: null,
    products: [{
      id: '2',
      activityProductId: '10',
      productId: '2',
      skuId: '3',
      name: '活动奶粉',
      image: 'https://api.example.com/product.jpg',
      price: 8900,
      originalPrice: 9900,
      sales: 12,
      activityPrice: 8900,
      stock: 5,
      activityStock: 5,
      limitPerUser: 2,
      fulfillmentType: 'delivery',
    }],
    ...overrides,
  }
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(now)
  vi.clearAllMocks()
  uniAppMock.onLoadCallbacks = []
  uniAppMock.onShowCallbacks = []
  uniAppMock.onHideCallbacks = []
  uniAppMock.onUnloadCallbacks = []
  vi.mocked(getActivityDetail).mockResolvedValue(activityDetail() as any)
  ;(globalThis as any).uni = {
    showToast: vi.fn(),
    navigateTo: vi.fn(),
  }
})

afterEach(() => {
  vi.useRealTimers()
})

describe('活动详情字段契约', () => {
  it('使用 bannerImage 兜底展示 banner，并渲染 ISO 倒计时', async () => {
    const wrapper = mount(ActivityDetailPage, {
      global: {
        stubs: {
          ProductCard: true,
        },
      },
    })
    await uniAppMock.onLoadCallbacks.at(-1)?.({ id: '1' })
    await flushPromises()

    expect(wrapper.find('image.activity-banner').attributes('src')).toBe('https://api.example.com/activity.jpg')
    expect(wrapper.text()).toContain('01')
    expect(wrapper.text()).not.toContain('NaN')
  })

  it('使用服务端 canonical products 渲染活动商品', async () => {
    const wrapper = mount(ActivityDetailPage, {
      global: {
        stubs: {
          CountdownTimer: true,
        },
      },
    })
    await uniAppMock.onLoadCallbacks.at(-1)?.({ id: '1' })
    await flushPromises()

    expect(wrapper.text()).toContain('活动奶粉')
    expect(wrapper.text()).toContain('¥89.00')
    expect(wrapper.text()).toContain('¥99.00')
    expect(wrapper.text()).toContain('活动可售 5 件')
    expect(wrapper.find('.product-image').attributes('src')).toBe('https://api.example.com/product.jpg')

    expect((wrapper.vm as any).activityProducts[0]).toMatchObject({
      activityProductId: '10',
      productId: '2',
      skuId: '3',
      name: '活动奶粉',
      image: 'https://api.example.com/product.jpg',
      price: 8900,
      originalPrice: 9900,
      sales: 12,
      activityPrice: 8900,
      stock: 5,
    })
  })

  it('跨过开始时间后无需刷新页面即可自动解锁购买', async () => {
    vi.mocked(getActivityDetail).mockResolvedValue(activityDetail({
      startTime: new Date(now.getTime() + 1000).toISOString(),
      endTime: new Date(now.getTime() + 60 * 1000).toISOString(),
    }) as any)

    const wrapper = mount(ActivityDetailPage, {
      global: {
        stubs: {
          CountdownTimer: true,
        },
      },
    })
    await uniAppMock.onLoadCallbacks.at(-1)?.({ id: '1' })
    await flushPromises()
    uniAppMock.onShowCallbacks.at(-1)?.()
    await flushPromises()

    expect(wrapper.text()).toContain('即将开始')
    expect(wrapper.find('button.buy-btn').attributes('disabled')).toBeDefined()

    await vi.advanceTimersByTimeAsync(1500)
    await flushPromises()

    expect(wrapper.text()).toContain('进行中')
    expect(wrapper.find('button.buy-btn').attributes('disabled')).toBeUndefined()

    uniAppMock.onHideCallbacks.at(-1)?.()
    wrapper.unmount()
  })
})
