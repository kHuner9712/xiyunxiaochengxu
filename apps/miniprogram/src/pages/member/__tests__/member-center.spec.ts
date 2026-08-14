import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import MemberPage from '../index.vue'
import { getMemberInfo, getMemberRights } from '@/api/member'

const lifecycle = vi.hoisted(() => ({
  onShowCallbacks: [] as Array<() => void>,
}))
const userState = vi.hoisted(() => ({
  isLoggedIn: true,
  avatar: '',
  nickname: '测试用户',
}))

vi.mock('@dcloudio/uni-app', () => ({
  onShow: vi.fn((callback: () => void) => lifecycle.onShowCallbacks.push(callback)),
}))

vi.mock('@/stores/user', () => ({
  useUserStore: () => userState,
}))

vi.mock('@/api/member', () => ({
  getMemberInfo: vi.fn(),
  getMemberRights: vi.fn(),
}))

beforeEach(() => {
  vi.clearAllMocks()
  lifecycle.onShowCallbacks = []
  userState.isLoggedIn = true
  userState.avatar = ''
  userState.nickname = '测试用户'
  ;(globalThis as any).uni = {
    showToast: vi.fn(),
    showModal: vi.fn(),
    navigateBack: vi.fn(),
  }
})

describe('会员中心核心操作', () => {
  it('登录用户进入后同时加载会员等级与当前等级权益', async () => {
    vi.mocked(getMemberInfo).mockResolvedValue({
      level: 1,
      levelName: '银卡会员',
      growthValue: 180,
      currentLevelGrowth: 180,
      nextLevelGrowth: 500,
      rights: ['积分加速'],
    } as any)
    vi.mocked(getMemberRights).mockResolvedValue([
      {
        id: '1',
        name: '生日/孕产期关怀',
        icon: '',
        description: '按宝宝生日或孕产阶段推送关怀福利',
        level: 1,
      },
    ] as any)

    const wrapper = mount(MemberPage, { global: { stubs: { Empty: true } } })
    lifecycle.onShowCallbacks.at(-1)?.()
    await flushPromises()

    expect(getMemberInfo).toHaveBeenCalledTimes(1)
    expect(getMemberRights).toHaveBeenCalledTimes(1)
    expect(wrapper.text()).toContain('银卡会员')
    expect(wrapper.text()).toContain('成长值 180 / 500')
    expect(wrapper.text()).toContain('生日/孕产期福利')
    expect(wrapper.text()).toContain('按宝宝生日或孕产阶段推送福利')
  })

  it('未登录时不访问会员接口，并提示后返回来源页', async () => {
    userState.isLoggedIn = false
    ;(globalThis as any).uni.showModal = vi.fn((options: any) => options.success?.())

    mount(MemberPage, { global: { stubs: { Empty: true } } })
    lifecycle.onShowCallbacks.at(-1)?.()
    await flushPromises()

    expect(getMemberInfo).not.toHaveBeenCalled()
    expect(getMemberRights).not.toHaveBeenCalled()
    expect((globalThis as any).uni.showModal).toHaveBeenCalledWith(expect.objectContaining({
      title: '需要登录',
      showCancel: false,
    }))
    expect((globalThis as any).uni.navigateBack).toHaveBeenCalledTimes(1)
  })

  it('会员信息或权益接口失败时向用户给出明确反馈', async () => {
    vi.mocked(getMemberInfo).mockRejectedValue(new Error('member failed'))
    vi.mocked(getMemberRights).mockRejectedValue(new Error('rights failed'))

    mount(MemberPage, { global: { stubs: { Empty: true } } })
    lifecycle.onShowCallbacks.at(-1)?.()
    await flushPromises()

    expect((globalThis as any).uni.showToast).toHaveBeenCalledWith({ title: '会员信息加载失败', icon: 'none' })
    expect((globalThis as any).uni.showToast).toHaveBeenCalledWith({ title: '权益加载失败', icon: 'none' })
  })
})
