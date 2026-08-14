import { beforeEach, describe, expect, it, vi } from 'vitest'
import { updateAddress } from '../address'
import { put } from '@/utils/request'

vi.mock('@/utils/request', () => ({
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  del: vi.fn(),
}))

beforeEach(() => {
  vi.clearAllMocks()
})

describe('address update production payload contract', () => {
  it('uses the address id only in the URL and never sends it as an extra DTO field', async () => {
    vi.mocked(put).mockResolvedValueOnce({})

    await updateAddress({
      id: '123',
      name: '张三',
      phone: '13800138000',
      province: '上海市',
      city: '上海市',
      district: '浦东新区',
      detail: '测试路1号',
      isDefault: true,
    })

    expect(put).toHaveBeenCalledWith('/weapp/address/123', {
      name: '张三',
      phone: '13800138000',
      province: '上海市',
      city: '上海市',
      district: '浦东新区',
      detail: '测试路1号',
      isDefault: true,
    })
    expect((vi.mocked(put).mock.calls[0][1] as any).id).toBeUndefined()
  })
})
