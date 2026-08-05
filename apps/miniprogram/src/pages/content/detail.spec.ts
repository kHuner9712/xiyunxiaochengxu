import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ContentDetailPage from './detail.vue'

const mocks = vi.hoisted(() => ({
  loadHandler: undefined as ((options?: Record<string, string>) => void) | undefined,
  shareHandler: undefined as (() => unknown) | undefined,
  getContentDetail: vi.fn(),
}))

vi.mock('@dcloudio/uni-app', () => ({
  onLoad: vi.fn((handler: (options?: Record<string, string>) => void) => {
    mocks.loadHandler = handler
  }),
  onShareAppMessage: vi.fn((handler: () => unknown) => {
    mocks.shareHandler = handler
  }),
}))

vi.mock('@/api/content', () => ({
  getContentDetail: mocks.getContentDetail,
}))

describe('content detail page', () => {
  beforeEach(() => {
    mocks.loadHandler = undefined
    mocks.shareHandler = undefined
    mocks.getContentDetail.mockReset()
  })

  it('renders the persisted video URL and poster returned by the API', async () => {
    mocks.getContentDetail.mockResolvedValue({
      id: '123',
      title: '育儿视频',
      coverImage: 'https://api.example.com/uploads/public/cover.jpg',
      content: '',
      categoryId: '',
      contentType: 'video',
      summary: '',
      videoUrl: 'https://api.example.com/uploads/public/video.mp4',
      videoCover: 'https://api.example.com/uploads/public/poster.jpg',
      videoDuration: 30,
      tags: ['育儿'],
      viewCount: 1,
      publishedAt: '2026-08-05T00:00:00.000Z',
    })

    const wrapper = mount(ContentDetailPage)
    expect(mocks.loadHandler).toBeTypeOf('function')

    mocks.loadHandler?.({ id: '123' })
    await flushPromises()

    expect(mocks.getContentDetail).toHaveBeenCalledWith(123)
    const video = wrapper.find('video')
    expect(video.exists()).toBe(true)
    expect(video.attributes('src')).toBe('https://api.example.com/uploads/public/video.mp4')
    expect(video.attributes('poster')).toBe('https://api.example.com/uploads/public/poster.jpg')
  })

  it('does not render a video element for article content', async () => {
    mocks.getContentDetail.mockResolvedValue({
      id: '124',
      title: '育儿文章',
      coverImage: 'https://api.example.com/uploads/public/article.jpg',
      content: '<p>正文</p>',
      categoryId: '',
      contentType: 'article',
      summary: '摘要',
      viewCount: 2,
      publishedAt: '2026-08-05T00:00:00.000Z',
    })

    const wrapper = mount(ContentDetailPage)
    mocks.loadHandler?.({ id: '124' })
    await flushPromises()

    expect(mocks.getContentDetail).toHaveBeenCalledWith(124)
    expect(wrapper.find('video').exists()).toBe(false)
  })

  it('builds the share path from the loaded content identifier', async () => {
    mocks.getContentDetail.mockResolvedValue({
      id: '125',
      title: '可分享内容',
      coverImage: '',
      content: '正文',
      categoryId: '',
      contentType: 'article',
      summary: '',
      viewCount: 0,
      publishedAt: '',
    })

    mount(ContentDetailPage)
    mocks.loadHandler?.({ id: '125' })
    await flushPromises()

    expect(mocks.shareHandler?.()).toEqual({
      title: '可分享内容',
      path: '/pages/content/detail?id=125',
    })
  })
})
