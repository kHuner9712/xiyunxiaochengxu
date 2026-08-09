import type { BannerItem } from '@/api/home'

export type BannerNavigation = {
  method: 'navigateTo' | 'switchTab'
  url: string
}

const POSITIVE_ID = /^[1-9]\d*$/
const MINI_PAGE_PATH = /^\/pages\/[A-Za-z0-9_./?=&%+\-]+$/
const TAB_PAGES = new Set([
  '/pages/home/index',
  '/pages/category/index',
  '/pages/activity/index',
  '/pages/cart/index',
  '/pages/user/index',
])

export function resolveBannerNavigation(banner: Pick<BannerItem, 'linkType' | 'linkValue'>): BannerNavigation | null {
  const linkValue = String(banner.linkValue || '').trim()

  if (banner.linkType === 1) {
    if (!POSITIVE_ID.test(linkValue)) return null
    return { method: 'navigateTo', url: `/pages/product/detail?id=${encodeURIComponent(linkValue)}` }
  }

  if (banner.linkType === 2) {
    if (!POSITIVE_ID.test(linkValue)) return null
    return { method: 'navigateTo', url: `/pages/activity/detail?id=${encodeURIComponent(linkValue)}` }
  }

  if (banner.linkType === 3) {
    if (!MINI_PAGE_PATH.test(linkValue)) return null
    const [basePath] = linkValue.split('?')
    if (TAB_PAGES.has(basePath)) {
      return { method: 'switchTab', url: basePath }
    }
    return { method: 'navigateTo', url: linkValue }
  }

  return null
}
