import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import SearchPage from '../index.vue'
import { searchProducts } from '@/api/search'

const storeMock = vi.hoisted(() => ({
  userStore: {
    isLoggedIn: false,
  },
}))

vi.mock('@dcloudio/uni-app', () => ({
  onReachBottom: vi.fn(),
  onPullDownRefresh: vi.fn(),
}))

vi.mock('@/stores/user', () => ({
  useUserStore: () => storeMock.userStore,
}))

vi.mock('@/api/search', () => ({
  searchProducts: vi.fn(),
  getHotKeywords: vi.fn(async () => []),
  getSearchHistory: vi.fn(async () => []),
  clearSearchHistory: vi.fn(async () => undefined),
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

beforeEach(() => {
  vi.clearAllMocks()
  storeMock.userStore.isLoggedIn = false
  ;(globalThis as any).uni = {
    showToast: vi.fn(),
    stopPullDownRefresh: vi.fn(),
  }
})

describe('搜索请求并发', () => {
  it('新关键词搜索必须覆盖旧请求，旧响应晚到时不能污染新结果', async () => {
    const first = deferred<any>()
    const second = deferred<any>()
    vi.mocked(searchProducts)
      .mockImplementationOnce(() => first.promise)
      .mockImplementationOnce(() => second.promise)

    const wrapper = mount(SearchPage, {
      global: {
        stubs: {
          ProductCard: true,
          Loading: true,
          Empty: true,
        },
      },
    })
    await flushPromises()

    const vm = wrapper.vm as any
    vm.keyword = '奶粉'
    const firstSearch = vm.doSearch()
    await Promise.resolve()

    vm.keyword = '纸尿裤'
    const secondSearch = vm.doSearch()
    await Promise.resolve()

    expect(searchProducts).toHaveBeenNthCalledWith(1, {
      keyword: '奶粉',
      page: 1,
      pageSize: 10,
    })
    expect(searchProducts).toHaveBeenNthCalledWith(2, {
      keyword: '纸尿裤',
      page: 1,
      pageSize: 10,
    })

    second.resolve({
      list: [{ id: 'new-result', name: '纸尿裤结果' }],
      total: 1,
      page: 1,
      pageSize: 10,
    })
    await secondSearch
    await flushPromises()

    expect(vm.keyword).toBe('纸尿裤')
    expect(vm.products.map((item: any) => item.id)).toEqual(['new-result'])
    expect(vm.loading).toBe(false)

    first.resolve({
      list: [{ id: 'stale-result', name: '奶粉旧结果' }],
      total: 1,
      page: 1,
      pageSize: 10,
    })
    await firstSearch
    await flushPromises()

    expect(vm.keyword).toBe('纸尿裤')
    expect(vm.products.map((item: any) => item.id)).toEqual(['new-result'])
    expect((globalThis as any).uni.showToast).not.toHaveBeenCalledWith({
      title: '搜索失败',
      icon: 'none',
    })
  })
})
