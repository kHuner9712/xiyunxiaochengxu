import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import MyBenefitPage from '../my.vue'
import { getMyBenefitPackages } from '@/api/benefit-package'

const uniAppMock = vi.hoisted(() => ({
  onShowCallbacks: [] as Array<() => void>,
}))

vi.mock('@dcloudio/uni-app', () => ({
  onShow: vi.fn((callback: () => void) => {
    uniAppMock.onShowCallbacks.push(callback)
  }),
  onHide: vi.fn(),
  onUnload: vi.fn(),
  onReachBottom: vi.fn(),
}))

vi.mock('@/api/benefit-package', () => ({
  getMyBenefitPackages: vi.fn(),
  getMyBenefitEntitlements: vi.fn(),
}))

beforeEach(() => {
  vi.clearAllMocks()
  uniAppMock.onShowCallbacks = []
  vi.mocked(getMyBenefitPackages).mockResolvedValue({
    list: [
      {
        id: '7001',
        packageId: '3001',
        packageName: '产后护理权益卡',
        packageCoverImage: null,
        status: 'active',
        validFrom: '2026-08-01T00:00:00.000Z',
        validTo: '2026-09-01T00:00:00.000Z',
        orderId: '9001',
      },
    ],
    total: 1,
  } as any)
  ;(globalThis as any).uni = {
    showToast: vi.fn(),
    navigateTo: vi.fn(),
  }
})

describe('权益卡到权益项导航', () => {
  it('使用权益包 packageId 筛选，而不是用户权益卡实例 id', async () => {
    const wrapper = mount(MyBenefitPage, {
      global: { stubs: { Loading: true, Empty: true } },
    })

    uniAppMock.onShowCallbacks.at(-1)?.()
    await flushPromises()

    expect(wrapper.find('.pkg-action').exists()).toBe(true)
    await wrapper.find('.pkg-action').trigger('tap')

    expect((globalThis as any).uni.navigateTo).toHaveBeenCalledWith({
      url: '/pages/benefit-package/entitlement?packageId=3001',
    })
    expect((globalThis as any).uni.navigateTo).not.toHaveBeenCalledWith({
      url: '/pages/benefit-package/entitlement?packageId=7001',
    })

    wrapper.unmount()
  })
})
