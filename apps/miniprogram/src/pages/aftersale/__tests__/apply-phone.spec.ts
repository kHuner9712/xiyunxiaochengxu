import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import AftersaleApplyPage from '../apply.vue'
import { applyAftersale } from '@/api/aftersale'

const storeMock = vi.hoisted(() => ({
  userStore: {
    isLoggedIn: true,
    phone: '',
    requireLogin: vi.fn(),
  },
}))

vi.mock('@dcloudio/uni-app', () => ({
  onLoad: vi.fn(),
}))

vi.mock('@/stores/user', () => ({
  useUserStore: () => storeMock.userStore,
}))

vi.mock('@/api/aftersale', () => ({
  applyAftersale: vi.fn(),
}))

vi.mock('@/api/order', () => ({
  getOrderDetail: vi.fn(),
}))

vi.mock('@/api/upload', () => ({
  chooseAndUploadImage: vi.fn(),
}))

vi.mock('@/utils/private-file', () => ({
  resolvePrivateFileUrl: vi.fn((url: string) => Promise.resolve(url)),
}))

beforeEach(() => {
  vi.clearAllMocks()
  storeMock.userStore.isLoggedIn = true
  storeMock.userStore.phone = ''
  ;(globalThis as any).uni = {
    showToast: vi.fn(),
    showModal: vi.fn(),
    switchTab: vi.fn(),
    navigateBack: vi.fn(),
  }
})

describe('售后申请手机号门槛', () => {
  it('未绑定手机号申请售后时被拦截', async () => {
    const wrapper = mount(AftersaleApplyPage)
    ;(wrapper.vm as any).orderId = 'order-1'
    ;(wrapper.vm as any).orderItemId = 'item-1'
    ;(wrapper.vm as any).form.reason = '质量问题'

    await (wrapper.vm as any).handleSubmit()

    expect(applyAftersale).not.toHaveBeenCalled()
    expect((globalThis as any).uni.showModal).toHaveBeenCalledWith(
      expect.objectContaining({
        title: '需要绑定手机号',
        content: '请先绑定手机号，便于售后联系。',
        confirmText: '去绑定',
      }),
    )
  })
})
