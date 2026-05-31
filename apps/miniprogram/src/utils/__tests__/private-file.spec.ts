import { beforeEach, describe, expect, it, vi } from 'vitest'
import { isPrivateFileUrl, resolvePrivateFileUrl } from '../private-file'

vi.mock('../request', () => ({
  getApiBaseUrl: () => 'https://api.example.com/api',
  getToken: () => 'token',
}))

beforeEach(() => {
  vi.clearAllMocks()
  ;(globalThis as any).uni = {
    downloadFile: vi.fn((options) => {
      options.success({ statusCode: 200, tempFilePath: '/tmp/private.jpg' })
    }),
  }
})

describe('private-file', () => {
  it('公开 URL 原样返回', async () => {
    await expect(resolvePrivateFileUrl('https://cdn.example.com/a.jpg')).resolves.toBe('https://cdn.example.com/a.jpg')
  })

  it('私有 URL 使用 token 下载为临时路径', async () => {
    await expect(resolvePrivateFileUrl('/api/common/file/private/1')).resolves.toBe('/tmp/private.jpg')
    expect((globalThis as any).uni.downloadFile).toHaveBeenCalledWith(
      expect.objectContaining({
        url: 'https://api.example.com/api/common/file/private/1',
        header: { Authorization: 'Bearer token' },
      }),
    )
  })

  it('识别私有文件 URL', () => {
    expect(isPrivateFileUrl('/api/common/file/private/1')).toBe(true)
    expect(isPrivateFileUrl('/uploads/public/a.jpg')).toBe(false)
  })
})
