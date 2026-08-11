import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ProductListPage from '../product/list.vue'
import ContentListPage from '../content/list.vue'
import ActivityContentListPage from '../activity-content/list.vue'
import { getProductList } from '@/api/product'
import { getContentCategories, getContentList } from '@/api/content'
import { getActivityContentList } from '@/api/activity-content'

vi.mock('@dcloudio/uni-app', () => ({
  onLoad: (callback: (options?: Record<string, unknown>) => void) => callback({}),
  onReachBottom: vi.fn(),
  onPullDownRefresh: vi.fn(),
}))

vi.mock('@/api/product', () => ({
  getProductList: vi.fn(),
}))

vi.mock('@/api/content', () => ({
  getContentCategories: vi.fn(),
  getContentList: vi.fn(),
}))

vi.mock('@/api/activity-content', () => ({
  getActivityContentList: vi.fn(),
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

function mountPage(component: any) {
  return mount(component, {
    global: {
      stubs: {
        ProductCard: true,
        Loading: true,
        Empty: true,
      },
    },
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  ;(globalThis as any).uni = {
    showToast: vi.fn(),
    navigateTo: vi.fn(),
    stopPullDownRefresh: vi.fn(),
  }
  vi.mocked(getContentCategories).mockResolvedValue([
    { id: 'cat-a', name: '分类A' } as any,
    { id: 'cat-b', name: '分类B' } as any,
  ])
})

describe('版本化列表请求并发', () => {
  it('商品排序切换后，旧排序响应晚到不能污染新排序结果', async () => {
    const first = deferred<any>()
    const second = deferred<any>()
    vi.mocked(getProductList)
      .mockImplementationOnce(() => first.promise)
      .mockImplementationOnce(() => second.promise)

    const wrapper = mountPage(ProductListPage)
    await Promise.resolve()

    const vm = wrapper.vm as any
    vm.switchSort('sales')
    await Promise.resolve()

    expect(getProductList).toHaveBeenNthCalledWith(1, {
      sort: 'default',
      page: 1,
      pageSize: 10,
    })
    expect(getProductList).toHaveBeenNthCalledWith(2, {
      sort: 'sales',
      page: 1,
      pageSize: 10,
    })

    second.resolve({
      list: [{ id: 'sales-new', name: '销量新结果' }],
      total: 1,
      page: 1,
      pageSize: 10,
    })
    await flushPromises()
    expect(vm.currentSort).toBe('sales')
    expect(vm.products.map((item: any) => item.id)).toEqual(['sales-new'])

    first.resolve({
      list: [{ id: 'default-stale', name: '综合旧结果' }],
      total: 1,
      page: 1,
      pageSize: 10,
    })
    await flushPromises()

    expect(vm.currentSort).toBe('sales')
    expect(vm.products.map((item: any) => item.id)).toEqual(['sales-new'])
    expect(vm.loading).toBe(false)
  })

  it('育儿知识切换分类后，旧分类响应晚到不能污染新分类结果', async () => {
    const first = deferred<any>()
    const second = deferred<any>()
    vi.mocked(getContentList)
      .mockImplementationOnce(() => first.promise)
      .mockImplementationOnce(() => second.promise)

    const wrapper = mountPage(ContentListPage)
    await flushPromises()

    const vm = wrapper.vm as any
    expect(getContentList).toHaveBeenCalledTimes(1)
    expect(getContentList).toHaveBeenNthCalledWith(1, {
      page: 1,
      pageSize: 10,
      categoryId: 'cat-a',
    })

    vm.switchCategory('cat-b')
    await Promise.resolve()
    expect(getContentList).toHaveBeenNthCalledWith(2, {
      page: 1,
      pageSize: 10,
      categoryId: 'cat-b',
    })

    second.resolve({
      list: [{ id: 'content-new', title: '分类B内容' }],
      total: 1,
      page: 1,
      pageSize: 10,
    })
    await flushPromises()
    expect(vm.currentCategoryId).toBe('cat-b')
    expect(vm.contents.map((item: any) => item.id)).toEqual(['content-new'])

    first.resolve({
      list: [{ id: 'content-stale', title: '分类A旧内容' }],
      total: 1,
      page: 1,
      pageSize: 10,
    })
    await flushPromises()

    expect(vm.currentCategoryId).toBe('cat-b')
    expect(vm.contents.map((item: any) => item.id)).toEqual(['content-new'])
    expect(vm.loading).toBe(false)
  })

  it('活动专区切换类型后，旧类型响应晚到不能污染新类型结果', async () => {
    const first = deferred<any>()
    const second = deferred<any>()
    vi.mocked(getActivityContentList)
      .mockImplementationOnce(() => first.promise)
      .mockImplementationOnce(() => second.promise)

    const wrapper = mountPage(ActivityContentListPage)
    await Promise.resolve()

    const vm = wrapper.vm as any
    vm.switchType('video')
    await Promise.resolve()

    expect(getActivityContentList).toHaveBeenNthCalledWith(1, {
      page: 1,
      pageSize: 10,
      keyword: undefined,
      type: undefined,
    })
    expect(getActivityContentList).toHaveBeenNthCalledWith(2, {
      page: 1,
      pageSize: 10,
      keyword: undefined,
      type: 'video',
    })

    second.resolve({
      list: [{ id: 'video-new', title: '视频新结果', type: 'video' }],
      total: 1,
      page: 1,
      pageSize: 10,
    })
    await flushPromises()
    expect(vm.currentType).toBe('video')
    expect(vm.list.map((item: any) => item.id)).toEqual(['video-new'])

    first.resolve({
      list: [{ id: 'article-stale', title: '旧图文', type: 'article' }],
      total: 1,
      page: 1,
      pageSize: 10,
    })
    await flushPromises()

    expect(vm.currentType).toBe('video')
    expect(vm.list.map((item: any) => item.id)).toEqual(['video-new'])
    expect(vm.loading).toBe(false)
  })
})
