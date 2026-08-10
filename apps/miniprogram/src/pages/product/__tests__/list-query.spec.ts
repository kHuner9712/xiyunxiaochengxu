import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ProductListPage from '../list.vue'
import { getProductList } from '@/api/product'

let loadHandler: ((options?: Record<string, string>) => void) | undefined

vi.mock('@dcloudio/uni-app', () => ({
  onLoad: vi.fn((handler) => { loadHandler = handler }),
  onReachBottom: vi.fn(),
  onPullDownRefresh: vi.fn(),
}))

vi.mock('@/api/product', () => ({
  getProductList: vi.fn(),
}))

function mountPage() {
  return mount(ProductListPage, {
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
  loadHandler = undefined
  vi.mocked(getProductList).mockResolvedValue({ list: [], total: 0 } as any)
  ;(globalThis as any).uni = {
    showToast: vi.fn(),
    navigateTo: vi.fn(),
    stopPullDownRefresh: vi.fn(),
  }
})

describe('商品列表路由参数', () => {
  it('热门更多映射为销量排序且分类 ID 保持 bigint-safe 字符串', async () => {
    mountPage()
    expect(loadHandler).toBeTypeOf('function')

    loadHandler?.({ categoryId: '9007199254740993', sort: 'hot' })
    await flushPromises()

    expect(getProductList).toHaveBeenCalledWith(expect.objectContaining({
      categoryId: '9007199254740993',
      sort: 'sales',
      page: 1,
      pageSize: 10,
    }))
  })

  it('未知排序和非法分类 ID 不会透传到公开商品接口', async () => {
    mountPage()
    loadHandler?.({ categoryId: '1e6', sort: 'unexpected' })
    await flushPromises()

    expect(getProductList).toHaveBeenCalledWith({
      sort: 'default',
      page: 1,
      pageSize: 10,
    })
  })
})
