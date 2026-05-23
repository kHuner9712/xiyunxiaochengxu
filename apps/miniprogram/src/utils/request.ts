interface ApiResponse<T = any> {
  code: number
  message: string
  data: T
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

const IS_PRODUCTION = import.meta.env.PROD

if (IS_PRODUCTION && !BASE_URL) {
  throw new Error('[baby-mall] VITE_API_BASE_URL 未配置，生产构建必须设置完整的 https:// 域名')
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
  if (currentPage && currentPage.route !== 'pages/user/index') {
    uni.navigateTo({
      url: '/pages/user/index?needLogin=true'
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
    uni.showToast({ title: 'API 地址未配置', icon: 'none', duration: 2000 })
    return Promise.reject(new Error('API 地址未配置'))
  }

  if (showLoading) {
    uni.showLoading({ title: '加载中...', mask: true })
  }

  const token = getToken()
  if (token) {
    header['Authorization'] = `Bearer ${token}`
  }

  return new Promise<T>((resolve, reject) => {
    uni.request({
      url: `${BASE_URL}${url}`,
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

        if (response.code === 0) {
          resolve(response.data)
        } else if (response.code === 40101 || response.code === 40102 || response.code === 40103) {
          removeToken()
          navigateToLogin()
          reject(new Error('登录已过期，请重新登录'))
        } else {
          if (showError) {
            uni.showToast({
              title: response.message || '请求失败',
              icon: 'none',
              duration: 2000
            })
          }
          reject(new Error(response.message || '请求失败'))
        }
      },
      fail: (err) => {
        if (showLoading) {
          uni.hideLoading()
        }
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
