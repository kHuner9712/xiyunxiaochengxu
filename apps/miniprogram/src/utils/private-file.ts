import { getApiBaseUrl, getToken } from './request'

export function isPrivateFileUrl(url?: string | null): boolean {
  return !!url && /\/api\/common\/file\/private\/|\/common\/file\/private\//.test(url)
}

function toDownloadUrl(url: string): string {
  if (/^https?:\/\//.test(url)) return url
  const baseUrl = getApiBaseUrl()
  if (url.startsWith('/api/')) {
    return `${baseUrl.replace(/\/api$/, '')}${url}`
  }
  if (url.startsWith('/common/')) {
    return `${baseUrl}${url}`
  }
  return url
}

export function resolvePrivateFileUrl(url: string): Promise<string> {
  if (!isPrivateFileUrl(url)) return Promise.resolve(url)
  const token = getToken()
  return new Promise((resolve, reject) => {
    uni.downloadFile({
      url: toDownloadUrl(url),
      header: token ? { Authorization: `Bearer ${token}` } : {},
      success: (res) => {
        if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
          resolve(res.tempFilePath)
        } else {
          reject(new Error('私有文件下载失败'))
        }
      },
      fail: reject,
    })
  })
}

export async function resolvePrivateFileUrls(urls: string[]): Promise<string[]> {
  return Promise.all(urls.map((url) => resolvePrivateFileUrl(url)))
}
