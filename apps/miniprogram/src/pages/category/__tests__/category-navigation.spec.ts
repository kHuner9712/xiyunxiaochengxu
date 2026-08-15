import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import CategoryPage from '../index.vue'
import { getCategoryTree } from '@/api/category'

const uniAppMock = vi.hoisted(() => ({
  onShowCallbacks: [] as Array<() => void>,
}))

vi.mock('@dcloudio/uni-app', () => ({
  onShow: vi.fn((callback: () => void) => {
    uniAppMock.onShowCallbacks.push(callback)
  }),
}))

vi.mock('@/api/category', () => ({
  getCategoryTree: vi.fn(),
}))

beforeEach(() => {
  vi.clearAllMocks()
  uniAppMock.onShowCallbacks = []
  ;(globalThis as any).uni = {
    navigateTo: vi.fn(),
    showToast: vi.fn(),
  }
})

async function showPage() {
  uniAppMock.onShowCallbacks.at(-1)?.()
  await flushPromises()
}

describe('分类页核心操作', () => {
  it('优先选择有子分类的一级分类，并可进入对应商品列表', async () => {
    vi.mocked(getCategoryTree).mockResolvedValue([
      { id: 'leaf', name: '空分类', children: [] },
      {
        id: 'parent',
        name: '喂养用品',
        children: [{ id: 'child', name: '奶瓶', icon: '', children: [] }],
      },
    ] as any)

    const wrapper = mount(CategoryPage, {
      global: { stubs: { Empty: true } },
    })
    await showPage()

    expect((wrapper.vm as any).currentCategoryId).toBe('parent')
    expect(wrapper.text()).toContain('喂养用品')
    expect(wrapper.text()).toContain('奶瓶')

    await wrapper.find('.sub-category').trigger('tap')
    expect((globalThis as any).uni.navigateTo).toHaveBeenCalledWith({
      url: '/pages/product/list?categoryId=child',
    })
  })

  it('搜索入口始终跳转到搜索页', async () => {
    vi.mocked(getCategoryTree).mockResolvedValue([] as any)
    const wrapper = mount(CategoryPage, {
      global: { stubs: { Empty: true } },
    })
    await showPage()

    await wrapper.find('.search-pill').trigger('tap')
    expect((globalThis as any).uni.navigateTo).toHaveBeenCalledWith({ url: '/pages/search/index' })
  })

  it('分类接口失败时给出明确提示而不是静默空白', async () => {
    vi.mocked(getCategoryTree).mockRejectedValue(new Error('network'))
    mount(CategoryPage, { global: { stubs: { Empty: true } } })
    await showPage()

    expect((globalThis as any).uni.showToast).toHaveBeenCalledWith({
      title: '分类加载失败',
      icon: 'none',
    })
  })
})
