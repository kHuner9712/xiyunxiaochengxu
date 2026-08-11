import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useUserStore } from '../user'
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
  }
})

describe('小程序退出登录', () => {
  it('先发服务端撤销请求，再立即清除本地会话并返回首页', () => {
    const store = useUserStore()
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

    store.logout()

    expect(logoutApi).toHaveBeenCalledTimes(1)
    expect(removeToken).toHaveBeenCalledTimes(1)
    expect(vi.mocked(logoutApi).mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(removeToken).mock.invocationCallOrder[0],
    )
    expect(store.token).toBe('')
    expect(store.userInfo).toBeNull()
    expect((globalThis as any).uni.reLaunch).toHaveBeenCalledWith({ url: '/pages/home/index' })
  })

  it('本地已无 token 时不发送无意义的 logout 请求', () => {
    const store = useUserStore()

    store.logout()

    expect(logoutApi).not.toHaveBeenCalled()
    expect(removeToken).toHaveBeenCalledTimes(1)
    expect((globalThis as any).uni.reLaunch).toHaveBeenCalledWith({ url: '/pages/home/index' })
  })
})
