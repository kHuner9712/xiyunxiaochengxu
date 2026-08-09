import { describe, expect, it } from 'vitest'
import { resolveBannerNavigation } from '../banner-navigation'

describe('首页 Banner 跳转', () => {
  it('商品和活动 Banner 使用安全字符串 ID 跳详情页', () => {
    expect(resolveBannerNavigation({ linkType: 1, linkValue: '9007199254740993' })).toEqual({
      method: 'navigateTo',
      url: '/pages/product/detail?id=9007199254740993',
    })
    expect(resolveBannerNavigation({ linkType: 2, linkValue: '123' })).toEqual({
      method: 'navigateTo',
      url: '/pages/activity/detail?id=123',
    })
  })

  it('普通小程序页面 Banner 使用 navigateTo', () => {
    expect(resolveBannerNavigation({ linkType: 3, linkValue: '/pages/content/detail?id=88' })).toEqual({
      method: 'navigateTo',
      url: '/pages/content/detail?id=88',
    })
  })

  it('tabBar 页面 Banner 使用 switchTab 且不把 query 传给 switchTab', () => {
    expect(resolveBannerNavigation({ linkType: 3, linkValue: '/pages/activity/index' })).toEqual({
      method: 'switchTab',
      url: '/pages/activity/index',
    })
    expect(resolveBannerNavigation({ linkType: 3, linkValue: '/pages/user/index?from=banner' })).toEqual({
      method: 'switchTab',
      url: '/pages/user/index',
    })
  })

  it('无跳转或非法目标不触发导航', () => {
    expect(resolveBannerNavigation({ linkType: 0, linkValue: '' })).toBeNull()
    expect(resolveBannerNavigation({ linkType: 1, linkValue: 'not-an-id' })).toBeNull()
    expect(resolveBannerNavigation({ linkType: 3, linkValue: 'https://example.com' })).toBeNull()
  })
})
