import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useUserStore } from '../user'
import { wxLogin as wxLoginApi } from '@/api/auth'
import { get, setToken } from '@/utils/request'
import { handleShareBindOnLogin } from '@/utils/share'

vi.mock('@/api/auth', () => ({
  wxLogin: vi.fn(),
  bindPhone: vi.fn(),
  updateProfile: vi.fn(),
}))

vi.mock('@/utils/request', () => ({
  get: vi.fn(),
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
  vi.mocked(wxLoginApi).mockResolvedValue({ token: 'token-1', isNewUser: false })
  vi.mocked(get).mockResolvedValue({
    id: '100',
    nickname: '微信用户',
    phone: '13800138000',
    memberLevel: 0,
    memberLevelName: '普通用户',
    points: 100,
  })
  vi.mocked(handleShareBindOnLogin).mockResolvedValue(true)
  ;(globalThis as any).uni = {
    login: vi.fn(({ success }) => success({ code: 'wx-code' })),
    getStorageSync: vi.fn(),
    setStorageSync: vi.fn(),
    removeStorageSync: vi.fn(),
    reLaunch: vi.fn(),
  }
})

describe('用户登录后的分享邀请绑定', () => {
  it('wxLogin 成功后立即绑定 pending_invite', async () => {
    const store = useUserStore()

    await store.wxLogin()

    expect(wxLoginApi).toHaveBeenCalledWith({ code: 'wx-code' })
    expect(setToken).toHaveBeenCalledWith('token-1')
    expect(handleShareBindOnLogin).toHaveBeenCalledTimes(1)
  })

  it('分享绑定失败不影响登录主流程并输出 warn', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.mocked(handleShareBindOnLogin).mockRejectedValueOnce(new Error('bind failed'))
    const store = useUserStore()

    await expect(store.wxLogin()).resolves.toEqual({ token: 'token-1', isNewUser: false })

    expect(store.isLoggedIn).toBe(true)
    expect(warnSpy).toHaveBeenCalledWith(
      '[baby-mall] bind invite after login failed:',
      expect.any(Error),
    )
    warnSpy.mockRestore()
  })
})
