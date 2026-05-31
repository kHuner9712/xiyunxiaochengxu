import { describe, expect, it, vi, beforeEach } from 'vitest'
import { uploadImage } from '../upload'

beforeEach(() => {
  vi.clearAllMocks()
  ;(globalThis as any).uni = {
    getStorageSync: vi.fn().mockReturnValue('token'),
    uploadFile: vi.fn((options) => {
      options.success({ data: JSON.stringify({ code: 0, data: { url: '/api/common/file/private/1' } }) })
    }),
  }
})

describe('uploadImage', () => {
  it('上传售后图片时透传 groupName', async () => {
    await uploadImage('/tmp/refund.jpg', 'aftersale')

    expect((globalThis as any).uni.uploadFile).toHaveBeenCalledWith(
      expect.objectContaining({
        formData: { groupName: 'aftersale' },
      }),
    )
  })
})
