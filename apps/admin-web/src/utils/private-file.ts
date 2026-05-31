import request from './request'

const objectUrls = new Set<string>()

export function isPrivateFileUrl(url?: string | null): boolean {
  return !!url && /\/api\/common\/file\/private\/|\/common\/file\/private\//.test(url)
}

function toRequestUrl(url: string): string {
  if (url.startsWith('/api/')) return url.slice('/api'.length)
  return url
}

export async function resolvePrivateFileUrl(url: string): Promise<string> {
  if (!isPrivateFileUrl(url)) return url
  const response = await request.get(toRequestUrl(url), { responseType: 'blob' })
  const objectUrl = URL.createObjectURL(response.data)
  objectUrls.add(objectUrl)
  return objectUrl
}

export async function resolvePrivateFileUrls(urls: string[]): Promise<string[]> {
  return Promise.all(urls.map((url) => resolvePrivateFileUrl(url)))
}

export function revokePrivateObjectUrls(urls?: string[]) {
  const targets = urls || Array.from(objectUrls)
  for (const url of targets) {
    if (objectUrls.has(url)) {
      URL.revokeObjectURL(url)
      objectUrls.delete(url)
    }
  }
}
