import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import EntitlementPage from '../entitlement.vue'
import { getBenefitEntitlement } from '@/api/benefit-package'

const now = new Date('2026-08-10T12:00:00.000Z')

const uniAppMock = vi.hoisted(() => ({
  onLoadCallbacks: [] as Array<(options?: Record<string, any>) => void | Promise<void>>,
  onShowCallbacks: [] as Array<() => void>,
  onHideCallbacks: [] as Array<() => void>,
}))

vi.mock('@dcloudio/uni-app', () => ({
  onLoad: vi.fn((callback: (options?: Record<string, any>) => void | Promise<void>) => {
    uniAppMock.onLoadCallbacks.push(callback)
  }),
  onShow: vi.fn((callback: () => void) => {
    uniAppMock.onShowCallbacks.push(callback)
  }),
  onHide: vi.fn((callback: () => void) => {
    uniAppMock.onHideCallbacks.push(callback)
  }),
  onUnload: vi.fn(),
  onReachBottom: vi.fn(),
}))

vi.mock('@/api/benefit-package', () => ({
  getBenefitEntitlement: vi.fn(),
  getMyBenefitEntitlements: vi.fn(),
}))

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(now)
  vi.clearAllMocks()
  uniAppMock.onLoadCallbacks = []
  uniAppMock.onShowCallbacks = []
  uniAppMock.onHideCallbacks = []
  vi.mocked(getBenefitEntitlement).mockResolvedValue({
    id: '9',
    userBenefitPackageId: '7',
    packageItemId: '8',
    packageName: '产后护理权益卡',
    packageSubtitle: '安心到店',
    itemName: '门店护理服务',
    itemType: 'service',
    itemDescription: '到店核销一次护理服务',
    originalValue: 19900,
    verifyCode: 'ABC12345',
    status: 'unused',
    usedAt: null,
    verifyRemark: null,
    validFrom: '2026-08-01T00:00:00.000Z',
    validTo: '2026-09-01T00:00:00.000Z',
    pickupStoreId: '12',
    merchantPromotionSourceId: '18',
    storeName: '禧孕护理中心',
    storeAddress: '上海市浦东新区测试路88号',
    storePhone: '021-12345678',
    businessHours: '09:00-18:00',
    merchantName: '禧孕服务商',
    merchantContactPhone: '400-123-4567',
  } as any)
  ;(globalThis as any).uni = {
    showToast: vi.fn(),
    navigateTo: vi.fn(),
    makePhoneCall: vi.fn(),
  }
})

afterEach(() => {
  vi.useRealTimers()
})

describe('权益核销详情', () => {
  it('展示真实门店和商家信息，而不是只暴露内部 ID', async () => {
    const wrapper = mount(EntitlementPage, {
      global: {
        stubs: {
          Loading: true,
          Empty: true,
        },
      },
    })
    await uniAppMock.onLoadCallbacks.at(-1)?.({ id: '9' })
    uniAppMock.onShowCallbacks.at(-1)?.()
    await flushPromises()

    expect(wrapper.text()).toContain('禧孕护理中心')
    expect(wrapper.text()).toContain('上海市浦东新区测试路88号')
    expect(wrapper.text()).toContain('09:00-18:00')
    expect(wrapper.text()).toContain('禧孕服务商')
    expect(wrapper.text()).not.toContain('门店ID：12')
    expect(wrapper.text()).not.toContain('商家ID：18')

    await wrapper.find('.phone-row').trigger('tap')
    expect((globalThis as any).uni.makePhoneCall).toHaveBeenCalledWith({
      phoneNumber: '021-12345678',
    })

    uniAppMock.onHideCallbacks.at(-1)?.()
    wrapper.unmount()
  })
})
