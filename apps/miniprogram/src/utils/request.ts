interface ApiResponse<T = any> {
  code: number
  message: string
  data: T
  requestId?: string
}

type RequestMethod = 'GET' | 'POST' | 'PUT' | 'DELETE'

interface RequestConfig {
  url: string
  method?: RequestMethod
  data?: any
  header?: Record<string, string>
  showLoading?: boolean
  showError?: boolean
  timeout?: number
}

function normalizeApiBaseUrl(raw: string): string {
  if (!raw) return ''
  const url = raw.replace(/\/+$/, '')
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
export const AUTH_EXPIRED_EVENT = 'baby-mall:auth-expired'
const USER_TAB_URL = '/pages/user/index'
const TAB_BAR_ROUTES = new Set([
  'pages/home/index',
  'pages/category/index',
  'pages/activity/index',
  'pages/cart/index',
  'pages/user/index'
])
const AUTH_ERROR_CODES = new Set([40101, 40102, 40103])
const DEFAULT_TIMEOUT = 15000
let isHandlingAuthError = false
let loadingRequestCount = 0

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

function notifyAuthExpired() {
  try {
    uni.$emit(AUTH_EXPIRED_EVENT)
  } catch (err) {
    console.warn('[baby-mall] failed to broadcast auth expiration:', err)
  }
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

function beginLoading() {
  loadingRequestCount += 1
  if (loadingRequestCount === 1) {
    uni.showLoading({ title: '加载中...', mask: true })
  }
}

function endLoading() {
  if (loadingRequestCount <= 0) return
  loadingRequestCount -= 1
  if (loadingRequestCount === 0) {
    uni.hideLoading()
  }
}

function normalizeMessage(value: unknown): string | undefined {
  if (typeof value === 'string') {
    const text = value.trim()
    return text || undefined
  }
  if (Array.isArray(value)) {
    const text = value.map(item => String(item).trim()).filter(Boolean).join('；')
    return text || undefined
  }
  return undefined
}

function fallbackMessageForStatus(statusCode: number): string {
  if (statusCode === 403) return '暂无权限执行此操作'
  if (statusCode === 404) return '请求的内容不存在'
  if (statusCode === 429) return '操作过于频繁，请稍后再试'
  if (statusCode >= 500) return '服务暂时不可用，请稍后重试'
  return '请求失败，请稍后重试'
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
    showError = true,
    timeout = DEFAULT_TIMEOUT
  } = config

  if (!BASE_URL) {
    const errMsg = 'API 地址未配置，请联系管理员'
    console.error('[baby-mall] VITE_API_BASE_URL 未配置')
    uni.showToast({ title: errMsg, icon: 'none', duration: 3000 })
    return Promise.reject(new Error(errMsg))
  }

  if (showLoading) beginLoading()

  const requestHeader: Record<string, string> = { ...header }
  const token = getToken()
  if (token) {
    requestHeader.Authorization = `Bearer ${token}`
  }

  const fullUrl = `${BASE_URL}${url}`

  return new Promise<T>((resolve, reject) => {
    uni.request({
      url: fullUrl,
      method,
      data,
      timeout,
      header: {
        'Content-Type': 'application/json',
        ...requestHeader
      },
      success: (res) => {
        const statusCode = Number(res.statusCode || 0)
        const payload = res.data && typeof res.data === 'object'
          ? res.data as Partial<ApiResponse<T>>
          : null
        const responseCode = typeof payload?.code === 'number' ? payload.code : undefined
        const requestId = payload?.requestId || (res.header as any)?.['X-Request-Id'] || (res.header as any)?.['x-request-id']

        if (statusCode === 401 || (responseCode !== undefined && AUTH_ERROR_CODES.has(responseCode))) {
          removeToken()
          notifyAuthExpired()
          redirectToLoginTab('登录已过期，请重新登录')
          reject(new Error('登录已过期，请重新登录'))
          return
        }

        if (statusCode >= 200 && statusCode < 300 && responseCode === 0) {
          resolve(payload?.data as T)
          return
        }

        const errMsg = normalizeMessage(payload?.message) || fallbackMessageForStatus(statusCode)
        console.error(
          `[baby-mall] API error: ${method} ${fullUrl} status=${statusCode || '-'} code=${responseCode ?? '-'} requestId=${requestId || '-'} message=${errMsg}`
        )
        if (showError) {
          uni.showToast({ title: errMsg, icon: 'none', duration: 2000 })
        }
        reject(new Error(errMsg))
      },
      fail: (err) => {
        const detail = String((err as any)?.errMsg || err || '')
        const errMsg = /timeout/i.test(detail) ? '请求超时，请稍后重试' : '网络异常，请稍后重试'
        console.error(`[baby-mall] Network error: ${method} ${fullUrl}`, detail)
        if (showError) {
          uni.showToast({ title: errMsg, icon: 'none', duration: 2000 })
        }
        reject(new Error(errMsg))
      },
      complete: () => {
        if (showLoading) endLoading()
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
