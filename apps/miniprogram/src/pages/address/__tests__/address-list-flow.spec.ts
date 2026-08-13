import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import AddressListPage from '../list.vue'
import { deleteAddress, getAddressList, setDefaultAddress } from '@/api/address'

const lifecycle = vi.hoisted(() => ({
  onLoadCallbacks: [] as Array<(options?: Record<string, string>) => void>,
  onShowCallbacks: [] as Array<() => void>,
}))

vi.mock('@dcloudio/uni-app', () => ({
  onLoad: vi.fn((callback: (options?: Record<string, string>) => void) => lifecycle.onLoadCallbacks.push(callback)),
  onShow: vi.fn((callback: () => void) => lifecycle.onShowCallbacks.push(callback)),
}))

vi.mock('@/api/address', () => ({
  getAddressList: vi.fn(),
  deleteAddress: vi.fn(),
  setDefaultAddress: vi.fn(),
}))

function address(id: string, isDefault = false) {
  return {
    id,
    name: '测试收货人',
    phone: '13800138000',
    province: '上海市',
    city: '上海市',
    district: '浦东新区',
    detail: `测试路${id}号`,
    isDefault,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  lifecycle.onLoadCallbacks = []
  lifecycle.onShowCallbacks = []
  ;(globalThis as any).uni = {
    navigateBack: vi.fn(),
    navigateTo: vi.fn(),
    showModal: vi.fn(),
    showToast: vi.fn(),
  }
})

describe('收货地址列表核心操作', () => {
  it('订单选择模式点击地址会回传选中项并返回订单确认页', async () => {
    vi.mocked(getAddressList).mockResolvedValue([address('1', true)] as any)
    const emit = vi.fn()
    ;(globalThis as any).getCurrentPages = vi.fn(() => [{ getOpenerEventChannel: () => ({ emit }) }])

    const wrapper = mount(AddressListPage, { global: { stubs: { Empty: true } } })
    lifecycle.onLoadCallbacks.at(-1)?.({ select: 'true' })
    lifecycle.onShowCallbacks.at(-1)?.()
    await flushPromises()

    await wrapper.find('.address-card').trigger('tap')
    expect(emit).toHaveBeenCalledWith('selectAddress', expect.objectContaining({ id: '1' }))
    expect((globalThis as any).uni.navigateBack).toHaveBeenCalledTimes(1)
  })

  it('设为默认地址成功后重新读取服务端权威地址列表', async () => {
    vi.mocked(getAddressList)
      .mockResolvedValueOnce([address('1', false), address('2', true)] as any)
      .mockResolvedValueOnce([address('1', true), address('2', false)] as any)
    vi.mocked(setDefaultAddress).mockResolvedValue({} as any)
    ;(globalThis as any).getCurrentPages = vi.fn(() => [{}])

    const wrapper = mount(AddressListPage, { global: { stubs: { Empty: true } } })
    lifecycle.onLoadCallbacks.at(-1)?.({})
    lifecycle.onShowCallbacks.at(-1)?.()
    await flushPromises()

    await (wrapper.vm as any).setDefault((wrapper.vm as any).addresses[0])
    await flushPromises()

    expect(setDefaultAddress).toHaveBeenCalledWith('1')
    expect(getAddressList).toHaveBeenCalledTimes(2)
    expect((wrapper.vm as any).addresses[0].isDefault).toBe(true)
  })

  it('确认删除后只调用一次删除接口，并由刷新结果决定新的默认地址', async () => {
    vi.mocked(getAddressList)
      .mockResolvedValueOnce([address('1', true), address('2', false)] as any)
      .mockResolvedValueOnce([address('2', true)] as any)
    vi.mocked(deleteAddress).mockResolvedValue({} as any)
    ;(globalThis as any).getCurrentPages = vi.fn(() => [{}])
    ;(globalThis as any).uni.showModal = vi.fn((options: any) => options.success?.({ confirm: true }))

    const wrapper = mount(AddressListPage, { global: { stubs: { Empty: true } } })
    lifecycle.onLoadCallbacks.at(-1)?.({})
    lifecycle.onShowCallbacks.at(-1)?.()
    await flushPromises()

    await (wrapper.vm as any).deleteAddress((wrapper.vm as any).addresses[0])
    await flushPromises()

    expect(deleteAddress).toHaveBeenCalledTimes(1)
    expect(deleteAddress).toHaveBeenCalledWith('1')
    expect((wrapper.vm as any).addresses).toEqual([expect.objectContaining({ id: '2', isDefault: true })])
  })

  it('地址接口失败时显示加载失败，而不是把异常伪装成空地址', async () => {
    vi.mocked(getAddressList).mockRejectedValue(new Error('network'))
    ;(globalThis as any).getCurrentPages = vi.fn(() => [{}])
    mount(AddressListPage, { global: { stubs: { Empty: true } } })
    lifecycle.onLoadCallbacks.at(-1)?.({})
    lifecycle.onShowCallbacks.at(-1)?.()
    await flushPromises()

    expect((globalThis as any).uni.showToast).toHaveBeenCalledWith({ title: '地址加载失败', icon: 'none' })
  })
})
