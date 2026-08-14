import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import AddressEditPage from '../edit.vue'
import { createAddress, deleteAddress, getAddressDetail, updateAddress } from '@/api/address'

const lifecycle = vi.hoisted(() => ({
  onLoadCallbacks: [] as Array<(options?: Record<string, string>) => void>,
}))

vi.mock('@dcloudio/uni-app', () => ({
  onLoad: vi.fn((callback: (options?: Record<string, string>) => void) => lifecycle.onLoadCallbacks.push(callback)),
}))

vi.mock('@/api/address', () => ({
  createAddress: vi.fn(),
  updateAddress: vi.fn(),
  deleteAddress: vi.fn(),
  getAddressDetail: vi.fn(),
}))

beforeEach(() => {
  vi.clearAllMocks()
  vi.useFakeTimers()
  lifecycle.onLoadCallbacks = []
  ;(globalThis as any).uni = {
    showToast: vi.fn(),
    showModal: vi.fn(),
    navigateBack: vi.fn(),
  }
})

afterEach(() => {
  vi.useRealTimers()
})

function fillValidForm(wrapper: ReturnType<typeof mount>) {
  const form = (wrapper.vm as any).form
  Object.assign(form, {
    name: '测试收货人',
    phone: '13800138000',
    province: '上海市',
    city: '上海市',
    district: '浦东新区',
    detail: '测试路1号',
    isDefault: true,
  })
}

describe('收货地址编辑核心操作', () => {
  it('新增地址只提交用户填写字段，成功后提示并返回', async () => {
    vi.mocked(createAddress).mockResolvedValue({ id: '1' } as any)
    const wrapper = mount(AddressEditPage)
    lifecycle.onLoadCallbacks.at(-1)?.({})
    fillValidForm(wrapper)

    await (wrapper.vm as any).handleSubmit()
    await flushPromises()

    expect(createAddress).toHaveBeenCalledWith({
      name: '测试收货人',
      phone: '13800138000',
      province: '上海市',
      city: '上海市',
      district: '浦东新区',
      detail: '测试路1号',
      isDefault: true,
    })
    expect((globalThis as any).uni.showToast).toHaveBeenCalledWith({ title: '保存成功', icon: 'success' })
    vi.advanceTimersByTime(1500)
    expect((globalThis as any).uni.navigateBack).toHaveBeenCalledTimes(1)
  })

  it('编辑地址先加载详情，再以同一地址 id 更新', async () => {
    vi.mocked(getAddressDetail).mockResolvedValue({
      id: '9',
      name: '原姓名',
      phone: '13800138000',
      province: '浙江省',
      city: '杭州市',
      district: '西湖区',
      detail: '原地址',
      isDefault: false,
    } as any)
    vi.mocked(updateAddress).mockResolvedValue({} as any)

    const wrapper = mount(AddressEditPage)
    lifecycle.onLoadCallbacks.at(-1)?.({ id: '9' })
    await flushPromises()
    ;(wrapper.vm as any).form.detail = '新地址'

    await (wrapper.vm as any).handleSubmit()
    await flushPromises()

    expect(updateAddress).toHaveBeenCalledWith(expect.objectContaining({
      id: '9',
      name: '原姓名',
      detail: '新地址',
    }))
    expect(createAddress).not.toHaveBeenCalled()
  })

  it('保存请求进行中时快速重复提交不会产生第二次写请求', async () => {
    let release!: () => void
    const pending = new Promise<void>((resolve) => { release = resolve })
    vi.mocked(createAddress).mockImplementation(async () => {
      await pending
      return {} as any
    })

    const wrapper = mount(AddressEditPage)
    lifecycle.onLoadCallbacks.at(-1)?.({})
    fillValidForm(wrapper)

    const first = (wrapper.vm as any).handleSubmit()
    const second = (wrapper.vm as any).handleSubmit()
    await Promise.resolve()

    expect(createAddress).toHaveBeenCalledTimes(1)
    release()
    await first
    await second
  })

  it('编辑页确认删除时只发起一次删除请求并立即返回', async () => {
    vi.mocked(getAddressDetail).mockResolvedValue({
      id: '9',
      name: '原姓名',
      phone: '13800138000',
      province: '浙江省',
      city: '杭州市',
      district: '西湖区',
      detail: '原地址',
      isDefault: false,
    } as any)
    vi.mocked(deleteAddress).mockResolvedValue({} as any)
    ;(globalThis as any).uni.showModal = vi.fn((options: any) => options.success?.({ confirm: true }))

    const wrapper = mount(AddressEditPage)
    lifecycle.onLoadCallbacks.at(-1)?.({ id: '9' })
    await flushPromises()

    await (wrapper.vm as any).handleDelete()
    await flushPromises()

    expect(deleteAddress).toHaveBeenCalledTimes(1)
    expect(deleteAddress).toHaveBeenCalledWith('9')
    expect((globalThis as any).uni.navigateBack).toHaveBeenCalledTimes(1)
  })

  it('删除确认框打开期间禁止第二次删除和保存', async () => {
    vi.mocked(getAddressDetail).mockResolvedValue({
      id: '9',
      name: '原姓名',
      phone: '13800138000',
      province: '浙江省',
      city: '杭州市',
      district: '西湖区',
      detail: '原地址',
      isDefault: false,
    } as any)
    vi.mocked(deleteAddress).mockResolvedValue({} as any)
    let modalOptions: any
    ;(globalThis as any).uni.showModal = vi.fn((options: any) => { modalOptions = options })

    const wrapper = mount(AddressEditPage)
    lifecycle.onLoadCallbacks.at(-1)?.({ id: '9' })
    await flushPromises()
    fillValidForm(wrapper)

    const firstDelete = (wrapper.vm as any).handleDelete()
    const secondDelete = (wrapper.vm as any).handleDelete()
    const saveDuringDelete = (wrapper.vm as any).handleSubmit()

    expect((wrapper.vm as any).deleting).toBe(true)
    expect((globalThis as any).uni.showModal).toHaveBeenCalledTimes(1)
    expect(deleteAddress).not.toHaveBeenCalled()
    expect(updateAddress).not.toHaveBeenCalled()

    modalOptions.success?.({ confirm: true })
    await Promise.all([firstDelete, secondDelete, saveDuringDelete])

    expect(deleteAddress).toHaveBeenCalledTimes(1)
    expect((wrapper.vm as any).deleting).toBe(false)
  })

  it('无效手机号不会发请求，并明确提示', async () => {
    const wrapper = mount(AddressEditPage)
    lifecycle.onLoadCallbacks.at(-1)?.({})
    fillValidForm(wrapper)
    ;(wrapper.vm as any).form.phone = '123'

    await (wrapper.vm as any).handleSubmit()

    expect(createAddress).not.toHaveBeenCalled()
    expect((globalThis as any).uni.showToast).toHaveBeenCalledWith({ title: '请输入正确的手机号', icon: 'none' })
  })
})
