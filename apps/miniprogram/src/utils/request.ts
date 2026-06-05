interface ApiResponse<T = any> {
  code: number
  message: string
  data: T
  requestId?: string
}

interface RequestConfig {
  url: string
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE'
  data?: any
  header?: Record<string, string>
  showLoading?: boolean
  showError?: boolean
}

function normalizeApiBaseUrl(raw: string): string {
  if (!raw) return ''
  let url = raw.replace(/\/+$/, '')
  if (import.meta.env.PROD) {
    if (!url.startsWith('https://')) {
      console.error('[baby-mall] 生产环境 VITE_API_BASE_URL 必须以 https:// 开头，当前值:', raw)
      return ''
    }
    if (!url.endsWith('/api')) {
      console.error('[baby-mall] 生产环境 VITE_API_BASE_URL 必须以 /api 结尾，当前值:', raw)
      return ''
    }
  }
  return url
}

const BASE_URL = normalizeApiBaseUrl(import.meta.env.VITE_API_BASE_URL || '')
const TOKEN_KEY = 'baby_mall_token'
export const REDIRECT_AFTER_LOGIN_KEY = 'baby_mall_redirect_after_login'
const USER_TAB_URL = '/pages/user/index'
const TAB_BAR_ROUTES = new Set([
  'pages/home/index',
  'pages/category/index',
  'pages/activity/index',
  'pages/cart/index',
  'pages/user/index'
])
const AUTH_ERROR_CODES = [40101, 40102, 40103]
let isHandlingAuthError = false

if (!BASE_URL) {
  console.error('[baby-mall] VITE_API_BASE_URL 未配置，所有 API 请求将失败')
}

export function getToken(): string {
  return uni.getStorageSync(TOKEN_KEY) || ''
}

export function getApiBaseUrl(): string {
  return BASE_URL
}

export function setToken(token: string) {
  uni.setStorageSync(TOKEN_KEY, token)
}

export function removeToken() {
  uni.removeStorageSync(TOKEN_KEY)
}

function getCurrentPageUrl() {
  const pages = getCurrentPages()
  const currentPage = pages[pages.length - 1]
  if (!currentPage?.route) return ''
  const options = (currentPage as any).options || {}
  const query = Object.keys(options)
    .filter(key => options[key] !== undefined && options[key] !== null && options[key] !== '')
    .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(String(options[key]))}`)
    .join('&')
  return `/${currentPage.route}${query ? `?${query}` : ''}`
}

function navigateToUrl(url: string) {
  const route = url.replace(/^\//, '').split('?')[0]
  if (TAB_BAR_ROUTES.has(route)) {
    uni.switchTab({ url: `/${route}` })
  } else {
    uni.navigateTo({ url })
  }
}

export function consumeRedirectAfterLogin() {
  const redirectUrl = uni.getStorageSync(REDIRECT_AFTER_LOGIN_KEY) || ''
  if (redirectUrl) {
    uni.removeStorageSync(REDIRECT_AFTER_LOGIN_KEY)
  }
  return redirectUrl
}

export function navigateToStoredRedirect() {
  const redirectUrl = consumeRedirectAfterLogin()
  if (!redirectUrl || redirectUrl.startsWith(USER_TAB_URL)) return false
  navigateToUrl(redirectUrl)
  return true
}

export function redirectToLoginTab(message = '请先登录后使用') {
  if (isHandlingAuthError) return

  const currentUrl = getCurrentPageUrl()
  if (currentUrl && !currentUrl.startsWith(USER_TAB_URL)) {
    uni.setStorageSync(REDIRECT_AFTER_LOGIN_KEY, currentUrl)
  }

  isHandlingAuthError = true
  uni.showToast({ title: message, icon: 'none' })
  uni.switchTab({
    url: USER_TAB_URL,
    fail: () => {
      uni.reLaunch({ url: USER_TAB_URL })
    },
    complete: () => {
      setTimeout(() => {
        isHandlingAuthError = false
      }, 1000)
    }
  })
}

export function request<T = any>(config: RequestConfig): Promise<T> {
  const {
    url,
    method = 'GET',
    data,
    header = {},
    showLoading = false,
    showError = true
  } = config

  if (!BASE_URL) {
    const errMsg = 'API 地址未配置，请在 .env.production 中设置 VITE_API_BASE_URL'
    console.error(`[baby-mall] ${errMsg}`)
    uni.showToast({ title: errMsg, icon: 'none', duration: 3000 })
    return Promise.reject(new Error(errMsg))
  }

  if (showLoading) {
    uni.showLoading({ title: '加载中...', mask: true })
  }

  const token = getToken()
  if (token) {
    header['Authorization'] = `Bearer ${token}`
  }

  const fullUrl = `${BASE_URL}${url}`

  return new Promise<T>((resolve, reject) => {
    uni.request({
      url: fullUrl,
      method,
      data,
      header: {
        'Content-Type': 'application/json',
        ...header
      },
      success: (res) => {
        if (showLoading) {
          uni.hideLoading()
        }

        const response = res.data as ApiResponse<T>

        const requestId = response.requestId || (res.header as any)?.['X-Request-Id'] || (res.header as any)?.['x-request-id']

        if (response.code === 0) {
          resolve(response.data)
        } else if (AUTH_ERROR_CODES.includes(response.code)) {
          removeToken()
          redirectToLoginTab('登录已过期，请重新登录')
          reject(new Error('登录已过期，请重新登录'))
        } else {
          const errMsg = response.message || '请求失败'
          console.error(`[baby-mall] API error: ${method} ${fullUrl} code=${response.code} requestId=${requestId || '-'} message=${errMsg}`)
          if (showError) {
            uni.showToast({
              title: errMsg,
              icon: 'none',
              duration: 2000
            })
          }
          reject(new Error(errMsg))
        }
      },
      fail: (err) => {
        if (showLoading) {
          uni.hideLoading()
        }
        console.error(`[baby-mall] Network error: ${method} ${fullUrl}`, err.errMsg || err)
        if (showError) {
          uni.showToast({
            title: '网络异常，请稍后重试',
            icon: 'none',
            duration: 2000
          })
        }
        reject(err)
      }
    })
  })
}

export function get<T = any>(url: string, data?: any, config?: Partial<RequestConfig>): Promise<T> {
  return request<T>({ url, method: 'GET', data, ...config })
}

export function post<T = any>(url: string, data?: any, config?: Partial<RequestConfig>): Promise<T> {
  return request<T>({ url, method: 'POST', data, ...config })
}

export function put<T = any>(url: string, data?: any, config?: Partial<RequestConfig>): Promise<T> {
  return request<T>({ url, method: 'PUT', data, ...config })
}

export function del<T = any>(url: string, data?: any, config?: Partial<RequestConfig>): Promise<T> {
  return request<T>({ url, method: 'DELETE', data, ...config })
}
