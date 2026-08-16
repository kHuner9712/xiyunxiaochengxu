import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ProfilePage from '../profile.vue'
import { cancelAccount } from '@/api/auth'

const uniAppMock = vi.hoisted(() => ({
  onShowCallbacks: [] as Array<() => void | Promise<void>>,
}))

const storeMock = vi.hoisted(() => ({
  userStore: {
    isLoggedIn: true,
    userInfo: {
      nickname: '测试用户',
      avatar: 'https://example.com/avatar.png',
      avatarUrl: '',
      phone: '13800000000',
    },
    avatar: 'https://example.com/avatar.png',
    memberLevelName: '普通会员',
    fetchUserInfo: vi.fn(),
    updateProfile: vi.fn(),
    logout: vi.fn(),
  },
}))

vi.mock('@dcloudio/uni-app', () => ({
  onShow: vi.fn((callback: () => void | Promise<void>) => {
    uniAppMock.onShowCallbacks.push(callback)
  }),
}))

vi.mock('@/stores/user', () => ({
  useUserStore: () => storeMock.userStore,
}))

vi.mock('@/api/auth', () => ({
  cancelAccount: vi.fn(),
}))

vi.mock('@/api/upload', () => ({
  uploadImage: vi.fn(),
}))

beforeEach(() => {
  vi.clearAllMocks()
  uniAppMock.onShowCallbacks = []
  storeMock.userStore.isLoggedIn = true
  storeMock.userStore.fetchUserInfo.mockResolvedValue({})
  storeMock.userStore.logout.mockReturnValue(undefined)
  vi.mocked(cancelAccount).mockResolvedValue({
    cancelled: true,
    cancelledAt: '2026-08-17T03:00:00.000Z',
  })
})

describe('账号注销入口', () => {
  it('两次明确确认后调用后端注销，并只在成功后清理本地登录态', async () => {
    const showModal = vi.fn((options: any) => {
      options.success?.({ confirm: true, cancel: false })
    })
    ;(globalThis as any).uni = {
      showModal,
      showToast: vi.fn(),
      navigateTo: vi.fn(),
    }

    const wrapper = mount(ProfilePage)
    await wrapper.find('button.cancel-account-btn').trigger('tap')
    await flushPromises()

    expect(showModal).toHaveBeenCalledTimes(2)
    expect(cancelAccount).toHaveBeenCalledTimes(1)
    expect(storeMock.userStore.logout).toHaveBeenCalledTimes(1)
    expect((globalThis as any).uni.showToast).toHaveBeenCalledWith({
      title: '账号已注销',
      icon: 'success',
    })
  })

  it('后端因未完成业务拒绝注销时保留登录态并展示真实原因', async () => {
    vi.mocked(cancelAccount).mockRejectedValueOnce(new Error('存在处理中售后单，请等待售后完成后再注销账号'))
    let confirmCount = 0
    const showModal = vi.fn((options: any) => {
      if (confirmCount < 2) {
        confirmCount += 1
        options.success?.({ confirm: true, cancel: false })
      }
    })
    ;(globalThis as any).uni = {
      showModal,
      showToast: vi.fn(),
      navigateTo: vi.fn(),
    }

    const wrapper = mount(ProfilePage)
    await wrapper.find('button.cancel-account-btn').trigger('tap')
    await flushPromises()

    expect(cancelAccount).toHaveBeenCalledTimes(1)
    expect(storeMock.userStore.logout).not.toHaveBeenCalled()
    const failureModal = showModal.mock.calls.at(-1)?.[0]
    expect(failureModal).toMatchObject({
      title: '暂时无法注销',
      content: '存在处理中售后单，请等待售后完成后再注销账号',
      showCancel: false,
    })
  })
})
