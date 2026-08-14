import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useUserStore } from '../user'
import { useCartStore } from '../cart'
import { logout as logoutApi } from '@/api/auth'
import { removeToken } from '@/utils/request'

vi.mock('@/api/auth', () => ({
  wxLogin: vi.fn(),
  logout: vi.fn(),
  bindPhone: vi.fn(),
  updateProfile: vi.fn(),
}))

vi.mock('@/utils/request', () => ({
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  del: vi.fn(),
  getToken: vi.fn(() => ''),
  setToken: vi.fn(),
  removeToken: vi.fn(),
  redirectToLoginTab: vi.fn(),
}))

vi.mock('@/utils/share', () => ({
  handleShareBindOnLogin: vi.fn(),
}))

beforeEach(() => {
  vi.clearAllMocks()
  setActivePinia(createPinia())
  vi.mocked(logoutApi).mockResolvedValue(null as any)
  ;(globalThis as any).uni = {
    reLaunch: vi.fn(),
    login: vi.fn(),
    setTabBarBadge: vi.fn(),
    removeTabBarBadge: vi.fn(),
    showToast: vi.fn(),
  }
})

describe('小程序退出登录', () => {
  it('先发服务端撤销请求，再立即清除本地会话、购物车并返回首页', () => {
    const store = useUserStore()
    const cartStore = useCartStore()
    store.$patch({
      token: 'live-access-token',
      userInfo: {
        id: '1',
        nickname: '测试用户',
        memberLevel: 1,
        memberLevelName: '普通会员',
        points: 10,
      } as any,
    })
    cartStore.$patch({
      items: [{
        id: 'cart-1',
        productId: 'product-1',
        skuId: 'sku-1',
        productName: '测试商品',
        productImage: '',
        skuName: '默认规格',
        price: 1000,
        quantity: 1,
        stock: 10,
        checked: true,
      }],
    })

    store.logout()

    expect(logoutApi).toHaveBeenCalledTimes(1)
    expect(removeToken).toHaveBeenCalledTimes(1)
    expect(vi.mocked(logoutApi).mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(removeToken).mock.invocationCallOrder[0],
    )
    expect(store.token).toBe('')
    expect(store.userInfo).toBeNull()
    expect(cartStore.items).toEqual([])
    expect((globalThis as any).uni.removeTabBarBadge).toHaveBeenCalled()
    expect((globalThis as any).uni.reLaunch).toHaveBeenCalledWith({ url: '/pages/home/index' })
  })

  it('本地已无 token 时不发送无意义的 logout 请求，但仍清空本地购物车', () => {
    const store = useUserStore()
    const cartStore = useCartStore()
    cartStore.$patch({
      items: [{
        id: 'stale-cart',
        productId: 'product-1',
        skuId: 'sku-1',
        productName: '上个会话商品',
        productImage: '',
        skuName: '默认规格',
        price: 1000,
        quantity: 1,
        stock: 10,
        checked: true,
      }],
    })

    store.logout()

    expect(logoutApi).not.toHaveBeenCalled()
    expect(removeToken).toHaveBeenCalledTimes(1)
    expect(cartStore.items).toEqual([])
    expect((globalThis as any).uni.reLaunch).toHaveBeenCalledWith({ url: '/pages/home/index' })
  })
})
