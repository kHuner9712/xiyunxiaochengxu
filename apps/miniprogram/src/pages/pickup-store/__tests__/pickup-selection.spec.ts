import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import PickupStorePage from '../list.vue'
import { getPickupStoreList } from '@/api/pickup-store'

const lifecycle = vi.hoisted(() => ({
  onLoadCallbacks: [] as Array<(options?: Record<string, string>) => void>,
  onReachBottomCallbacks: [] as Array<() => void>,
}))

vi.mock('@dcloudio/uni-app', () => ({
  onLoad: vi.fn((callback: (options?: Record<string, string>) => void) => lifecycle.onLoadCallbacks.push(callback)),
  onReachBottom: vi.fn((callback: () => void) => lifecycle.onReachBottomCallbacks.push(callback)),
}))

vi.mock('@/api/pickup-store', () => ({
  getPickupStoreList: vi.fn(),
}))

function store(id: string, name: string) {
  return {
    id,
    name,
    contactPhone: '13800138000',
    province: '上海市',
    city: '上海市',
    district: '浦东新区',
    address: '测试路1号',
    fullAddress: '上海市上海市浦东新区测试路1号',
    latitude: null,
    longitude: null,
    businessHours: '09:00-18:00',
    pickupNotice: '',
    status: 1,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  lifecycle.onLoadCallbacks = []
  lifecycle.onReachBottomCallbacks = []
  ;(globalThis as any).uni = {
    navigateBack: vi.fn(),
    makePhoneCall: vi.fn(),
    showToast: vi.fn(),
  }
})

describe('自提点选择页核心操作', () => {
  it('选择模式会通过 opener eventChannel 回传门店并返回上一页', async () => {
    vi.mocked(getPickupStoreList).mockResolvedValue({ list: [store('1', '陆家嘴店')], total: 1 } as any)
    const emit = vi.fn()
    ;(globalThis as any).getCurrentPages = vi.fn(() => [{
      getOpenerEventChannel: () => ({ emit }),
    }])

    const wrapper = mount(PickupStorePage, {
      global: { stubs: { Loading: true, Empty: true } },
    })
    lifecycle.onLoadCallbacks.at(-1)?.({ select: 'true' })
    await flushPromises()

    expect(wrapper.text()).toContain('陆家嘴店')
    await wrapper.find('.store-card').trigger('tap')

    expect(emit).toHaveBeenCalledWith('selectStore', expect.objectContaining({ id: '1', name: '陆家嘴店' }))
    expect((globalThis as any).uni.navigateBack).toHaveBeenCalledTimes(1)
  })

  it('普通浏览模式点击门店不会误返回或发出选择事件', async () => {
    vi.mocked(getPickupStoreList).mockResolvedValue({ list: [store('1', '陆家嘴店')], total: 1 } as any)
    const emit = vi.fn()
    ;(globalThis as any).getCurrentPages = vi.fn(() => [{
      getOpenerEventChannel: () => ({ emit }),
    }])

    const wrapper = mount(PickupStorePage, {
      global: { stubs: { Loading: true, Empty: true } },
    })
    lifecycle.onLoadCallbacks.at(-1)?.({})
    await flushPromises()
    await wrapper.find('.store-card').trigger('tap')

    expect(emit).not.toHaveBeenCalled()
    expect((globalThis as any).uni.navigateBack).not.toHaveBeenCalled()
  })

  it('触底加载下一页时追加结果且不会覆盖第一页', async () => {
    vi.mocked(getPickupStoreList)
      .mockResolvedValueOnce({ list: [store('1', '一店')], total: 2 } as any)
      .mockResolvedValueOnce({ list: [store('2', '二店')], total: 2 } as any)
    ;(globalThis as any).getCurrentPages = vi.fn(() => [{}])

    const wrapper = mount(PickupStorePage, {
      global: { stubs: { Loading: true, Empty: true } },
    })
    lifecycle.onLoadCallbacks.at(-1)?.({})
    await flushPromises()
    lifecycle.onReachBottomCallbacks.at(-1)?.()
    await flushPromises()

    expect(getPickupStoreList).toHaveBeenNthCalledWith(1, { page: 1, pageSize: 20 })
    expect(getPickupStoreList).toHaveBeenNthCalledWith(2, { page: 2, pageSize: 20 })
    expect(wrapper.text()).toContain('一店')
    expect(wrapper.text()).toContain('二店')
  })

  it('点击电话只调用系统拨号能力', async () => {
    vi.mocked(getPickupStoreList).mockResolvedValue({ list: [store('1', '陆家嘴店')], total: 1 } as any)
    const emit = vi.fn()
    ;(globalThis as any).getCurrentPages = vi.fn(() => [{
      getOpenerEventChannel: () => ({ emit }),
    }])

    const wrapper = mount(PickupStorePage, {
      global: { stubs: { Loading: true, Empty: true } },
    })
    lifecycle.onLoadCallbacks.at(-1)?.({ select: 'true' })
    await flushPromises()
    await wrapper.find('.store-phone').trigger('tap')

    expect((globalThis as any).uni.makePhoneCall).toHaveBeenCalledWith({ phoneNumber: '13800138000' })
    expect(emit).not.toHaveBeenCalled()
  })
})
