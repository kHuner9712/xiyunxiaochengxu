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

const BASE_URL = import.meta.env.VITE_API_BASE_URL || ''
const TOKEN_KEY = 'baby_mall_token'
const AUTH_ERROR_CODES = [40101, 40102, 40103]
let isHandlingAuthError = false

if (!BASE_URL) {
  console.error('[baby-mall] VITE_API_BASE_URL 未配置，所有 API 请求将失败')
}

function getToken(): string {
  return uni.getStorageSync(TOKEN_KEY) || ''
}

export function setToken(token: string) {
  uni.setStorageSync(TOKEN_KEY, token)
}

export function removeToken() {
  uni.removeStorageSync(TOKEN_KEY)
}

function navigateToLogin() {
  const pages = getCurrentPages()
  const currentPage = pages[pages.length - 1]
  if (currentPage && currentPage.route !== 'pages/user/index' && !isHandlingAuthError) {
    isHandlingAuthError = true
    uni.navigateTo({
      url: '/pages/user/index?needLogin=true',
      complete: () => {
        setTimeout(() => {
          isHandlingAuthError = false
        }, 1000)
      }
    })
  }
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
          navigateToLogin()
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
