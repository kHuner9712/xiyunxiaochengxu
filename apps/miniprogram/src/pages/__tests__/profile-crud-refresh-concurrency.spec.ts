import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import AddressListPage from '../address/list.vue'
import BabyListPage from '../baby/list.vue'
import { getAddressList } from '@/api/address'
import { getBabyList } from '@/api/baby'

const uniAppMock = vi.hoisted(() => ({
  onShowCallbacks: [] as Array<() => void>,
}))

vi.mock('@dcloudio/uni-app', () => ({
  onLoad: (callback: (options?: Record<string, unknown>) => void) => callback({}),
  onShow: vi.fn((callback: () => void) => uniAppMock.onShowCallbacks.push(callback)),
}))

vi.mock('@/api/address', () => ({
  getAddressList: vi.fn(),
  deleteAddress: vi.fn(),
  setDefaultAddress: vi.fn(),
}))

vi.mock('@/api/baby', () => ({
  getBabyList: vi.fn(),
  deleteBaby: vi.fn(),
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
  ;(globalThis as any).getCurrentPages = vi.fn(() => [
    { getOpenerEventChannel: vi.fn(() => null) },
  ])
  ;(globalThis as any).uni = {
    showToast: vi.fn(),
    showModal: vi.fn(),
    navigateTo: vi.fn(),
    navigateBack: vi.fn(),
  }
})

describe('个人资料 CRUD 列表刷新并发', () => {
  it('地址新状态先返回后，旧 onShow 响应不能恢复旧地址', async () => {
    const first = deferred<any[]>()
    const second = deferred<any[]>()
    vi.mocked(getAddressList)
      .mockImplementationOnce(() => first.promise)
      .mockImplementationOnce(() => second.promise)

    const wrapper = mount(AddressListPage, {
      global: { stubs: { Empty: true } },
    })

    uniAppMock.onShowCallbacks.at(-1)?.()
    await Promise.resolve()
    uniAppMock.onShowCallbacks.at(-1)?.()
    await Promise.resolve()
    expect(getAddressList).toHaveBeenCalledTimes(2)

    second.resolve([{
      id: 'addr-new',
      name: '新地址联系人',
      phone: '13800138000',
      province: '上海市',
      city: '上海市',
      district: '浦东新区',
      detail: '新地址1号',
      isDefault: true,
    } as any])
    await flushPromises()

    expect((wrapper.vm as any).addresses.map((item: any) => item.id)).toEqual(['addr-new'])
    expect(wrapper.text()).toContain('新地址联系人')

    first.resolve([{
      id: 'addr-old',
      name: '已删除旧地址',
      phone: '13900139000',
      province: '北京市',
      city: '北京市',
      district: '朝阳区',
      detail: '旧地址1号',
      isDefault: false,
    } as any])
    await flushPromises()

    expect((wrapper.vm as any).addresses.map((item: any) => item.id)).toEqual(['addr-new'])
    expect(wrapper.text()).not.toContain('已删除旧地址')
  })

  it('宝宝档案新状态先返回后，旧 onShow 响应不能恢复已删除档案', async () => {
    uniAppMock.onShowCallbacks = []
    const first = deferred<any[]>()
    const second = deferred<any[]>()
    vi.mocked(getBabyList)
      .mockImplementationOnce(() => first.promise)
      .mockImplementationOnce(() => second.promise)

    const wrapper = mount(BabyListPage, {
      global: { stubs: { Empty: true } },
    })

    uniAppMock.onShowCallbacks.at(-1)?.()
    await Promise.resolve()
    uniAppMock.onShowCallbacks.at(-1)?.()
    await Promise.resolve()
    expect(getBabyList).toHaveBeenCalledTimes(2)

    second.resolve([{
      id: 'baby-new',
      nickname: '新宝宝档案',
      gender: 1,
      birthday: '2025-08-11T00:00:00.000Z',
      avatar: '',
      avatarUrl: '',
      isDefault: 1,
    } as any])
    await flushPromises()

    expect((wrapper.vm as any).babies.map((item: any) => item.id)).toEqual(['baby-new'])
    expect(wrapper.text()).toContain('新宝宝档案')

    first.resolve([{
      id: 'baby-old',
      nickname: '已删除旧宝宝',
      gender: 2,
      birthday: '2024-08-11T00:00:00.000Z',
      avatar: '',
      avatarUrl: '',
      isDefault: 0,
    } as any])
    await flushPromises()

    expect((wrapper.vm as any).babies.map((item: any) => item.id)).toEqual(['baby-new'])
    expect(wrapper.text()).not.toContain('已删除旧宝宝')
  })
})
