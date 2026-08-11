import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import MyBenefitPage from '../my.vue'
import { getMyBenefitPackages, getMyBenefitEntitlements } from '@/api/benefit-package'

vi.mock('@dcloudio/uni-app', () => ({
  onShow: vi.fn(),
  onHide: vi.fn(),
  onUnload: vi.fn(),
  onReachBottom: vi.fn(),
}))

vi.mock('@/api/benefit-package', () => ({
  getMyBenefitPackages: vi.fn(),
  getMyBenefitEntitlements: vi.fn(),
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
  ;(globalThis as any).uni = {
    showToast: vi.fn(),
    navigateTo: vi.fn(),
  }
})

describe('我的权益请求并发', () => {
  it('切到单项权益后，旧权益卡响应晚到不能污染当前 Tab', async () => {
    const packagesRequest = deferred<any>()
    const entitlementsRequest = deferred<any>()
    vi.mocked(getMyBenefitPackages).mockImplementationOnce(() => packagesRequest.promise)
    vi.mocked(getMyBenefitEntitlements).mockImplementationOnce(() => entitlementsRequest.promise)

    const wrapper = mount(MyBenefitPage, {
      global: { stubs: { Loading: true, Empty: true } },
    })
    const vm = wrapper.vm as any

    const firstLoad = vm.refreshList()
    await Promise.resolve()
    vm.switchTab('entitlements')
    await Promise.resolve()

    expect(getMyBenefitPackages).toHaveBeenCalledWith({ page: 1, pageSize: 20 })
    expect(getMyBenefitEntitlements).toHaveBeenCalledWith({ page: 1, pageSize: 20 })

    entitlementsRequest.resolve({
      list: [{
        id: 'ent-new',
        itemName: '新单项权益',
        packageName: '测试权益卡',
        verifyCode: 'ABC123',
        status: 'unused',
        validFrom: '2026-08-01T00:00:00.000Z',
        validTo: '2026-08-31T00:00:00.000Z',
        usedAt: null,
      }],
      total: 1,
    })
    await flushPromises()

    expect(vm.activeTab).toBe('entitlements')
    expect(vm.entitlementList.map((item: any) => item.id)).toEqual(['ent-new'])
    expect(vm.loading).toBe(false)

    packagesRequest.resolve({
      list: [{
        id: 'pkg-stale',
        packageName: '旧权益卡',
        status: 'active',
        validFrom: '2026-08-01T00:00:00.000Z',
        validTo: '2026-08-31T00:00:00.000Z',
      }],
      total: 1,
    })
    await firstLoad
    await flushPromises()

    expect(vm.activeTab).toBe('entitlements')
    expect(vm.entitlementList.map((item: any) => item.id)).toEqual(['ent-new'])
    expect(wrapper.text()).not.toContain('旧权益卡')
  })
})
