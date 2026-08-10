import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ContentDetailPage from '../detail.vue'
import { getContentDetail } from '@/api/content'

const uniAppMock = vi.hoisted(() => ({
  onLoadCallbacks: [] as Array<(options?: Record<string, any>) => void | Promise<void>>,
}))

vi.mock('@dcloudio/uni-app', () => ({
  onLoad: vi.fn((callback: (options?: Record<string, any>) => void | Promise<void>) => {
    uniAppMock.onLoadCallbacks.push(callback)
  }),
  onShareAppMessage: vi.fn(),
}))

vi.mock('@/api/content', () => ({
  getContentDetail: vi.fn(),
}))

beforeEach(() => {
  vi.clearAllMocks()
  uniAppMock.onLoadCallbacks = []
  vi.mocked(getContentDetail).mockResolvedValue({
    id: '1',
    title: '育儿文章',
    coverImage: '',
    content: '<p>正文</p>',
    categoryId: '',
    contentType: 'article',
    summary: '',
    viewCount: 1,
    publishedAt: '2026-08-10T00:00:00.000Z',
    relatedProducts: [{
      id: '2',
      name: '关联商品',
      image: 'https://api.example.com/p.jpg',
      price: 9900,
    }],
    relatedActivity: {
      id: '4',
      name: '进行中活动',
      image: 'https://api.example.com/a.jpg',
      type: '1',
      startTime: '2026-08-10T00:00:00.000Z',
      endTime: '2026-08-11T00:00:00.000Z',
    },
  } as any)
  ;(globalThis as any).uni = {
    showToast: vi.fn(),
    navigateTo: vi.fn(),
  }
})

describe('内容关联目标', () => {
  it('展示公共可用的关联商品和活动并跳转到真实详情页', async () => {
    const wrapper = mount(ContentDetailPage)
    await uniAppMock.onLoadCallbacks.at(-1)?.({ id: '1' })
    await flushPromises()

    expect(wrapper.text()).toContain('相关活动')
    expect(wrapper.text()).toContain('进行中活动')
    expect(wrapper.text()).toContain('相关商品')
    expect(wrapper.text()).toContain('关联商品')
    expect(wrapper.text()).toContain('¥99.00')

    await wrapper.find('.activity-link').trigger('click')
    expect((globalThis as any).uni.navigateTo).toHaveBeenCalledWith({
      url: '/pages/activity/detail?id=4',
    })

    await wrapper.find('.related-product').trigger('click')
    expect((globalThis as any).uni.navigateTo).toHaveBeenCalledWith({
      url: '/pages/product/detail?id=2',
    })
  })
})
