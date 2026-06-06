import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import ActivityDetailPage from '../detail.vue'
import { getActivityDetail } from '@/api/activity'

const now = new Date('2026-06-06T00:00:00.000Z')

const uniAppMock = vi.hoisted(() => ({
  onLoadCallbacks: [] as Array<(options?: Record<string, any>) => void | Promise<void>>,
}))

vi.mock('@dcloudio/uni-app', () => ({
  onLoad: vi.fn((callback: (options?: Record<string, any>) => void | Promise<void>) => {
    uniAppMock.onLoadCallbacks.push(callback)
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
    type: 'flash_sale',
    startTime: now.toISOString(),
    endTime: new Date(now.getTime() + 60 * 60 * 1000).toISOString(),
    rules: '活动规则',
    activityProducts: [{
      id: 'ap-1',
      productId: 'p-1',
      activityPrice: 8900,
      activityStock: 5,
      product: {
        id: 'p-1',
        name: '活动奶粉',
        mainImage: 'https://api.example.com/product.jpg',
        minPrice: 9900,
        totalSales: 12,
      },
    }],
    ...overrides,
  }
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(now)
  vi.clearAllMocks()
  uniAppMock.onLoadCallbacks = []
  vi.mocked(getActivityDetail).mockResolvedValue(activityDetail() as any)
  ;(globalThis as any).uni = {
    showToast: vi.fn(),
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

  it('将 activityProducts 映射为 ProductCard 可用字段', async () => {
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
    expect(wrapper.text()).toContain('已售12件')
    expect(wrapper.find('.product-image').attributes('src')).toBe('https://api.example.com/product.jpg')

    expect((wrapper.vm as any).activityProducts[0]).toMatchObject({
      name: '活动奶粉',
      image: 'https://api.example.com/product.jpg',
      price: 8900,
      originalPrice: 9900,
      sales: 12,
      activityPrice: 8900,
      stock: 5,
    })
  })
})
