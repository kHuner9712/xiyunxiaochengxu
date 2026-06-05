import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ProfilePage from '../profile.vue'
import { uploadImage } from '@/api/upload'

const uniAppMock = vi.hoisted(() => ({
  onShowCallbacks: [] as Array<() => void | Promise<void>>,
}))

const storeMock = vi.hoisted(() => ({
  userStore: {
    isLoggedIn: true,
    userInfo: {
      nickname: '',
      avatar: '',
      avatarUrl: '',
      phone: '',
    },
    nickname: '微信用户',
    avatar: '',
    memberLevelName: '普通会员',
    fetchUserInfo: vi.fn(),
    updateProfile: vi.fn(),
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

vi.mock('@/api/upload', () => ({
  uploadImage: vi.fn(),
}))

beforeEach(() => {
  vi.clearAllMocks()
  uniAppMock.onShowCallbacks = []
  storeMock.userStore.isLoggedIn = true
  storeMock.userStore.userInfo.nickname = ''
  storeMock.userStore.userInfo.avatar = ''
  storeMock.userStore.userInfo.avatarUrl = ''
  storeMock.userStore.userInfo.phone = ''
  storeMock.userStore.nickname = '微信用户'
  storeMock.userStore.avatar = ''
  storeMock.userStore.memberLevelName = '普通会员'
  storeMock.userStore.fetchUserInfo.mockResolvedValue({})
  storeMock.userStore.updateProfile.mockResolvedValue({})
  vi.mocked(uploadImage).mockResolvedValue({ url: 'https://example.com/avatar.png' })
  ;(globalThis as any).uni = {
    showToast: vi.fn(),
    navigateTo: vi.fn(),
  }
})

describe('个人资料页', () => {
  it('使用 chooseAvatar 和 nickname 输入保存头像昵称', async () => {
    const wrapper = mount(ProfilePage)
    await uniAppMock.onShowCallbacks.at(-1)?.()
    await flushPromises()

    await wrapper.find('button.avatar-picker').trigger('chooseavatar', {
      detail: { avatarUrl: 'wxfile://avatar-temp.png' },
    })
    await wrapper.find('input.nickname-input').setValue('新昵称')
    await wrapper.find('button.save-btn').trigger('tap')
    await flushPromises()

    expect(uploadImage).toHaveBeenCalledWith('wxfile://avatar-temp.png', 'user-avatar')
    expect(storeMock.userStore.updateProfile).toHaveBeenCalledWith({
      nickname: '新昵称',
      avatar: 'https://example.com/avatar.png',
    })
    expect((globalThis as any).uni.showToast).toHaveBeenCalledWith({
      title: '保存成功',
      icon: 'success',
    })
  })
})
