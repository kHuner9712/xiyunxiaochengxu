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

  it('慢速 onShow 刷新晚到时不能覆盖用户已经开始填写的昵称和头像', async () => {
    const refresh = deferred<any>()
    storeMock.userStore.fetchUserInfo.mockImplementationOnce(() => refresh.promise)
    const wrapper = mount(ProfilePage)

    const refreshTask = uniAppMock.onShowCallbacks.at(-1)?.()
    await wrapper.find('input.nickname-input').setValue('正在填写的新昵称')
    await wrapper.find('button.avatar-picker').trigger('chooseavatar', {
      detail: { avatarUrl: 'wxfile://new-local-avatar.png' },
    })

    storeMock.userStore.userInfo.nickname = '服务端旧昵称'
    storeMock.userStore.userInfo.avatar = 'https://example.com/old-avatar.png'
    refresh.resolve({})
    await refreshTask
    await flushPromises()

    const vm = wrapper.vm as any
    expect(vm.dirty).toBe(true)
    expect(vm.form.nickname).toBe('正在填写的新昵称')
    expect(vm.form.avatar).toBe('wxfile://new-local-avatar.png')
  })

  it('保存上传进行中时禁止二次提交和后续头像选择覆盖本次保存', async () => {
    const upload = deferred<any>()
    vi.mocked(uploadImage).mockImplementationOnce(() => upload.promise)
    const wrapper = mount(ProfilePage)
    const vm = wrapper.vm as any
    vm.form.nickname = '新昵称'
    vm.form.avatar = 'wxfile://first-avatar.png'
    vm.handleChooseAvatar({ detail: { avatarUrl: 'wxfile://first-avatar.png' } })

    const first = vm.handleSubmit()
    const second = vm.handleSubmit()
    vm.handleChooseAvatar({ detail: { avatarUrl: 'wxfile://second-avatar.png' } })

    expect(vm.submitting).toBe(true)
    expect(uploadImage).toHaveBeenCalledTimes(1)
    expect(vm.form.avatar).toBe('wxfile://first-avatar.png')
    expect(storeMock.userStore.updateProfile).not.toHaveBeenCalled()

    upload.resolve({ url: 'https://example.com/saved-avatar.png' })
    await Promise.all([first, second])

    expect(storeMock.userStore.updateProfile).toHaveBeenCalledTimes(1)
    expect(storeMock.userStore.updateProfile).toHaveBeenCalledWith({
      nickname: '新昵称',
      avatar: 'https://example.com/saved-avatar.png',
    })
    expect(vm.submitting).toBe(false)
  })
})
