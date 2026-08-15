import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { uploadImage } from '../upload'
import {
  AUTH_EXPIRED_EVENT,
  getApiBaseUrl,
  redirectToLoginTab,
  removeToken,
} from '@/utils/request'

vi.mock('@/utils/request', () => ({
  AUTH_EXPIRED_EVENT: 'baby-mall:auth-expired',
  getApiBaseUrl: vi.fn(() => 'https://api.example.com/api'),
  getToken: vi.fn(() => 'token-value'),
  removeToken: vi.fn(),
  redirectToLoginTab: vi.fn(),
}))

const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(getApiBaseUrl).mockReturnValue('https://api.example.com/api')
  ;(globalThis as any).uni = {
    showToast: vi.fn(),
    $emit: vi.fn(),
    uploadFile: vi.fn((options) => {
      options.success({
        statusCode: 200,
        data: JSON.stringify({ code: 0, data: { url: '/api/common/file/private/1' } }),
      })
    }),
  }
})

afterEach(() => {
  consoleErrorSpy.mockClear()
})

describe('uploadImage', () => {
  it('头像上传使用统一 API base 和 user-avatar 分组', async () => {
    await uploadImage('/tmp/avatar.jpg', 'user-avatar')

    expect((globalThis as any).uni.uploadFile).toHaveBeenCalledWith(
      expect.objectContaining({
        url: 'https://api.example.com/api/common/file/upload',
        formData: { groupName: 'user-avatar' },
      }),
    )
  })

  it('上传售后凭证时透传 aftersale 分组', async () => {
    await uploadImage('/tmp/refund.jpg', 'aftersale')

    expect((globalThis as any).uni.uploadFile).toHaveBeenCalledWith(
      expect.objectContaining({
        url: 'https://api.example.com/api/common/file/upload',
        formData: { groupName: 'aftersale' },
      }),
    )
  })

  it('API base 为空时明确 reject 并提示', async () => {
    vi.mocked(getApiBaseUrl).mockReturnValue('')

    await expect(uploadImage('/tmp/avatar.jpg', 'user-avatar')).rejects.toThrow('API 地址未配置')

    expect((globalThis as any).uni.uploadFile).not.toHaveBeenCalled()
    expect((globalThis as any).uni.showToast).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'API 地址未配置，无法上传图片' }),
    )
  })

  it('业务 401 响应会清理旧 token、广播内存态失效并回到登录页', async () => {
    ;(globalThis as any).uni.uploadFile.mockImplementationOnce((options: any) => {
      options.success({
        statusCode: 200,
        data: JSON.stringify({ code: 40102, message: '登录已过期' }),
      })
    })

    await expect(uploadImage('/tmp/refund.jpg', 'aftersale')).rejects.toThrow('登录已过期')

    expect(removeToken).toHaveBeenCalledTimes(1)
    expect((globalThis as any).uni.$emit).toHaveBeenCalledWith(AUTH_EXPIRED_EVENT)
    expect(redirectToLoginTab).toHaveBeenCalledWith('登录已过期，请重新登录')
  })

  it('HTTP 401 响应同样清理旧 token、广播内存态失效并回到登录页', async () => {
    ;(globalThis as any).uni.uploadFile.mockImplementationOnce((options: any) => {
      options.success({
        statusCode: 401,
        data: JSON.stringify({ code: 40101, message: '未登录' }),
      })
    })

    await expect(uploadImage('/tmp/refund.jpg', 'aftersale')).rejects.toThrow('登录已过期')

    expect(removeToken).toHaveBeenCalledTimes(1)
    expect((globalThis as any).uni.$emit).toHaveBeenCalledWith(AUTH_EXPIRED_EVENT)
    expect(redirectToLoginTab).toHaveBeenCalledWith('登录已过期，请重新登录')
  })

  it('上传失败时输出模块名、状态码和错误内容且不打印 token', async () => {
    ;(globalThis as any).uni.uploadFile.mockImplementationOnce((options: any) => {
      options.success({
        statusCode: 500,
        data: JSON.stringify({ code: 500, message: 'server failed' }),
      })
    })

    await expect(uploadImage('/tmp/refund.jpg', 'aftersale')).rejects.toThrow('server failed')

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      '[baby-mall][upload] HTTP failed',
      expect.objectContaining({
        statusCode: 500,
        error: 'server failed',
      }),
    )
    expect(JSON.stringify(consoleErrorSpy.mock.calls)).not.toContain('token-value')
  })
})
