import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import HomePage from '../index.vue'
import { getGuessProducts, getHomeData } from '@/api/home'

const uniAppMock = vi.hoisted(() => ({
  onShowCallbacks: [] as Array<() => void>,
}))

vi.mock('@dcloudio/uni-app', () => ({
  onPullDownRefresh: vi.fn(),
  onReachBottom: vi.fn(),
  onShareAppMessage: vi.fn(),
  onShow: vi.fn((callback: () => void) => uniAppMock.onShowCallbacks.push(callback)),
}))

vi.mock('@/api/home', () => ({
  getHomeData: vi.fn(),
  getGuessProducts: vi.fn(),
}))

vi.mock('@/stores/user', () => ({
  useUserStore: () => ({ userInfo: null }),
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

function homePayload(name: string) {
  return {
    brand: { name, logo: '' },
    banners: [],
    quickEntries: [],
    announcement: '',
    recommendations: [],
    monthRecommend: [],
    hotProducts: [],
    newProducts: [],
    activities: [],
  } as any
}

function guessPayload(id: string) {
  return {
    list: [{ id, name: id, price: 100, image: '' }],
    total: 1,
  } as any
}

beforeEach(() => {
  vi.clearAllMocks()
  uniAppMock.onShowCallbacks = []
  ;(globalThis as any).uni = {
    showToast: vi.fn(),
    stopPullDownRefresh: vi.fn(),
    navigateTo: vi.fn(),
    switchTab: vi.fn(),
  }
})

describe('首页前台刷新', () => {
  it('再次显示首页时刷新数据，旧首页与旧猜你喜欢响应晚到也不能覆盖新结果', async () => {
    const oldHome = deferred<any>()
    const newHome = deferred<any>()
    const oldGuess = deferred<any>()
    const newGuess = deferred<any>()
    vi.mocked(getHomeData)
      .mockImplementationOnce(() => oldHome.promise)
      .mockImplementationOnce(() => newHome.promise)
    vi.mocked(getGuessProducts)
      .mockImplementationOnce(() => oldGuess.promise)
      .mockImplementationOnce(() => newGuess.promise)

    const wrapper = mount(HomePage, {
      global: {
        stubs: {
          ProductCard: { template: '<view class="product-card-stub" />' },
          CountdownTimer: true,
          Loading: true,
          Empty: true,
        },
      },
    })

    const onShow = uniAppMock.onShowCallbacks.at(-1)
    onShow?.()
    await Promise.resolve()
    onShow?.()
    await Promise.resolve()

    newHome.resolve(homePayload('最新首页'))
    newGuess.resolve(guessPayload('new-product'))
    await flushPromises()

    const vm = wrapper.vm as any
    expect(vm.homeData.brand.name).toBe('最新首页')
    expect(vm.guessProducts.map((item: any) => item.id)).toEqual(['new-product'])

    oldHome.resolve(homePayload('旧首页'))
    oldGuess.resolve(guessPayload('old-product'))
    await flushPromises()

    expect(vm.homeData.brand.name).toBe('最新首页')
    expect(vm.guessProducts.map((item: any) => item.id)).toEqual(['new-product'])
    expect(vm.guessLoading).toBe(false)
  })
})
