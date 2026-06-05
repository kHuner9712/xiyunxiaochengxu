import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import UserPage from '../index.vue'

const storeMock = vi.hoisted(() => ({
  userStore: {
    isLoggedIn: true,
    nickname: '微信用户',
    avatar: '',
    phone: '',
    memberLevelName: '普通用户',
    wxLogin: vi.fn(),
    bindPhone: vi.fn(),
  },
}))

vi.mock('@dcloudio/uni-app', () => ({
  onShow: vi.fn(),
}))

vi.mock('@/stores/user', () => ({
  useUserStore: () => storeMock.userStore,
}))

vi.mock('@/api/order', () => ({
  getOrderCount: vi.fn().mockResolvedValue({
    unpaid: 0,
    unshipped: 0,
    pendingPickup: 0,
    unreceived: 0,
    aftersale: 0,
  }),
  normalizeOrderStatus: vi.fn((status) => status),
}))

function mountUserPage() {
  return mount(UserPage)
}

beforeEach(() => {
  vi.clearAllMocks()
  storeMock.userStore.isLoggedIn = true
  storeMock.userStore.nickname = '微信用户'
  storeMock.userStore.avatar = ''
  storeMock.userStore.phone = ''
  storeMock.userStore.memberLevelName = '普通用户'
  storeMock.userStore.wxLogin.mockResolvedValue({})
  storeMock.userStore.bindPhone.mockResolvedValue({})
  ;(globalThis as any).uni = {
    login: vi.fn(({ success }) => success({ code: 'login-code' })),
    showToast: vi.fn(),
    showModal: vi.fn(),
    navigateTo: vi.fn(),
  }
})

describe('我的页手机号绑定', () => {
  it('新版 getPhoneNumber code 不混用 encryptedData 和 iv', async () => {
    const wrapper = mountUserPage()

    await wrapper.find('button.phone-btn').trigger('getphonenumber', {
      detail: {
        errMsg: 'getPhoneNumber:ok',
        code: 'phone-code',
        encryptedData: 'legacy-encrypted-data',
        iv: 'legacy-iv',
      },
    })
    await flushPromises()

    expect(storeMock.userStore.bindPhone).toHaveBeenCalledWith({ code: 'phone-code' })
    expect((globalThis as any).uni.login).not.toHaveBeenCalled()
  })

  it('旧版 encryptedData 和 iv 场景使用 uni.login code', async () => {
    const wrapper = mountUserPage()

    await wrapper.find('button.phone-btn').trigger('getphonenumber', {
      detail: {
        errMsg: 'getPhoneNumber:ok',
        encryptedData: 'legacy-encrypted-data',
        iv: 'legacy-iv',
      },
    })
    await flushPromises()

    expect((globalThis as any).uni.login).toHaveBeenCalled()
    expect(storeMock.userStore.bindPhone).toHaveBeenCalledWith({
      code: 'login-code',
      encryptedData: 'legacy-encrypted-data',
      iv: 'legacy-iv',
    })
  })
})
